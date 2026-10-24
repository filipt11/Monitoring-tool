from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import numpy as np
import pandas as pd
from influxdb_client import InfluxDBClient

from anomaly_detector.config import (
    INFLUX_BUCKET,
    INFLUX_ORG,
    INFLUX_TOKEN,
    INFLUX_URL,
    POLLING_INTERVAL_SEC,
)

DetectorKind = Literal["ewma", "cusum"]
ScopeKind = Literal["device", "interface"]

METRIC_SPECS: dict[str, tuple[str, ScopeKind, list[str]]] = {
    "cpu_usage": ("device_statistics", "device", ["hostname"]),
    "memory_usage_pct": ("device_statistics", "device", ["hostname"]),
    "in_util_pct": ("interface_statistics", "interface", ["hostname", "if_name"]),
    "out_util_pct": ("interface_statistics", "interface", ["hostname", "if_name"]),
}
"""Mapping of metric name → (Influx measurement, scope, group-by columns)."""

CUSUM_EPISODE_GAP = timedelta(seconds=POLLING_INTERVAL_SEC * 1.5)
"""Maximum gap between consecutive CUSUM flags that still belong to one episode."""


@dataclass(frozen=True)
class MetricSeriesSpec:
    """Describes one metric series used by the detectors."""

    metric: str
    measurement: str
    scope: ScopeKind
    group_columns: list[str]


def ensure_utc(dt: datetime) -> datetime:
    """Normalize datetimes to UTC (naive values are treated as UTC)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_flux_time(dt: datetime) -> str:
    """Format for Influx Flux range(...)."""
    return ensure_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")


def to_iso_z(dt: datetime) -> str:
    """ISO-8601 UTC string with trailing Z (for JSON responses)."""
    return ensure_utc(dt).isoformat().replace("+00:00", "Z")


class InfluxMetricStore:
    """Thin wrapper around the InfluxDB query API for metric time series."""

    def __init__(self) -> None:
        self.client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        self.query_api = self.client.query_api()

    def fetch_metric_data(
        self,
        measurement: str,
        field: str,
        start: datetime,
        end: datetime,
        hostname: str | None = None,
    ) -> pd.DataFrame:
        """
        Query a single field from a measurement over ``[start, end]``.

        Returns a DataFrame sorted by hostname / interface / time, with the
        metric value in column ``_value``. Optional ``hostname`` is a
        case-insensitive substring filter.
        """
        start_flux = to_flux_time(start)
        end_flux = to_flux_time(end)

        query = f'''
            from(bucket: "{INFLUX_BUCKET}")
              |> range(start: time(v: "{start_flux}"), stop: time(v: "{end_flux}"))
              |> filter(fn: (r) => r["_measurement"] == "{measurement}")
              |> filter(fn: (r) => r["_field"] == "{field}")
              |> drop(columns: ["_start", "_stop"])
              |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        result = self.query_api.query_data_frame(query)

        if isinstance(result, list):
            if not result:
                return pd.DataFrame()
            df = pd.concat(result, ignore_index=True)
        else:
            df = result

        if df.empty:
            return df

        df["_time"] = pd.to_datetime(df["_time"], utc=True)

        if hostname and "hostname" in df.columns:
            needle = hostname.strip().lower()
            if needle:
                df = df[df["hostname"].astype(str).str.lower().str.contains(needle, regex=False)]
                if df.empty:
                    return df

        sort_cols = ["hostname"]
        if "if_name" in df.columns:
            sort_cols.append("if_name")
        sort_cols.append("_time")

        df = df.sort_values(by=sort_cols).reset_index(drop=True)

        if field in df.columns:
            df = df.rename(columns={field: "_value"})

        return df


def detect_anomalies_ewma_cusum(
    group: pd.DataFrame,
    span: int = 7,
    ewma_std: float = 2.5,
    cusum_k: float = 1.0,
    cusum_h: float = 5.0,
) -> pd.DataFrame:
    """Annotate one device/interface series with EWMA and CUSUM anomaly flags.

    Args:
        group: Time-ordered samples with column ``_value``.
        span: EWMA span (samples) for mean and deviation.
        ewma_std: Multiplier for the EWMA band width (``mean ± ewma_std * std``).
        cusum_k: Allowance (slack) subtracted from each z-score step in CUSUM.
        cusum_h: Decision threshold for the high / low CUSUM accumulators.

    Returns:
        Copy of ``group`` with columns ``ewma``, ``std_dev``, bounds,
        ``ewma_anomaly``, ``cusum_sh``, ``cusum_sl``, and ``cusum_anomaly``.
    """
    group = group.copy()
    group["ewma"] = group["_value"].ewm(span=span).mean().shift(1)
    group["std_dev"] = group["_value"].ewm(span=span).std().shift(1)

    group["ewma"] = group["ewma"].bfill().fillna(group["_value"])
    group["std_dev"] = group["std_dev"].bfill().fillna(0)
    group["std_dev"] = np.where(group["std_dev"] < 1.0, 1.0, group["std_dev"])

    group["upper_bound"] = group["ewma"] + (ewma_std * group["std_dev"])
    group["lower_bound"] = group["ewma"] - (ewma_std * group["std_dev"])

    group["ewma_anomaly"] = (
        (group["_value"] > group["upper_bound"]) | (group["_value"] < group["lower_bound"])
    ).astype(int)

    min_threshold = 15.0
    group["ewma_anomaly"] = np.where(
        (group["ewma_anomaly"] == 1)
        & ((group["_value"] > min_threshold) | (group["ewma"] > min_threshold)),
        1,
        0,
    )
    group.iloc[:3, group.columns.get_loc("ewma_anomaly")] = 0

    target_mean = group["_value"].rolling(window=10, min_periods=1).mean().shift(1).bfill()
    target_std = group["_value"].rolling(window=10, min_periods=1).std().shift(1).bfill()
    target_std = np.where(target_std < 1.0, 1.0, target_std)
    z_scores = (group["_value"] - target_mean) / target_std

    sh = np.zeros(len(group))
    sl = np.zeros(len(group))
    z_values = z_scores.values
    for i in range(1, len(z_values)):
        sh[i] = max(0, sh[i - 1] + z_values[i] - cusum_k)
        sl[i] = min(0, sl[i - 1] + z_values[i] + cusum_k)

    group["cusum_sh"] = sh
    group["cusum_sl"] = sl
    group["cusum_anomaly"] = (
        (group["cusum_sh"] > cusum_h) | (group["cusum_sl"] < -cusum_h)
    ).astype(int)

    burn_in_period = 10
    if len(group) > burn_in_period:
        group.iloc[:burn_in_period, group.columns.get_loc("cusum_anomaly")] = 0
        group.iloc[:burn_in_period, group.columns.get_loc("ewma_anomaly")] = 0
    else:
        group["cusum_anomaly"] = 0
        group["ewma_anomaly"] = 0

    return group


def apply_anomaly_detection(df: pd.DataFrame, group_columns: list[str]) -> pd.DataFrame:

    """Run :func:`detect_anomalies_ewma_cusum` independently on each group."""

    if df is None or df.empty:
        return df

    analyzed_groups = []
    for _, group in df.groupby(group_columns):
        analyzed_groups.append(detect_anomalies_ewma_cusum(group.copy()))

    return pd.concat(analyzed_groups, ignore_index=True)


def build_anomaly_item(
    spec: MetricSeriesSpec,
    row: pd.Series,
    detector: DetectorKind,
    start_time: datetime,
    end_time: datetime,
    value: float,
    peak_value: float,
    sample_count: int,
) -> dict[str, Any]:
    
    """Build one JSON-serializable anomaly dict for the API response.
    """
    item: dict[str, Any] = {
        "detector": detector,
        "scope": spec.scope,
        "metric": spec.metric,
        "hostname": row["hostname"],
        "ifName": row["if_name"] if spec.scope == "interface" and "if_name" in row else None,
        "startTime": to_iso_z(start_time),
        "endTime": to_iso_z(end_time),
        "value": round(float(value), 6),
        "peakValue": round(float(peak_value), 6),
        "sampleCount": sample_count,
    }
    if detector == "cusum":
        item["cusumSh"] = round(float(row["cusum_sh"]), 6)
        item["cusumSl"] = round(float(row["cusum_sl"]), 6)
    return item


def collect_ewma_items(spec: MetricSeriesSpec, analyzed: pd.DataFrame) -> list[dict[str, Any]]:

    """Convert EWMA-flagged samples into point anomaly items."""

    flagged = analyzed[analyzed["ewma_anomaly"] == 1]
    items: list[dict[str, Any]] = []
    for _, row in flagged.iterrows():
        ts = ensure_utc(row["_time"].to_pydatetime())
        val = float(row["_value"])
        items.append(build_anomaly_item(spec, row, "ewma", ts, ts, val, val, 1))
    return items


def collect_cusum_items(
    spec: MetricSeriesSpec,
    analyzed: pd.DataFrame,
    merge_episodes: bool,
) -> list[dict[str, Any]]:
    """
    Convert CUSUM flags into anomaly items.

    When ``merge_episodes`` is true, consecutive flags within
    :data:`CUSUM_EPISODE_GAP` form one sustained episode.
    """
    flagged = analyzed[analyzed["cusum_anomaly"] == 1].copy()
    if flagged.empty:
        return []

    items: list[dict[str, Any]] = []

    for _, series in flagged.groupby(spec.group_columns, sort=False):
        series = series.sort_values("_time")
        if not merge_episodes:
            for _, row in series.iterrows():
                ts = ensure_utc(row["_time"].to_pydatetime())
                val = float(row["_value"])
                items.append(build_anomaly_item(spec, row, "cusum", ts, ts, val, val, 1))
            continue

        episode_rows: list[pd.Series] = []
        episode_start: datetime | None = None
        last_time: datetime | None = None

        def flush_episode() -> None:
            nonlocal episode_rows, episode_start, last_time
            if not episode_rows or episode_start is None or last_time is None:
                episode_rows = []
                episode_start = None
                last_time = None
                return
            # Single CUSUM hits stay EWMA-only in the UI.
            if len(episode_rows) < 2:
                episode_rows = []
                episode_start = None
                last_time = None
                return
            values = [float(r["_value"]) for r in episode_rows]
            peak_idx = int(np.argmax(values))
            anchor = episode_rows[peak_idx]
            items.append(
                build_anomaly_item(
                    spec,
                    anchor,
                    "cusum",
                    episode_start,
                    last_time,
                    values[-1],
                    max(values),
                    len(episode_rows),
                )
            )
            episode_rows = []
            episode_start = None
            last_time = None

        for _, row in series.iterrows():
            ts = ensure_utc(row["_time"].to_pydatetime())
            if episode_start is None:
                episode_start = ts
                last_time = ts
                episode_rows = [row]
                continue
            assert last_time is not None
            if ts - last_time > CUSUM_EPISODE_GAP:
                flush_episode()
                episode_start = ts
                episode_rows = [row]
            else:
                episode_rows.append(row)
            last_time = ts

        flush_episode()

    return items


def parse_item_time(value: str) -> datetime:
    return ensure_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))


def item_overlaps_display(
    item: dict[str, Any],
    display_start: datetime,
    display_end: datetime,
) -> bool:
    item_start = parse_item_time(item["startTime"])
    item_end = parse_item_time(item["endTime"])
    return item_end >= display_start and item_start <= display_end


def detect_anomalies_for_range(
    store: InfluxMetricStore,
    compute_start: datetime,
    compute_end: datetime,
    metrics: list[str],
    detectors: list[DetectorKind],
    hostname: str | None,
    merge_cusum_episodes: bool,
    display_start: datetime | None = None,
    display_end: datetime | None = None,
) -> list[dict[str, Any]]:
    """
    Run detection on [compute_start, compute_end], optionally keeping only items
    that overlap [display_start, display_end].
    """
    items: list[dict[str, Any]] = []

    for metric in metrics:
        measurement, scope, group_columns = METRIC_SPECS[metric]
        spec = MetricSeriesSpec(metric, measurement, scope, group_columns)
        df = store.fetch_metric_data(
            measurement, metric, compute_start, compute_end, hostname=hostname
        )
        if df.empty:
            continue

        analyzed = apply_anomaly_detection(df, group_columns)
        if analyzed.empty:
            continue

        if "ewma" in detectors:
            items.extend(collect_ewma_items(spec, analyzed))
        if "cusum" in detectors:
            items.extend(collect_cusum_items(spec, analyzed, merge_cusum_episodes))

    if display_start is not None and display_end is not None:
        items = [
            item
            for item in items
            if item_overlaps_display(item, display_start, display_end)
        ]

    items.sort(key=lambda x: x["startTime"], reverse=True)
    return items

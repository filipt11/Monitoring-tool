import argparse
import warnings
from datetime import datetime, timedelta, timezone

import pandas as pd

from anomaly_detector.config import CONTEXT_LOOKBACK_HOURS, INFLUX_BUCKET
from anomaly_detector.logic import (
    InfluxMetricStore,
    apply_anomaly_detection,
    ensure_utc,
    to_flux_time,
)

try:
    from influxdb_client.client.warnings import MissingPivotFunction
except ImportError:
    MissingPivotFunction = None

if isinstance(MissingPivotFunction, type) and issubclass(MissingPivotFunction, Warning):
    warnings.simplefilter("ignore", MissingPivotFunction)


def fetch_cpu_with_ground_truth(
    store: InfluxMetricStore,
    start: datetime,
    end: datetime,
    hostname_substr: str | None = None,
) -> pd.DataFrame:

    start_flux = to_flux_time(start)
    end_flux = to_flux_time(end)

    query = f'''
        from(bucket: "{INFLUX_BUCKET}")
          |> range(start: time(v: "{start_flux}"), stop: time(v: "{end_flux}"))
          |> filter(fn: (r) => r["_measurement"] == "device_statistics")
          |> filter(fn: (r) =>
              r["_field"] == "cpu_usage" or
              r["_field"] == "sim_anomaly" or
              r["_field"] == "sim_event"
          )
          |> drop(columns: ["_start", "_stop"])
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    result = store.query_api.query_data_frame(query)
    if isinstance(result, list):
        if not result:
            return pd.DataFrame()
        df = pd.concat(result, ignore_index=True)
    else:
        df = result

    if df.empty:
        return df

    df["_time"] = pd.to_datetime(df["_time"], utc=True)

    if "cpu_usage" in df.columns:
        df = df.rename(columns={"cpu_usage": "_value"})

    if "_value" not in df.columns:
        return pd.DataFrame()

    if "sim_anomaly" not in df.columns:
        df["sim_anomaly"] = 0
    if "sim_event" not in df.columns:
        df["sim_event"] = "none"

    df["sim_anomaly"] = pd.to_numeric(df["sim_anomaly"], errors="coerce").fillna(0).astype(int)
    df["sim_event"] = df["sim_event"].fillna("none").astype(str)

    if hostname_substr:
        needle = hostname_substr.strip().lower()
        df = df[df["hostname"].astype(str).str.lower().str.contains(needle, regex=False)]

    return df.sort_values(["hostname", "_time"]).reset_index(drop=True)


def scores(y_true: pd.Series, y_pred: pd.Series) -> dict[str, float]:

    """Compute TP/FP/FN, precision, recall, and F1 for binary series."""

    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall)
        else 0.0
    )
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def compute_window(display_start: datetime, display_end: datetime) -> tuple[datetime, datetime]:

    """Same rule as the API: at least CONTEXT_LOOKBACK_HOURS ending at display_end."""

    display_span = display_end - display_start
    context_span = timedelta(hours=CONTEXT_LOOKBACK_HOURS)
    compute_span = max(display_span, context_span)
    return display_end - compute_span, display_end


def run_evaluation(hours: float, hostname: str | None) -> None:

    """Detect on the API context window, then print scores for the last ``hours``."""

    display_end = datetime.now(timezone.utc)
    display_start = display_end - timedelta(hours=hours)
    compute_start, compute_end = compute_window(display_start, display_end)
    store = InfluxMetricStore()

    print(
        f"Score window:   {ensure_utc(display_start).isoformat()} → "
        f"{ensure_utc(display_end).isoformat()}  (--hours {hours})"
    )
    print(
        f"Compute window: {ensure_utc(compute_start).isoformat()} → "
        f"{ensure_utc(compute_end).isoformat()}  "
        f"(context ≥ {CONTEXT_LOOKBACK_HOURS}h, same as API)"
    )
    if hostname:
        print(f"Hostname filter (substring): {hostname!r}")

    df = fetch_cpu_with_ground_truth(store, compute_start, compute_end, hostname)
    if df.empty:
        print("No CPU points in the compute window.")
        return

    analyzed = apply_anomaly_detection(df, group_columns=["hostname"])
    if analyzed.empty:
        print("Detection produced an empty frame.")
        return

    display_mask = (analyzed["_time"] >= pd.Timestamp(display_start)) & (
        analyzed["_time"] <= pd.Timestamp(display_end)
    )
    scored = analyzed.loc[display_mask].copy()
    if scored.empty:
        print("No CPU points in the score window after detection.")
        return

    y_true = (scored["sim_anomaly"] == 1).astype(int)
    y_true = y_true | scored["sim_event"].isin(["spike", "drop"]).astype(int)
    with_gt = int(y_true.sum())

    print(f"CPU samples (score window): {len(scored)}  |  compute samples: {len(analyzed)}")
    print(f"Ground-truth spike/drop points (score window): {with_gt}")
    if with_gt == 0:
        print(
            "\nNo sim_event/sim_anomaly labels in the score window.\n"
            "Restart simulators + poller so new points include ground truth, "
            "then wait for a few poll cycles and re-run."
        )
        return

    ewma_scores = scores(y_true, scored["ewma_anomaly"].astype(int))
    cusum_scores = scores(y_true, scored["cusum_anomaly"].astype(int))

    print("\n=== EWMA vs simulator ground truth (point-level, score window) ===")
    print(
        f"TP={ewma_scores['tp']}  FP={ewma_scores['fp']}  FN={ewma_scores['fn']}  "
        f"precision={ewma_scores['precision']:.3f}  "
        f"recall={ewma_scores['recall']:.3f}  F1={ewma_scores['f1']:.3f}"
    )

    print("\n=== CUSUM vs same ground truth (note: CUSUM targets level shifts) ===")
    print(
        f"TP={cusum_scores['tp']}  FP={cusum_scores['fp']}  FN={cusum_scores['fn']}  "
        f"precision={cusum_scores['precision']:.3f}  "
        f"recall={cusum_scores['recall']:.3f}  F1={cusum_scores['f1']:.3f}"
    )

    missed = scored[(y_true == 1) & (scored["ewma_anomaly"] == 0)].copy()
    false_pos = scored[(y_true == 0) & (scored["ewma_anomaly"] == 1)].copy()
    hits = scored[(y_true == 1) & (scored["ewma_anomaly"] == 1)].copy()

    cols = ["hostname", "_time", "_value", "sim_event", "ewma_anomaly", "cusum_anomaly"]

    print(f"\n=== Simulator spike/drop DETECTED by EWMA ({len(hits)}) ===")
    if hits.empty:
        print("(none)")
    else:
        print(hits[cols].to_string(index=False))

    print(f"\n=== Simulator spike/drop MISSED by EWMA ({len(missed)}) ===")
    if missed.empty:
        print("(none)")
    else:
        print(missed[cols].to_string(index=False))

    print(f"\n=== EWMA alerts without simulator event — false positives ({len(false_pos)}) ===")
    if false_pos.empty:
        print("(none)")
    else:
        print(false_pos[cols].head(40).to_string(index=False))
        if len(false_pos) > 40:
            print(f"... and {len(false_pos) - 40} more")

    by_type = (
        scored[y_true == 1]
        .groupby("sim_event")
        .agg(
            total=("_value", "count"),
            ewma_caught=("ewma_anomaly", "sum"),
        )
    )
    if not by_type.empty:
        print("\n=== Miss rate by sim_event type (EWMA) ===")
        by_type["missed"] = by_type["total"] - by_type["ewma_caught"]
        by_type["catch_rate"] = by_type["ewma_caught"] / by_type["total"]
        print(by_type.to_string())


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate anomaly detection against simulator ground truth in Influx. "
            "Uses the same context lookback as the API"
        )
    )
    parser.add_argument(
        "--hours",
        type=float,
        default=12.0,
        help="Score/display window in hours. Detection always uses ≥12h context.",
    )
    parser.add_argument(
        "--hostname",
        type=str,
        default=None,
        help="Optional hostname substring filter (e.g. low, avg).",
    )
    args = parser.parse_args()
    run_evaluation(hours=args.hours, hostname=args.hostname)


if __name__ == "__main__":
    main()

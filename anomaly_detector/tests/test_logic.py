"""Fast unit tests for anomaly_detector.logic (no InfluxDB required)."""

from datetime import datetime, timedelta, timezone

import pandas as pd

from anomaly_detector.logic import (
    MetricSeriesSpec,
    apply_anomaly_detection,
    collect_cusum_items,
    collect_ewma_items,
    detect_anomalies_ewma_cusum,
    ensure_utc,
    item_overlaps_display,
    to_flux_time,
    to_iso_z,
)


def _series(values: list[float], hostname: str = "r1") -> pd.DataFrame:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return pd.DataFrame(
        {
            "_time": [start + timedelta(minutes=5 * i) for i in range(len(values))],
            "_value": values,
            "hostname": hostname,
        }
    )


def test_ensure_utc_naive_assumed_utc():
    naive = datetime(2024, 6, 1, 12, 0, 0)
    assert ensure_utc(naive).tzinfo == timezone.utc


def test_ensure_utc_converts_aware():
    warsaw_like = datetime(2024, 6, 1, 14, 0, tzinfo=timezone(timedelta(hours=2)))
    got = ensure_utc(warsaw_like)
    assert got.tzinfo == timezone.utc
    assert got.hour == 12


def test_to_iso_z_and_flux_time():
    dt = datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    assert to_iso_z(dt) == "2024-01-02T03:04:05Z"
    assert to_flux_time(dt) == "2024-01-02T03:04:05Z"


def test_stable_series_has_no_anomalies_after_burn_in():
    values = [20.0 + (i % 3) * 0.2 for i in range(40)]
    result = detect_anomalies_ewma_cusum(_series(values))
    after_burn_in = result.iloc[10:]
    assert after_burn_in["ewma_anomaly"].sum() == 0
    assert after_burn_in["cusum_anomaly"].sum() == 0


def test_short_series_is_all_zeros():
    result = detect_anomalies_ewma_cusum(_series([20.0, 90.0, 20.0]))
    assert result["ewma_anomaly"].sum() == 0
    assert result["cusum_anomaly"].sum() == 0


def test_ewma_detects_spike():
    values = [20.0] * 25 + [95.0] + [20.0] * 5
    result = detect_anomalies_ewma_cusum(_series(values))
    assert result["ewma_anomaly"].sum() >= 1
    assert int(result.loc[25, "ewma_anomaly"]) == 1


def test_cusum_detects_level_shift():
    values = [20.0] * 20 + [80.0] * 25
    result = detect_anomalies_ewma_cusum(_series(values))
    assert result["cusum_anomaly"].sum() >= 2


def test_apply_anomaly_detection_empty():
    empty = pd.DataFrame()
    assert apply_anomaly_detection(empty, ["hostname"]).empty
    assert apply_anomaly_detection(None, ["hostname"]) is None


def test_apply_anomaly_detection_per_hostname():
    left = _series([20.0] * 25 + [95.0], hostname="a")
    right = _series([20.0] * 26, hostname="b")
    df = pd.concat([left, right], ignore_index=True)
    result = apply_anomaly_detection(df, ["hostname"])
    assert set(result["hostname"]) == {"a", "b"}
    assert result.loc[result["hostname"] == "a", "ewma_anomaly"].sum() >= 1
    assert result.loc[result["hostname"] == "b", "ewma_anomaly"].sum() == 0


def test_collect_ewma_items():
    values = [20.0] * 25 + [95.0]
    analyzed = detect_anomalies_ewma_cusum(_series(values))
    spec = MetricSeriesSpec("cpu_usage", "device_statistics", "device", ["hostname"])
    items = collect_ewma_items(spec, analyzed)
    assert len(items) >= 1
    assert items[0]["detector"] == "ewma"
    assert items[0]["sampleCount"] == 1
    assert items[0]["startTime"] == items[0]["endTime"]


def test_collect_cusum_merges_episode_and_skips_singleton():
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    # One isolated flag → discarded when merge_episodes=True
    # Then three consecutive flags → one episode
    rows = []
    for i, (val, flag) in enumerate(
        [
            (20.0, 0),
            (80.0, 1),  # singleton
            (20.0, 0),
            (80.0, 1),
            (85.0, 1),
            (90.0, 1),
        ]
    ):
        rows.append(
            {
                "_time": start + timedelta(minutes=5 * i),
                "_value": val,
                "hostname": "r1",
                "cusum_anomaly": flag,
                "cusum_sh": 6.0 if flag else 0.0,
                "cusum_sl": 0.0,
            }
        )
    analyzed = pd.DataFrame(rows)
    spec = MetricSeriesSpec("cpu_usage", "device_statistics", "device", ["hostname"])

    merged = collect_cusum_items(spec, analyzed, merge_episodes=True)
    assert len(merged) == 1
    assert merged[0]["sampleCount"] == 3
    assert merged[0]["peakValue"] == 90.0
    assert merged[0]["detector"] == "cusum"

    unmerged = collect_cusum_items(spec, analyzed, merge_episodes=False)
    assert len(unmerged) == 4


def test_item_overlaps_display():
    item = {
        "startTime": "2024-01-01T12:00:00Z",
        "endTime": "2024-01-01T12:30:00Z",
    }
    window_start = datetime(2024, 1, 1, 12, 15, tzinfo=timezone.utc)
    window_end = datetime(2024, 1, 1, 13, 0, tzinfo=timezone.utc)
    assert item_overlaps_display(item, window_start, window_end)

    far_start = datetime(2024, 1, 1, 14, 0, tzinfo=timezone.utc)
    far_end = datetime(2024, 1, 1, 15, 0, tzinfo=timezone.utc)
    assert not item_overlaps_display(item, far_start, far_end)

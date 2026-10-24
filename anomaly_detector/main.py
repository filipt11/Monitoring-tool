from datetime import datetime, timedelta, timezone
from typing import Annotated

import uvicorn
from fastapi import FastAPI, HTTPException, Query, status

from anomaly_detector.config import (
    API_PORT,
    CONTEXT_LOOKBACK_HOURS,
    DEFAULT_LOOKBACK_HOURS,
)
from anomaly_detector.logic import (
    METRIC_SPECS,
    DetectorKind,
    InfluxMetricStore,
    detect_anomalies_for_range,
    ensure_utc,
    to_iso_z,
)

app = FastAPI(title="Anomaly detector", version="1.0.0")
store = InfluxMetricStore()

ALL_METRICS = list(METRIC_SPECS.keys())
ALL_DETECTORS: list[DetectorKind] = ["ewma", "cusum"]


def default_range() -> tuple[datetime, datetime]:

    """Return the default display window ending at now."""

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=DEFAULT_LOOKBACK_HOURS)
    return start, end


def compute_window(
    display_start: datetime,
    display_end: datetime,
) -> tuple[datetime, datetime]:
    
    """
    Expand the display range to a computation window of at least
    :data:`~anomaly_detector.config.CONTEXT_LOOKBACK_HOURS` ending at
    ``display_end``.
    """

    display_span = display_end - display_start
    context_span = timedelta(hours=CONTEXT_LOOKBACK_HOURS)
    compute_span = max(display_span, context_span)
    return display_end - compute_span, display_end


@app.get("/health")
def health() -> dict[str, str]:

    """Simple health check"""

    return {"status": "ok"}


@app.get("/anomalies")
def get_anomalies(
    start: datetime | None = None,
    end: datetime | None = None,
    metrics: Annotated[list[str] | None, Query()] = None,
    detectors: Annotated[list[str] | None, Query()] = None,
    hostname: str | None = None,
    merge_cusum_episodes: bool = True,
) -> dict:
    
    """
    Detect anomalies with a stable context window, then return only events that
    overlap the caller-selected display range [start, end].
    """
    
    if start is None and end is None:
        start, end = default_range()
    elif start is None or end is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide both start and end, or omit both to use the default lookback window.",
        )

    display_start = ensure_utc(start)
    display_end = ensure_utc(end)

    if display_end <= display_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end must be after start.",
        )

    compute_start, compute_end = compute_window(display_start, display_end)

    selected_metrics = metrics or ALL_METRICS
    unknown_metrics = [m for m in selected_metrics if m not in METRIC_SPECS]
    if unknown_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown metrics: {', '.join(unknown_metrics)}. Allowed: {', '.join(ALL_METRICS)}.",
        )

    selected_detectors_raw = detectors or ALL_DETECTORS
    selected_detectors: list[DetectorKind] = []
    for d in selected_detectors_raw:
        if d not in ALL_DETECTORS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown detector: {d}. Allowed: ewma, cusum.",
            )
        selected_detectors.append(d)  # type: ignore[arg-type]

    if not selected_detectors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one detector is required.",
        )

    items = detect_anomalies_for_range(
        store,
        compute_start,
        compute_end,
        selected_metrics,
        selected_detectors,
        hostname.strip() if hostname else None,
        merge_cusum_episodes,
        display_start=display_start,
        display_end=display_end,
    )

    return {
        "start": to_iso_z(display_start),
        "end": to_iso_z(display_end),
        "computeStart": to_iso_z(compute_start),
        "computeEnd": to_iso_z(compute_end),
        "defaultLookbackHours": DEFAULT_LOOKBACK_HOURS,
        "contextLookbackHours": CONTEXT_LOOKBACK_HOURS,
        "items": items,
    }


if __name__ == "__main__":
    uvicorn.run("anomaly_detector.main:app", host="0.0.0.0", port=API_PORT, reload=False)

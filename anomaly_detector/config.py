"""
Runtime configuration for the anomaly detector service.

Values are read from environment variables when present, with sensible
defaults for local development (InfluxDB on localhost, API on port 8010).
"""

import os

# 8001–8006 are used by local device simulators; keep detector off that range.
API_PORT = int(os.getenv("ANOMALY_DETECTOR_API_PORT", "8010"))
"""TCP port for the FastAPI anomaly detector HTTP server."""

INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
"""Base URL of the InfluxDB instance that stores polled metrics."""

INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "secret_token")
"""Authentication token for InfluxDB queries."""

INFLUX_ORG = os.getenv("INFLUX_ORG", "my_org")
"""InfluxDB organization name."""

INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "network_metrics")
"""Bucket that holds ``device_statistics`` / ``interface_statistics`` measurements."""

POLLING_INTERVAL_SEC = int(os.getenv("POLLING_INTERVAL_SEC", "300"))
"""Expected poll interval in seconds; used to merge nearby CUSUM flags into episodes."""

DEFAULT_LOOKBACK_HOURS = int(os.getenv("ANOMALY_DEFAULT_LOOKBACK_HOURS", "12"))
"""Default ``[start, end]`` window length (hours) when the client omits both parameters."""

CONTEXT_LOOKBACK_HOURS = int(os.getenv("ANOMALY_CONTEXT_LOOKBACK_HOURS", "12"))
"""Minimum computation window (hours) so EWMA/CUSUM have enough history before filtering."""

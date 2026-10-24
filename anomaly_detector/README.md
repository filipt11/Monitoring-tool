# Anomaly Detector

Python FastAPI service that reads metrics from InfluxDB and detects:

- **EWMA** — point anomalies (spikes / drops)
- **CUSUM** — sustained level shifts

Default HTTP port: `8010` (`GET /health`, `GET /anomalies`).

## Unit tests

Tests are pure unit tests (synthetic pandas series). They do **not** need InfluxDB,
Docker, or a running detector process.

### Setup (once)

From the repository root:

```bash
# Windows
py -m pip install -r anomaly_detector/requirements.txt pytest

# Linux / macOS
python -m pip install -r anomaly_detector/requirements.txt pytest
```

### Run

Always run from the **repository root** so `import anomaly_detector` resolves:

```bash
# Windows
py -m pytest anomaly_detector/tests -q

# Linux / macOS
python -m pytest anomaly_detector/tests -q
```

Verbose / single file:

```bash
py -m pytest anomaly_detector/tests/test_logic.py -v
```

### Offline evaluation (needs live Influx + simulator ground truth)

```bash
py -m anomaly_detector.evaluate --hours 12
```

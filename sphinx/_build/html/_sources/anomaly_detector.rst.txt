Anomaly Detector Module Documentation
======================================

The **Anomaly Detector** analyses polled network metrics stored in InfluxDB and
flags unusual behaviour for the Monitoring Tool UI.

It combines two classical statistical detectors:

* **EWMA** (Exponentially Weighted Moving Average) — sensitive to **point**
  anomalies such as short CPU spikes or interface utilization drops.
* **CUSUM** (Cumulative Sum) — sensitive to **sustained** level shifts that
  persist across multiple polling intervals.

The service runs as a FastAPI application (default port ``8010``). The Spring
application server proxies ``GET /api/data/anomalies`` to this service; the
React frontend presents the results on the Anomalies page and on the Main Page
summary tile.

Detection pipeline
------------------

1. Read metric series from InfluxDB (``device_statistics`` /
   ``interface_statistics``).
2. Expand the caller display window to a longer **context window** (at least
   :data:`~anomaly_detector.config.CONTEXT_LOOKBACK_HOURS`) so EWMA/CUSUM have
   enough history.
3. Run EWMA and/or CUSUM per device or interface group.
4. Merge consecutive CUSUM flags into episodes when enabled.
5. Keep only events that overlap the original display ``[start, end]`` range.

Supported metrics
-----------------

* ``cpu_usage``, ``memory_usage_pct`` (device scope)
* ``in_util_pct``, ``out_util_pct`` (interface scope)

Offline evaluation
------------------

Against simulator ground-truth labels (``sim_anomaly`` / ``sim_event``) you can
score precision, recall, and F1 with:

.. code-block:: bash

   python -m anomaly_detector.evaluate --hours 12

See :doc:`anomaly_detector/evaluate` for details.

Submodules
----------

.. toctree::
   :maxdepth: 2

   anomaly_detector/config
   anomaly_detector/logic
   anomaly_detector/main
   anomaly_detector/evaluate

Monitoring Tool Documentation
=============================

Welcome to the Monitoring Tool documentation.

This documentation is automatically generated from the source code using Sphinx.

Overview
--------

The Monitoring Tool consists of the following Python components documented here:

- **Poller**: Collects device metrics from network devices (Cisco, Juniper, etc.) and stores them in InfluxDB
- **Simulator**: Simulates network devices for testing and development purposes
- **Anomaly Detector**: Detects point (EWMA) and sustained (CUSUM) anomalies in polled metrics

Additional platform pieces (Spring Boot application server, React frontend,
PostgreSQL, InfluxDB) are orchestrated via the root ``docker-compose.yml`` and
are not covered by this autodoc tree.

Documentation Structure
------------------------
.. toctree::
   :maxdepth: 2
   :caption: Modules:

   poller
   simulator
   anomaly_detector

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

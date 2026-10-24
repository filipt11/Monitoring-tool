FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./anomaly_detector/
RUN pip install --no-cache-dir -r anomaly_detector/requirements.txt

COPY . ./anomaly_detector/

ENV PYTHONPATH=/app

EXPOSE 8010

CMD ["python", "-m", "anomaly_detector.main"]

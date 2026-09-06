FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Keep package layout so `from poller import ...` works
COPY . ./poller/

ENV PYTHONPATH=/app

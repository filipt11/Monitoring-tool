FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn

# Keep package layout so `from simulator import ...` works
COPY . ./simulator/

ENV PYTHONPATH=/app

CMD ["python", "-m", "simulator.main"]

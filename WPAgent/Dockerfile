# WPAgent (Wafer Prober Agent) - Docker image
#
# WPAgent is a pure-Python Kafka listener (main.py / WPAgent.py) that talks to
# a Sentio wafer prober over PyVISA/TCP and to the SVT Kafka bus. This image
# just needs a Python runtime + the packages in requirements.txt.

FROM python:3.12-slim

WORKDIR /app

# System libraries needed at runtime:
# - libgl1 / libglib2.0-0: required by opencv-python (cv2) even headless
# - librdkafka1: confluent-kafka's C dependency (its wheel bundles a copy, but
#   installing it here avoids surprises on architectures without a manylinux wheel)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    librdkafka1 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first so this layer is cached unless requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Now copy the actual application code
COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONNOUSERSITE=1

# Sanity check that the listener is up and heartbeating
# (see services/WPHeartbeat.py -> check_listener_health)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD python3.12 main.py check_listener_health || exit 1

ENTRYPOINT ["python3.12", "main.py"]

# Default: the mock probe station wired to the local Kafka network, so the
# image runs standalone with no real prober hardware. Override at `docker run`
# / `docker compose run` time for a real site, e.g.:
#   docker compose run wp-agent listen --config=configs/ProbeConfigCERN_DEV.json
CMD ["listen", "--config=configs/ProbeConfigMockLocal.json"]

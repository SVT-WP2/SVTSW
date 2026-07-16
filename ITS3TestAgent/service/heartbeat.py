"""Liveness heartbeat for the ITS3 TestAgent listener.

Mirrors ``WPAgent/services/WPHeartbeat.py``: a ``{timestamp}`` beat every 2s on
a short-retention topic, so the UI can tell the listener is alive without
sending a command.  ITS3's own WPAgentClient already consumes WPAgent's
heartbeat the same way.
"""

from __future__ import annotations

import json
import logging
import threading
import time

from confluent_kafka import Producer as KafkaProducer

from service.topics import (
    AGENT_NAME,
    HEARTBEAT_TOPIC,
    HEARTBEAT_TOPIC_CONFIG,
    ensure_topic,
)

log = logging.getLogger("its3.service")

HEARTBEAT_INTERVAL = 2.0
HEARTBEAT_TIMEOUT  = 6.0  # consumers treat a beat older than this as dead


class Heartbeat:
    """Background ``{timestamp, agent}`` producer."""

    def __init__(self, bootstrap_servers: str, ip_family: str = "v4") -> None:
        ensure_topic(bootstrap_servers, ip_family, HEARTBEAT_TOPIC,
                     config=HEARTBEAT_TOPIC_CONFIG)
        self._producer = KafkaProducer({"bootstrap.servers": bootstrap_servers,
                                        "broker.address.family": ip_family})
        self._stop   = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._beat, name="its3-heartbeat",
                                        daemon=True)
        self._thread.start()
        log.info("Heartbeat started on %s (every %.0fs)", HEARTBEAT_TOPIC,
                 HEARTBEAT_INTERVAL)

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._producer.flush(timeout=5)

    def _beat(self) -> None:
        while not self._stop.is_set():
            try:
                self._producer.produce(
                    HEARTBEAT_TOPIC,
                    value=json.dumps({"timestamp": time.time(),
                                      "agent": AGENT_NAME}).encode(),
                )
                self._producer.poll(0)
            except Exception as exc:  # a dropped beat must not kill the agent
                log.warning("Heartbeat produce failed: %s", exc)
            self._stop.wait(HEARTBEAT_INTERVAL)

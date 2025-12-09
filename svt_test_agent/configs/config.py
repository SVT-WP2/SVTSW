"""
SVT Test Agent – Default Configuration

This module defines:
  • Kafka topic names used across the system
  • A Kafka client configuration template (port substituted at runtime)
  • Backend implementation paths for emulator and real hardware

Nothing in this file executes code; it is purely declarative.

Location: svt_test_agent/configs/config.py
"""

from typing import Final


# =============================================================================
# Kafka Topics
# =============================================================================
# Topics are namespaced under "svt.*" to avoid collisions when multiple agents
# or systems share the same Kafka cluster.

DB_REQUEST_TOPIC: Final = "svt.db-agent.request"
DB_REPLY_TOPIC:   Final = "svt.db-agent.request.reply"

REQUEST_TOPIC: Final = "svt.test-agent.request"
REPLY_TOPIC:   Final = "svt.test-agent.request.reply"

# STATUS_TOPIC currently mirrors REPLY_TOPIC because status messages are routed
# through the same channel.
STATUS_TOPIC:  Final = "svt.test-agent.request.reply"


# =============================================================================
# Kafka Client Configuration
# =============================================================================
# This template is used by util_config.build_kafka_config() to produce the
# effective runtime configuration. The "{port}" placeholder is replaced with the
# port discovered from Docker, environment variables, or fallback defaults.

KAFKA_CONFIG_TEMPLATE: Final = {
    "consumer": {
        "bootstrap.servers": "localhost:{port}",
        "group.id": "test-agent",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    },
    "producer": {
        "bootstrap.servers": "localhost:{port}",
        "acks": "all",
        "linger.ms": 5,
        "batch.num.messages": 1000,
        "retries": 5,
    },
}


# =============================================================================
# Backend Implementations
# =============================================================================
# BACKEND selects the default system backend used by svt_test_agent.
#
# The backend class string is resolved dynamically:
#   "<module path>.<class name>"
#
# EmulatorBackend  → fully synthetic backend for development & CI
# RealBackend      → talks to actual hardware, requiring host/port parameters(yet to be defined)

BACKEND: Final = {
    "class": "svt_test_agent.test_system_backend.emulator.EmulatorBackend",
    "kwargs": {},
}

REAL_BACKEND: Final = {
    "class": "svt_test_agent.test_system_backend.real_backend.RealBackend",
    "kwargs": {
        "host": "127.0.0.1",
        "port": 9000,
        "timeout": 30,
    },
}
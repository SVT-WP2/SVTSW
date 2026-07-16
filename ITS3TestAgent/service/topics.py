"""Kafka topic names and headers for the ITS3 TestAgent.

Naming follows ``Documentation/Kafka/SvtKafkaConventions.md`` (dash-case, `.`
separators, reply topic = request topic + `.reply`).

Imported by the listener *and* the contract generator, so the documented paths
can never drift from the topics the agent actually uses.
"""

from __future__ import annotations

import logging

from confluent_kafka.admin import AdminClient, NewTopic

log = logging.getLogger("its3.service")

AGENT_NAME = "its3-test-agent"

REQUEST_TOPIC   = f"svt.{AGENT_NAME}.request"
REPLY_TOPIC     = f"svt.{AGENT_NAME}.request.reply"
HEARTBEAT_TOPIC = f"svt.{AGENT_NAME}.heartbeat"
#: Reserved for per-chip progress streaming; not produced yet (poll GetStatus).
STATUS_TOPIC    = f"svt.{AGENT_NAME}.status"

# Header names are fixed by the conventions doc.
CORRELATION_HEADER     = "kafka_correlationId"
REPLY_TOPIC_HEADER     = "kafka_replyTopic"
REPLY_PARTITION_HEADER = "kafka_replyPartition"

#: Heartbeats are liveness only — keep ~60s, never replay history.
HEARTBEAT_TOPIC_CONFIG = {"retention.ms": "60000", "segment.ms": "120000"}


def ensure_topic(bootstrap_servers: str, ip_family: str, topic: str,
                 config: dict[str, str] | None = None,
                 num_partitions: int = 1) -> None:
    """Create ``topic`` if the broker doesn't have it yet (idempotent)."""
    admin = AdminClient({"bootstrap.servers": bootstrap_servers,
                         "broker.address.family": ip_family})
    metadata = admin.list_topics(timeout=5)
    if topic in metadata.topics:
        return
    log.info("Creating Kafka topic %s", topic)
    new_topic = NewTopic(topic=topic, num_partitions=num_partitions,
                         replication_factor=1, config=config or {})
    for name, fut in admin.create_topics([new_topic]).items():
        try:
            fut.result(timeout=10)
            log.info("Created topic %s", name)
        except Exception as exc:  # already created by a peer, or no permission
            log.warning("Could not create topic %s: %s", name, exc)

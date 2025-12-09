"""
Kafka topic creation utility for the SVT Test Agent.

This script loads a topic configuration module, resolves the Kafka
bootstrap server, waits for the broker to become available, and ensures
that all required topics defined in configd exist . It is primarily used during development
and local deployments (Docker Compose).

Location: kafka_broker/broker_utils/topic_creation.py
"""

from __future__ import annotations

import importlib.util
import logging
import os
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Sequence

from confluent_kafka import KafkaException, KafkaError
from confluent_kafka.admin import AdminClient, NewTopic

from svt_test_agent.utilities.util_config import (
    build_kafka_config,
    persist_kafka_port,
    port_file_path,
)

logger = logging.getLogger(__name__)


def load_config(path: str) -> ModuleType:
    """
    Dynamically load config module from a file path.

    The module is expected to define topic names such as:
    - REQUEST_TOPIC
    - REPLY_TOPIC
    - STATUS_TOPIC
    - DB_REQUEST_TOPIC
    - DB_REPLY_TOPIC
    """
    abspath = os.path.abspath(path)
    spec = importlib.util.spec_from_file_location("topic_config", abspath)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load config module from: {path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolve_bootstrap(cfg_module: ModuleType) -> str:
    """
    Resolve the Kafka bootstrap.servers string.

    Priority:
    1. KAFKA_CONFIG in the config module, if present.
    2. build_kafka_config() from svt_test_agent.utilities.util_config.
    """
    kafka_cfg = getattr(cfg_module, "KAFKA_CONFIG", None)
    if kafka_cfg is not None:
        try:
            return kafka_cfg["producer"]["bootstrap.servers"]
        except Exception as exc:
            raise RuntimeError(
                "KAFKA_CONFIG present but missing producer.bootstrap.servers"
            ) from exc

    cfg = build_kafka_config()
    try:
        return cfg["producer"]["bootstrap.servers"]
    except Exception as exc:
        raise RuntimeError(
            "build_kafka_config() returned config without producer.bootstrap.servers"
        ) from exc


def _persist_from_bootstrap(bootstrap: str) -> None:
    """
    Extract the port from a bootstrap.servers string and persist it
    via util_config.persist_kafka_port, for use by other components.
    """
    try:
        port = str(bootstrap.rsplit(":", 1)[-1]).strip()
        if not port:
            logger.warning(
                "Bootstrap string '%s' does not contain a port to persist", bootstrap
            )
            return

        persist_kafka_port(port)
        logger.info("Saved Kafka port %s to %s", port, port_file_path())
    except Exception as exc:
        logger.warning("Failed to persist Kafka port file: %s", exc)


def wait_for_broker(bootstrap: str, attempts: int = 30, sleep_s: float = 1.0) -> bool:
    """
    Poll the Kafka broker until it responds or attempts are exhausted.

    Returns True if the broker is reachable, False otherwise.
    """
    admin = AdminClient({"bootstrap.servers": bootstrap})

    for i in range(1, attempts + 1):
        try:
            logger.info("[%d/%d] Checking broker at %s ...", i, attempts, bootstrap)
            metadata = admin.list_topics(timeout=2.0)
            cluster_id = getattr(metadata, "cluster_id", None)
            logger.info(
                "Broker ready: cluster_id=%s, brokers=%s",
                cluster_id,
                list(metadata.brokers.keys()),
            )
            return True
        except KafkaException as exc:
            logger.info(
                "Broker not ready (%s); retrying in %.1fs", exc, sleep_s
            )
            time.sleep(sleep_s)
        except Exception:
            logger.exception("Unexpected error while checking broker")
            time.sleep(sleep_s)

    return False


def ensure_topics(
    bootstrap: str,
    topics: Sequence[str],
    num_partitions: int = 1,
    replication_factor: int = 1,
) -> None:
    """
    Ensure that all given topics exist on the broker.

    Topics that already exist are left untouched.
    """
    admin = AdminClient({"bootstrap.servers": bootstrap})
    new_topics = [
        NewTopic(
            topic,
            num_partitions=num_partitions,
            replication_factor=replication_factor,
        )
        for topic in topics
    ]

    futures = admin.create_topics(new_topics, request_timeout=10.0)

    for topic, future in futures.items():
        try:
            future.result()
            logger.info("Created topic: %s", topic)
        except KafkaException as exc:
            err = exc.args[0] if exc.args else None
            already_exists = False

            if hasattr(err, "code") and err.code() == KafkaError.TOPIC_ALREADY_EXISTS:
                already_exists = True
            elif "TopicAlreadyExists" in str(exc) or "TopicAlreadyExistsError" in str(exc):
                already_exists = True

            if already_exists:
                logger.info("Topic already exists: %s", topic)
            else:
                logger.error("Failed to create topic %s: %s", topic, exc)
                raise


def main() -> None:
    """
    Usage(Only for developers):
        python -m kafka_broker.broker_utils.topic_creation path/to/config.py
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if len(sys.argv) != 2:
        print(
            "Usage: python -m kafka_broker.broker_utils.topic_creation <config.py>",
            file=sys.stderr,
        )
        sys.exit(1)

    cfg_path = Path(sys.argv[1]).resolve()

    try:
        cfg = load_config(str(cfg_path))
    except Exception as exc:
        print(f"Failed to load config from {cfg_path}: {exc}", file=sys.stderr)
        sys.exit(1)

    required = (
        "REQUEST_TOPIC",
        "REPLY_TOPIC",
        "STATUS_TOPIC",
        "DB_REQUEST_TOPIC",
        "DB_REPLY_TOPIC",
    )
    missing = [name for name in required if not hasattr(cfg, name)]
    if missing:
        print(
            f"Config {cfg_path} is missing required topics: {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(2)

    topics = [
        cfg.REQUEST_TOPIC,
        cfg.REPLY_TOPIC,
        cfg.STATUS_TOPIC,
        cfg.DB_REQUEST_TOPIC,
        cfg.DB_REPLY_TOPIC,
    ]

    # Deduplicate topics while preserving order
    seen: set[str] = set()
    unique_topics: list[str] = []
    for t in topics:
        if t not in seen:
            seen.add(t)
            unique_topics.append(t)

    if len(unique_topics) != len(topics):
        logger.info("De-duplicated topics: %s", unique_topics)

    topics = unique_topics

    try:
        bootstrap = resolve_bootstrap(cfg)
    except Exception as exc:
        print(f"Failed resolving bootstrap.servers: {exc}", file=sys.stderr)
        sys.exit(2)

    _persist_from_bootstrap(bootstrap)

    num_partitions = int(os.getenv("TOPIC_NUM_PARTITIONS", "1"))
    replication_factor = int(os.getenv("TOPIC_REPLICATION_FACTOR", "1"))

    logger.info("Using config file: %s", cfg_path)
    logger.info("Bootstrap: %s", bootstrap)
    logger.info(
        "Topics: %s (partitions=%d, replication_factor=%d)",
        topics,
        num_partitions,
        replication_factor,
    )

    if not wait_for_broker(bootstrap, attempts=30, sleep_s=1.0):
        logger.error(
            "Broker not reachable. "
            "Check Docker/compose configuration and advertised.listeners."
        )
        sys.exit(2)

    ensure_topics(
        bootstrap,
        topics,
        num_partitions=num_partitions,
        replication_factor=replication_factor,
    )
    logger.info("Broker reachable and topics ensured.")


if __name__ == "__main__":
    main()
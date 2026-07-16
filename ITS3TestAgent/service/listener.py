"""Kafka listener for the ITS3 TestAgent.

Consumes commands from ``svt.its3-test-agent.request``, hands each body to the
``Dispatcher``, and replies on the topic named by the request's
``kafka_replyTopic`` header (default ``svt.its3-test-agent.request.reply``).

This module is I/O only — the command semantics live in ``service/dispatcher.py``.

Commands are dispatched on the consumer thread, so handlers must return
promptly: StartRun hands the actual work to a background thread.
"""

from __future__ import annotations

import json
import logging

from confluent_kafka import Consumer as KafkaConsumer, Producer as KafkaProducer

from service.commands import COMMANDS
from service.dispatcher import Dispatcher
from service.heartbeat import Heartbeat
from service.models import ReplyStatus
from service.run_manager import RunManager
from service.topics import (
    CORRELATION_HEADER,
    REPLY_PARTITION_HEADER,
    REPLY_TOPIC,
    REPLY_TOPIC_HEADER,
    REQUEST_TOPIC,
    ensure_topic,
)

log = logging.getLogger("its3.service")


class ITS3Listener:
    def __init__(self, mgr: RunManager, bootstrap_servers: str,
                 ip_family: str = "v4",
                 group_id: str = "its3-test-agent") -> None:
        self.dispatcher = Dispatcher(mgr)

        log.info("Connecting to Kafka broker %s ...", bootstrap_servers)
        for topic in (REQUEST_TOPIC, REPLY_TOPIC):
            ensure_topic(bootstrap_servers, ip_family, topic)

        self.producer = KafkaProducer({"bootstrap.servers": bootstrap_servers,
                                       "broker.address.family": ip_family})
        self.consumer = KafkaConsumer({
            "bootstrap.servers":     bootstrap_servers,
            "broker.address.family": ip_family,
            "group.id":              group_id,
            "auto.offset.reset":     "latest",  # never replay old commands on restart
            "enable.auto.commit":    True,
        })
        self.consumer.subscribe([REQUEST_TOPIC])

        self.heartbeat = Heartbeat(bootstrap_servers, ip_family)
        self._running  = False

    # ------------------------------------------------------------------

    def run(self) -> None:
        self.heartbeat.start()
        self._running = True
        log.info("Listening on %s  (commands: %s)",
                 REQUEST_TOPIC, ", ".join(sorted(COMMANDS)))
        try:
            while self._running:
                msg = self.consumer.poll(1.0)
                if msg is None:
                    continue
                if msg.error():
                    log.error("Kafka consume error: %s", msg.error())
                    continue
                self._handle(msg)
        except KeyboardInterrupt:
            log.info("Interrupted — shutting down")
        finally:
            self.close()

    def stop(self) -> None:
        self._running = False

    def close(self) -> None:
        self.heartbeat.stop()
        self.consumer.close()
        self.producer.flush(timeout=5)
        log.info("Listener stopped")

    # ------------------------------------------------------------------

    def _handle(self, msg) -> None:
        headers = {k: v for k, v in (msg.headers() or []) if k}
        correlation_id = headers.get(CORRELATION_HEADER, b"").decode(errors="ignore")
        reply_topic    = (headers.get(REPLY_TOPIC_HEADER, b"").decode(errors="ignore")
                          or REPLY_TOPIC)
        try:
            reply_partition = int(headers.get(REPLY_PARTITION_HEADER, b"0") or 0)
        except ValueError:
            reply_partition = 0

        try:
            body = json.loads(msg.value())
        except (ValueError, TypeError) as exc:
            reply = {"type": "UnknownReply",
                     "status": ReplyStatus.BadRequest.value,
                     "error": {"message": f"Message is not valid JSON: {exc}"}}
        else:
            reply = self.dispatcher.dispatch(body)

        self._reply(reply, reply_topic, reply_partition, correlation_id)

    def _reply(self, body: dict, topic: str, partition: int,
               correlation_id: str) -> None:
        headers = []
        if correlation_id:
            headers.append((CORRELATION_HEADER, correlation_id.encode()))
            headers.append((REPLY_PARTITION_HEADER, str(partition).encode()))
        try:
            self.producer.produce(topic, value=json.dumps(body).encode(),
                                  partition=partition, headers=headers)
            self.producer.flush(timeout=5)
            log.info("<- %s status=%s", body["type"], body["status"])
        except Exception as exc:
            log.error("Failed to publish reply to %s: %s", topic, exc)

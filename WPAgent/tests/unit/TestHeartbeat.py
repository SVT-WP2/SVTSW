"""
Unit tests for services/WPHeartbeat.py
=======================================

Tests the inheritance-based design:
    HeartbeatBase
        ListenerHealthCheck  - is_listener_alive(), wait_for_listener()
    HeartbeatMonitorBase
        ListenerHealthMonitor

All Kafka objects are mocked so no live broker is needed.
"""

import itertools
import json
import os
import tempfile
import time
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SERVERS = "localhost:9092"


def _make_admin_mock(existing_topics=()):
    admin = MagicMock()
    metadata = MagicMock()
    metadata.topics = {t: MagicMock() for t in existing_topics}
    admin.list_topics.return_value = metadata
    future = MagicMock()
    future.result.return_value = None
    admin.create_topics.return_value = {
        t: future
        for t in ["svt.wp-agent.heartbeat"]
    }
    admin.alter_configs.return_value = {MagicMock(): future}
    return admin


def _make_msg(timestamp):
    msg = MagicMock()
    msg.error.return_value = None
    payload = {"timestamp": timestamp, "status": "alive"}
    msg.value.return_value = json.dumps(payload).encode()
    return msg


def _patch_kafka(existing_topics=(), consumer_messages=None):
    if consumer_messages is None:
        consumer_messages = [None]
    admin_mock = _make_admin_mock(existing_topics)
    producer_mock = MagicMock()
    consumer_mock = MagicMock()
    consumer_mock.poll.side_effect = itertools.cycle(consumer_messages)
    patches = [
        patch("services.WPHeartbeat.AdminClient",   return_value=admin_mock),
        patch("services.WPHeartbeat.KafkaProducer", return_value=producer_mock),
        patch("services.WPHeartbeat.KafkaConsumer", return_value=consumer_mock),
    ]
    return patches, producer_mock, consumer_mock, admin_mock


# ---------------------------------------------------------------------------
# Plain-Python consumer stub for _is_alive / wait_for tests
# (avoids MagicMock side_effect exhaustion when the loop runs many cycles)
# ---------------------------------------------------------------------------


class _FakeConsumer:
    def __init__(self, messages):
        self._cycle = itertools.cycle(messages)

    def poll(self, timeout):
        return next(self._cycle)

    def close(self):
        pass

    def subscribe(self, topics):
        pass


def _listener_with_consumer(messages):
    from services.WPHeartbeat import ListenerHealthCheck
    hc = ListenerHealthCheck()          # bootstrap_servers=None
    hc.consumer = _FakeConsumer(messages)
    return hc


# ---------------------------------------------------------------------------
# Topic attributes
# ---------------------------------------------------------------------------


class TestTopicAttributes:

    def test_listener_topic(self):
        from services.WPHeartbeat import ListenerHealthCheck
        assert ListenerHealthCheck.HEARTBEAT_TOPIC == "svt.wp-agent.heartbeat"

    def test_no_separate_cache_heartbeat(self):
        import services.WPHeartbeat as hb
        assert not hasattr(hb, "CacheHealthCheck")
        assert not hasattr(hb, "CacheHealthMonitor")


# ---------------------------------------------------------------------------
# Init - no bootstrap_servers
# ---------------------------------------------------------------------------


class TestInitNoServers:

    def test_listener_producer_and_consumer_none(self):
        from services.WPHeartbeat import ListenerHealthCheck
        hc = ListenerHealthCheck()
        assert hc.producer is None
        assert hc.consumer is None

    def test_listener_does_not_crash(self):
        from services.WPHeartbeat import ListenerHealthCheck
        ListenerHealthCheck(bootstrap_servers=None)


# ---------------------------------------------------------------------------
# Init - with bootstrap_servers
# ---------------------------------------------------------------------------


class TestInitWithServers:

    def test_listener_creates_producer_and_consumer(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, prod, cons, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
        assert hc.producer is prod
        assert hc.consumer is cons

    def test_topic_created_when_missing(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, _, _, admin = _patch_kafka(existing_topics=())
        with patches[0], patches[1], patches[2]:
            ListenerHealthCheck(SERVERS)
        admin.create_topics.assert_called_once()

    def test_topic_config_updated_when_existing(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, _, _, admin = _patch_kafka(
            existing_topics=[ListenerHealthCheck.HEARTBEAT_TOPIC]
        )
        with patches[0], patches[1], patches[2]:
            ListenerHealthCheck(SERVERS)
        admin.alter_configs.assert_called_once()
        admin.create_topics.assert_not_called()


# ---------------------------------------------------------------------------
# send_heartbeat
# ---------------------------------------------------------------------------


class TestSendHeartbeat:

    def test_listener_calls_produce(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.send_heartbeat()
        prod.produce.assert_called_once()

    def test_payload_has_timestamp_and_status(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.send_heartbeat()
        raw = prod.produce.call_args[1]["value"]
        payload = json.loads(raw.decode())
        assert payload["status"] == "alive"
        assert "timestamp" in payload

    def test_uses_correct_topic(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.send_heartbeat()
        assert prod.produce.call_args[0][0] == ListenerHealthCheck.HEARTBEAT_TOPIC

    def test_noop_when_no_producer(self):
        from services.WPHeartbeat import ListenerHealthCheck
        hc = ListenerHealthCheck()
        hc.send_heartbeat()   # must not raise


# ---------------------------------------------------------------------------
# is_listener_alive
# ---------------------------------------------------------------------------


class TestIsAlive:

    def test_listener_alive_for_recent_heartbeat(self):
        hc = _listener_with_consumer([_make_msg(time.time() - 1.0)])
        alive, age = hc.is_listener_alive(timeout=1.0)
        assert alive is True
        assert 0 < age < hc.HEARTBEAT_TIMEOUT

    def test_listener_dead_for_old_heartbeat(self):
        hc = _listener_with_consumer([_make_msg(time.time() - 100.0)])
        alive, age = hc.is_listener_alive(timeout=0.3)
        assert alive is False
        assert age > hc.HEARTBEAT_TIMEOUT

    def test_listener_dead_inf_when_no_messages(self):
        hc = _listener_with_consumer([None])
        alive, age = hc.is_listener_alive(timeout=0.2)
        assert alive is False
        assert age == float("inf")

    def test_listener_dead_inf_when_no_consumer(self):
        from services.WPHeartbeat import ListenerHealthCheck
        hc = ListenerHealthCheck()
        alive, age = hc.is_listener_alive()
        assert alive is False
        assert age == float("inf")


# ---------------------------------------------------------------------------
# wait_for_listener
# ---------------------------------------------------------------------------


class TestWaitForOnline:

    def test_listener_returns_true_when_alive(self):
        hc = _listener_with_consumer([_make_msg(time.time() - 0.5)])
        assert hc.wait_for_listener(max_wait=5.0, check_interval=0.5) is True

    def test_listener_returns_false_on_timeout(self):
        hc = _listener_with_consumer([None])
        assert hc.wait_for_listener(max_wait=0.5, check_interval=0.2) is False


# ---------------------------------------------------------------------------
# close
# ---------------------------------------------------------------------------


class TestClose:

    def test_close_flushes_producer_and_closes_consumer(self):
        from services.WPHeartbeat import ListenerHealthCheck
        patches, prod, cons, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.close()
        cons.close.assert_called_once()
        prod.flush.assert_called_once()

    def test_close_noop_when_no_kafka(self):
        from services.WPHeartbeat import ListenerHealthCheck
        hc = ListenerHealthCheck()
        hc.close()  # must not raise


# ---------------------------------------------------------------------------
# ListenerHealthMonitor
# ---------------------------------------------------------------------------


class TestListenerHealthMonitor:

    def test_start_sends_heartbeats(self):
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc)
            monitor.start()
            time.sleep(0.2)
            monitor.stop()
        assert prod.produce.call_count >= 1

    def test_stop_halts_thread(self):
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc)
            monitor.start()
            time.sleep(0.15)
            monitor.stop()
            count_after = prod.produce.call_count
            time.sleep(0.2)
        assert prod.produce.call_count == count_after


# ---------------------------------------------------------------------------
# ListenerHealthMonitor - on_heartbeat callback (cache snapshot writes)
# ---------------------------------------------------------------------------


class TestListenerHealthMonitorCallback:

    def test_on_heartbeat_called_every_beat(self):
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        patches, _, _, _ = _patch_kafka()
        callback = MagicMock()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc, on_heartbeat=callback)
            monitor.start()
            time.sleep(0.25)
            monitor.stop()
        assert callback.call_count >= 1

    def test_on_heartbeat_writes_file(self):
        """Concrete file-write scenario: snapshot written on each heartbeat."""
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as f:
            snapshot_path = f.name

        beats = []

        def write_snapshot():
            beats.append(time.time())
            with open(snapshot_path, "w", encoding="utf-8") as fp:
                json.dump({"snapshot_at": beats[-1]}, fp)

        patches, _, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc, on_heartbeat=write_snapshot)
            monitor.start()
            time.sleep(0.25)
            monitor.stop()

        assert os.path.exists(snapshot_path)
        with open(snapshot_path, encoding="utf-8") as f:
            data = json.load(f)
        assert "snapshot_at" in data
        assert len(beats) >= 1
        os.unlink(snapshot_path)

    def test_no_callback_still_beats(self):
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        patches, prod, _, _ = _patch_kafka()
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc, on_heartbeat=None)
            monitor.start()
            time.sleep(0.2)
            monitor.stop()
        assert prod.produce.call_count >= 1

    def test_failing_callback_does_not_stop_heartbeats(self):
        from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
        patches, prod, _, _ = _patch_kafka()
        callback = MagicMock(side_effect=OSError("disk full"))
        with patches[0], patches[1], patches[2]:
            hc = ListenerHealthCheck(SERVERS)
            hc.HEARTBEAT_INTERVAL = 0.05
            monitor = ListenerHealthMonitor(hc, on_heartbeat=callback)
            monitor.start()
            time.sleep(0.3)
            monitor.stop()
        assert callback.call_count >= 2          # kept being called after the first failure
        assert prod.produce.call_count >= 2      # heartbeats kept flowing

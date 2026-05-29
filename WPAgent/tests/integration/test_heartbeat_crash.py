"""
Integration test: heartbeat monitor behaviour when Kafka is unavailable
=======================================================================

"""

import logging
import os
import tempfile
import time

import pytest

# ── helpers ───────────────────────────────────────────────────────────────────


def _close_handlers(name="WPAgent_HB"):
    lgr = logging.getLogger(name)
    for h in lgr.handlers[:]:
        h.close()
        lgr.removeHandler(h)


def _make_logger(log_path, name="WPAgent_HB"):
    from utilities.WPAgentLogger import WPAgentLogger

    WPAgentLogger._instance = None
    _close_handlers(name)
    return WPAgentLogger(name=name, log_file=log_path, level=logging.DEBUG)


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def log_file():
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".log", delete=False, encoding="utf-8"
    ) as f:
        path = f.name
    yield path
    _close_handlers()
    try:
        os.unlink(path)
    except PermissionError:
        pass  # Windows: harmless leftover in temp dir


@pytest.fixture(autouse=True)
def reset_singleton():
    yield
    from utilities.WPAgentLogger import WPAgentLogger

    WPAgentLogger._instance = None
    _close_handlers()


# ── helpers that mimic the real monitor loops ─────────────────────────────────


def _run_listener_monitor_loop(logger, beats: list):
    """
    Replay a sequence of heartbeat events the way ListenerHealthMonitor does:

        beats = [
            {"alive": True,  "age": 1.2},          # normal beat
            {"alive": False, "age": 9.0},           # missed beats
            {"kafka_error": "Connection refused"},  # broker down
        ]

    This is exactly what heartbeat_loop() does:

        try:
            health_check.send_heartbeat()   ← we replace with the beat dict
            logger.log_heartbeat("Listener", is_alive=True)
        except Exception as e:
            logger.log_heartbeat("Listener", is_alive=False, kafka_error=str(e))
    """
    for beat in beats:
        if "kafka_error" in beat:
            # Simulate the exception path: send_heartbeat() raised
            logger.log_heartbeat(
                "Listener",
                is_alive=False,
                kafka_error=beat["kafka_error"],
            )
        elif beat.get("alive"):
            logger.log_heartbeat(
                "Listener",
                is_alive=True,
                age_seconds=beat.get("age"),
            )
        else:
            logger.log_heartbeat(
                "Listener",
                is_alive=False,
                age_seconds=beat.get("age"),
            )


# ── scenarios ─────────────────────────────────────────────────────────────────


class TestHeartbeatCrash:

    def test_kafka_down_from_start(self, log_file):
        """
        Kafka is never reachable — every beat raises immediately.
        The log must contain only KAFKA-ERROR lines, no ALIVE lines.
        """
        logger = _make_logger(log_file)

        kafka_error = "[Errno 111] Connection refused (broker: localhost:9092)"
        beats = [{"kafka_error": kafka_error}] * 3  # 3 failed attempts

        _run_listener_monitor_loop(logger, beats)

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        content = _read(log_file)
        lines = [l for l in content.splitlines() if l.strip()]

        assert len(lines) == 3, "Expected one log line per failed beat"
        assert all(
            "KAFKA-ERROR" in l for l in lines
        ), "Every line should be a KAFKA-ERROR when broker is unreachable"
        assert all(
            "ERROR" in l for l in lines
        ), "Kafka connectivity failures must be logged at ERROR level"
        assert "Connection refused" in content
        assert "ALIVE" not in content

    def test_kafka_comes_back_after_crash(self, log_file):
        """
        Kafka goes down then recovers.
        Log must show: ALIVE → KAFKA-ERROR → ALIVE again.
        The recovery line must appear AFTER the error line.
        """
        logger = _make_logger(log_file)

        beats = [
            {"alive": True, "age": 1.1},
            {"alive": True, "age": 1.3},
            {"kafka_error": "[Errno 111] Connection refused"},
            {"kafka_error": "[Errno 111] Connection refused"},
            {"alive": True, "age": 0.8},  # broker came back
        ]
        _run_listener_monitor_loop(logger, beats)

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        content = _read(log_file)
        lines = [l for l in content.splitlines() if l.strip()]

        alive_indices = [i for i, l in enumerate(lines) if "ALIVE" in l]
        error_indices = [i for i, l in enumerate(lines) if "KAFKA-ERROR" in l]

        assert alive_indices, "Should have ALIVE lines"
        assert error_indices, "Should have KAFKA-ERROR lines"

        # Recovery: the last ALIVE line must come after the last error line
        assert (
            alive_indices[-1] > error_indices[-1]
        ), "The recovery ALIVE beat should appear after the KAFKA-ERROR lines"

    def test_listener_dead_no_kafka_error(self, log_file):
        """
        Kafka is reachable but no heartbeat is arriving — listener process died.
        is_alive=False, no kafka_error → DEAD at WARNING level (not ERROR).
        """
        logger = _make_logger(log_file)

        # Health check found no recent heartbeat (listener process crashed)
        logger.log_heartbeat("Listener", is_alive=False, age_seconds=float("inf"))
        logger.log_heartbeat("Listener", is_alive=False, age_seconds=float("inf"))

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        content = _read(log_file)

        assert "Listener=DEAD" in content
        assert (
            "WARNING" in content
        ), "Dead-but-Kafka-OK should log at WARNING, not ERROR"
        assert "ERROR" not in content, "No Kafka error — must not log at ERROR level"
        assert "no heartbeat received" in content

    def test_log_contains_timestamp_and_component(self, log_file):
        """
        Every line must be parseable: timestamp, level, component name, status.
        """
        logger = _make_logger(log_file)
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=2.5)
        logger.log_heartbeat("Cache", is_alive=True, age_seconds=1.0)

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        for line in _read(log_file).splitlines():
            if not line.strip():
                continue
            assert (
                " - INFO - " in line or " - WARNING - " in line or " - ERROR - " in line
            ), f"Line missing level tag: {line}"
            assert "[HEARTBEAT]" in line, f"Line missing [HEARTBEAT] tag: {line}"

    def test_mixed_cache_and_listener_crash(self, log_file):
        """
        Both Cache and Listener monitors running: Cache crashes, Listener stays alive.
        Log must distinguish the two components.
        """
        logger = _make_logger(log_file)

        # Listener is fine
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=1.0)
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=1.1)

        # Cache broker fails
        logger.log_heartbeat(
            "Cache", is_alive=False, kafka_error="Topic authorization failed"
        )
        logger.log_heartbeat(
            "Cache", is_alive=False, kafka_error="Topic authorization failed"
        )

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        content = _read(log_file)
        lines = content.splitlines()

        listener_lines = [l for l in lines if "Listener" in l]
        cache_lines = [l for l in lines if "Cache" in l]

        assert all(
            "ALIVE" in l for l in listener_lines
        ), "Listener should be ALIVE throughout"
        assert all(
            "KAFKA-ERROR" in l for l in cache_lines
        ), "Cache should be KAFKA-ERROR throughout"
        assert all("INFO" in l for l in listener_lines)
        assert all("ERROR" in l for l in cache_lines)

    def test_full_session_sequence(self, log_file):
        """
        Realistic end-to-end sequence — the kind you'd read in production:

          startup → steady beats → kafka outage → recovery → shutdown

        Checks that the file tells the full story in order.
        """
        logger = _make_logger(log_file)

        # Startup
        logger.log_command(
            "Agent started", command="Initialize", result={"status": "Success"}
        )

        # Steady heartbeats
        for age in [1.0, 1.2, 1.1]:
            logger.log_heartbeat("Listener", is_alive=True, age_seconds=age)
            logger.log_heartbeat("Cache", is_alive=True, age_seconds=age - 0.2)

        # Kafka outage
        for _ in range(3):
            logger.log_heartbeat(
                "Listener", is_alive=False, kafka_error="[Errno 111] Connection refused"
            )
            logger.log_heartbeat(
                "Cache", is_alive=False, kafka_error="[Errno 111] Connection refused"
            )

        # Recovery
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=0.9)
        logger.log_heartbeat("Cache", is_alive=True, age_seconds=1.1)

        # Shutdown command
        logger.log_command(
            "Agent stopped", command="Shutdown", result={"status": "Success"}
        )

        for h in logging.getLogger("WPAgent_HB").handlers:
            h.flush()

        content = _read(log_file)
        lines = [l for l in content.splitlines() if l.strip()]

        # All three states present
        assert any("ALIVE" in l for l in lines), "No ALIVE lines found"
        assert any("KAFKA-ERROR" in l for l in lines), "No KAFKA-ERROR lines found"

        # Commands still visible alongside heartbeats
        assert any("Initialize" in l for l in lines)
        assert any("Shutdown" in l for l in lines)

        # Severity spread: INFO, WARNING-or-ERROR present
        assert any("INFO" in l for l in lines)
        assert any("ERROR" in l for l in lines)

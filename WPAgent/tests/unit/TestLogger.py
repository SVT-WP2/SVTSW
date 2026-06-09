"""
Unit tests for utilities/WPAgentLogger.py

Covers:
  - File log is written for every call to log_command()
  - File log includes command, message, data, and result (structured)
  - Severity levels map to the correct logging calls
  - Kafka path is exercised but does not block file logging
  - Singleton is properly isolated between tests via _instance reset

Windows note
------------
logging.FileHandler keeps the file open for the lifetime of the handler.
On Windows this prevents os.unlink() from succeeding in teardown.
The log_file fixture therefore explicitly closes all handlers on the
"TestWPAgent" logger before attempting to delete the temp file.
"""

import logging
import os
import tempfile

import pytest
from unittest.mock import patch, MagicMock

# ── helpers ───────────────────────────────────────────────────────────────────


def _close_handlers(logger_name: str = "TestWPAgent") -> None:
    """Close and remove every handler attached to *logger_name*.

    Must be called before deleting the backing file on Windows, where an
    open FileHandler holds an exclusive lock on the file.
    """
    lgr = logging.getLogger(logger_name)
    for h in lgr.handlers[:]:
        h.close()
        lgr.removeHandler(h)


def _fresh_logger(log_path, kafka_enabled=False):
    """Return a WPAgentLogger backed by *log_path*, with the singleton reset."""
    from utilities.WPAgentLogger import WPAgentLogger

    WPAgentLogger._instance = None
    _close_handlers()
    return WPAgentLogger(
        name="TestWPAgent",
        log_file=log_path,
        kafka_enabled=kafka_enabled,
    )


def _read_log(log_path):
    with open(log_path, "r", encoding="utf-8") as f:
        return f.read()


# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset the singleton and close all handlers after every test."""
    yield
    from utilities.WPAgentLogger import WPAgentLogger

    WPAgentLogger._instance = None
    _close_handlers()


@pytest.fixture
def log_file():
    """Provide a fresh temp log file and clean it up after the test.

    Handlers are closed before the delete so Windows doesn't raise
    PermissionError [WinError 32].
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".log", delete=False, encoding="utf-8"
    ) as f:
        path = f.name
    yield path
    # Close the FileHandler BEFORE deleting — required on Windows.
    _close_handlers()
    if os.path.exists(path):
        try:
            os.unlink(path)
        except PermissionError:
            pass  # leave in temp dir — harmless on any OS


# ── basic write ───────────────────────────────────────────────────────────────


class TestFileLogging:

    def test_log_command_creates_file(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("test message", command="TestCmd")
        assert os.path.exists(log_file)

    def test_log_command_writes_command_name(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("hello", command="MoveChuckXY")
        assert "MoveChuckXY" in _read_log(log_file)

    def test_log_command_writes_message(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("operation succeeded", command="TestCmd")
        assert "operation succeeded" in _read_log(log_file)

    def test_log_command_without_command_uses_na(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("bare message")
        assert "N/A" in _read_log(log_file)

    def test_log_command_writes_data_to_file(self, log_file):
        """BUG COVERAGE: data field must appear in the file log, not only Kafka."""
        logger = _fresh_logger(log_file)
        logger.log_command(
            "wafer loaded",
            command="LoadWafer",
            data={"waferId": 42, "orientation": "Up"},
        )
        content = _read_log(log_file)
        assert "waferId" in content, (
            "data field is missing from the file log — "
            "log_command() was only sending it to Kafka"
        )
        assert "42" in content

    def test_log_command_writes_result_to_file(self, log_file):
        """BUG COVERAGE: result field must appear in the file log."""
        logger = _fresh_logger(log_file)
        logger.log_command(
            "chuck moved",
            command="MoveChuckContact",
            result={"status": "Success", "position": "contact"},
        )
        content = _read_log(log_file)
        assert (
            "result" in content or "Success" in content
        ), "result field is missing from the file log"

    def test_log_command_data_and_result_together(self, log_file):
        """Both data and result must appear when both are provided."""
        logger = _fresh_logger(log_file)
        logger.log_command(
            "die selected",
            command="MoveChuckDie",
            data={"col": 3, "row": 7},
            result={"status": "Success"},
        )
        content = _read_log(log_file)
        assert "col" in content
        assert "row" in content
        assert "Success" in content

    def test_log_command_none_data_does_not_crash(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("ok", command="Help", data=None, result=None)
        assert "Help" in _read_log(log_file)


# ── severity levels ───────────────────────────────────────────────────────────


class TestSeverityLevels:

    def test_debug_level_writes_to_file(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger, Severity

        WPAgentLogger._instance = None
        _close_handlers()
        logger = WPAgentLogger(
            name="TestWPAgent",
            log_file=log_file,
            level=logging.DEBUG,
        )
        logger.log_command("debug msg", severityLevel=Severity.DEBUG, command="DbgCmd")
        assert "DbgCmd" in _read_log(log_file)

    def test_warning_level_writes_to_file(self, log_file):
        from utilities.WPAgentLogger import Severity

        logger = _fresh_logger(log_file)
        logger.log_command(
            "warn msg", severityLevel=Severity.WARNING, command="WarnCmd"
        )
        assert "WarnCmd" in _read_log(log_file)

    def test_error_level_writes_to_file(self, log_file):
        from utilities.WPAgentLogger import Severity

        logger = _fresh_logger(log_file)
        logger.log_command("err msg", severityLevel=Severity.ERROR, command="ErrCmd")
        assert "ErrCmd" in _read_log(log_file)

    def test_invalid_severity_falls_back_to_info(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("fallback", severityLevel=99, command="FallbackCmd")
        assert "FallbackCmd" in _read_log(log_file)


# ── multiple entries ──────────────────────────────────────────────────────────


class TestMultipleEntries:

    def test_multiple_calls_all_written(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("first", command="CmdA")
        logger.log_command("second", command="CmdB")
        logger.log_command("third", command="CmdC")
        content = _read_log(log_file)
        assert "CmdA" in content
        assert "CmdB" in content
        assert "CmdC" in content

    def test_each_entry_on_separate_line(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_command("one", command="Alpha")
        logger.log_command("two", command="Beta")
        lines = [l for l in _read_log(log_file).splitlines() if l.strip()]
        assert len(lines) >= 2


# ── Kafka path ────────────────────────────────────────────────────────────────


class TestKafkaPath:

    def test_kafka_disabled_no_producer_created(self, log_file):
        logger = _fresh_logger(log_file, kafka_enabled=False)
        assert logger.kafka_producer is None

    def test_kafka_enabled_calls_produce(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger, Severity

        mock_producer = MagicMock()
        WPAgentLogger._instance = None
        _close_handlers()
        with patch("utilities.WPAgentLogger.KafkaProducer", return_value=mock_producer):
            logger = WPAgentLogger(
                name="TestWPAgent",
                log_file=log_file,
                kafka_enabled=True,
                kafka_servers="localhost:9092",
                kafka_topic="test-logs",
                severity_threshold=Severity.DEBUG,
            )
            logger.log_command(
                "kafka msg", command="KafkaCmd", severityLevel=Severity.INFO
            )
        mock_producer.produce.assert_called_once()

    def test_kafka_failure_does_not_suppress_file_log(self, log_file):
        """If Kafka produce() raises, the file log must still be intact."""
        from utilities.WPAgentLogger import WPAgentLogger, Severity

        mock_producer = MagicMock()
        mock_producer.produce.side_effect = Exception("broker unavailable")
        WPAgentLogger._instance = None
        _close_handlers()
        with patch("utilities.WPAgentLogger.KafkaProducer", return_value=mock_producer):
            logger = WPAgentLogger(
                name="TestWPAgent",
                log_file=log_file,
                kafka_enabled=True,
                kafka_servers="localhost:9092",
                severity_threshold=Severity.DEBUG,
            )
            logger.log_command(
                "safe msg", command="SafeCmd", severityLevel=Severity.INFO
            )
        assert "SafeCmd" in _read_log(log_file)


# ── singleton ─────────────────────────────────────────────────────────────────


class TestSingleton:

    def test_same_instance_returned(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger

        a = _fresh_logger(log_file)
        b = WPAgentLogger()
        assert a is b

    def test_instance_reset_allows_new_creation(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger

        a = _fresh_logger(log_file)
        WPAgentLogger._instance = None
        _close_handlers()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".log", delete=False, encoding="utf-8"
        ) as f2:
            path2 = f2.name
        try:
            b = WPAgentLogger(name="TestWPAgent", log_file=path2)
            assert a is not b
        finally:
            _close_handlers()
            try:
                os.unlink(path2)
            except PermissionError:
                pass


# ── log_heartbeat ─────────────────────────────────────────────────────────────


class TestLogHeartbeat:

    def test_alive_writes_info_with_age(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=1.5)
        content = _read_log(log_file)
        assert "[HEARTBEAT]" in content
        assert "Listener=ALIVE" in content
        assert "1.5s" in content

    def test_alive_without_age(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Cache", is_alive=True)
        content = _read_log(log_file)
        assert "Cache=ALIVE" in content

    def test_dead_with_age_writes_warning(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger, Severity

        WPAgentLogger._instance = None
        _close_handlers()
        # Route WARNING to file (default level is INFO so WARNING goes through)
        logger = WPAgentLogger(name="TestWPAgent", log_file=log_file)
        logger.log_heartbeat("Listener", is_alive=False, age_seconds=9.2)
        content = _read_log(log_file)
        assert "Listener=DEAD" in content
        assert "9.2s ago" in content
        assert "WARNING" in content

    def test_dead_no_heartbeat_ever(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Cache", is_alive=False, age_seconds=None)
        content = _read_log(log_file)
        assert "Cache=DEAD" in content
        assert "no heartbeat received" in content

    def test_dead_inf_age_treated_as_no_heartbeat(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Listener", is_alive=False, age_seconds=float("inf"))
        content = _read_log(log_file)
        assert "no heartbeat received" in content

    def test_kafka_error_writes_error_level(self, log_file):
        from utilities.WPAgentLogger import WPAgentLogger

        WPAgentLogger._instance = None
        _close_handlers()
        logger = WPAgentLogger(
            name="TestWPAgent", log_file=log_file, level=logging.DEBUG
        )
        logger.log_heartbeat(
            "Listener", is_alive=False, kafka_error="[Errno 111] Connection refused"
        )
        content = _read_log(log_file)
        assert "KAFKA-ERROR" in content
        assert "Connection refused" in content
        assert "ERROR" in content

    def test_cache_and_listener_both_logged(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=1.0)
        logger.log_heartbeat("Cache", is_alive=True, age_seconds=0.5)
        content = _read_log(log_file)
        assert "Listener=ALIVE" in content
        assert "Cache=ALIVE" in content

    def test_heartbeat_and_command_coexist(self, log_file):
        logger = _fresh_logger(log_file)
        logger.log_heartbeat("Listener", is_alive=True, age_seconds=2.1)
        logger.log_command(
            "chuck moved", command="MoveChuckContact", result={"status": "Success"}
        )
        content = _read_log(log_file)
        assert "[HEARTBEAT]" in content
        assert "MoveChuckContact" in content
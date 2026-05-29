# It is a singleton class so only one instance can be created at a time
import logging
import json
import time
from confluent_kafka import Producer as KafkaProducer


class Severity:
    DEBUG = 0
    INFO = 1
    WARNING = 2
    ERROR = 3
    CRITICAL = 4


class WPAgentLogger:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(WPAgentLogger, cls).__new__(cls)
            cls._instance._initialize(*args, **kwargs)
        return cls._instance

    def _initialize(
        self,
        name="WPAgent",
        log_file="WPAgentLogger.log",
        level=logging.INFO,
        kafka_enabled=False,
        kafka_servers="svmithi02:9096",
        kafka_topic="prober-logs",
        severity_threshold=Severity.INFO,
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.kafka_enabled = kafka_enabled
        self.kafka_topic = kafka_topic
        self.severity_threshold = severity_threshold

        if kafka_enabled:
            self.kafka_producer = KafkaProducer({"bootstrap.servers": kafka_servers})
        else:
            self.kafka_producer = None

        if not self.logger.handlers:
            formatter = logging.Formatter(
                "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
            )

            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

            stream_handler = logging.StreamHandler()
            stream_handler.setLevel(logging.ERROR)
            stream_handler.setFormatter(formatter)
            self.logger.addHandler(stream_handler)

    # ── command logging ───────────────────────────────────────────────────────

    def log_command(
        self,
        messageOut,
        severityLevel=Severity.INFO,
        command=None,
        data=None,
        result=None,
    ):
        log_method = {
            Severity.DEBUG: self.logger.debug,
            Severity.INFO: self.logger.info,
            Severity.WARNING: self.logger.warning,
            Severity.ERROR: self.logger.error,
            Severity.CRITICAL: self.logger.critical,
        }.get(severityLevel, self.logger.info)

        parts = [f"{command or 'N/A'} - {messageOut}"]
        if data is not None:
            parts.append(f"data={json.dumps(data)}")
        if result is not None:
            parts.append(f"result={json.dumps(result)}")
        log_method(" | ".join(parts))

        # Build structured log for Kafka
        log_entry = {
            "command": command,
            "messageOut": messageOut,
            "severityLevel": severityLevel,
            "data": data,
            "result": result,
        }

        if self.kafka_enabled and severityLevel >= self.severity_threshold:
            try:
                self.kafka_producer.produce(
                    self.kafka_topic,
                    key=command or "log",
                    value=json.dumps(log_entry).encode("utf-8"),
                    callback=self._delivery_report,
                )
                self.kafka_producer.poll(0)
            except Exception as e:
                self.logger.error(f"Kafka log delivery failed: {e}")

    # ── heartbeat / health logging ────────────────────────────────────────────

    def log_heartbeat(
        self,
        component: str,
        is_alive: bool,
        age_seconds: float = None,
        kafka_error: str = None,
    ):
        """Log a heartbeat health event to the file.

        Args:
            component:    Human-readable name, e.g. "Listener" or "Cache".
            is_alive:     True if a recent heartbeat was received.
            age_seconds:  How old the last heartbeat was, in seconds.
                          Pass float('inf') or None when no heartbeat seen at all.
            kafka_error:  Non-None string when the Kafka produce/consume itself
                          raised an exception (connectivity problem).
        """
        # ── build status string ───────────────────────────────────────────────
        if kafka_error:
            status = "KAFKA-ERROR"
            age_str = f"error={kafka_error}"
            severity = Severity.ERROR
        elif is_alive:
            status = "ALIVE"
            age_str = f"age={age_seconds:.1f}s" if age_seconds is not None else ""
            severity = Severity.INFO
        else:
            status = "DEAD"
            if age_seconds is None or age_seconds == float("inf"):
                age_str = "no heartbeat received"
            else:
                age_str = f"last seen {age_seconds:.1f}s ago"
            severity = Severity.WARNING

        parts = [f"[HEARTBEAT] {component}={status}"]
        if age_str:
            parts.append(age_str)

        message = " | ".join(parts)

        log_method = {
            Severity.INFO: self.logger.info,
            Severity.WARNING: self.logger.warning,
            Severity.ERROR: self.logger.error,
        }.get(severity, self.logger.info)

        log_method(message)

    # ── internal ──────────────────────────────────────────────────────────────

    def _delivery_report(self, err, msg):
        if err is not None:
            self.logger.error(f"[Kafka] Delivery failed: {err}")
        else:
            self.logger.debug(
                f"[Kafka] Log delivered to {msg.topic()} [{msg.partition()}] offset {msg.offset()}"
            )

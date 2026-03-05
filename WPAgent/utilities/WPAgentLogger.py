# It is a singleton class so only one instance can be created at a time
import logging
import json
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
        name='WPAgent',
        log_file='WPAgentLogger.log',
        level=logging.INFO,
        kafka_enabled=False,
        kafka_servers='localhost:9095',
        kafka_topic='prober-logs',
        severity_threshold=Severity.INFO
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.kafka_enabled = kafka_enabled
        self.kafka_topic = kafka_topic
        self.severity_threshold = severity_threshold

        if kafka_enabled:
            self.kafka_producer = KafkaProducer({'bootstrap.servers': kafka_servers})
        else:
            self.kafka_producer = None

        if not self.logger.handlers:
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')

            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

            stream_handler = logging.StreamHandler()
            stream_handler.setLevel(logging.ERROR)
            stream_handler.setFormatter(formatter)
            self.logger.addHandler(stream_handler)

    def log_command(self, messageOut, severityLevel=Severity.INFO, command=None, data=None, result=None):
        # Log to local logger
        log_method = {
            Severity.DEBUG: self.logger.debug,
            Severity.INFO: self.logger.info,
            Severity.WARNING: self.logger.warning,
            Severity.ERROR: self.logger.error,
            Severity.CRITICAL: self.logger.critical
        }.get(severityLevel, self.logger.info)

        log_method(f"{command or 'N/A'} - {messageOut}")

        # Build structured log
        log_entry = {
            "command": command,
            "messageOut": messageOut,
            "severityLevel": severityLevel,
            "data": data,
            "result": result
        }

        # Send to Kafka if enabled and severity is above threshold
        if self.kafka_enabled and severityLevel >= self.severity_threshold:
            try:
                self.kafka_producer.produce(
                    self.kafka_topic,
                    key=command or "log",
                    value=json.dumps(log_entry).encode('utf-8'),
                    callback=self._delivery_report
                )
                self.kafka_producer.poll(0)
            except Exception as e:
                self.logger.error(f"Kafka log delivery failed: {e}")

    def _delivery_report(self, err, msg):
        if err is not None:
            self.logger.error(f"[Kafka] Delivery failed: {err}")
        else:
            self.logger.debug(f"[Kafka] Log delivered to {msg.topic()} [{msg.partition()}] offset {msg.offset()}")

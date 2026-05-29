# It is a singleton class so only one instance can be created at a time
import logging
import json
from confluent_kafka import Producer as KafkaProducer
from datetime import datetime
from utilities.WPResponseBuilder import ResponseBuilder


class WPAgentCache:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(WPAgentCache, cls).__new__(cls)
            cls._instance._initialize(*args, **kwargs)
        return cls._instance

    def _initialize(
        self,
        name="WPAgent",
        cache_file="WPAgent.cache.json",
        kafka_enabled=False,
        kafka_servers="svmithi02:9096",
        kafka_topic="svt.wp-agent.cache",
    ):

        self.cache_file = cache_file
        self.cache = logging.getLogger(f"{name}.cache")

        self.cache = logging.getLogger(f"{name}.cache")
        self.cache.setLevel(logging.DEBUG)
        self.cache.propagate = False

        self.kafka_enabled = kafka_enabled
        self.kafka_topic = kafka_topic

        if kafka_enabled:
            self.kafka_producer = KafkaProducer({"bootstrap.servers": kafka_servers})
        else:
            self.kafka_producer = None

    def cache_command(self, TITLE=None):

        cache_entry = ResponseBuilder._build_data()
        cache_entry["lastUpdated"] = datetime.now().isoformat()

        # Rewrite the entire file each time
        with open(self.cache_file, "w") as f:
            json.dump(cache_entry, f, indent=2)
        # Kafka publish if enabled
        if self.kafka_enabled:
            try:
                self.kafka_producer.produce(
                    self.kafka_topic,
                    value=json.dumps(cache_entry).encode("utf-8"),
                    callback=self.delivery_report,
                )
                self.kafka_producer.poll(0)
            except Exception as e:
                self.cache.error(f"Kafka log delivery failed: {e}")

    def initialize_cache(self):
        self.cache_command()

    def _delivery_report(self, err, msg):
        if err is not None:
            self.cache.error(f"[Kafka] Delivery failed: {err}")
        else:
            self.cache.debug(
                f"[Kafka] Cache delivered to {msg.topic()} [{msg.partition()}] offset {msg.offset()}"
            )

# It is a singleton class so only one instance can be created at a time
import logging
import json
from confluent_kafka import Producer as KafkaProducer
from datetime import datetime

    
class WPAgentCache:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(WPAgentCache, cls).__new__(cls)
            cls._instance._initialize(*args, **kwargs)
        return cls._instance

    def _initialize(
        self,
        name='WPAgent',
        cache_file='WPAgent.cache.json',
        kafka_enabled=False,
        kafka_servers='localhost:9095',
        kafka_topic='svt.wp-agent.cache',
    ):

        self.cache = logging.getLogger(name)
        self.cache.setLevel(logging.DEBUG)

        self.kafka_enabled = kafka_enabled
        self.kafka_topic = kafka_topic

        if kafka_enabled:
            self.kafka_producer = KafkaProducer({'bootstrap.servers': kafka_servers})
        else:
            self.kafka_producer = None

        if not self.cache.handlers:
            file_handler = logging.FileHandler(cache_file)
            self.cache.addHandler(file_handler)

    def cache_command(self):
        # Build structured Cache
        log_entry = {
            "time": datetime.now().isoformat()
        }
        # Write to file (always)
        self.cache.info(json.dumps(log_entry))
        
        # Send to Kafka if enabled and severity is above threshold
        if self.kafka_enabled :
            try:
                self.kafka_producer.produce(
                    self.kafka_topic,
                    value=json.dumps(log_entry).encode('utf-8'),
                    callback=self._delivery_report
                )
                self.kafka_producer.poll(0)
            except Exception as e:
                self.cache.error(f"Kafka log delivery failed: {e}")

    def _delivery_report(self, err, msg):
        if err is not None:
            self.cache.error(f"[Kafka] Delivery failed: {err}")
        else:
            self.cache.debug(f"[Kafka] Cache delivered to {msg.topic()} [{msg.partition()}] offset {msg.offset()}")

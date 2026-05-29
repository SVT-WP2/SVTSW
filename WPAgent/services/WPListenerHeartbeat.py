"""
Listener Heartbeat System
Tracks if listener is alive and prevents commands when it's down
"""

import time
import json
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic, ConfigResource


class ListenerHealthCheck:
    """
    Monitors listener health via heartbeat messages
    """

    HEARTBEAT_TOPIC = "svt.wp-agent.heartbeat"
    HEARTBEAT_INTERVAL = 2.0  # Listener sends heartbeat every 2 seconds
    HEARTBEAT_TIMEOUT = 6.0  # Consider dead if no heartbeat for 6 seconds

    HEARTBEAT_TOPIC_CONFIG = {
        "retention.ms": "60000",
        "segment.ms": "120000",
    }

    def __init__(
        self, bootstrap_servers=None
    ):  # ← CHANGED: Added parameter with default None
        """
        Initialize listener health check

        Args:
            bootstrap_servers: Kafka broker address (e.g., "svmithi02:9092")
                              If None, uses default
        """
        # ← CHANGED: Use provided broker or default
        if bootstrap_servers:
            self.bootstrap_servers = bootstrap_servers
        else:
            # self.bootstrap_servers = 'svmithi02:9096'
            print("WARNING - Kafka broker not found")

        self._ensure_topic_exists()

        # For checking health
        # FIX: Changed 'latest' to 'earliest' so we can see existing heartbeats
        self.consumer = KafkaConsumer(
            {
                "bootstrap.servers": self.bootstrap_servers,
                "group.id": f"heartbeat-checker-{time.time()}",  # Unique group ID each time
                "auto.offset.reset": "earliest",  # FIX: Read from beginning
                "enable.auto.commit": False,  # Don't commit offsets
            }
        )
        self.consumer.subscribe([self.HEARTBEAT_TOPIC])

        # For sending heartbeats (listener side)
        self.producer = KafkaProducer({"bootstrap.servers": self.bootstrap_servers})

    def _ensure_topic_exists(self):
        admin = AdminClient({"bootstrap.servers": self.bootstrap_servers})
        metadata = admin.list_topics(timeout=5)

        if self.HEARTBEAT_TOPIC not in metadata.topics:
            # Topic doesn't exist — create with correct config
            new_topic = NewTopic(
                topic=self.HEARTBEAT_TOPIC,
                num_partitions=1,
                replication_factor=1,
                config=self.HEARTBEAT_TOPIC_CONFIG,
            )
            fs = admin.create_topics([new_topic])
            try:
                fs[self.HEARTBEAT_TOPIC].result()
                print(f"[✅ Heartbeat Topic Created] {self.HEARTBEAT_TOPIC}")
            except Exception as e:
                print(f"[⚠️ Heartbeat Topic Error] {e}")
        else:
            # Topic exists — enforce config on every startup
            resource = ConfigResource("topic", self.HEARTBEAT_TOPIC)
            for key, value in self.HEARTBEAT_TOPIC_CONFIG.items():
                resource.set_config(key, value)
            fs = admin.alter_configs([resource])
            try:
                fs[resource].result()
                print(f"[✅ Heartbeat Topic Config Updated] {self.HEARTBEAT_TOPIC}")
            except Exception as e:
                print(f"[⚠️ Heartbeat Topic Config Error] {e}")

    def send_heartbeat(self):
        """Send heartbeat (called by listener)"""
        heartbeat = {"timestamp": time.time(), "status": "alive"}

        self.producer.produce(
            self.HEARTBEAT_TOPIC, value=json.dumps(heartbeat).encode("utf-8")
        )
        self.producer.poll(0)

    def is_listener_alive(self, timeout=2.0):
        """
        Check if listener is alive by looking for recent heartbeat

        Args:
            timeout: How long to wait for heartbeat (seconds)

        Returns:
            tuple: (is_alive: bool, last_heartbeat_age: float)
        """
        start_time = time.time()
        last_heartbeat_time = None
        current_time = time.time()

        # Poll for recent heartbeat
        while time.time() - start_time < timeout:
            msg = self.consumer.poll(0.1)

            if msg and not msg.error():
                try:
                    heartbeat = json.loads(msg.value().decode("utf-8"))
                    heartbeat_time = heartbeat.get("timestamp")

                    if heartbeat_time:
                        age = current_time - heartbeat_time

                        # If heartbeat is recent enough, listener is alive
                        if age < self.HEARTBEAT_TIMEOUT:
                            return True, age

                        # Keep track of most recent heartbeat
                        if (
                            last_heartbeat_time is None
                            or heartbeat_time > last_heartbeat_time
                        ):
                            last_heartbeat_time = heartbeat_time

                except Exception:
                    # Silently ignore parse errors
                    pass

        # No recent heartbeat found
        if last_heartbeat_time:
            age = current_time - last_heartbeat_time
            return False, age
        else:
            return False, float("inf")

    def wait_for_listener(self, max_wait=30.0, check_interval=2.0):
        """
        Wait until listener comes online

        Args:
            max_wait: Maximum time to wait (seconds)
            check_interval: How often to check (seconds)

        Returns:
            bool: True if listener came online, False if timeout
        """
        print(f"⏳ Waiting for listener to come online (max {max_wait}s)...")

        start = time.time()
        while time.time() - start < max_wait:
            is_alive, age = self.is_listener_alive(timeout=check_interval)

            if is_alive:
                print(f"✅ Listener is online! (heartbeat age: {age:.1f}s)")
                return True

            elapsed = time.time() - start
            print(f"   Still waiting... ({elapsed:.0f}s elapsed)")
            time.sleep(check_interval)

        print(f"❌ Timeout: Listener did not come online within {max_wait}s")
        return False

    def close(self):
        """Clean up resources"""
        self.consumer.close()
        self.producer.flush()


class ListenerHealthMonitor:
    """
    Background thread that sends heartbeats (runs in listener)
    """

    def __init__(self, health_check: ListenerHealthCheck):
        self.health_check = health_check
        self.running = False
        self._thread = None

    def _get_logger(self):
        try:
            from utilities.WPAgentLogger import WPAgentLogger

            return WPAgentLogger()
        except Exception:
            return None

    def start(self):
        """Start sending heartbeats"""
        import threading

        self.running = True

        def heartbeat_loop():
            print(
                f"💓 Heartbeat monitor started (interval: {self.health_check.HEARTBEAT_INTERVAL}s)"
            )

            while self.running:
                try:
                    self.health_check.send_heartbeat()
                    time.sleep(self.health_check.HEARTBEAT_INTERVAL)
                except Exception as e:
                    logger = self._get_logger()
                    if logger:
                        logger.log_heartbeat(
                            "Listener", is_alive=False, kafka_error=str(e)
                        )

        self._thread = threading.Thread(target=heartbeat_loop, daemon=False)
        self._thread.start()

    def stop(self):
        """Stop sending heartbeats"""
        self.running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        self.health_check.producer.flush(timeout=2.0)
        print("💔 Heartbeat monitor stopped")

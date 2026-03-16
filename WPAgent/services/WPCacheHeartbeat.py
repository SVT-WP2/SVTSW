"""
Cache Heartbeat System
"""

import time
import json
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic


class CacheHealthCheck:
    """
    Cache heartbeat
    """

    HEARTBEAT_TOPIC = "svt.wp-agent.cache-heartbeat"
    HEARTBEAT_INTERVAL = 2.0  # Cache heartbeat every 2 seconds
    HEARTBEAT_TIMEOUT = 6.0  # Consider dead if no heartbeat for 6 seconds

    def __init__(self, bootstrap_servers='localhost:9095'):
        self.bootstrap_servers = bootstrap_servers
        self._ensure_topic_exists()

        # For checking health
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': f'heartbeat-checker-{time.time()}',  # Unique group ID each time
            'auto.offset.reset': 'earliest',  # FIX: Read from beginning
            'enable.auto.commit': False  # Don't commit offsets
        })
        self.consumer.subscribe([self.HEARTBEAT_TOPIC])

        # For sending heartbeats (listener side)
        self.producer = KafkaProducer({
            'bootstrap.servers': self.bootstrap_servers
        })

    def _ensure_topic_exists(self):
        """Create heartbeat topic if it doesn't exist"""
        admin = AdminClient({'bootstrap.servers': self.bootstrap_servers})
        metadata = admin.list_topics(timeout=5)

        if self.HEARTBEAT_TOPIC not in metadata.topics:
            new_topic = NewTopic(
                topic=self.HEARTBEAT_TOPIC,
                num_partitions=1,
                replication_factor=1
            )
            fs = admin.create_topics([new_topic])
            try:
                fs[self.HEARTBEAT_TOPIC].result()
                print(f"[✅ Heartbeat Topic Created] {self.HEARTBEAT_TOPIC}")
            except Exception as e:
                print(f"[⚠️ Heartbeat Topic Error] {e}")

    def send_heartbeat(self):
        """Send heartbeat (called by listener)"""
        heartbeat = {
            "timestamp": time.time(),
            "status": "alive"
        }

        self.producer.produce(
            self.HEARTBEAT_TOPIC,
            value=json.dumps(heartbeat).encode("utf-8")
        )
        self.producer.poll(0)

    def is_cache_alive(self, timeout=2.0):
        """
        Check if cache is alive by looking for recent heartbeat

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
                        age = time.time() - heartbeat_time

                        # If heartbeat is recent enough, cache is alive
                        if age < self.HEARTBEAT_TIMEOUT:
                            return True, age

                        # Keep track of most recent heartbeat
                        if last_heartbeat_time is None or heartbeat_time > last_heartbeat_time:
                            last_heartbeat_time = heartbeat_time

                except Exception as e:
                    # Silently ignore parse errors
                    pass

        # No recent heartbeat found
        if last_heartbeat_time:
            age = current_time - last_heartbeat_time
            return False, age
        else:
            return False, float('inf')

    def wait_for_cache(self, max_wait=30.0, check_interval=2.0):
        """
        Wait until cache comes online

        Args:
            max_wait: Maximum time to wait (seconds)
            check_interval: How often to check (seconds)

        Returns:
            bool: True if cache came online, False if timeout
        """
        print(f"⏳ Waiting for cache to come online (max {max_wait}s)...")

        start = time.time()
        while time.time() - start < max_wait:
            is_alive, age = self.is_cache_alive(timeout=check_interval)

            if is_alive:
                print(f"✅ Cache is online! (heartbeat age: {age:.1f}s)")
                return True

            elapsed = time.time() - start
            print(f"   Still waiting... ({elapsed:.0f}s elapsed)")
            time.sleep(check_interval)

        print(f"❌ Timeout: Cache did not come online within {max_wait}s")
        return False

    def close(self):
        """Clean up resources"""
        self.consumer.close()
        self.producer.flush()


class CacheHealthMonitor:
    def __init__(self, cache_check: CacheHealthCheck, on_heartbeat=None):
        self.cache_check = cache_check
        self.on_heartbeat = on_heartbeat   # ← callable, or None
        self.running = False
        self._thread = None

    def start(self):
        import threading
        self.running = True

        def heartbeat_loop():
            print(f"💓 Cache Heartbeat monitor started (interval: {self.cache_check.HEARTBEAT_INTERVAL}s)")
            while self.running:
                try:
                    self.cache_check.send_heartbeat()

                    if self.on_heartbeat:        # ← call snapshot if provided
                        self.on_heartbeat()

                    time.sleep(self.cache_check.HEARTBEAT_INTERVAL)
                except Exception as e:
                    print(f"⚠️ Cache Heartbeat error: {e}")

        self._thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self._thread.start()


    def stop(self):
        """Stop sending heartbeats"""
        self.running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        print("💔 Cache Heartbeat monitor stopped")
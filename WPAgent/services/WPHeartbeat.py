"""
WPHeartbeat - Base unified heartbeat base + Listener and Cache subclasses

Architecture:
    HeartbeatBase
        ListenerHealthCheck  - is_listener_alive(), wait_for_listener()
        CacheHealthCheck     - is_cache_alive(),    wait_for_cache()
    HeartbeatMonitorBase
        ListenerHealthMonitor  (no callback)
        CacheHealthMonitor     (on_heartbeat callback for snapshot writes)
"""

import json
import time
import threading

from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic, ConfigResource


_HEARTBEAT_TOPIC_CONFIG = {
    "retention.ms": "60000",
    "segment.ms":   "120000",
}


class HeartbeatBase:
    """
    Shared Kafka plumbing. Subclasses declare HEARTBEAT_TOPIC and expose
    component-specific public methods that delegate to _is_alive() /
    _wait_for_online().
    """

    HEARTBEAT_TOPIC    = ""
    HEARTBEAT_INTERVAL = 2.0
    HEARTBEAT_TIMEOUT  = 6.0

    def __init__(self, bootstrap_servers=None):
        self.bootstrap_servers = bootstrap_servers

        if not bootstrap_servers:
            print(f"WARNING - Kafka broker not found for {self.__class__.__name__}")
            self.producer = None
            self.consumer = None
            return

        self._ensure_topic_exists()

        self.consumer = KafkaConsumer(
            {
                "bootstrap.servers":  bootstrap_servers,
                "group.id":           f"heartbeat-checker-{self.__class__.__name__}-{time.time()}",
                "auto.offset.reset":  "earliest",
                "enable.auto.commit": False,
            }
        )
        self.consumer.subscribe([self.HEARTBEAT_TOPIC])
        self.producer = KafkaProducer({"bootstrap.servers": bootstrap_servers})

    def _ensure_topic_exists(self):
        admin    = AdminClient({"bootstrap.servers": self.bootstrap_servers})
        metadata = admin.list_topics(timeout=5)

        if self.HEARTBEAT_TOPIC not in metadata.topics:
            new_topic = NewTopic(
                topic=self.HEARTBEAT_TOPIC,
                num_partitions=1,
                replication_factor=1,
                config=_HEARTBEAT_TOPIC_CONFIG,
            )
            fs = admin.create_topics([new_topic])
            try:
                fs[self.HEARTBEAT_TOPIC].result()
                print(f"[OK Heartbeat Topic Created] {self.HEARTBEAT_TOPIC}")
            except Exception as e:
                print(f"[WARN Heartbeat Topic Error] {e}")
        else:
            resource = ConfigResource("topic", self.HEARTBEAT_TOPIC)
            for key, value in _HEARTBEAT_TOPIC_CONFIG.items():
                resource.set_config(key, value)
            fs = admin.alter_configs([resource])
            try:
                fs[resource].result()
                print(f"[OK Heartbeat Topic Config Updated] {self.HEARTBEAT_TOPIC}")
            except Exception as e:
                print(f"[WARN Heartbeat Topic Config Error] {e}")

    def send_heartbeat(self):
        if not self.producer:
            return
        heartbeat = {"timestamp": time.time(), "status": "alive"}
        self.producer.produce(
            self.HEARTBEAT_TOPIC,
            value=json.dumps(heartbeat).encode("utf-8"),
        )
        self.producer.poll(0)

    def _is_alive(self, timeout=2.0):
        if not self.consumer:
            return False, float("inf")

        start_time          = time.time()
        current_time        = time.time()
        last_heartbeat_time = None

        while time.time() - start_time < timeout:
            msg = self.consumer.poll(0.1)
            if msg and not msg.error():
                try:
                    heartbeat      = json.loads(msg.value().decode("utf-8"))
                    heartbeat_time = heartbeat.get("timestamp")
                    if heartbeat_time:
                        age = current_time - heartbeat_time
                        if age < self.HEARTBEAT_TIMEOUT:
                            return True, age
                        if last_heartbeat_time is None or heartbeat_time > last_heartbeat_time:
                            last_heartbeat_time = heartbeat_time
                except Exception:
                    pass

        if last_heartbeat_time:
            return False, current_time - last_heartbeat_time
        return False, float("inf")

    def _wait_for_online(self, label, max_wait=30.0, check_interval=2.0):
        print(f"Waiting for {label} to come online (max {max_wait}s)...")
        start = time.time()
        while time.time() - start < max_wait:
            is_alive, age = self._is_alive(timeout=check_interval)
            if is_alive:
                print(f"{label.capitalize()} is online! (heartbeat age: {age:.1f}s)")
                return True
            elapsed = time.time() - start
            print(f"   Still waiting... ({elapsed:.0f}s elapsed)")
            time.sleep(check_interval)
        print(f"Timeout: {label.capitalize()} did not come online within {max_wait}s")
        return False

    def close(self):
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.flush()


class ListenerHealthCheck(HeartbeatBase):
    HEARTBEAT_TOPIC = "svt.wp-agent.heartbeat"

    def is_listener_alive(self, timeout=2.0):
        return self._is_alive(timeout)

    def wait_for_listener(self, max_wait=30.0, check_interval=2.0):
        return self._wait_for_online("listener", max_wait, check_interval)


class CacheHealthCheck(HeartbeatBase):
    HEARTBEAT_TOPIC = "svt.wp-agent.cache-heartbeat"

    def is_cache_alive(self, timeout=2.0):
        return self._is_alive(timeout)

    def wait_for_cache(self, max_wait=30.0, check_interval=2.0):
        return self._wait_for_online("cache", max_wait, check_interval)


class HeartbeatMonitorBase:
    """Background thread that calls send_heartbeat() on a fixed interval."""

    def __init__(self, health_check: HeartbeatBase):
        self.health_check = health_check
        self.running      = False
        self._thread      = None

    def _component_label(self):
        return self.health_check.__class__.__name__

    def _get_logger(self):
        try:
            from utilities.WPAgentLogger import WPAgentLogger
            return WPAgentLogger()
        except Exception:
            return None

    def _on_beat(self):
        """Hook called after every successful beat. Override in subclasses."""
        pass

    def start(self):
        self.running = True
        label = self._component_label()

        def heartbeat_loop():
            print(f"Heartbeat monitor started: {label} (interval: {self.health_check.HEARTBEAT_INTERVAL}s)")
            while self.running:
                try:
                    self.health_check.send_heartbeat()
                    self._on_beat()
                except Exception as e:
                    logger = self._get_logger()
                    if logger:
                        component = "Cache" if "Cache" in label else "Listener"
                        logger.log_heartbeat(component, is_alive=False, kafka_error=str(e))
                time.sleep(self.health_check.HEARTBEAT_INTERVAL)
        self._thread = threading.Thread(target=heartbeat_loop, daemon=False)
        self._thread.start()

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        if self.health_check.producer:
            self.health_check.producer.flush(timeout=2.0)
        print(f"Heartbeat monitor stopped: {self._component_label()}")


class ListenerHealthMonitor(HeartbeatMonitorBase):
    def __init__(self, health_check: ListenerHealthCheck):
        super().__init__(health_check)


class CacheHealthMonitor(HeartbeatMonitorBase):
    def __init__(self, cache_check: CacheHealthCheck, on_heartbeat=None):
        super().__init__(cache_check)
        self.on_heartbeat = on_heartbeat

    def _on_beat(self):
        if self.on_heartbeat:
            self.on_heartbeat()

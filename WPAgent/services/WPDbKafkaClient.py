"""
Kafka client specifically for DB Agent communication.
"""

from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import uuid
import time
from typing import Optional, List
from utilities.WPAgentTypes import KafkaPayload


class DBKafkaClient:
    """Singleton Kafka client for DB Agent communication."""

    _instance: Optional["DBKafkaClient"] = None

    # =========================================================================
    # Singleton
    # =========================================================================

    @classmethod
    def get_instance(cls, bootstrap_servers=None) -> "DBKafkaClient":
        """Get or create singleton instance."""
        if cls._instance is None:
            cls._instance = cls.__new__(cls)
            cls._instance._initialize(bootstrap_servers)
        return cls._instance

    def __init__(self):
        raise RuntimeError("Use DBKafkaClient.get_instance() instead of direct instantiation.")

    def _initialize(self, bootstrap_servers: Optional[str]):
        """Internal init — only called once by get_instance()."""
        if not bootstrap_servers:
            raise ValueError(
                "DBKafkaClient requires a bootstrap_servers address. "
                "Call get_instance(bootstrap_servers='host:port')."
            )

        self.DB_BROKER = bootstrap_servers
        self.DB_REQUEST_TOPIC = "svt.db-agent.request"
        self.DB_REPLY_TOPIC = "svt.db-agent.request.reply"

        print(f"🔌 Initializing DB Kafka Client — broker: {bootstrap_servers}")
        print(f"   Request topic: {self.DB_REQUEST_TOPIC}")
        print(f"   Reply topic:   {self.DB_REPLY_TOPIC}")

        self._ensure_topics_exist()

        self.producer = KafkaProducer({
            "bootstrap.servers": self.DB_BROKER,
            "request.timeout.ms": 30000,
            "socket.timeout.ms": 30000,
        })

        self.consumer = KafkaConsumer({
            "bootstrap.servers": self.DB_BROKER,
            "group.id": f"wp-agent-db-consumer-{uuid.uuid4().hex[:8]}",
            "auto.offset.reset": "latest",
            "enable.auto.commit": False,
            "session.timeout.ms": 10000,
            "heartbeat.interval.ms": 3000,
            "max.poll.interval.ms": 120000,
        })
        self.consumer.subscribe([self.DB_REPLY_TOPIC])
        self._wait_for_assignment()
        print("✅ DB Kafka Client initialized successfully")

    # =========================================================================
    # Kafka plumbing
    # =========================================================================

    def _wait_for_assignment(self, timeout: float = 5.0) -> bool:
        """Wait until consumer is assigned to at least one partition."""
        start = time.time()
        while time.time() - start < timeout:
            self.consumer.poll(0.1)
            if self.consumer.assignment():
                parts = [f"{p.topic}[{p.partition}]" for p in self.consumer.assignment()]
                print(f"   ✅ Consumer assigned to partition(s): {', '.join(parts)}")
                return True
        print(f"   ⚠️  Consumer not assigned within {timeout}s — replies may be missed")
        return False

    def _ensure_topics_exist(self):
        """Create required topics if they don't exist."""
        admin = AdminClient({"bootstrap.servers": self.DB_BROKER})
        try:
            existing = set(admin.list_topics(timeout=5).topics.keys())
            to_create = [
                NewTopic(t, num_partitions=1, replication_factor=1)
                for t in [self.DB_REQUEST_TOPIC, self.DB_REPLY_TOPIC]
                if t not in existing
            ]
            if not to_create:
                print("   ✅ All DB topics already exist")
                return
            for topic, future in admin.create_topics(to_create).items():
                try:
                    future.result()
                    print(f"   ✅ Topic created: {topic}")
                except Exception as e:
                    print(f"   ⚠️  Topic creation error for {topic}: {e}")
        except Exception as e:
            print(f"   ⚠️  Error checking topics: {e}")

    def _send_request(self, message_type: str, data: dict, correlation_id: str) -> bool:
        """Produce a request message to the DB request topic. Returns True on success."""
        payload = {"type": message_type, "data": data}
        headers = [
            ("kafka_correlationId", correlation_id.encode("utf-8")),
            ("kafka_replyTopic", self.DB_REPLY_TOPIC.encode("utf-8")),
            ("kafka_replyPartition", b"0"),
        ]
        try:
            self.producer.produce(
                self.DB_REQUEST_TOPIC,
                value=json.dumps(payload).encode("utf-8"),
                headers=headers,
            )
            self.producer.flush()
            print(f"📤 Sent DB request: {message_type} (corr: {correlation_id[:8]}...)")
            return True
        except Exception as e:
            print(f"❌ Failed to send request: {e}")
            return False

    def _wait_for_reply(self, correlation_id: str, timeout: float) -> Optional[KafkaPayload]:
        """Poll the reply topic until we get our correlated response or timeout."""
        start = time.time()
        messages_seen = 0

        while time.time() - start < timeout:
            msg = self.consumer.poll(0.05)
            if msg is None:
                continue
            if msg.error():
                print(f"   ⚠️  Consumer error: {msg.error()}")
                continue

            messages_seen += 1
            try:
                headers = {k: v for k, v in (msg.headers() or [])}
                corr = headers.get("kafka_correlationId")
                if not corr or corr.decode("utf-8") != correlation_id:
                    continue

                value = json.loads(msg.value().decode("utf-8"))
                print(f"✅ Received reply (status: {value.get('status')}, type: '{value.get('type', '')}')")
                return value

            except Exception as e:
                print(f"   ⚠️  Error processing message: {e}")
                continue

        print(f"⏱️  Timeout waiting for DB reply ({timeout}s), messages seen: {messages_seen}")
        return None

    def request_reply(
        self,
        message_type: str,
        data: dict,
        reply_type: str,
        timeout: float = 10.0,
    ) -> Optional[KafkaPayload]:
        """Send a request and wait for the correlated reply."""
        correlation_id = str(uuid.uuid4())
        if not self._send_request(message_type, data, correlation_id):
            return None
        return self._wait_for_reply(correlation_id, timeout)

    # =========================================================================
    # High-level DB operations
    # =========================================================================

    def get_all_wafer_probe_projects(self, timeout: float = 15.0) -> List[dict]:
        """Get all wafer probe projects. Returns list or empty list on failure."""
        result = self.request_reply("GetAllWaferProbeProjects", {}, "GetAllWaferProbeProjectsReply", timeout)
        if result and result.get("status") == "Success":
            return result.get("data", {}).get("items", [])
        return []

    def get_all_wafer_probe_machines(self, timeout: float = 15.0) -> List[dict]:
        """Get all wafer probe machines. Returns list or empty list on failure."""
        result = self.request_reply("GetAllWaferProbeMachines", {}, "GetAllWaferProbeMachinesReply", timeout)
        if result and result.get("status") == "Success":
            return result.get("data", {}).get("items", [])
        return []

    def get_all_asic_by_id(self, asic_id: int, timeout: float = 15.0) -> Optional[KafkaPayload]:
        """
        Get ASIC by ID. Returns the full response dict on success, or None on failure.
        Callers should use result.get('data', {}).get('items', []).
        """
        result = self.request_reply(
            "GetAllAsics",
            {"filter": {"ids": [asic_id]}, "pager": {"limit": 1, "offset": 0}},
            "GetAllAsicsReply",
            timeout,
        )
        if result and result.get("status") == "Success":
            return result
        return None

    def update_machine_loaded_wafer(
        self, wp_machine_id: int, wafer_id, orientation, timeout: float = 15.0
    ) -> bool:
        """Update loaded wafer on machine. Returns True on success."""
        result = self.request_reply(
            "UpdateWpMachineLoadedWafer",
            {"wpMachineId": wp_machine_id, "loadedWaferId": wafer_id, "orientation": orientation},
            "UpdateWpMachineLoadedWaferReply",
            timeout,
        )
        return result is not None and result.get("status") == "Success"

    def update_machine_installed_probe_card(
        self, wp_machine_id: int, probe_card_id, orientation, timeout: float = 15.0
    ) -> bool:
        """Update installed probe card on machine. Returns True on success."""
        result = self.request_reply(
            "UpdateWpMachineInstalledProbeCard",
            {"wpMachineId": wp_machine_id, "installedProbeCardId": probe_card_id, "orientation": orientation},
            "UpdateWpMachineInstalledProbeCardReply",
            timeout,
        )
        return result is not None and result.get("status") == "Success"

    def test_connection(self, timeout: float = 5.0) -> bool:
        """Test if DB Agent is reachable."""
        print("🔍 Testing DB Agent connection...")
        result = self.request_reply("GetAllWaferProbeMachines", {}, "GetAllWaferProbeMachinesReply", timeout)
        if result:
            print("✅ DB Agent is reachable")
            return True
        print("❌ DB Agent is not responding")
        return False

    # =========================================================================
    # Lifecycle
    # =========================================================================

    def close(self):
        """Clean up Kafka resources."""
        print("🔄 Closing DB Kafka Client...")
        if hasattr(self, "consumer") and self.consumer:
            self.consumer.close()
        if hasattr(self, "producer") and self.producer:
            self.producer.flush()
        DBKafkaClient._instance = None
        print("✅ DB Kafka Client closed")

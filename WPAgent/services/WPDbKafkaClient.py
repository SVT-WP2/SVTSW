"""
Kafka client specifically for DB Agent communication

UPDATED: Accepts bootstrap_servers parameter for dynamic broker configuration
"""
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import uuid
import time
from typing import Optional, Dict, Any


class DBKafkaClient:
    """Singleton Kafka client specifically for DB Agent communication"""

    _instance = None

    @classmethod
    def get_instance(cls, bootstrap_servers=None):  # ← CHANGED: Added parameter
        """Get or create singleton instance"""
        if cls._instance is None:
            cls._instance = cls(bootstrap_servers=bootstrap_servers)
        return cls._instance

    def __init__(self, bootstrap_servers=None):  # ← CHANGED: Added parameter
        """
        Initialize DB Kafka Client

        Args:
            bootstrap_servers: Kafka broker address (e.g., "svmithi02:9096")
                              If None, uses default
        """
        if DBKafkaClient._instance is not None:
            raise RuntimeError("DBKafkaClient is a singleton. Use get_instance() instead.")

        # ============================================================
        # NEW: Use provided broker or fallback to default
        # ============================================================
        if bootstrap_servers:
            self.DB_BROKER = bootstrap_servers
            print(f"🔌 Using DB Kafka broker from config: {bootstrap_servers}")
        else:
            self.DB_BROKER = "svmithi02:9096"  # Default
            print(f"🔌 Using default DB Kafka broker: {self.DB_BROKER}")
        # ============================================================

        self.DB_REQUEST_TOPIC = "svt.db-agent.request"
        self.DB_REPLY_TOPIC = "svt.db-agent.request.reply"

        print(f"🔄 Initializing DB Kafka Client...")
        print(f"   Broker: {self.DB_BROKER}")
        print(f"   Request Topic: {self.DB_REQUEST_TOPIC}")
        print(f"   Reply Topic: {self.DB_REPLY_TOPIC}")

        # Ensure topics exist
        self._ensure_topics_exist()

        # Create producer
        self.producer = KafkaProducer({
            'bootstrap.servers': self.DB_BROKER,
            'request.timeout.ms': 30000,
            'socket.timeout.ms': 30000
        })

        # Create consumer with stable group ID
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.DB_BROKER,
            'group.id': 'wp-agent-db-consumer',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': False,
            'session.timeout.ms': 10000,
            'heartbeat.interval.ms': 3000,
            'max.poll.interval.ms': 120000
        })

        # Subscribe to reply topic
        self.consumer.subscribe([self.DB_REPLY_TOPIC])

        # Warm up consumer
        print(f"   Warming up consumer...")
        for _ in range(3):
            self.consumer.poll(0.05)

        print(f"✅ DB Kafka Client initialized successfully")

        # Mark singleton as created
        DBKafkaClient._instance = self

    def _ensure_topics_exist(self):
        """Ensure required Kafka topics exist"""
        admin = AdminClient({'bootstrap.servers': self.DB_BROKER})

        try:
            metadata = admin.list_topics(timeout=5)
            existing_topics = set(metadata.topics.keys())

            topics_to_create = []

            if self.DB_REQUEST_TOPIC not in existing_topics:
                topics_to_create.append(NewTopic(
                    self.DB_REQUEST_TOPIC,
                    num_partitions=1,
                    replication_factor=1
                ))

            if self.DB_REPLY_TOPIC not in existing_topics:
                topics_to_create.append(NewTopic(
                    self.DB_REPLY_TOPIC,
                    num_partitions=1,
                    replication_factor=1
                ))

            if topics_to_create:
                fs = admin.create_topics(topics_to_create)
                for topic, future in fs.items():
                    try:
                        future.result()
                        print(f"   ✅ Topic created: {topic}")
                    except Exception as e:
                        print(f"   ⚠️  Topic creation error for {topic}: {e}")
            else:
                print(f"   ✅ All topics already exist")

        except Exception as e:
            print(f"   ⚠️  Error checking topics: {e}")

    def request_reply(
            self,
            message_type: str,
            data: Dict[str, Any],
            reply_type: str,
            timeout: float = 10.0,
            use_requestId: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Send request and wait for reply using SVT Kafka conventions

        Args:
            message_type: Type of message (e.g., "GetAllWaferProbeMachines")
            data: Data payload
            reply_type: Expected reply type (can be empty string)
            timeout: Timeout in seconds
            use_requestId: IGNORED - we always use correlationId in headers

        Returns:
            Reply dict or None if timeout
        """
        # Generate correlation ID for SVT convention
        correlation_id = str(uuid.uuid4())

        # Build payload (NO requestId in body)
        payload = {
            "type": message_type,
            "data": data
        }

        # SVT Kafka headers
        headers = [
            ("kafka_correlationId", correlation_id.encode("utf-8")),
            ("kafka_replyTopic", self.DB_REPLY_TOPIC.encode("utf-8")),
            ("kafka_replyPartition", b"0")
        ]

        # Send request
        try:
            self.producer.produce(
                self.DB_REQUEST_TOPIC,
                value=json.dumps(payload).encode("utf-8"),
                headers=headers
            )
            self.producer.flush()

            print(f"📤 Sent DB request: {message_type} (correlation: {correlation_id[:8]}...)")

        except Exception as e:
            print(f"❌ Failed to send request: {e}")
            return None

        # Wait for reply
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
                # Check correlation ID in headers
                msg_headers = {k: v for k, v in (msg.headers() or [])}
                msg_corr_id = msg_headers.get("kafka_correlationId")

                if not msg_corr_id:
                    continue

                msg_corr_str = msg_corr_id.decode("utf-8")

                # Check if this is our message
                if msg_corr_str != correlation_id:
                    continue

                # Parse response
                value = json.loads(msg.value().decode("utf-8"))

                status = value.get("status")
                received_type = value.get("type", "")

                print(f"✅ Received reply (status: {status}, type: '{received_type}')")

                # Return the full response
                return value

            except Exception as e:
                print(f"   ⚠️  Error processing message: {e}")
                continue

        print(f"⏱️  Timeout waiting for DB reply ({timeout}s)")
        print(f"   Messages seen: {messages_seen}")
        return None

    def get_all_wafer_probe_projects(self, timeout: float = 15.0):
        """Get all wafer probe projects from database"""
        result = self.request_reply(
            message_type="GetAllWaferProbeProjects",
            data={},
            reply_type="GetAllWaferProbeProjectsReply",
            timeout=timeout
        )

        if result and result.get("status") == "Success":
            return result.get("data", {}).get("items", [])
        return []

    def get_all_wafer_probe_machines(self, timeout: float = 15.0):
        """Get all wafer probe machines from database"""
        result = self.request_reply(
            message_type="GetAllWaferProbeMachines",
            data={},
            reply_type="GetAllWaferProbeMachinesReply",
            timeout=timeout
        )

        if result and result.get("status") == "Success":
            return result.get("data", {}).get("items", [])
        return []

    def get_all_asic_by_id(self, asicId: int, timeout: float = 15.0):
        """Get all asics  from database"""
        result = self.request_reply(
            message_type="GetAllAsics",
            data={
                "filter": {
                    "ids": [asicId]
                },
                "pager": {
                    "limit": 1,  # Only need 1 result
                    "offset": 0
                }
            },
            reply_type="GetAllAsicsReply",
            timeout=timeout
        )

        if result and result.get("status") == "Success":
            return result
        return []

    def update_machine_loaded_wafer(self, wp_machine_id: int, wafer_id, orientation, timeout: float = 15.0):
        """Update loaded wafer on machine"""
        result = self.request_reply(
            message_type="UpdateWpMachineLoadedWafer",
            data={
                "wpMachineId": wp_machine_id,
                "loadedWaferId": wafer_id,
                "orientation": orientation
            },
            reply_type="UpdateWpMachineLoadedWaferReply",
            timeout=timeout
        )

        return result and result.get("status") == "Success"

    def update_machine_installed_probe_card(self, wp_machine_id: int, probe_card_id, orientation,
                                            timeout: float = 15.0):
        """Update installed probe card on machine"""
        result = self.request_reply(
            message_type="UpdateWpMachineInstalledProbeCard",
            data={
                "wpMachineId": wp_machine_id,
                "installedProbeCardId": probe_card_id,
                "orientation": orientation
            },
            reply_type="UpdateWpMachineInstalledProbeCardReply",
            timeout=timeout
        )

        return result and result.get("status") == "Success"

    def test_connection(self, timeout: float = 5.0) -> bool:
        """Test if DB Agent is reachable"""
        print(f"🔍 Testing DB Agent connection...")

        result = self.request_reply(
            message_type="GetAllWaferProbeMachines",
            data={"filter": {"ids": []}},
            reply_type="GetAllWaferProbeMachinesReply",
            timeout=timeout
        )

        if result:
            print(f"✅ DB Agent is reachable")
            return True
        else:
            print(f"❌ DB Agent is not responding")
            return False

    def close(self):
        """Clean up resources"""
        print(f"🔄 Closing DB Kafka Client...")
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.flush()
        print(f"✅ DB Kafka Client closed")
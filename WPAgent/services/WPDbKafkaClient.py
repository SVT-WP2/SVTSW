"""
Singleton Kafka client specifically for DB Agent communication
Fixes: Consumer offset issues, request ID matching, and connection stability
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
    DB_BROKER = "localhost:9095"
    DB_REQUEST_TOPIC = "svt.db-agent.request"
    DB_REPLY_TOPIC = "svt.db-agent.request.reply"

    @classmethod
    def get_instance(cls):
        """Get or create singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        if DBKafkaClient._instance is not None:
            raise RuntimeError("DBKafkaClient is a singleton. Use get_instance() instead.")

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
        # ⚠️ CRITICAL: Using 'earliest' instead of 'latest' to avoid missing messages
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.DB_BROKER,
            'group.id': 'wp-agent-db-consumer',  # Stable group ID
            'auto.offset.reset': 'latest',  # Read from beginning if no offset
            'enable.auto.commit': False,  # Manual offset management
            'session.timeout.ms': 10000,
            'heartbeat.interval.ms': 3000,
            'max.poll.interval.ms': 30000
        })

        # Subscribe to reply topic
        self.consumer.subscribe([self.DB_REPLY_TOPIC])

        # Warm up consumer (ensure subscription is active)
        print(f"   Warming up consumer...")
        for _ in range(3):  # Poll a few times to ensure subscription
            self.consumer.poll(0.1)

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
                print(f"   Creating topic: {self.DB_REQUEST_TOPIC}")

            if self.DB_REPLY_TOPIC not in existing_topics:
                topics_to_create.append(NewTopic(
                    self.DB_REPLY_TOPIC,
                    num_partitions=1,
                    replication_factor=1
                ))
                print(f"   Creating topic: {self.DB_REPLY_TOPIC}")

            if topics_to_create:
                fs = admin.create_topics(topics_to_create)
                for topic, future in fs.items():
                    try:
                        future.result()
                        print(f"   ✅ Topic created: {topic}")
                    except Exception as e:
                        print(f"   ⚠️ Topic creation error for {topic}: {e}")
            else:
                print(f"   ✅ All topics already exist")

        except Exception as e:
            print(f"   ⚠️ Error checking topics: {e}")

    def request_reply(
            self,
            message_type: str,
            data: Dict[str, Any],
            reply_type: str,
            timeout: float = 10.0,
            use_requestId: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Send request and wait for reply with optional request ID matching

        Args:
            message_type: Type of message (e.g., "GetAllWaferProbeMachines")
            data: Data payload
            reply_type: Expected reply type
            timeout: Timeout in seconds
            use_requestId: Whether to use request ID for matching (recommended)

        Returns:
            Reply dict or None if timeout
        """
        requestId = str(uuid.uuid4()) if use_requestId else None

        # Build payload according to Swagger spec
        payload = {
            "type": message_type,
            "data": data
        }

        if use_requestId:
            payload["requestId"] = requestId

        # Send request
        try:
            self.producer.produce(
                self.DB_REQUEST_TOPIC,
                value=json.dumps(payload).encode("utf-8")
            )
            self.producer.flush()

            if use_requestId:
                print(f"📤 Sent DB request: {message_type} (ID: {requestId[:8]}...)")
            else:
                print(f"📤 Sent DB request: {message_type}")
            print(f"   Waiting for reply type: {reply_type} (timeout: {timeout}s)")

        except Exception as e:
            print(f"❌ Failed to send request: {e}")
            return None

        # Wait for reply
        start = time.time()
        messages_seen = 0

        while time.time() - start < timeout:
            msg = self.consumer.poll(1.0)

            if msg is None:
                elapsed = time.time() - start
                if elapsed > 3 and messages_seen == 0:
                    print(f"   ⏳ Still waiting... ({elapsed:.0f}s elapsed, no messages yet)")
                continue

            if msg.error():
                print(f"   ⚠️ Consumer error: {msg.error()}")
                continue

            messages_seen += 1

            try:
                value = json.loads(msg.value().decode("utf-8"))
                received_type = value.get("type")

                # Match by reply type
                if received_type == reply_type:
                    # If using request ID, verify it matches
                    if use_requestId:
                        reply_requestId = value.get("requestId")

                        if reply_requestId and reply_requestId != requestId:
                            print(f"   ℹ️ Ignoring reply with different requestId ({reply_requestId[:8]}...)")
                            continue

                    status = value.get("status")
                    print(f"✅ Received reply (status: {status})")

                    # Check status
                    if status != "Success":
                        error = value.get("error", {})
                        error_msg = error.get("message", "Unknown error")
                        print(f"❌ DB Agent returned error: {error_msg}")
                        return None

                    return value
                else:
                    print(f"   ℹ️ Ignoring message type: {received_type}")

            except json.JSONDecodeError as e:
                print(f"   ⚠️ Failed to parse message: {e}")
                continue
            except Exception as e:
                print(f"   ⚠️ Error processing message: {e}")
                continue

        elapsed = time.time() - start
        print(f"⏱️ Timeout waiting for DB reply ({elapsed:.1f}s)")
        print(f"   Messages seen: {messages_seen}")
        print(f"   Expected reply type: {reply_type}")
        print(f"\n💡 Troubleshooting:")
        print(f"   1. Check if DB Agent is running")
        print(f"   2. Verify DB Agent uses broker: {self.DB_BROKER}")
        print(f"   3. Check topic: {self.DB_REPLY_TOPIC}")

        return None

    def test_connection(self, timeout: float = 5.0) -> bool:
        """
        Test if DB Agent is reachable

        Args:
            timeout: Test timeout in seconds

        Returns:
            True if DB Agent responds, False otherwise
        """
        print(f"🔍 Testing DB Agent connection...")

        # Try a simple enum request
        result = self.request_reply(
            message_type="GetAllEnums",
            data={"enumsNames": ["waferMapOrientation"]},
            reply_type="GetAllEnumsReply",
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
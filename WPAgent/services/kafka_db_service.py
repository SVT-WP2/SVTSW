from typing import List, Dict, Optional, Any
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import uuid
import time


class KafkaDBService:
    """Service for communicating with DB Agent via Kafka on localhost:9095"""

    DB_REQUEST_TOPIC = "svt.db-agent.request"
    DB_REPLY_TOPIC = "svt.db-agent.request.reply"
    DB_KAFKA_BROKER = "localhost:9095"

    # Singleton instance
    _instance = None
    _initialized = False

    @classmethod
    def get_instance(cls):
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        """Initialize DB service (use get_instance() for singleton)"""
        if KafkaDBService._initialized:
            return  # Already initialized

        print(f"🔄 Initializing KafkaDBService...")
        print(f"   Broker: {self.DB_KAFKA_BROKER}")

        # Ensure topics exist
        self._ensure_topics_exist()

        # Create producer
        self.producer = KafkaProducer({
            'bootstrap.servers': self.DB_KAFKA_BROKER,
            'request.timeout.ms': 30000
        })

        # Create consumer with stable group ID and 'earliest' offset
        # ⚠️ CRITICAL: 'earliest' ensures we don't miss quick replies
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.DB_KAFKA_BROKER,
            'group.id': 'wp-agent-db-consumer',  # Stable group ID
            'auto.offset.reset': 'earliest',  # ⚠️ CRITICAL: Changed from 'latest'
            'enable.auto.commit': False,
            'session.timeout.ms': 10000,
            'heartbeat.interval.ms': 3000
        })

        self.consumer.subscribe([self.DB_REPLY_TOPIC])

        # Warm up consumer (ensure subscription is active)
        print(f"   Warming up consumer...")
        for _ in range(3):
            self.consumer.poll(0.1)

        KafkaDBService._initialized = True
        print(f"✅ KafkaDBService initialized")

    def _ensure_topics_exist(self):
        """Ensure required Kafka topics exist"""
        admin = AdminClient({'bootstrap.servers': self.DB_KAFKA_BROKER})

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
                        print(f"   ⚠️ Topic error: {e}")

        except Exception as e:
            print(f"   ⚠️ Error checking topics: {e}")

    def _request_reply(
            self,
            message_type: str,
            data: Dict[str, Any],
            reply_type: str,
            timeout: float = 10.0
    ) -> Optional[Dict[str, Any]]:
        """
        Send request to DB Agent and wait for reply

        Args:
            message_type: Type of message (e.g., "GetAllWaferProbeMachines")
            data: Data payload for the message
            reply_type: Expected reply type (e.g., "GetAllWaferProbeMachinesReply")
            timeout: Timeout in seconds

        Returns:
            Reply data or None if timeout
        """
        # Build message - NO requestId as per your requirement
        payload = {
            "type": message_type,
            "data": data
        }

        # Debug: Print the actual payload
        print(f"\n📤 Sending to DB Agent:")
        print(f"   Topic: {self.DB_REQUEST_TOPIC}")
        print(f"   Payload: {json.dumps(payload, indent=2)}")

        # Send request
        try:
            self.producer.produce(
                self.DB_REQUEST_TOPIC,
                value=json.dumps(payload).encode("utf-8")
            )
            self.producer.flush()
            print(f"   ✅ Request sent")
        except Exception as e:
            print(f"   ❌ Send failed: {e}")
            return None

        print(f"   ⏳ Waiting for '{reply_type}' (timeout: {timeout}s)...")

        # Wait for reply
        start = time.time()
        messages_seen = 0

        while time.time() - start < timeout:
            msg = self.consumer.poll(1.0)

            if msg is None:
                elapsed = time.time() - start
                if elapsed > 3 and messages_seen == 0:
                    print(f"   ⏳ Still waiting... ({elapsed:.0f}s, no messages)")
                continue

            if msg.error():
                print(f"   ⚠️ Consumer error: {msg.error()}")
                continue

            messages_seen += 1

            try:
                value = json.loads(msg.value().decode("utf-8"))
                received_type = value.get("type")

                print(f"   📥 Received: {received_type}")

                # Check if this is the reply we want
                if received_type == reply_type:
                    status = value.get("status")
                    print(f"   ✅ Match! Status: {status}")

                    # Check status
                    if status != "Success":
                        error = value.get("error", {})
                        error_msg = error.get("message", "Unknown error")
                        print(f"   ❌ DB Agent error: {error_msg}")
                        return None

                    return value
                else:
                    print(f"   ℹ️ Ignoring: {received_type}")

            except json.JSONDecodeError as e:
                print(f"   ⚠️ JSON parse error: {e}")
                continue
            except Exception as e:
                print(f"   ⚠️ Error: {e}")
                continue

        elapsed = time.time() - start
        print(f"\n   ⏱️ TIMEOUT after {elapsed:.1f}s")
        print(f"   Messages seen: {messages_seen}")

        return None

    def get_all_enums(
            self,
            enum_names: Optional[List[str]] = None,
            timeout: float = 10.0
    ) -> Dict[str, List[str]]:
        """Get enumeration values from database"""
        data = {}
        if enum_names:
            data["enumsNames"] = enum_names

        reply = self._request_reply(
            message_type="GetAllEnums",
            data=data,
            reply_type="GetAllEnumsReply",
            timeout=timeout
        )

        if not reply:
            return {}

        return reply.get("data", {}) or {}

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        """Get available chip types"""
        data = self.get_all_enums(["asicFamilyType"], timeout=timeout)
        return data.get("asicFamilyType", []) or data.get("asicFamilType", [])

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        """Get available wafer map orientations"""
        data = self.get_all_enums(["waferMapOrientation"], timeout=timeout)
        return data.get("waferMapOrientation", [])

    def get_all_wafer_probe_machines(
            self,
            timeout: float = 10.0
    ) -> List[Dict[str, Any]]:
        """
        Get all wafer probe machines from database

        Sends message in format:
        {
          "type": "GetAllWaferProbeMachines",
          "data": {
            "filter": {
              "ids": []
            }
          }
        }
        """
        # ✅ CORRECTED: Proper structure with ids array
        data = {
            "filter": {
                "ids": []  # Empty array = get all machines
            }
        }

        reply = self._request_reply(
            message_type="GetAllWaferProbeMachines",
            data=data,
            reply_type="GetAllWaferProbeMachinesReply",
            timeout=timeout
        )

        if not reply:
            return []

        reply_data = reply.get("data", {})
        machines = reply_data.get("items", [])

        if machines:
            print(f"\n✅ Got {len(machines)} machine(s)")
        else:
            print(f"\n⚠️ No machines in response")

        return machines

    def close(self):
        """Clean up resources"""
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.flush()
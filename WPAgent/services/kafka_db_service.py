from typing import List, Dict, Optional, Any
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
import json
import uuid
import time


class KafkaDBService:
    """Service for communicating with DB Agent via Kafka on localhost:9095"""

    DB_REQUEST_TOPIC = "svt.db-agent.request"
    DB_REPLY_TOPIC = "svt.db-agent.request.reply"
    DB_KAFKA_BROKER = "localhost:9095"  # DB Agent uses different Kafka broker

    def __init__(self, kafka_client=None):
        """
        Initialize with optional KafkaClient (not used for DB Agent)
        DB Agent uses its own Kafka broker at localhost:9095

        Args:
            kafka_client: Optional, not used for DB operations
        """
        # Create dedicated Kafka producer/consumer for DB Agent
        self.producer = KafkaProducer({
            'bootstrap.servers': self.DB_KAFKA_BROKER
        })

        self.consumer = None  # Created on-demand

    def _get_consumer(self):
        """Get or create consumer for DB replies"""
        if self.consumer is None:
            self.consumer = KafkaConsumer({
                'bootstrap.servers': self.DB_KAFKA_BROKER,
                'group.id': f'wp-agent-db-consumer-{uuid.uuid4()}',
                'auto.offset.reset': 'latest',  # Only new messages
                'enable.auto.commit': False
            })
            self.consumer.subscribe([self.DB_REPLY_TOPIC])
        return self.consumer

    def _request_reply(self, message_type: str, data: Dict[str, Any], reply_type: str, timeout: float = 10.0) -> \
    Optional[Dict[str, Any]]:
        """
        Send request to DB Agent and wait for reply

        NOTE: We don't use requestId because:
        1. It's optional in Swagger
        2. We consume only new messages (auto.offset.reset=latest)
        3. We look for the specific reply_type we're waiting for
        4. Simpler = better!

        Args:
            message_type: Type of message (e.g., "GetAllWaferProbeMachines")
            data: Data payload for the message
            reply_type: Expected reply type (e.g., "GetAllWaferProbeMachinesReply")
            timeout: Timeout in seconds

        Returns:
            Reply data or None if timeout
        """
        # Build message according to Swagger spec (NO requestId needed)
        payload = {
            "type": message_type,
            "data": data
        }

        # Send request
        self.producer.produce(
            self.DB_REQUEST_TOPIC,
            value=json.dumps(payload).encode("utf-8")
        )
        self.producer.flush()

        print(f"📤 Sent request to DB Agent (broker: {self.DB_KAFKA_BROKER})")
        print(f"   Topic: {self.DB_REQUEST_TOPIC}")
        print(f"   Type: {message_type}")
        print(f"   Waiting for reply type: {reply_type}...")

        # Get consumer (will only see new messages after this point)
        consumer = self._get_consumer()
        start = time.time()

        while time.time() - start < timeout:
            msg = consumer.poll(1.0)

            if msg is None:
                continue

            if msg.error():
                print(f"⚠️ Consumer error: {msg.error()}")
                continue

            try:
                value = json.loads(msg.value().decode("utf-8"))

                # Check if this is the reply type we're waiting for
                # Since we use auto.offset.reset=latest, any message we get
                # after sending our request is likely our reply
                if value.get("type") == reply_type:
                    status = value.get("status")
                    print(f"✅ Received reply from DB Agent (status: {status})")

                    # Check status
                    if status != "Success":
                        error = value.get("error", {})
                        error_msg = error.get("message", "Unknown error")
                        print(f"❌ DB Agent returned error: {error_msg}")
                        return None

                    return value
                else:
                    # Different message type - ignore
                    print(f"   ℹ️ Ignoring message type: {value.get('type')}")

            except Exception as e:
                print(f"⚠️ Failed to parse message: {e}")
                continue

        print(f"⏱️ Timeout waiting for reply (waited {timeout}s)")
        return None

    def get_all_enums(self, enum_names: Optional[List[str]] = None, timeout: float = 10.0) -> Dict[str, List[str]]:
        """
        Get enumeration values from database

        Args:
            enum_names: Optional list of specific enum names to retrieve
            timeout: Request timeout in seconds

        Returns:
            Dictionary mapping enum names to their values
        """
        # According to Swagger: GetAllEnumsRequest
        data = {}
        if enum_names:
            data["enumsNames"] = enum_names

        reply = self._request_reply("GetAllEnums", data, "GetAllEnumsReply", timeout)

        if not reply:
            return {}

        return reply.get("data", {}) or {}

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        """
        Get available chip types (asicFamilyType enum)

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of chip type names
        """
        data = self.get_all_enums(["asicFamilyType"], timeout=timeout)
        # Note: Swagger shows "asicFamilType" (typo?) so try both
        return data.get("asicFamilyType", []) or data.get("asicFamilType", [])

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        """
        Get available wafer map orientations

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of orientation values
        """
        data = self.get_all_enums(["waferMapOrientation"], timeout=timeout)
        return data.get("waferMapOrientation", [])

    def get_all_wafer_probe_machines(self, timeout: float = 10.0) -> List[Dict[str, Any]]:
        """
        Get all wafer probe machines from database

        According to Swagger:
        - Request type: "GetAllWaferProbeMachines"
        - Reply type: "GetAllWaferProbeMachinesReply"
        - Data structure: { "filter": { "ids": [optional array] } }

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of wafer probe machine dictionaries with their details
        """
        # Build request data according to Swagger spec
        data = {
            "filter": {
                # Empty filter = get all machines
            }
        }

        reply = self._request_reply(
            "GetAllWaferProbeMachines",
            data,
            "GetAllWaferProbeMachinesReply",
            timeout
        )

        if not reply:
            print(f"⚠️ No reply received from DB agent (timeout: {timeout}s)")
            return []

        # Extract the machines from the reply
        # According to Swagger: GetAllWaferProbeMachinesReplyMessage.data.items
        reply_data = reply.get("data", {})
        machines = reply_data.get("items", [])

        if machines:
            print(f"✅ Retrieved {len(machines)} wafer probe machine(s)")
        else:
            print(f"⚠️ No machines found in response")

        return machines

    def close(self):
        """Clean up resources"""
        if self.consumer:
            self.consumer.close()
        self.producer.flush()
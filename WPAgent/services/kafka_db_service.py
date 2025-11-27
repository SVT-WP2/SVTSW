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

    # Header names as per SVT conventions
    HEADER_CORRELATION_ID = 'kafka_correlationId'
    HEADER_REPLY_TOPIC = 'kafka_replyTopic'
    HEADER_REPLY_PARTITION = 'kafka_replyPartition'

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
            return

        print(f"🔄 Initializing KafkaDBService...")
        print(f"   Broker: {self.DB_KAFKA_BROKER}")

        self._ensure_topics_exist()

        # Create producer
        self.producer = KafkaProducer({
            'bootstrap.servers': self.DB_KAFKA_BROKER,
            'request.timeout.ms': 30000
        })

        # Create consumer with 'earliest' offset
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.DB_KAFKA_BROKER,
            'group.id': 'wp-agent-db-consumer',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': False,
            'session.timeout.ms': 10000,
            'heartbeat.interval.ms': 3000
        })

        self.consumer.subscribe([self.DB_REPLY_TOPIC])

        # Warm up consumer
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
            data: Optional[Dict[str, Any]],
            reply_type: str,
            timeout: float = 10.0
    ) -> Optional[Dict[str, Any]]:
        """
        Send request to DB Agent and wait for reply using Kafka headers

        Args:
            message_type: Type of message (e.g., "GetAllWaferProbeMachines")
            data: Data payload (can be None for some requests)
            reply_type: Expected reply type
            timeout: Timeout in seconds

        Returns:
            Reply data or None if timeout
        """
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())

        # Build message body as per SVT conventions
        message_body = {
            "type": message_type
        }
        if data is not None:
            message_body["data"] = data

        # Build headers as per SVT conventions
        headers = {
            self.HEADER_CORRELATION_ID: correlation_id.encode('utf-8'),
            self.HEADER_REPLY_TOPIC: self.DB_REPLY_TOPIC.encode('utf-8'),
            self.HEADER_REPLY_PARTITION: str(0).encode('utf-8')
        }


        # Send request with headers
        try:
            self.producer.produce(
                self.DB_REQUEST_TOPIC,
                value=json.dumps(message_body).encode("utf-8"),
                headers=list(headers.items())  # Convert dict to list of tuples
            )
            self.producer.flush()
            print(f"   ✅ Request sent")
        except Exception as e:
            print(f"   ❌ Send failed: {e}")
            return None

        print(f"   ⏳ Waiting for reply (correlation_id: {correlation_id[:8]}...)...")

        # Wait for reply with matching correlation ID
        start = time.time()
        messages_seen = 0

        while time.time() - start < timeout:
            msg = self.consumer.poll(1.0)

            if msg is None:
                elapsed = time.time() - start
                if elapsed > 3 and messages_seen == 0:
                    print(f"   ⏳ Still waiting... ({elapsed:.0f}s)")
                continue

            if msg.error():
                print(f"   ⚠️ Consumer error: {msg.error()}")
                continue

            messages_seen += 1

            try:
                # Check headers for correlation ID
                msg_headers = msg.headers()
                if msg_headers:
                    msg_correlation_id = None
                    for key, value in msg_headers:
                        if key == self.HEADER_CORRELATION_ID:
                            msg_correlation_id = value.decode('utf-8')
                            break

                    # Check if correlation ID matches
                    if msg_correlation_id != correlation_id:
                        continue

                    print(f"   📥 Got message with matching correlationId!")

                # Parse message body
                reply_body = json.loads(msg.value().decode("utf-8"))
                reply_type_received = reply_body.get("type")
                status = reply_body.get("status")

                print(f"   Reply type: {reply_type_received}")
                print(f"   Status: {status}")

                # Check status
                if status != "Success":
                    error = reply_body.get("error", {})
                    error_msg = error.get("message", "Unknown error")
                    print(f"   ❌ DB Agent error: {error_msg}")
                    return None

                return reply_body

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
        """
        Get enumeration values from database

        Message format:
        {
          "type": "GetAllEnums",
          "data": {
            "enumsNames": ["asicFamilyType", ...]  // optional
          }
        }
        """
        # Build data - can be None if no specific enums requested
        data = None
        if enum_names:
            data = {"enumsNames": enum_names}

        reply = self._request_reply(
            message_type="GetAllEnums",
            data=data,
            reply_type="GetAllEnumsReply",
            timeout=timeout
        )

        if not reply:
            return {}

        return reply.get("data", {}) or {}
    #TODO Need to be Implemented in correct way
    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        """Get available chip types"""
        data = self.get_all_enums(["asicFamilyType"], timeout=timeout)
        return data.get("asicFamilyType", []) or data.get("asicFamilType", [])

    # TODO Need to be Implemented in correct way
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

        Message format:
        {
          "type": "GetAllWaferProbeMachines",
          "data": {
            "filter": {
              "ids": []
            }
          }
        }
        """
        data = {
            "filter": {
                "ids": []
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

    def get_all_wafer_probe_projects(self,
            timeout: float = 15.0
        ) -> List[Dict[str, Any]]:
        """
        Get all wafer probe projects from database.

        Returns:
            dict: Response with projects list
            {
                "status": "Success",
                "type": "GetAllWaferProbeProjectsReply",
                "data": {
                    "items": [
                        {
                            "id": 0,
                            "wpMachineId": 0,
                            "waferTypeId": 0,
                            "name": "string",
                            "asicFamilyType": "string",
                            "orientation": "string",
                            "alignmentDie": "string",
                            "homeDie": "string",
                            "local2GlobalMap": "string"
                        },
                        ...
                    ]
                }
            }
        """
        data = {
            "filter": {
                "ids": []
            }
        }

        reply = self._request_reply(
            message_type="GetAllWaferProbeProjects",
            data=data,
            reply_type="GetAllWaferProbeProjectsReply",
            timeout=timeout
        )

        if not reply:
            return []

        reply_data = reply.get("data", {})
        projects = reply_data.get("items", [])

        if projects:
            print(f"\n✅ Got {len(projects)} project(s)")
        else:
            print(f"\n⚠️ No projects in response")

        return projects


    def close(self):
        """Clean up resources"""
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.flush()
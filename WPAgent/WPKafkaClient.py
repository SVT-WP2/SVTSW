from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
from concurrent.futures import ThreadPoolExecutor

import json
import time
import ast
import uuid
from typing import Callable, Optional, Dict, Any, List

from WPCmdMap import execute_command
from utilities.WPAgentLogger import WPAgentLogger, Severity
from utilities.WPAgentCache import WPAgentCache
from services.WPListenerHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
from services.WPCacheHeartbeat import CacheHealthCheck, CacheHealthMonitor

logger = WPAgentLogger(kafka_servers=None)
cache = WPAgentCache(kafka_servers=None)
cache.initialize_cache()

# =========================
# SVT Kafka Conventions
# =========================
KAFKA_HEADER__CORRELATION_ID = "kafka_correlationId"
KAFKA_HEADER__REPLY_TOPIC = "kafka_replyTopic"
KAFKA_HEADER__REPLY_PARTITION = "kafka_replyPartition"


class SvtMessageStatus:
    Success = "Success"
    BadRequest = "BadRequest"
    NotFound = "NotFound"
    UnexpectedError = "UnexpectedError"


def _headers_to_dict(headers) -> Dict[str, bytes]:
    """Convert confluent-kafka headers list[(k,v)] to dict."""
    if not headers:
        return {}
    return {k: v for (k, v) in headers if k is not None}


class KafkaClient:
    def __init__(self, bootstrap_servers=None, group_id='wafer-executor'):
        """
        Initialize Kafka client

        Args:
            bootstrap_servers: Kafka broker address (e.g., "svmithi02:9092")
                              If None, uses default
            group_id: Consumer group ID
        """
        
        self.bootstrap_servers = bootstrap_servers
        print(f"🔌 Using Kafka broker from config: {bootstrap_servers}")

        self.group_id = group_id

        # Topics
        self.request_topic = 'svt.wp-agent.request'
        self.reply_topic = f'{self.request_topic}.reply'

        self._ensure_topic_exists(self.request_topic)
        self._ensure_topic_exists(self.reply_topic)

        # Producer configuration
        producer_config = {
            'bootstrap.servers': self.bootstrap_servers,
            'linger.ms': 0,
            'compression.type': 'none',
            'client.id': f'wp-agent-producer-{uuid.uuid4().hex[:8]}',
            # Disable localhost fallback
            'socket.timeout.ms': 10000,
            #'api.version.request': True,
        }
        self.producer = KafkaProducer(producer_config)

        self.request_consumer = None
        self.reply_consumer = None
        self._initialize_reply_consumer()

        # Initialize heartbeat monitoring with correct broker
        self.health_check = ListenerHealthCheck(bootstrap_servers=self.bootstrap_servers)
        self.heartbeat_monitor = ListenerHealthMonitor(self.health_check)

        self.cache_health_check = CacheHealthCheck(bootstrap_servers=self.bootstrap_servers)
        self.cache_heartbeat = CacheHealthMonitor(self.cache_health_check, on_heartbeat=cache.cache_command)

    def _ensure_topic_exists(self, topic_name, num_partitions=1, replication_factor=1):
        admin_config = {
            'bootstrap.servers': self.bootstrap_servers,
            'broker.address.family': 'v4',  # Force IPv4 only
        }
        admin = AdminClient(admin_config)
        metadata = admin.list_topics(timeout=5)

        if topic_name not in metadata.topics:
            new_topic = NewTopic(
                topic=topic_name,
                num_partitions=num_partitions,
                replication_factor=replication_factor
            )
            fs = admin.create_topics([new_topic])
            try:
                fs[topic_name].result()
                print(f"[✅ Topic Created] {topic_name}")
            except Exception as e:
                print(f"[⚠️ Topic Error] Failed to create topic '{topic_name}': {e}")
        else:
            print(f"[✅ Topic Exists] {topic_name}")

    def _delivery_report(self, err, msg):
        if err:
            print(f"[❌ Delivery failed] {err}")

    def _initialize_reply_consumer(self):
        if self.reply_consumer is not None:
            return

        from confluent_kafka import TopicPartition

        consumer_config = {
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': f'{self.group_id}-reply-{uuid.uuid4().hex[:8]}',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': False,
            'fetch.wait.max.ms': 50,
            'socket.timeout.ms': 10000,
            'client.id': f'wp-agent-reply-consumer-{uuid.uuid4().hex[:8]}',
            # Disable localhost fallback
            'broker.address.family': 'v4',  # Force IPv4 only
        }
        self.reply_consumer = KafkaConsumer(consumer_config)

        partition = TopicPartition(self.reply_topic, 0)
        self.reply_consumer.assign([partition])
        self.reply_consumer.poll(1.0)

        low, high = self.reply_consumer.get_watermark_offsets(partition, timeout=5.0)
        self.reply_consumer.seek(TopicPartition(self.reply_topic, 0, high))
        print(f"✅ Reply consumer ready (manual assign, offset={high})")

    def _convert_param_types(self, params):
        converted = {}
        for k, v in params.items():
            try:
                converted[k] = ast.literal_eval(v)
            except Exception:
                converted[k] = v
        return converted

    def send(
            self,
            command,
            params=None,
            *,
            data=None,
            repeat=1,
            delay=0,
            wait_for_reply=True,
            timeout=30.0
    ):

        print (self.bootstrap_servers)

        if data is not None:
            params = data

        if isinstance(params, str):
            if command == "RunSequencer" and params.endswith(".json"):
                params = {"filepath": params}
            elif "=" in params:
                k, v = params.split("=", 1)
                params = {k: v}
            else:
                params = {}
        elif params is None:
            params = {}
        elif not isinstance(params, dict):
            try:
                params = dict(params)
            except Exception:
                params = {}

        results = []

        for i in range(repeat):
            correlation_id = str(uuid.uuid4())

            reply_consumer = None
            if wait_for_reply:
                reply_consumer = self._get_persistent_reply_consumer()

                deadline = time.time() + 5.0
                while not reply_consumer.assignment() and time.time() < deadline:
                    reply_consumer.poll(0.05)
                if not reply_consumer.assignment():
                    print("⚠️  Reply consumer not assigned — replies may be missed")

            payload = {"type": command, "data": params}
            headers = [(KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8"))]

            if wait_for_reply:
                headers.append((KAFKA_HEADER__REPLY_TOPIC, self.reply_topic.encode("utf-8")))
                headers.append((KAFKA_HEADER__REPLY_PARTITION, b"0"))

            logger.log_command(
                messageOut=f"Sending command: {command} (correlation: {correlation_id[:8]}...)",
                severityLevel=Severity.INFO,
                command=command,
                data=params,
                result=None,
            )

            self.producer.produce(
                self.request_topic,
                value=json.dumps(payload).encode("utf-8"),
                headers=headers,
                callback=self._delivery_report,
            )
            self.producer.flush()

            if wait_for_reply:
                print(f"📤 Command sent: {command}")
                print(f"⏳ Waiting for response (timeout: {timeout}s)...")

                response = self._wait_for_reply_on(reply_consumer, correlation_id, timeout)

                if response:
                    results.append(response)

                    status = response.get("status", "unknown")
                    rtype = response.get("type", "UnknownReply")

                    display_output = None

                    if "data" in response and isinstance(response["data"], dict):
                        if "message" in response["data"]:
                            display_output = response["data"]["message"]

                    if display_output is None and "output" in response:
                        display_output = response["output"]

                    if display_output is None:
                        error_info = response.get("error", {})
                        if isinstance(error_info, dict):
                            display_output = error_info.get("message", "")

                    if status == SvtMessageStatus.Success:
                        print(f"✅ {status}: {rtype}")
                        if display_output:
                            print(display_output)
                    else:
                        print(f"❌ {status}: {rtype}")
                        if display_output:
                            print(f"   {display_output}")

                    return response

                else:
                    error_response = {
                        "status": SvtMessageStatus.UnexpectedError,
                        "type": f"{command}Reply",
                        "error": {"message": f"Timeout: No response received within {timeout}s. Listener may be down."}
                    }
                    print(f"⏱️  TIMEOUT: No response within {timeout}s")
                    print(f"   Check if listener is running: python main.py check_listener_health")
                    return error_response

            else:
                print(f"📤 Command queued: {command} (no reply expected)")

            if i < repeat - 1:
                time.sleep(delay)

        return results if repeat > 1 else (results[0] if results else None)

    def listen(self, poll_timeout=0.1):
        """Listen for and process Kafka messages (LISTENER MODE)."""

        consumer_config = {
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.group_id,
            'auto.offset.reset': 'latest',
            'enable.auto.commit': True,
            'session.timeout.ms': 10000,
            'heartbeat.interval.ms': 3000,
            'max.poll.interval.ms': 300000,
            'client.id': f'wp-agent-listener-{uuid.uuid4().hex[:8]}',
            # Disable localhost fallback
            'broker.address.family': 'v4',  # Force IPv4 only
        }

        print(self.bootstrap_servers)

        self.request_consumer = KafkaConsumer(consumer_config)
        self.request_consumer.subscribe([self.request_topic])

        executor = ThreadPoolExecutor(max_workers=4)

        logger.log_command(
            messageOut=f"Kafka listener started on topic '{self.request_topic}'",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            result=None
        )

        self.heartbeat_monitor.start()
        self.cache_heartbeat.start()

        try:
            while True:
                msg = self.request_consumer.poll(poll_timeout)

                if msg is None:
                    continue

                if msg.error():
                    logger.log_command(
                        messageOut=f"Kafka error: {msg.error()}",
                        severityLevel=Severity.ERROR,
                        command="KAFKA_LISTEN",
                        result={"error": str(msg.error())}
                    )
                    continue

                executor.submit(self._handle_message, msg)

        except KeyboardInterrupt:
            pass
        finally:
            self.request_consumer.close()
            self.heartbeat_monitor.stop()
            self.cache_heartbeat.stop()
            self.producer.flush(timeout=5.0)
            if self.reply_consumer:
                self.reply_consumer.close()

    def _handle_message(self, msg):
        """Runs in a thread — executes command and sends reply."""
        try:
            payload = json.loads(msg.value().decode("utf-8"))

            command = payload.get("type")
            params = payload.get("data", {}) or {}

            if hasattr(self, "_convert_param_types"):
                params = self._convert_param_types(params)

            hdr = _headers_to_dict(msg.headers())
            corr_bytes = hdr.get(KAFKA_HEADER__CORRELATION_ID)
            reply_topic_bytes = hdr.get(KAFKA_HEADER__REPLY_TOPIC)
            reply_part_bytes = hdr.get(KAFKA_HEADER__REPLY_PARTITION)

            correlation_id = corr_bytes.decode("utf-8", errors="ignore") if corr_bytes else None
            reply_to = reply_topic_bytes.decode("utf-8", errors="ignore") if reply_topic_bytes else None
            reply_partition = int(reply_part_bytes.decode("utf-8", errors="ignore")) if reply_part_bytes else 0

            logger.log_command(
                messageOut=f"Received command: {command}",
                severityLevel=Severity.INFO,
                command=command,
                data=params,
                result=None
            )

            exec_start = time.time()
            result = execute_command(command, params)
            exec_end = time.time()
            exec_time_ms = (exec_end - exec_start) * 1000

            if result and "type" in result and "data" in result:
                reply_body = result
                if "data" in reply_body and isinstance(reply_body["data"], dict):
                    reply_body["data"]["executionTimeMs"] = exec_time_ms
            else:
                raw_status = (result or {}).get("status", "error")
                output = (result or {}).get("output", "No output")

                if raw_status == "success":
                    reply_body = {
                        "status": SvtMessageStatus.Success,
                        "type": f"{command}Reply",
                        "data": {"output": output, "executionTimeMs": exec_time_ms}
                    }
                else:
                    reply_body = {
                        "status": SvtMessageStatus.UnexpectedError,
                        "type": f"{command}Reply",
                        "error": {"message": output}
                    }

            if reply_to and correlation_id:
                reply_headers = [
                    (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
                    (KAFKA_HEADER__REPLY_PARTITION, str(reply_partition).encode("utf-8")),
                ]
                self.producer.produce(
                    reply_to,
                    value=json.dumps(reply_body).encode("utf-8"),
                    headers=reply_headers,
                    partition=reply_partition
                )
                self.producer.flush(timeout=2.0)

        except Exception as e:
            logger.log_command(
                messageOut=f"Exception during command execution: {str(e)}",
                severityLevel=Severity.ERROR,
                command=command if 'command' in locals() else "UNKNOWN",
                result={"error": str(e)}
            )
            try:
                hdr = _headers_to_dict(msg.headers())
                corr_bytes = hdr.get(KAFKA_HEADER__CORRELATION_ID)
                reply_topic_bytes = hdr.get(KAFKA_HEADER__REPLY_TOPIC)
                reply_part_bytes = hdr.get(KAFKA_HEADER__REPLY_PARTITION)

                correlation_id = corr_bytes.decode("utf-8", errors="ignore") if corr_bytes else None
                reply_to = reply_topic_bytes.decode("utf-8", errors="ignore") if reply_topic_bytes else None
                reply_partition = int(reply_part_bytes.decode("utf-8", errors="ignore")) if reply_part_bytes else 0

                if reply_to and correlation_id:
                    error_reply = {
                        "status": SvtMessageStatus.UnexpectedError,
                        "type": f"{command if 'command' in locals() and command else 'Unknown'}Reply",
                        "error": {"message": f"Exception: {str(e)}"}
                    }
                    reply_headers = [
                        (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
                        (KAFKA_HEADER__REPLY_PARTITION, str(reply_partition).encode("utf-8")),
                    ]
                    self.producer.produce(
                        reply_to,
                        value=json.dumps(error_reply).encode("utf-8"),
                        headers=reply_headers,
                        partition=reply_partition
                    )
                    self.producer.flush(timeout=2.0)
            except Exception:
                pass

    def _get_persistent_reply_consumer(self):
        if self.reply_consumer is None:
            consumer_config = {
                'bootstrap.servers': self.bootstrap_servers,
                'group.id': f'{self.group_id}-reply',
                'auto.offset.reset': 'latest',
                'enable.auto.commit': False,
                'session.timeout.ms': 60000,
                'max.poll.interval.ms': 120000,
                'fetch.wait.max.ms': 50,
                'client.id': f'wp-agent-persistent-reply-{uuid.uuid4().hex[:8]}',
                # Disable localhost fallback
                'broker.address.family': 'v4',  # Force IPv4 only
            }
            self.reply_consumer = KafkaConsumer(consumer_config)
            self.reply_consumer.subscribe([self.reply_topic])

            start = time.time()
            while time.time() - start < 10.0:
                self.reply_consumer.poll(0.1)
                if self.reply_consumer.assignment():
                    break
        return self.reply_consumer

    def subscribe_if_needed(self, topics: List[str]) -> None:
        """Subscribe to additional topics if needed"""
        if self.reply_consumer:
            try:
                current = set(self.reply_consumer.subscription() or [])
            except AttributeError:
                current = set()
            wanted = current.union(set(topics))
            self.reply_consumer.subscribe(list(wanted))

    def request_reply(
            self,
            request_topic: str,
            payload: Dict[str, Any],
            timeout: float = 10.0,
            reply_partition: int = 0,
            match_fn: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generic request-reply for other services (like DB agent)"""
        reply_topic = f"{request_topic}.reply"
        self._ensure_topic_exists(request_topic)
        self._ensure_topic_exists(reply_topic)

        self._get_persistent_reply_consumer()
        self.subscribe_if_needed([reply_topic])

        correlation_id = str(uuid.uuid4())

        if "type" in payload and ("data" in payload or "params" in payload):
            body = payload
            if "params" in body and "data" not in body:
                body = dict(body)
                body["data"] = body.pop("params")
        else:
            body = payload

        headers = [
            (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
            (KAFKA_HEADER__REPLY_TOPIC, reply_topic.encode("utf-8")),
            (KAFKA_HEADER__REPLY_PARTITION, str(reply_partition).encode("utf-8")),
        ]

        self.producer.produce(request_topic, json.dumps(body).encode("utf-8"), headers=headers)
        self.producer.flush()

        start = time.time()
        while time.time() - start < timeout:
            msg = self.reply_consumer.poll(0.05)
            if msg is None or msg.error():
                continue

            hdr = _headers_to_dict(msg.headers())
            corr = hdr.get(KAFKA_HEADER__CORRELATION_ID)
            if not corr:
                continue
            if corr.decode("utf-8", errors="ignore") != correlation_id:
                continue

            try:
                reply = json.loads(msg.value().decode("utf-8"))
            except Exception:
                continue

            if match_fn and not match_fn(reply):
                continue

            return reply

        return None

    def _wait_for_reply_on(self, consumer, correlation_id: str, timeout: float):
        start_time = time.time()
        while time.time() - start_time < timeout:
            msg = consumer.poll(0.05)
            if msg is None or msg.error():
                continue
            try:
                hdr = _headers_to_dict(msg.headers())
                corr = hdr.get(KAFKA_HEADER__CORRELATION_ID)
                if corr and corr.decode("utf-8", errors="ignore") == correlation_id:
                    return json.loads(msg.value().decode("utf-8"))
            except Exception:
                continue
        return None
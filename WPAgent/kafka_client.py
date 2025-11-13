from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import time
import ast
import uuid
from typing import Callable, Optional, Dict, Any, List
from cmd_map import execute_command
from WPAgentUtilities.WPAgentLogger import WPAgentLogger, Severity
from services.listener_heartbeat import ListenerHealthCheck, ListenerHealthMonitor

logger = WPAgentLogger()


class KafkaClient:
    def __init__(self, bootstrap_servers='localhost:9092', group_id='wafer-executor'):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.request_topic = 'svt.wp-agent.request'
        self.reply_topic = 'svt.wp-agent.reply'

        self._ensure_topic_exists(self.request_topic)
        self._ensure_topic_exists(self.reply_topic)

        self.producer = KafkaProducer({'bootstrap.servers': self.bootstrap_servers})

        # Consumer for listener (processes requests)
        self.request_consumer = KafkaConsumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.group_id,
            'auto.offset.reset': 'latest',
            'enable.auto.commit': True,
            'session.timeout.ms': 6000,
            'heartbeat.interval.ms': 3000
        })
        self.request_consumer.subscribe([self.request_topic])

        # Consumer for sender (receives replies)
        self.reply_consumer = None  # Created on-demand when sending

        # Initialize heartbeat monitoring
        self.health_check = ListenerHealthCheck(bootstrap_servers=self.bootstrap_servers)
        self.heartbeat_monitor = ListenerHealthMonitor(self.health_check)

    def _ensure_topic_exists(self, topic_name, num_partitions=1, replication_factor=1):
        admin = AdminClient({'bootstrap.servers': self.bootstrap_servers})
        metadata = admin.list_topics(timeout=5)

        if topic_name not in metadata.topics:
            new_topic = NewTopic(topic=topic_name,
                                 num_partitions=num_partitions,
                                 replication_factor=replication_factor)
            fs = admin.create_topics([new_topic])
            try:
                fs[topic_name].result()
                print(f"[✅ Topic Created] {topic_name}")
            except Exception as e:
                print(f"[⚠️ Topic Error] Failed to create topic '{topic_name}': {e}")
        else:
            print(f"[✅ Topic Exists] {topic_name}")

    def send(self, command, params=None, repeat=1, delay=0, wait_for_reply=True, timeout=30.0):
        """
        Send a Kafka command message and optionally wait for reply.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command
            delay: Delay between repeats in seconds
            wait_for_reply: Whether to wait for response (default: True)
            timeout: How long to wait for reply in seconds (default: 30.0)

        Returns:
            dict: Response from listener (if wait_for_reply=True)
                  None (if wait_for_reply=False)
        """
        # --- normalize params ---
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
            request_id = str(uuid.uuid4())

            payload = {
                "type": command,
                "params": params,
                "request_id": request_id,
                "sent_at": time.time(),
                "reply_to": self.reply_topic if wait_for_reply else None
            }

            logger.log_command(
                messageOut=f"Sending command: {command} (request_id: {request_id[:8]}...)",
                severityLevel=Severity.INFO,
                command=command,
                params=params,
                result=None,
            )

            # Send request
            self.producer.produce(
                self.request_topic,
                value=json.dumps(payload).encode("utf-8"),
                callback=self._delivery_report,
            )
            self.producer.flush()

            if wait_for_reply:
                print(f"📤 Command sent: {command}")
                print(f"⏳ Waiting for response (timeout: {timeout}s)...")

                # Wait for reply
                response = self._wait_for_reply(request_id, timeout)

                if response:
                    results.append(response)

                    # Display result
                    status = response.get("status", "unknown")
                    output = response.get("output", "No output")
                    exec_time = response.get("execution_time_ms", 0)

                    if status == "success":
                        print(f"✅ SUCCESS ({exec_time:.1f}ms): {output}")
                    else:
                        print(f"❌ ERROR ({exec_time:.1f}ms): {output}")

                    return response  # Return immediately for single command
                else:
                    error_response = {
                        "status": "error",
                        "output": f"Timeout: No response received within {timeout}s. Listener may be down.",
                        "request_id": request_id
                    }
                    print(f"⏱️  TIMEOUT: No response within {timeout}s")
                    print(f"   Check if listener is running: python main.py check_listener_health")
                    return error_response
            else:
                print(f"📤 Command queued: {command} (no reply expected)")

            if i < repeat - 1:
                time.sleep(delay)

        return results if repeat > 1 else (results[0] if results else None)

    def _wait_for_reply(self, request_id: str, timeout: float) -> Optional[Dict]:
        """
        Wait for a reply message with matching request_id

        Args:
            request_id: The request ID to match
            timeout: How long to wait (seconds)

        Returns:
            dict: Reply message or None if timeout
        """
        # Create reply consumer if not exists
        if self.reply_consumer is None:
            self.reply_consumer = KafkaConsumer({
                'bootstrap.servers': self.bootstrap_servers,
                'group.id': f'reply-consumer-{uuid.uuid4()}',
                'auto.offset.reset': 'latest',
                'enable.auto.commit': False
            })
            self.reply_consumer.subscribe([self.reply_topic])

        start_time = time.time()

        while time.time() - start_time < timeout:
            msg = self.reply_consumer.poll(0.5)

            if msg is None:
                continue

            if msg.error():
                print(f"[⚠️ Reply consumer error] {msg.error()}")
                continue

            try:
                reply = json.loads(msg.value().decode("utf-8"))

                if reply.get("request_id") == request_id:
                    return reply

            except Exception as e:
                print(f"[⚠️ Failed to parse reply] {e}")
                continue

        return None

    def listen(self, poll_timeout=0.1):
        """
        Listen for and process Kafka messages (LISTENER MODE).

        Args:
            poll_timeout: Timeout in seconds for each poll (default: 0.1s = 100ms)
        """

        logger.log_command(
            messageOut=f"Kafka listener started on topic '{self.request_topic}'",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            params={"poll_timeout": poll_timeout},
            result=None
        )

        # Start heartbeat monitoring
        self.heartbeat_monitor.start()

        print(f"📡 Listener started")
        print(f"   Request topic: {self.request_topic}")
        print(f"   Reply topic: {self.reply_topic}")
        print(f"   Consumer group: {self.group_id}")
        print(f"   Offset: latest (only new messages)")
        print(f"   Heartbeat: enabled\n")

        try:
            while True:
                msg = self.request_consumer.poll(poll_timeout)

                if msg is None:
                    continue

                if msg.error():
                    print(f"[❌ Kafka error] {msg.error()}")
                    logger.log_command(
                        messageOut=f"Kafka error: {msg.error()}",
                        severityLevel=Severity.ERROR,
                        command="KAFKA_LISTEN",
                        result={"error": str(msg.error())}
                    )
                    continue

                receive_time = time.time()

                try:
                    payload = json.loads(msg.value().decode("utf-8"))

                    command = payload.get("type")
                    params = payload.get("params", {})
                    request_id = payload.get("request_id")
                    reply_to = payload.get("reply_to")
                    sent_at = payload.get("sent_at")

                    if hasattr(self, "_convert_param_types"):
                        params = self._convert_param_types(params)

                    print(f"\n[📥 Received] {command}")
                    if request_id:
                        print(f"   Request ID: {request_id[:8]}...")

                    logger.log_command(
                        messageOut=f"Received command: {command}",
                        severityLevel=Severity.INFO,
                        command=command,
                        params=params,
                        result=None
                    )

                    if params:
                        print(f"   Params: {params}")

                    # Calculate Kafka latency
                    if sent_at:
                        kafka_delay = (receive_time - sent_at) * 1000
                        print(f"   Kafka latency: {kafka_delay:.1f}ms")

                    # Execute command
                    exec_start = time.time()
                    result = execute_command(command, params)
                    exec_end = time.time()
                    exec_time = (exec_end - exec_start) * 1000

                    # Log execution
                    status = result.get("status", "unknown")
                    output = result.get("output", "No output")

                    print(f"   Execution time: {exec_time:.1f}ms")

                    if status == "success":
                        print(f"   ✅ SUCCESS: {output}")
                    else:
                        print(f"   ❌ ERROR: {output}")

                    # Send reply if requested
                    if reply_to and request_id:
                        reply = {
                            "type": "CommandReply",
                            "request_id": request_id,
                            "command": command,
                            "status": status,
                            "output": output,
                            "execution_time_ms": exec_time,
                            "timestamp": time.time()
                        }

                        self.producer.produce(
                            reply_to,
                            value=json.dumps(reply).encode("utf-8")
                        )
                        self.producer.flush()
                        print(f"   📤 Reply sent")

                except Exception as e:
                    logger.log_command(
                        messageOut=f"Exception during command execution: {str(e)}",
                        severityLevel=Severity.ERROR,
                        command=command if 'command' in locals() else "UNKNOWN",
                        result={"error": str(e)}
                    )
                    print(f"[❌ Exception] {e}")

                    # Send error reply if possible
                    if 'reply_to' in locals() and reply_to and 'request_id' in locals() and request_id:
                        error_reply = {
                            "type": "CommandReply",
                            "request_id": request_id,
                            "command": command if 'command' in locals() else "UNKNOWN",
                            "status": "error",
                            "output": f"Exception: {str(e)}",
                            "execution_time_ms": 0,
                            "timestamp": time.time()
                        }

                        self.producer.produce(reply_to, value=json.dumps(error_reply).encode("utf-8"))
                        self.producer.flush()

        except KeyboardInterrupt:
            print("\n[🛑 Listener stopped]")
        finally:
            self.heartbeat_monitor.stop()
            self.request_consumer.close()
            if self.reply_consumer:
                self.reply_consumer.close()

    def _convert_param_types(self, params):
        converted = {}
        for k, v in params.items():
            try:
                converted[k] = ast.literal_eval(v)
            except:
                converted[k] = v
        return converted

    def _delivery_report(self, err, msg):
        if err:
            print(f"[❌ Delivery failed] {err}")
        else:
            # Silently succeed - don't spam console
            pass

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
            reply_topic: str,
            payload: Dict[str, Any],
            reply_type: str,
            timeout: float = 10.0,
            match_fn: Optional[Callable[[Dict[str, Any]], bool]] = None,
            add_request_id: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Generic request-reply for other services (like DB agent)"""
        req_id = None
        if add_request_id:
            req_id = str(uuid.uuid4())
            payload = dict(payload)
            payload["requestId"] = req_id

        self.producer.produce(request_topic, json.dumps(payload).encode("utf-8"))
        self.producer.flush()

        # Use reply consumer
        if self.reply_consumer is None:
            self.reply_consumer = KafkaConsumer({
                'bootstrap.servers': self.bootstrap_servers,
                'group.id': f'reply-consumer-{uuid.uuid4()}',
                'auto.offset.reset': 'latest',
                'enable.auto.commit': False
            })

        self.subscribe_if_needed([reply_topic])

        start = time.time()
        while time.time() - start < timeout:
            msg = self.reply_consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                logger.log(Severity.ERROR, f"[KafkaClient] {msg.error()}")
                continue
            try:
                value = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                logger.log(Severity.ERROR, f"[KafkaClient] JSON parse error: {e}")
                continue
            if value.get("type") != reply_type:
                continue
            if add_request_id and value.get("requestId") and value["requestId"] != req_id:
                continue
            if match_fn and not match_fn(value):
                continue
            return value

        logger.log(Severity.WARNING, f"[KafkaClient] Timeout waiting for reply_type={reply_type}")
        return None
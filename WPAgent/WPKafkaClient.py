from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic

import json
import time
import ast
import uuid
from typing import Callable, Optional, Dict, Any, List

from WPCmdMap import execute_command
from utilities.WPAgentLogger import WPAgentLogger, Severity
from services.WPListenerHeartbeat import ListenerHealthCheck, ListenerHealthMonitor

logger = WPAgentLogger()

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
    def __init__(self, bootstrap_servers='localhost:9095', group_id='wafer-executor'):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id

        #  topics
        self.request_topic = 'svt.wp-agent.request'
        self.reply_topic = f'{self.request_topic}.reply'  # svt.wp-agent.request.reply

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

<<<<<<< HEAD
=======
    def send(self, command, data=None, repeat=1, delay=0, wait_for_reply=True, timeout=30.0):
        """
        Send a Kafka command message and optionally wait for reply.

        Args:
            command: Command name to execute
            data: Command parameters (dict or string)
            repeat: Number of times to repeat the command
            delay: Delay between repeats in seconds
            wait_for_reply: Whether to wait for response (default: True)
            timeout: How long to wait for reply in seconds (default: 30.0)

        Returns:
            dict: Response from listener (if wait_for_reply=True)
                  None (if wait_for_reply=False)
        """
        # --- normalize params ---
        if isinstance(data, str):
            if command == "RunSequencer" and data.endswith(".json"):
                data = {"filepath": data}
            elif "=" in data:
                k, v = data.split("=", 1)
                data = {k: v}
            else:
                data = {}
        elif data is None:
            data = {}
        elif not isinstance(data, dict):
            try:
                data = dict(data)
            except Exception:
                data = {}

        results = []

        if wait_for_reply and self.reply_consumer is None:
            print(f"⏳ Initializing reply consumer...")
            self._ensure_reply_consumer_ready()

        for i in range(repeat):
            requestId = str(uuid.uuid4())

            payload = {
                "type": command,
                "data": data,
                "requestId": requestId,
                "reply_to": self.reply_topic if wait_for_reply else None
            }

            logger.log_command(
                messageOut=f"Sending command: {command} (requestId: {requestId[:8]}...)",
                severityLevel=Severity.INFO,
                command=command,
                data=data,
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
                response = self._wait_for_reply(requestId, timeout)

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
                        "requestId": requestId
                    }
                    print(f"⏱️  TIMEOUT: No response within {timeout}s")
                    print(f"   Check if listener is running: python main.py check_listener_health")
                    return error_response
            else:
                print(f"📤 Command queued: {command} (no reply expected)")

            if i < repeat - 1:
                time.sleep(delay)

        return results if repeat > 1 else (results[0] if results else None)

    def _wait_for_reply(self, requestId: str, timeout: float) -> Optional[Dict]:
        """Wait for a reply message with matching requestId"""

        # Consumer should already be initialized by send()
        if self.reply_consumer is None:
            print(f"⚠️  Reply consumer not initialized!")
            return None

        start_time = time.time()

        while time.time() - start_time < timeout:
            msg = self.reply_consumer.poll(0.5)

            if msg is None:
                continue

            if msg.error():
                continue

            try:
                reply = json.loads(msg.value().decode("utf-8"))

                if reply.get("requestId") == requestId:
                    return reply

            except Exception as e:
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
            data={"poll_timeout": poll_timeout},
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

        print(f"⏳ Waiting for consumer to be ready...")
        max_wait = 30.0
        start = time.time()
        ready = False

        while time.time() - start < max_wait:
            # Poll to join consumer group and get partition assignment
            self.request_consumer.poll(0.1)

            # Check if assigned
            assignment = self.request_consumer.assignment()
            if assignment:
                elapsed = time.time() - start
                print(f"✅ Consumer ready in {elapsed:.1f}s")
                print(f"   Partitions: {assignment}\n")
                ready = True
                break

            time.sleep(0.1)

        if not ready:
            print(f"⚠️  Consumer not ready after {max_wait}s\n")

        print("=" * 70)
        print("🎯 LISTENER IS READY - YOU CAN NOW SEND COMMANDS!")
        print("=" * 70)
        print()

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
                    data = payload.get("data", {})
                    requestId = payload.get("requestId")
                    reply_to = payload.get("reply_to")

                    if hasattr(self, "_convert_param_types"):
                        data = self._convert_param_types(data)

                    print(f"\n[📥 Received] {command}")
                    if requestId:
                        print(f"   Request ID: {requestId[:8]}...")

                    logger.log_command(
                        messageOut=f"Received command: {command}",
                        severityLevel=Severity.INFO,
                        command=command,
                        data=data,
                        result=None
                    )

                    if data:
                        print(f"   Params: {data}")


                    # Execute command
                    exec_start = time.time()
                    result = execute_command(command, data)
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
                    if reply_to and requestId:
                        reply = {
                            "type": "CommandReply",
                            "requestId": requestId,
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
                    if 'reply_to' in locals() and reply_to and 'requestId' in locals() and requestId:
                        error_reply = {
                            "type": "CommandReply",
                            "requestId": requestId,
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

    def _convert_param_types(self, data):
        converted = {}
        for k, v in data.items():
            try:
                converted[k] = ast.literal_eval(v)
            except:
                converted[k] = v
        return converted

>>>>>>> d8253d1 (partially fixed naming)
    def _delivery_report(self, err, msg):
        if err:
            print(f"[❌ Delivery failed] {err}")

    # -----------------------------------------
    # Reply consumer (sender side)
    # -----------------------------------------
    def _ensure_reply_consumer_ready(self):
        """Ensure reply consumer is initialized and ready"""
        if self.reply_consumer is not None:
            return  # Already initialized

        consumer_group = f'reply-consumer-{uuid.uuid4()}'

        self.reply_consumer = KafkaConsumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': consumer_group,
            'auto.offset.reset': 'earliest',
            'enable.auto.commit': False,
            'session.timeout.ms': 60000,
            'max.poll.interval.ms': 120000
        })
        self.reply_consumer.subscribe([self.reply_topic])

        # Wait for consumer to be ready
        start = time.time()
        while time.time() - start < 5.0:
            self.reply_consumer.poll(0.1)
            if self.reply_consumer.assignment():
                elapsed = time.time() - start
                print(f"   ✅ Reply consumer ready ({elapsed:.1f}s)")
                return
            time.sleep(0.1)

        print(f"   ⚠️  Reply consumer timeout (may miss fast replies)")

    def _wait_for_reply(self, correlation_id: str, timeout: float) -> Optional[Dict]:
        """Wait for a reply message with matching kafka_correlationId header."""
        if self.reply_consumer is None:
            print(f"⚠️  Reply consumer not initialized!")
            return None

        start_time = time.time()

        while time.time() - start_time < timeout:
            msg = self.reply_consumer.poll(0.5)

            if msg is None:
                continue
            if msg.error():
                continue

            try:
                hdr = _headers_to_dict(msg.headers())
                corr = hdr.get(KAFKA_HEADER__CORRELATION_ID)
                if not corr:
                    continue

                if corr.decode("utf-8", errors="ignore") != correlation_id:
                    continue

                return json.loads(msg.value().decode("utf-8"))

            except Exception:
                continue

        return None

    # -----------------------------------------
    # Param conversion helpers
    # -----------------------------------------
    def _convert_param_types(self, params):
        converted = {}
        for k, v in params.items():
            try:
                converted[k] = ast.literal_eval(v)
            except Exception:
                converted[k] = v
        return converted

    # -----------------------------------------
    # SEND (client mode)
    # -----------------------------------------
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
        # Backward/forward compatibility:
        # - old callers: send(command, params=...)
        # - WPAgent.py: send(command=..., data=...)
        if data is not None:
            params = data
        """
        Send a Kafka command message and optionally wait for reply (SVT convention).

        Request:
          - topic: svt.wp-agent.request
          - headers: kafka_correlationId, kafka_replyTopic, kafka_replyPartition
          - body: { type, data }

        Reply:
          - topic: svt.wp-agent.request.reply
          - headers: kafka_correlationId, kafka_replyPartition
          - body: { status, type, data?, error? }
        """
        # --- normalize params  ---
        if isinstance(params, str):
            if command == "RunSequencer" and params.endswith(".json"):
                params = {"filepath": params}
            elif "=" in params:
                k, v = params.split("=", 1)
                params = {k: v}
            else:
                data = {}
        elif data is None:
            data = {}
        elif not isinstance(data, dict):
            try:
                data = dict(data)
            except Exception:
                data = {}

        results = []

        if wait_for_reply and self.reply_consumer is None:
            print(f"⏳ Initializing reply consumer...")
            self._ensure_reply_consumer_ready()

        for i in range(repeat):
            correlation_id = str(uuid.uuid4())

            # Convention request body
            payload = {
                "type": command,
                "data": params
            }

            # Convention headers
            headers = [
                (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
            ]

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

            # Send request
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

                response = self._wait_for_reply(correlation_id, timeout)

                if response:
                    results.append(response)

                    status = response.get("status", "unknown")
                    rtype = response.get("type", "UnknownReply")

                    # ====== FIXED: Extract message for display (handles both formats) ======
                    display_output = None

                    # Try ResponseBuilder format first (data.message)
                    if "data" in response and isinstance(response["data"], dict):
                        if "message" in response["data"]:
                            display_output = response["data"]["message"]

                    # Fall back to old format (output key at root level)
                    if display_output is None and "output" in response:
                        display_output = response["output"]

                    # Fall back to error message
                    if display_output is None:
                        error_info = response.get("error", {})
                        if isinstance(error_info, dict):
                            display_output = error_info.get("message", "")

                    # Display based on status
                    if status == SvtMessageStatus.Success:
                        print(f"✅ {status}: {rtype}")
                        if display_output:
                            print(display_output)
                    else:
                        print(f"❌ {status}: {rtype}")
                        if display_output:
                            print(f"   {display_output}")
                    # ====== END FIX ======

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

    # -----------------------------------------
    # LISTEN (server mode)
    # -----------------------------------------
    def listen(self, poll_timeout=0.1):
        """
        Listen for and process Kafka messages (LISTENER MODE).
        Silent mode: no command prints, only errors are logged.
        """

        logger.log_command(
            messageOut=f"Kafka listener started on topic '{self.request_topic}'",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            result=None
        )

        # Start heartbeat monitoring
        self.heartbeat_monitor.start()

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
                    result = execute_command(command, data)
                    exec_end = time.time()
                    exec_time_ms = (exec_end - exec_start) * 1000

                    # ====== FIXED: Handle both ResponseBuilder and old format ======
                    # Check if result is already in ResponseBuilder format
                    if result and "type" in result and "data" in result:
                        # Already ResponseBuilder format - use as-is but add execution time
                        reply_body = result
                        if "data" in reply_body and isinstance(reply_body["data"], dict):
                            reply_body["data"]["executionTimeMs"] = exec_time_ms
                    else:
                        # Old format - convert to SVT convention
                        raw_status = (result or {}).get("status", "error")
                        output = (result or {}).get("output", "No output")

                        if raw_status == "success":
                            reply_body = {
                                "status": SvtMessageStatus.Success,
                                "type": f"{command}Reply",
                                "data": {
                                    "output": output,
                                    "executionTimeMs": exec_time_ms
                                }
                            }
                        else:
                            reply_body = {
                                "status": SvtMessageStatus.UnexpectedError,
                                "type": f"{command}Reply",
                                "error": {
                                    "message": output
                                }
                            }
                    # ====== END FIX ======

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
                        self.producer.flush()

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
                        reply_partition = int(
                            reply_part_bytes.decode("utf-8", errors="ignore")) if reply_part_bytes else 0

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
                            self.producer.flush()

                    except Exception:
                        pass

        except KeyboardInterrupt:
            pass
        finally:
            self.heartbeat_monitor.stop()
            self.request_consumer.close()
            if self.reply_consumer:
                self.reply_consumer.close()

    # -----------------------------------------
    # (Optional) request_reply helper for other services
    #
    # -----------------------------------------
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
<<<<<<< HEAD
    ) -> Optional[Dict[str, Any]]:
        """
        Generic request-reply for other services (like DB agent), SVT convention:
          - reply topic is request_topic + ".reply"
          - correlation via kafka headers
        """
        reply_topic = f"{request_topic}.reply"
        self._ensure_topic_exists(request_topic)
        self._ensure_topic_exists(reply_topic)
=======
            add_requestId: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Generic request-reply for other services (like DB agent)"""
        req_id = None
        if add_requestId:
            req_id = str(uuid.uuid4())
            payload = dict(payload)
            payload["requestId"] = req_id
>>>>>>> d8253d1 (partially fixed naming)

        if self.reply_consumer is None:
            self._ensure_reply_consumer_ready()
        # Make sure we are subscribed to that service's reply topic too
        self.subscribe_if_needed([reply_topic])

        correlation_id = str(uuid.uuid4())

        # Ensure convention request body {type,data} if caller didn't do it
        # If you already pass {type,data}, this will keep it.
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
            msg = self.reply_consumer.poll(0.5)
            if msg is None or msg.error():
                continue
<<<<<<< HEAD
=======
            if msg.error():
                logger.log_command(
                    messageOut=f"[KafkaClient] {msg.error()}",
                    severityLevel=Severity.ERROR,
                    command="KAFKA_REQUEST_REPLY",
                    result={"error": str(msg.error())}
                )
                continue
            try:
                value = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                logger.log_command(
                    messageOut=f"[KafkaClient] JSON parse error: {e}",
                    severityLevel=Severity.ERROR,
                    command="KAFKA_REQUEST_REPLY",
                    result={"error": str(e)}
                )
                continue
            if value.get("type") != reply_type:
                continue
            if add_requestId and value.get("requestId") and value["requestId"] != req_id:
                continue
            if match_fn and not match_fn(value):
                continue
            return value
>>>>>>> d8253d1 (partially fixed naming)

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
from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import time
import ast
import uuid
from typing import Callable, Optional, Dict, Any, List
from cmd_map import execute_command
from WPAgentUtilities.WPAgentLogger import WPAgentLogger, Severity
from listener_heartbeat import ListenerHealthCheck, ListenerHealthMonitor

logger = WPAgentLogger()


class KafkaClient:
    def __init__(self, bootstrap_servers='localhost:9092', group_id='wafer-executor'):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.topic = 'svt.wp-agent'
        self._ensure_topic_exists(self.topic)

        self.producer = KafkaProducer({'bootstrap.servers': self.bootstrap_servers})
        self.consumer = KafkaConsumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.group_id,
            'auto.offset.reset': 'earliest'
        })
        self.consumer.subscribe([self.topic])

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
            except Exception as e:
                print(f"[⚠️ Topic Error] Failed to create topic '{topic_name}': {e}")
        else:
            print(f"[Topic Exists] {topic_name}")

    def send(self, command, params=None, repeat=1, delay=0):
        """
        Send a Kafka command message:
          - payload keys: { "type": <command>, "params": { ... } }
          - params is ALWAYS a dict (we coerce strings like sequence json paths)
        """
        # --- normalize params ---
        if isinstance(params, str):
            # tolerate "filepath=..." or raw path for RunSequencer
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

        payload = {"type": command, "params": params}

        for _ in range(repeat):
            logger.log_command(
                messageOut=f"Sending command: {command}",
                severityLevel=Severity.INFO,
                command=command,
                params=params,
                result=None,
            )
            self.producer.produce(
                self.topic,
                value=json.dumps(payload).encode("utf-8"),
                callback=self._delivery_report,
            )
            self.producer.poll(0)
            time.sleep(delay)

        self.producer.flush()

    def listen(self, poll_timeout=0.1):
        """
        Listen for and process Kafka messages.

        Args:
            poll_timeout: Timeout in seconds for each poll (default: 0.1s = 100ms)
                         Lower = faster response but higher CPU
                         Higher = slower response but lower CPU
                         Recommended: 0.05 to 0.2 seconds
        """

        logger.log_command(
            messageOut=f"Kafka listener started on topic '{self.topic}' (poll_timeout={poll_timeout}s)",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            params={"poll_timeout": poll_timeout},
            result=None
        )

        # Start heartbeat monitoring
        self.heartbeat_monitor.start()

        try:
            while True:
                msg = self.consumer.poll(poll_timeout)

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

                # Record receive time for diagnostics
                receive_time = time.time()

                try:
                    payload = json.loads(msg.value().decode("utf-8"))

                    # ✅ Fix: support both "type" and old "message"
                    command = payload.get("type") or payload.get("message")

                    params = payload.get("params", {})
                    if hasattr(self, "_convert_param_types"):
                        params = self._convert_param_types(params)

                    print(f"\n[📥 Received] {command}")
                    logger.log_command(
                        messageOut=f"Received command: {command}",
                        severityLevel=Severity.INFO,
                        command=command,
                        params=params,
                        result=None
                    )
                    print(f"[ Params] {params}" if params else "[ℹ️ No parameters]")

                    # Record execution start time
                    exec_start = time.time()

                    result = execute_command(command, params)

                    # Record execution end time
                    exec_end = time.time()

                    # Calculate timings
                    sent_at = payload.get("sent_at")
                    if sent_at:
                        kafka_delay = (receive_time - sent_at) * 1000
                        print(f"[️ Kafka delay] {kafka_delay:.1f}ms")

                    exec_time = (exec_end - exec_start) * 1000

                    if result["status"] == "success":
                        print(f"[✅ OK] {result['output']}")
                    else:
                        print(f"[❌ ERROR] {result['output']}")

                except Exception as e:
                    logger.log_command(
                        messageOut=f"Exception during command execution: {str(e)}",
                        severityLevel=Severity.ERROR,
                        command=command if 'command' in locals() else "UNKNOWN",
                        result={"error": str(e)}
                    )
                    print(f"[❌ Exception] {e}")

        except KeyboardInterrupt:
            print("\n[🛑 Listener stopped]")
        finally:
            # Stop heartbeat monitoring
            self.heartbeat_monitor.stop()
            self.consumer.close()

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
            print(f"[✅ Delivered] {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")

    def subscribe_if_needed(self, topics: List[str]) -> None:
        try:
            current = set(self.consumer.subscription() or [])
        except AttributeError:
            current = set()
        wanted = current.union(set(topics))
        self.consumer.subscribe(list(wanted))

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
        req_id = None
        if add_request_id:
            req_id = str(uuid.uuid4())
            payload = dict(payload)
            payload["requestId"] = req_id

        self.producer.produce(request_topic, json.dumps(payload).encode("utf-8"), callback=self._delivery_report)
        self.producer.flush()
        self.subscribe_if_needed([reply_topic])

        start = time.time()
        while time.time() - start < timeout:
            msg = self.consumer.poll(1.0)
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
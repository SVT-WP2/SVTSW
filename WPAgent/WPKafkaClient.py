from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient, NewTopic
from concurrent.futures import ThreadPoolExecutor, wait as wait_for_futures

import json
import signal
import threading
import time
import ast
import uuid
from typing import Callable, Optional, List, Dict
from utilities.WPAgentTypes import KafkaPayload

from WPCmdMap import execute_command
from utilities.WPAgentLogger import WPAgentLogger, Severity
from utilities.WPAgentCache import WPAgentCache
from services.WPHeartbeat import ListenerHealthCheck, ListenerHealthMonitor
from services.WPProberConnectionWatch import (
    ProberConnectionWatch, add_connection_listener, close_prober_connection, remove_connection_listener,
)
from utilities.WPCommandActivity import command_running, running_commands
from utilities.WPMachineName import is_same_machine, normalize_machine_name
from utilities.WPMessagesStatus import WPMessagesStatus

logger = WPAgentLogger(kafka_servers=None)
# cache = WPAgentCache(kafka_servers=None)
# cache.initialize_cache()

# =========================
# SVT Kafka Conventions
# =========================
KAFKA_HEADER__CORRELATION_ID = "kafka_correlationId"
KAFKA_HEADER__REPLY_TOPIC = "kafka_replyTopic"
KAFKA_HEADER__REPLY_PARTITION = "kafka_replyPartition"

# Connection status of each WP machine (see ProberConnectionWatch)
CONNECTION_STATUS_TOPIC = "svt.wp-agent.connection-status"
CONNECTION_STATUS_EVENT = "WpConnectionStatusChanged"

# Seconds that a command which is running when the listener stops gets to finish, before
# the connection to the WP machine is closed anyway. Keep the stop timeout of the service
# above it (stop_grace_period in the compose files).
STOP_COMMAND_WAIT = 20.0


def _stop_on_sigterm(stop: threading.Event):
    """
    SIGTERM (docker stop, a deploy, systemctl stop) asks the listener to stop in order,
    as Ctrl+C does. Without a handler Python has none for SIGTERM: a process with PID 1
    in a container ignores the signal and is killed after the stop timeout.

    Returns a function that puts the previous handler back.
    """
    try:
        previous = signal.signal(signal.SIGTERM, lambda _signum, _frame: stop.set())
    except ValueError:
        return lambda: None  # not the main thread: signal handlers cannot be set here
    if previous is None:  # the old handler was not set from Python
        previous = signal.SIG_DFL
    return lambda: signal.signal(signal.SIGTERM, previous)



def _headers_to_dict(headers) -> Dict[str, bytes]:
    """Convert confluent-kafka headers list[(k,v)] to dict."""
    if not headers:
        return {}
    return {k: v for (k, v) in headers if k is not None}


class KafkaClient:
    def __init__(self, bootstrap_servers=None, group_id="wafer-executor", agent_name=None):
        """
        Initialize Kafka client

        Args:
            bootstrap_servers: Kafka broker address (e.g., "svmithi02:9092")
                              If None, uses default
            group_id: Consumer group ID
            agent_name: WP machine of this listener. It runs only the requests for this
                        machine, and every machine has its own consumer group.
        """

        self.bootstrap_servers = bootstrap_servers
        print(f"🔌 Using Kafka broker from config: {bootstrap_servers}")

        self.group_id = group_id
        self.agent_name = agent_name

        # Topics
        self.request_topic = "svt.wp-agent.request"
        self.reply_topic = f"{self.request_topic}.reply"
        self.connection_topic = CONNECTION_STATUS_TOPIC

        self._ensure_topic_exists(self.request_topic)
        self._ensure_topic_exists(self.reply_topic)
        self._ensure_topic_exists(self.connection_topic)

        # Producer configuration
        producer_config = {
            "bootstrap.servers": self.bootstrap_servers,
            "linger.ms": 0,
            "compression.type": "none",
            "client.id": f"wp-agent-producer-{uuid.uuid4().hex[:8]}",
            "socket.timeout.ms": 10000,
        }
        self.producer = KafkaProducer(producer_config)

        self.request_consumer = None
        self.reply_consumer = None

        self._initialize_reply_consumer()
        self.cache = None

    def _ensure_topic_exists(self, topic_name, num_partitions=1, replication_factor=1):
        admin_config = {
            "bootstrap.servers": self.bootstrap_servers,
            "broker.address.family": "v4",  # Force IPv4 only
        }
        admin = AdminClient(admin_config)
        metadata = admin.list_topics(timeout=5)

        if topic_name not in metadata.topics:
            new_topic = NewTopic(
                topic=topic_name,
                num_partitions=num_partitions,
                replication_factor=replication_factor,
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
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": f"{self.group_id}-reply-{uuid.uuid4().hex[:8]}",
            "auto.offset.reset": "latest",
            "enable.auto.commit": False,
            "fetch.wait.max.ms": 50,
            "socket.timeout.ms": 10000,
            "client.id": f"wp-agent-reply-consumer-{uuid.uuid4().hex[:8]}",
            # Disable localhost fallback
            "broker.address.family": "v4",  # Force IPv4 only
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
            timeout=30.0,
    ):

        # print(self.bootstrap_servers)

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
                headers.append(
                    (KAFKA_HEADER__REPLY_TOPIC, self.reply_topic.encode("utf-8"))
                )
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

                response = self._wait_for_reply_on(
                    reply_consumer, correlation_id, timeout
                )

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

                    if status == WPMessagesStatus.Success:
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
                        "status": WPMessagesStatus.UnexpectedError,
                        "type": f"{command}Reply",
                        "error": {
                            "message": f"Timeout: No response received within {timeout}s. Listener may be down."
                        },
                    }
                    print(f"⏱️  TIMEOUT: No response within {timeout}s")
                    print(
                        "   Check if listener is running: python main.py check_listener_health"
                    )
                    return error_response

            else:
                print(f"📤 Command queued: {command} (no reply expected)")

            if i < repeat - 1:
                time.sleep(delay)

        return results if repeat > 1 else (results[0] if results else None)

    def listener_group_id(self):
        """One consumer group per machine: each listener gets every request.
        A second listener of the same machine joins the same group and stays idle."""
        machine = normalize_machine_name(self.agent_name)
        return f"{self.group_id}-{machine}" if machine else self.group_id

    def is_for_this_machine(self, params):
        """True when the request names the machine of this listener (always, without agent_name)."""
        if not self.agent_name:
            return True
        target = params.get("waferAgentName") if isinstance(params, dict) else None
        return is_same_machine(target, self.agent_name)

    def publish_connection_status(self, connected, initialized):
        """Send a WpConnectionStatusChanged event (key: the machine name) with the given status."""
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()
        event = {
            "type": CONNECTION_STATUS_EVENT,
            "data": {
                "waferAgentName": self.agent_name,
                "wpMachineId": g.wpMachineId,
                "connected": connected,
                "initialized": initialized,
                "address": g.address,
                "timestamp": time.time(),
            },
        }
        self.producer.produce(
            self.connection_topic,
            key=(normalize_machine_name(self.agent_name) or None),
            value=json.dumps(event).encode("utf-8"),
        )
        self.producer.poll(0)

    def skip_request_backlog(self, consumer):
        """
        Move the offsets of this listener's group to the end of the request topic, before
        the consumer subscribes.

        Kafka resumes a group from its committed offset ("auto.offset.reset: latest" only
        covers a group without one), so the requests sent while the agent was down would
        run when it starts: their senders gave up long ago, and a command among them
        would move the machine now.

        The broker accepts the commit only while the group has no member. With another
        listener of this machine in the group the offsets stay, and this listener joins the
        group as it is. Returns the number of skipped requests, or None when the offsets
        could not be read or moved.
        """
        from confluent_kafka import TopicPartition

        group = self.listener_group_id()
        try:
            metadata = consumer.list_topics(self.request_topic, timeout=5.0)
            partitions = [
                TopicPartition(self.request_topic, partition)
                for partition in metadata.topics[self.request_topic].partitions
            ]
            skipped, ends = 0, []
            for committed in consumer.committed(partitions, timeout=5.0):
                _low, high = consumer.get_watermark_offsets(committed, timeout=5.0, cached=False)
                if committed.offset >= 0:  # negative: no committed offset, "latest" applies
                    skipped += max(0, high - committed.offset)
                ends.append(TopicPartition(committed.topic, committed.partition, high))
            if skipped:
                consumer.commit(offsets=ends, asynchronous=False)
        except Exception as e:
            logger.log_command(
                messageOut=f"Could not skip the request backlog of group '{group}': {e}",
                severityLevel=Severity.WARNING,
                command="KAFKA_LISTEN",
                result={"error": str(e)},
            )
            return None

        if skipped:
            logger.log_command(
                messageOut=f"Skipped {skipped} request(s) sent while no listener of group '{group}' was running",
                severityLevel=Severity.WARNING,
                command="KAFKA_LISTEN",
                result=None,
            )
        return skipped

    def listen(self, poll_timeout=0.1):
        """Listen for and process Kafka messages (LISTENER MODE).

        The listener starts after the last request of the topic (skip_request_backlog) and
        with the connection watch, which only reports whether the WP machine is on: the
        agent connects to the machine when it gets the Initialize command.

        Ctrl+C or SIGTERM stops it in order (_stop_listening): the running command
        finishes, then the connection to the WP machine is closed.
        """

        consumer_config = {
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.listener_group_id(),
            "auto.offset.reset": "latest",
            "enable.auto.commit": True,
            "session.timeout.ms": 10000,
            "heartbeat.interval.ms": 3000,
            "max.poll.interval.ms": 300000,
            "client.id": f"wp-agent-listener-{uuid.uuid4().hex[:8]}",
            # Disable localhost fallback
            "broker.address.family": "v4",  # Force IPv4 only
        }

        print(self.bootstrap_servers)

        self.cache = WPAgentCache(kafka_servers=self.bootstrap_servers)
        self.cache.initialize_cache()

        self.request_consumer = KafkaConsumer(consumer_config)
        self.skip_request_backlog(self.request_consumer)
        self.request_consumer.subscribe([self.request_topic])

        # Initialize heartbeat monitoring with correct broker only when listener started
        health_check = ListenerHealthCheck(
            bootstrap_servers=self.bootstrap_servers, agent_name=self.agent_name
        )
        # The cache snapshot is refreshed on every heartbeat beat (no separate cache topic)
        heartbeat_monitor = ListenerHealthMonitor(
            health_check, on_heartbeat=self.cache.cache_command
        )

        executor = ThreadPoolExecutor(max_workers=4)
        handling = set()  # the futures of the requests that are being handled

        logger.log_command(
            messageOut=f"Kafka listener started on topic '{self.request_topic}'",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            result=None,
        )

        heartbeat_monitor.start()

        # The global watcher of the WP machine: it reports whether the machine is on and
        # restores a lost connection; every status change is published as an event.
        add_connection_listener(self.publish_connection_status)
        # The watch stays quiet while a command runs (utilities/WPCommandActivity.py)
        connection_watch = ProberConnectionWatch(is_busy=lambda: running_commands() > 0)
        connection_watch.start()

        stop = threading.Event()
        restore_sigterm = _stop_on_sigterm(stop)
        try:
            while not stop.is_set():
                msg = self.request_consumer.poll(poll_timeout)

                if msg is None:
                    continue

                if msg.error():
                    logger.log_command(
                        messageOut=f"Kafka error: {msg.error()}",
                        severityLevel=Severity.ERROR,
                        command="KAFKA_LISTEN",
                        result={"error": str(msg.error())},
                    )
                    continue

                future = executor.submit(self._handle_message, msg)
                handling.add(future)
                future.add_done_callback(handling.discard)

        except KeyboardInterrupt:
            pass
        finally:
            try:
                self._stop_listening(executor, handling, heartbeat_monitor, connection_watch)
            finally:
                restore_sigterm()

    def _stop_listening(self, executor, handling, heartbeat_monitor, connection_watch):
        """
        Stop the listener in an order that leaves the WP machine in a clean state:

        1. No new requests; requests that wait for a free worker are dropped.
        2. A running command gets STOP_COMMAND_WAIT seconds to finish and to send its reply.
        3. The connection watch stops, so that it does not take the closed connection for
           a lost machine (no reconnect, no Error state).
        4. The machine goes to local mode and the TCP connection is closed
           (close_prober_connection). A command that is still running is cut: no local
           mode then, because a second command on the same connection would mix with it.
        5. The heartbeat stops, the replies and the last status event go out.

        A step that fails does not stop the next ones.
        """
        def step(what, action):
            try:
                return action()
            except Exception as e:
                logger.log_command(
                    messageOut=f"Stop of the listener: could not {what}: {e}",
                    severityLevel=Severity.WARNING,
                    command="KAFKA_LISTEN",
                    result={"error": str(e)},
                )
                return None

        logger.log_command(
            messageOut="Kafka listener stops",
            severityLevel=Severity.INFO,
            command="KAFKA_LISTEN",
            result=None,
        )

        step("close the request consumer", self.request_consumer.close)
        step("drop the waiting requests", lambda: executor.shutdown(wait=False, cancel_futures=True))

        _done, still_running = wait_for_futures(list(handling), timeout=STOP_COMMAND_WAIT)
        if still_running:
            logger.log_command(
                messageOut=(
                    f"{len(still_running)} command(s) still running after {STOP_COMMAND_WAIT:.0f} s: "
                    "the connection to the WP machine is closed anyway"
                ),
                severityLevel=Severity.WARNING,
                command="KAFKA_LISTEN",
                result=None,
            )

        step("stop the connection watch", connection_watch.stop)
        closed = step(
            "close the connection to the WP machine",
            lambda: close_prober_connection(send_local_mode=not still_running),
        )
        if closed:
            logger.log_command(
                messageOut="Connection to the WP machine closed: the next start needs Initialize",
                severityLevel=Severity.INFO,
                command="KAFKA_LISTEN",
                result=None,
            )

        step("remove the connection listener", lambda: remove_connection_listener(self.publish_connection_status))
        step("stop the heartbeat", heartbeat_monitor.stop)
        step("send the last messages", lambda: self.producer.flush(timeout=5.0))
        if self.reply_consumer:
            step("close the reply consumer", self.reply_consumer.close)

    def _handle_message(self, msg):
        """Runs in a thread — executes command and sends reply."""
        try:
            payload = json.loads(msg.value().decode("utf-8"))

            command = payload.get("type")
            params = payload.get("data", {}) or {}

            # Every agent reads every request: only the named machine runs it and replies.
            if not self.is_for_this_machine(params):
                return

            if hasattr(self, "_convert_param_types"):
                params = self._convert_param_types(params)

            hdr = _headers_to_dict(msg.headers())
            corr_bytes = hdr.get(KAFKA_HEADER__CORRELATION_ID)
            reply_topic_bytes = hdr.get(KAFKA_HEADER__REPLY_TOPIC)
            reply_part_bytes = hdr.get(KAFKA_HEADER__REPLY_PARTITION)

            correlation_id = (
                corr_bytes.decode("utf-8", errors="ignore") if corr_bytes else None
            )
            reply_to = (
                reply_topic_bytes.decode("utf-8", errors="ignore")
                if reply_topic_bytes
                else None
            )
            reply_partition = (
                int(reply_part_bytes.decode("utf-8", errors="ignore"))
                if reply_part_bytes
                else 0
            )

            logger.log_command(
                messageOut=f"Received command: {command}",
                severityLevel=Severity.INFO,
                command=command,
                data=params,
                result=None,
            )

            exec_start = time.time()
            with command_running():
                result = execute_command(command, params)
            exec_end = time.time()
            exec_time_ms = (exec_end - exec_start) * 1000
            self.cache.cache_command()  # update cache snapshot with current global state

            if result and "type" in result and "data" in result:
                reply_body = result
                if "data" in reply_body and isinstance(reply_body["data"], dict):
                    reply_body["data"]["executionTimeMs"] = exec_time_ms
            else:
                raw_status = (result or {}).get("status", "error")
                output = (result or {}).get("output", "No output")

                if raw_status == "Success":
                    reply_body = {
                        "status": WPMessagesStatus.Success,
                        "type": f"{command}Reply",
                        "data": {"output": output, "executionTimeMs": exec_time_ms},
                    }
                else:
                    reply_body = {
                        "status": WPMessagesStatus.UnexpectedError,
                        "type": f"{command}Reply",
                        "error": {"message": output},
                    }

            if reply_to and correlation_id:
                reply_headers = [
                    (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
                    (
                        KAFKA_HEADER__REPLY_PARTITION,
                        str(reply_partition).encode("utf-8"),
                    ),
                ]
                self.producer.produce(
                    reply_to,
                    value=json.dumps(reply_body).encode("utf-8"),
                    headers=reply_headers,
                    partition=reply_partition,
                )
                self.producer.flush(timeout=2.0)

        except Exception as e:
            logger.log_command(
                messageOut=f"Exception during command execution: {str(e)}",
                severityLevel=Severity.ERROR,
                command=command if "command" in locals() else "UNKNOWN",
                result={"error": str(e)},
            )
            try:
                hdr = _headers_to_dict(msg.headers())
                corr_bytes = hdr.get(KAFKA_HEADER__CORRELATION_ID)
                reply_topic_bytes = hdr.get(KAFKA_HEADER__REPLY_TOPIC)
                reply_part_bytes = hdr.get(KAFKA_HEADER__REPLY_PARTITION)

                correlation_id = (
                    corr_bytes.decode("utf-8", errors="ignore") if corr_bytes else None
                )
                reply_to = (
                    reply_topic_bytes.decode("utf-8", errors="ignore")
                    if reply_topic_bytes
                    else None
                )
                reply_partition = (
                    int(reply_part_bytes.decode("utf-8", errors="ignore"))
                    if reply_part_bytes
                    else 0
                )

                if reply_to and correlation_id:
                    error_reply = {
                        "status": WPMessagesStatus.UnexpectedError,
                        "type": f"{command if 'command' in locals() and command else 'Unknown'}Reply",
                        "error": {"message": f"Exception: {str(e)}"},
                    }
                    reply_headers = [
                        (KAFKA_HEADER__CORRELATION_ID, correlation_id.encode("utf-8")),
                        (
                            KAFKA_HEADER__REPLY_PARTITION,
                            str(reply_partition).encode("utf-8"),
                        ),
                    ]
                    self.producer.produce(
                        reply_to,
                        value=json.dumps(error_reply).encode("utf-8"),
                        headers=reply_headers,
                        partition=reply_partition,
                    )
                    self.producer.flush(timeout=2.0)
            except Exception:
                pass

    def _get_persistent_reply_consumer(self):
        # self.reply_consumer is normally already set by _initialize_reply_consumer()
        # (called from __init__) using assign(), not subscribe() — deliberately, so
        # it never joins a consumer group and can't be silently dropped for going
        # idle past max.poll.interval.ms (the same failure fixed in WPDbKafkaClient).
        # This is just a defensive fallback in case it's ever missing; it reuses
        # that same assign()-based setup rather than duplicating a subscribe()-based
        # one, which would reintroduce that risk (and can't safely be mixed with an
        # assign()-based consumer anyway).
        if self.reply_consumer is None:
            self._initialize_reply_consumer()
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
            payload: KafkaPayload,
            timeout: float = 10.0,
            reply_partition: int = 0,
            match_fn: Optional[Callable[[KafkaPayload], bool]] = None,
    ) -> Optional[KafkaPayload]:
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

        self.producer.produce(
            request_topic, json.dumps(body).encode("utf-8"), headers=headers
        )
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

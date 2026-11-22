"""
One WPAgent per WP machine: the machine name, the routing of requests, the skip of the
request backlog at start, the start config from the env vars, the required DB lookup and
the per-machine heartbeat.

Run:  python3 -m pytest tests/unit/TestOneAgentPerMachine.py -q -o python_files="Test*.py"
"""

import itertools
import json
import time
from unittest.mock import MagicMock

import pytest

import services.WPHeartbeat as heartbeat_module
import WPKafkaClient
from services.WPHeartbeat import ListenerHealthCheck
from utilities.WPMachineName import is_same_machine, normalize_machine_name
from WPAgent import ENV_KAFKA_BROKER, ENV_MACHINE_NAME, WaferProberAgent
from WPKafkaClient import CONNECTION_STATUS_EVENT, CONNECTION_STATUS_TOPIC, KafkaClient

WPMIT = {
    "id": 3, "name": "WPMIT", "hostName": "wpmit01.cern.ch", "connectionPort": 35555,
    "software": "Sentio", "generalLocation": "CERN",
}


# --- machine name ---------------------------------------------------------------------------

@pytest.mark.parametrize("name, other", [
    ("WPMIT", "WPMIT"), ("wpmit", "WPMIT"), ("WPMIT_DEV", "WPMIT"), (" WPMIT ", "wpmit_dev"),
])
def test_names_of_the_same_machine(name, other):
    assert is_same_machine(name, other)


@pytest.mark.parametrize("name, other", [
    ("WPMIT", "WPPRAGUE"), (None, "WPMIT"), ("WPMIT", None), ("", ""), (None, None),
])
def test_names_of_another_or_no_machine(name, other):
    assert not is_same_machine(name, other)


def test_normalized_name():
    assert normalize_machine_name("wpmit_dev") == "WPMIT"
    assert normalize_machine_name(None) == ""


# --- routing ----------------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def no_reply_consumer(monkeypatch):
    """The listener side needs no reply consumer (the stubbed Kafka has no offsets)."""
    monkeypatch.setattr(KafkaClient, "_initialize_reply_consumer", lambda self: None)


def _client(agent_name="WPMIT"):
    client = KafkaClient(bootstrap_servers="kafka:9094", agent_name=agent_name)
    client.producer = MagicMock()
    client.cache = MagicMock()
    return client


def _request(agent_name, command="GetAgentState"):
    data = {"user": "u1"}
    if agent_name is not None:
        data["waferAgentName"] = agent_name
    msg = MagicMock()
    msg.value.return_value = json.dumps({"type": command, "data": data}).encode()
    msg.headers.return_value = [
        (WPKafkaClient.KAFKA_HEADER__CORRELATION_ID, b"corr-1"),
        (WPKafkaClient.KAFKA_HEADER__REPLY_TOPIC, b"svt.wp-agent.request.reply"),
    ]
    return msg


def test_one_consumer_group_per_machine():
    assert _client("WPMIT").listener_group_id() == "wafer-executor-WPMIT"
    assert _client("wpmit_dev").listener_group_id() == "wafer-executor-WPMIT"
    assert _client(None).listener_group_id() == "wafer-executor"


@pytest.mark.parametrize("target", ["WPPRAGUE", None])
def test_request_for_another_machine_is_dropped_without_reply(monkeypatch, target):
    execute = MagicMock()
    monkeypatch.setattr(WPKafkaClient, "execute_command", execute)
    client = _client("WPMIT")
    client._handle_message(_request(target))
    execute.assert_not_called()
    client.producer.produce.assert_not_called()


@pytest.mark.parametrize("target", ["WPMIT", "WPMIT_DEV", "wpmit"])
def test_request_for_this_machine_runs_and_replies(monkeypatch, target):
    execute = MagicMock(return_value={"status": "Success", "type": "GetAgentStateReply", "data": {}})
    monkeypatch.setattr(WPKafkaClient, "execute_command", execute)
    client = _client("WPMIT")
    client._handle_message(_request(target))
    execute.assert_called_once()
    assert client.producer.produce.call_args[0][0] == "svt.wp-agent.request.reply"


def test_every_command_takes_the_routing_keys():
    """Every request carries waferAgentName (and user): a handler without them fails on each call."""
    import inspect

    from WPCmdMap import COMMAND_ROUTER

    def takes(handler, key):
        params = inspect.signature(handler).parameters
        return key in params or any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values())

    missing = [name for name, handler in COMMAND_ROUTER.items()
               if not (takes(handler, "waferAgentName") and takes(handler, "user"))]
    assert missing == []


def test_connection_status_event(globals_instance):
    globals_instance.wpMachineId = 3
    globals_instance.set_address("wpmit01.cern.ch:35555")
    client = _client("WPMIT")
    client.publish_connection_status(False)

    args, kwargs = client.producer.produce.call_args
    assert args[0] == CONNECTION_STATUS_TOPIC
    assert kwargs["key"] == "WPMIT"
    event = json.loads(kwargs["value"])
    assert event["type"] == CONNECTION_STATUS_EVENT
    assert {k: event["data"][k] for k in ("waferAgentName", "wpMachineId", "connected", "initialized", "address")} == {
        "waferAgentName": "WPMIT", "wpMachineId": 3, "connected": False, "initialized": False,
        "address": "wpmit01.cern.ch:35555",
    }


# --- request backlog --------------------------------------------------------------------------

REQUEST_TOPIC = "svt.wp-agent.request"


class _TopicPartition:
    def __init__(self, topic, partition, offset=-1001):
        self.topic, self.partition, self.offset = topic, partition, offset


@pytest.fixture
def request_consumer(monkeypatch):
    """A consumer of a group that committed `committed` on a topic that ends at `high`."""
    import confluent_kafka

    monkeypatch.setattr(confluent_kafka, "TopicPartition", _TopicPartition)

    def build(committed, high):
        consumer = MagicMock()
        consumer.list_topics.return_value.topics = {REQUEST_TOPIC: MagicMock(partitions={0: None})}
        consumer.committed.return_value = [_TopicPartition(REQUEST_TOPIC, 0, committed)]
        consumer.get_watermark_offsets.return_value = (0, high)
        return consumer

    return build


def test_requests_sent_while_the_agent_was_down_are_skipped(request_consumer):
    consumer = request_consumer(committed=5, high=8)
    assert _client("WPMIT").skip_request_backlog(consumer) == 3

    kwargs = consumer.commit.call_args[1]
    assert [(tp.topic, tp.partition, tp.offset) for tp in kwargs["offsets"]] == [(REQUEST_TOPIC, 0, 8)]
    assert kwargs["asynchronous"] is False


@pytest.mark.parametrize("committed", [8, -1001])   # up to date; a new group ("latest" applies)
def test_nothing_to_skip_leaves_the_offsets(request_consumer, committed):
    consumer = request_consumer(committed=committed, high=8)
    assert _client("WPMIT").skip_request_backlog(consumer) == 0
    consumer.commit.assert_not_called()


def test_offsets_stay_when_the_group_has_another_member(request_consumer):
    consumer = request_consumer(committed=5, high=8)
    consumer.commit.side_effect = Exception("UNKNOWN_MEMBER_ID")   # the broker refuses the commit
    assert _client("WPMIT").skip_request_backlog(consumer) is None


def test_listener_skips_the_backlog_before_it_subscribes(request_consumer, monkeypatch):
    consumer = request_consumer(committed=5, high=8)
    consumer.poll.side_effect = KeyboardInterrupt      # stop the listener at its first poll
    monkeypatch.setattr(WPKafkaClient, "KafkaConsumer", lambda _config: consumer)
    for name in ("WPAgentCache", "ListenerHealthCheck", "ListenerHealthMonitor", "ProberConnectionWatch"):
        monkeypatch.setattr(WPKafkaClient, name, MagicMock())

    _client("WPMIT").listen()

    calls = [call[0] for call in consumer.method_calls]
    assert calls.index("commit") < calls.index("subscribe") < calls.index("poll")


# --- start config -----------------------------------------------------------------------------

@pytest.fixture
def no_env(monkeypatch):
    monkeypatch.delenv(ENV_MACHINE_NAME, raising=False)
    monkeypatch.delenv(ENV_KAFKA_BROKER, raising=False)


def test_start_config_from_the_env_vars(monkeypatch):
    monkeypatch.setenv(ENV_MACHINE_NAME, "WPMIT")
    monkeypatch.setenv(ENV_KAFKA_BROKER, "kafka:9094")
    assert WaferProberAgent()._load_start_config() == {"name": "WPMIT", "kafka_broker": "kafka:9094"}


def test_config_file_wins_over_the_env_vars(monkeypatch, tmp_path):
    monkeypatch.setenv(ENV_MACHINE_NAME, "OTHER")
    monkeypatch.setenv(ENV_KAFKA_BROKER, "other:1")
    path = tmp_path / "ProbeConfigTest.json"
    path.write_text(json.dumps({"name": "WPMIT", "kafka_broker": "pcmitpx01:9096"}))
    assert WaferProberAgent(config=str(path))._load_start_config()["name"] == "WPMIT"


def test_start_config_needs_a_file_or_both_env_vars(no_env, monkeypatch):
    monkeypatch.setenv(ENV_MACHINE_NAME, "WPMIT")
    with pytest.raises(KeyError):
        WaferProberAgent()._load_start_config()


def test_listen_without_config_exits_with_1(no_env):
    with pytest.raises(SystemExit) as stop:
        WaferProberAgent().listen()
    assert stop.value.code == 1


# --- machine from the DB ----------------------------------------------------------------------

class _FakeDb:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = 0

    def get_all_wafer_probe_machines(self, timeout=15.0):
        self.calls += 1
        return self.answers.pop(0) if self.answers else []


@pytest.fixture
def fake_db(monkeypatch):
    from services.WPDbKafkaClient import DBKafkaClient

    def install(*answers):
        db = _FakeDb(answers)
        monkeypatch.setattr(DBKafkaClient, "_instance", db)
        return db

    return install


def test_machine_comes_from_the_db(fake_db):
    fake_db([WPMIT])
    config = WaferProberAgent()._load_probe_config_with_db({"name": "WPMIT", "kafka_broker": "kafka:9094"})
    assert config == {
        "address": "wpmit01.cern.ch", "port": 35555, "machineType": "Sentio", "machineId": 3,
        "description": "CERN", "kafka_broker": "kafka:9094", "name": "WPMIT",
    }


def test_host_of_the_record_is_used_as_it_is(fake_db):
    fake_db([{**WPMIT, "hostName": "cern.ch"}])
    assert WaferProberAgent()._find_machine_in_db("WPMIT", "kafka:9094", wait=0)["address"] == "cern.ch"


def test_record_without_host_stops_the_agent(fake_db):
    fake_db([{**WPMIT, "hostName": ""}])
    with pytest.raises(ValueError, match="hostName"):
        WaferProberAgent()._find_machine_in_db("WPMIT", "kafka:9094", wait=0)


def test_waits_for_the_db_agent(fake_db, monkeypatch):
    monkeypatch.setattr("WPAgent.time.sleep", lambda _s: None)
    db = fake_db([], [], [WPMIT])
    assert WaferProberAgent()._find_machine_in_db("wpmit", "kafka:9094", wait=60)["machineId"] == 3
    assert db.calls == 3


def test_no_answer_from_the_db_stops_the_agent(fake_db):
    fake_db()
    with pytest.raises(TimeoutError):
        WaferProberAgent()._find_machine_in_db("WPMIT", "kafka:9094", wait=0)


def test_unknown_machine_stops_the_agent_and_names_the_known_ones(fake_db):
    fake_db([WPMIT])
    with pytest.raises(LookupError, match="Known: WPMIT"):
        WaferProberAgent()._find_machine_in_db("WPPRAGUE", "kafka:9094", wait=0)


def test_unsupported_software_stops_the_agent(fake_db):
    fake_db([{**WPMIT, "software": "VeloxCascade"}])
    with pytest.raises(ValueError, match="VeloxCascade"):
        WaferProberAgent()._find_machine_in_db("WPMIT", "kafka:9094", wait=0)


def test_mock_config_needs_no_db(fake_db):
    db = fake_db([WPMIT])
    config = {"name": "MOCK_LOCAL", "kafka_broker": "kafka:9084", "machineType": "mock",
              "address": "mock-prober", "port": 35555}
    assert WaferProberAgent()._load_probe_config_with_db(config) is config
    assert db.calls == 0


# --- heartbeat and local health ---------------------------------------------------------------

class _FakeConsumer:
    def __init__(self, messages):
        self._cycle = itertools.cycle(messages)

    def poll(self, timeout):
        return next(self._cycle)


def _beat(agent_name, timestamp):
    msg = MagicMock()
    msg.error.return_value = None
    msg.value.return_value = json.dumps({"timestamp": timestamp, "waferAgentName": agent_name}).encode()
    return msg


@pytest.fixture
def health_file(tmp_path, monkeypatch):
    path = tmp_path / "wp-agent-health.json"
    monkeypatch.setattr(heartbeat_module, "LOCAL_HEALTH_FILE", str(path))
    return path


def test_heartbeat_names_the_machine_and_its_connection(globals_instance, health_file):
    globals_instance.prober_connected = False
    globals_instance.wpMachineId = 3
    hc = ListenerHealthCheck(agent_name="WPMIT")  # no broker: no Kafka objects
    hc.producer = MagicMock()
    hc.send_heartbeat()

    kwargs = hc.producer.produce.call_args[1]
    beat = json.loads(kwargs["value"])
    assert (beat["waferAgentName"], beat["wpMachineId"], beat["proberConnected"]) == ("WPMIT", 3, False)
    assert beat["proberInitialized"] is False
    assert heartbeat_module.read_local_health() is None   # Kafka has not confirmed it yet

    kwargs["on_delivery"](None, MagicMock())
    assert heartbeat_module.read_local_health()["waferAgentName"] == "WPMIT"


def test_heartbeat_that_kafka_refused_is_not_written(health_file):
    hc = ListenerHealthCheck(agent_name="WPMIT")
    hc.producer = MagicMock()
    hc.send_heartbeat()
    hc.producer.produce.call_args[1]["on_delivery"](Exception("broker down"), None)
    assert heartbeat_module.read_local_health() is None


def test_health_check_counts_only_its_machine():
    hc = ListenerHealthCheck(agent_name="WPMIT")
    hc.consumer = _FakeConsumer([_beat("WPPRAGUE", time.time())])
    assert hc.is_listener_alive(timeout=0.2)[0] is False
    hc.consumer = _FakeConsumer([_beat("WPMIT_DEV", time.time())])
    assert hc.is_listener_alive(timeout=0.2)[0] is True


@pytest.mark.parametrize("connected", [True, False, None])
def test_local_health_ok_while_listener_beats_even_if_machine_is_off(health_file, connected):
    heartbeat_module.write_local_health(
        {"timestamp": time.time(), "waferAgentName": "WPMIT", "proberConnected": connected}
    )
    with pytest.raises(SystemExit) as stop:
        WaferProberAgent().check_local_health()
    assert stop.value.code == 0


def test_local_health_fails_on_an_old_heartbeat(health_file):
    heartbeat_module.write_local_health({"timestamp": time.time() - 60, "waferAgentName": "WPMIT"})
    with pytest.raises(SystemExit) as stop:
        WaferProberAgent().check_local_health()
    assert stop.value.code == 1


def test_local_health_fails_without_heartbeat(health_file):
    with pytest.raises(SystemExit) as stop:
        WaferProberAgent().check_local_health()
    assert stop.value.code == 1

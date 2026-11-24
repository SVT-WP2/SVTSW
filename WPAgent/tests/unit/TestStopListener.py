"""
The stop of the agent (Ctrl+C, SIGTERM from `docker stop` / a deploy / systemctl): the
running command finishes, the WP machine goes to local mode and the TCP connection to it
is closed. A restarted agent has no connection: it waits for the Initialize command.

Also here: the prober factory closes the connection of every prober that it lets go.

Run:  python3 -m pytest tests/unit/TestStopListener.py -q -o python_files="Test*.py"
"""

import json
import signal
import socket
import threading
import time
from unittest.mock import MagicMock

import pytest

import drivers.WPFactory as factory_module
import WPCmdMap
import WPKafkaClient
from drivers.WPFactory import ProberFactory, ProberNotConnectedError
from drivers.WPMockProber import MockProberImpl
from drivers.WPSentioProber import SentioProberImpl
from services.WPProberConnectionWatch import (
    add_connection_listener, close_prober_connection, remove_connection_listener, set_prober_connected,
)
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from WPKafkaClient import CONNECTION_STATUS_TOPIC, KafkaClient

AGENT = "TestAgent"
MOCK = ("mock", "mock:35555")


@pytest.fixture(autouse=True)
def machine(globals_instance):
    """The agent after its start: the machine is known (mock: always on), nothing is connected."""
    factory = ProberFactory.get_instance()
    factory.reset()
    globals_instance.wpAgentName = AGENT
    globals_instance.set_address(MOCK[1])
    globals_instance.set_machine_type(MOCK[0])
    sm.force_state(S.ServiceOn)
    yield factory
    factory.reset()
    sm.force_state(S.ServiceOn)


@pytest.fixture
def statuses():
    """The (connected, initialized) pair of every status change that the listeners got."""
    seen = []

    def listener(connected, initialized):
        seen.append((connected, initialized))

    add_connection_listener(listener)
    yield seen
    remove_connection_listener(listener)


def _initialized(machine):
    """The agent after Initialize: connected to the machine."""
    prober = machine.get_prober(*MOCK)
    set_prober_connected(True, "initialized")
    return prober


# --- the factory closes what it lets go -------------------------------------------------------

def test_close_closes_the_connection_and_forgets_the_prober(machine):
    prober = machine.get_prober(*MOCK)
    machine.close()
    assert prober.is_alive() is False
    assert not machine.is_initialized()
    assert machine.get_current_config() is None


def test_close_without_a_connection_is_fine(machine):
    machine.close()
    assert not machine.is_initialized()


def test_after_close_the_agent_connects_again(machine):
    old = machine.get_prober(*MOCK)
    machine.close()
    new = machine.get_prober(*MOCK)
    assert new is not old and new.is_alive()


def test_reconnect_closes_the_old_connection(machine):
    old = machine.get_prober(*MOCK)
    new = machine.reconnect(*MOCK)
    assert old.is_alive() is False
    assert new.is_alive() is True
    assert machine.get_prober(*MOCK) is new


def test_failed_reconnect_keeps_the_old_connection(machine, monkeypatch):
    old = machine.get_prober(*MOCK)

    def unreachable(_address):
        raise OSError("machine is off")

    monkeypatch.setitem(factory_module.prober_classes, "mock", unreachable)
    with pytest.raises(OSError):
        machine.reconnect(*MOCK)
    assert old.is_alive() is True
    assert machine.get_prober(*MOCK) is old


def test_another_address_closes_the_old_connection(machine):
    old = machine.get_prober(*MOCK)
    new = machine.get_prober("mock", "mock-moved:35555")
    assert old.is_alive() is False
    assert new.is_alive() is True


def test_initialize_with_force_closes_the_old_connection(machine):
    res = WPCmdMap.execute_command("Initialize", {"waferAgentName": AGENT})
    assert res["status"] == "Success", res
    old = machine.get_current_prober()

    res = WPCmdMap.execute_command("Initialize", {"waferAgentName": AGENT, "force": True})
    assert res["status"] == "Success", res
    assert old.is_alive() is False
    assert machine.get_current_prober() is not old
    assert machine.get_current_prober().is_alive() is True


def test_a_prober_without_disconnect_does_not_break_the_close(machine):
    machine.get_prober(*MOCK)
    machine._prober = object()      # an old test double
    machine.close()
    assert not machine.is_initialized()


def test_disconnect_that_fails_does_not_break_the_close(machine):
    prober = machine.get_prober(*MOCK)
    prober.disconnect = MagicMock(side_effect=OSError("socket is gone"))
    machine.close()
    assert not machine.is_initialized()


# --- no new connection once the agent stops ---------------------------------------------------

def test_final_close_refuses_every_new_connection(machine):
    old = machine.get_prober(*MOCK)
    machine.close(final=True)
    assert old.is_alive() is False
    with pytest.raises(ProberNotConnectedError, match="stopping"):
        machine.get_prober(*MOCK)
    with pytest.raises(ProberNotConnectedError, match="stopping"):
        machine.reconnect(*MOCK)
    assert not machine.is_initialized()


def test_initialize_after_the_stop_fails_and_opens_nothing(machine, monkeypatch):
    opened = []
    monkeypatch.setitem(
        factory_module.prober_classes, "mock", lambda address: opened.append(address) or MockProberImpl(address)
    )
    machine.close(final=True)
    res = WPCmdMap.execute_command("Initialize", {"waferAgentName": AGENT})
    assert res["status"] != "Success"
    assert "stopping" in res["error"]["message"]
    assert opened == []
    assert sm.current_state == S.ServiceOn


def test_a_connection_that_opens_while_the_agent_stops_is_closed(machine, monkeypatch):
    opened = []

    def slow_connect(address):
        machine.close(final=True)       # the stop arrives while the connection is opening
        opened.append(MockProberImpl(address))
        return opened[-1]

    monkeypatch.setitem(factory_module.prober_classes, "mock", slow_connect)
    with pytest.raises(ProberNotConnectedError, match="stopping"):
        machine.get_prober(*MOCK)
    assert opened[0].is_alive() is False
    assert not machine.is_initialized()


# --- SENTIO driver: the TCP connection --------------------------------------------------------

@pytest.fixture
def pair():
    a, b = socket.socketpair()
    yield a, b
    for s in (a, b):
        s.close()


def _sentio(sock):
    impl = object.__new__(SentioProberImpl)
    impl.prober = MagicMock()
    impl.prober.comm = MagicMock()
    impl.prober.comm._CommunicatorTcpIp__socket = sock
    return impl


def test_disconnect_ends_the_connection_for_sentio_and_sends_nothing(pair):
    a, b = pair
    impl = _sentio(a)
    impl.disconnect()
    b.settimeout(2.0)
    assert b.recv(16) == b""            # the end of the connection, no data before it
    assert a.fileno() == -1             # closed on our side
    impl.prober.comm.disconnect.assert_called_once()
    impl.prober.send_cmd.assert_not_called()


def test_disconnect_twice_is_safe(pair):
    a, _ = pair
    impl = _sentio(a)
    impl.disconnect()
    impl.disconnect()
    assert impl.is_alive() is False


def test_disconnect_survives_a_library_that_fails(pair):
    a, _ = pair
    impl = _sentio(a)
    impl.prober.comm.disconnect.side_effect = RuntimeError("library error")
    impl.disconnect()
    assert a.fileno() == -1


def test_disconnect_wakes_up_a_command_that_waits_for_an_answer(pair):
    a, _ = pair
    impl = _sentio(a)
    result = []

    def waiting_command():
        try:
            result.append(a.recv(16))
        except OSError as e:
            result.append(e)

    reader = threading.Thread(target=waiting_command, daemon=True)
    reader.start()
    time.sleep(0.1)                     # the command waits for the answer of SENTIO
    impl.disconnect()
    reader.join(timeout=2.0)
    assert not reader.is_alive()
    assert result and (result[0] == b"" or isinstance(result[0], OSError))


# --- close_prober_connection ------------------------------------------------------------------

def test_stop_sends_local_mode_then_closes(machine, statuses):
    prober = _initialized(machine)
    order = []
    prober.local_mode = lambda: order.append("local mode")
    prober.disconnect = lambda: order.append("closed")

    assert close_prober_connection() is True
    assert order == ["local mode", "closed"]
    assert not machine.is_initialized()
    # Initialize, then the stop: the machine is on, the agent is not initialized any more
    assert statuses == [(True, True), (True, False)]


def test_stop_sends_no_local_mode_while_a_command_runs(machine):
    prober = _initialized(machine)
    prober.local_mode = MagicMock()
    assert close_prober_connection(send_local_mode=False) is True
    prober.local_mode.assert_not_called()
    assert prober.is_alive() is False


def test_stop_sends_no_local_mode_to_a_machine_that_is_off(machine, statuses):
    prober = _initialized(machine)
    prober.local_mode = MagicMock()
    set_prober_connected(False, "machine was switched off")
    assert close_prober_connection() is True
    prober.local_mode.assert_not_called()
    assert statuses == [(True, True), (False, True), (False, False)]


def test_stop_closes_also_when_local_mode_fails(machine):
    prober = _initialized(machine)
    prober.local_mode = MagicMock(side_effect=OSError("no answer"))
    assert close_prober_connection() is True
    assert prober.is_alive() is False
    assert not machine.is_initialized()


def test_stop_without_a_connection_sends_no_status(machine, statuses):
    assert close_prober_connection() is False
    assert statuses == []
    with pytest.raises(ProberNotConnectedError, match="stopping"):
        machine.get_prober(*MOCK)


# --- the listener -----------------------------------------------------------------------------

def _request(command="GetAgentState"):
    msg = MagicMock()
    msg.error.return_value = None
    msg.value.return_value = json.dumps(
        {"type": command, "data": {"user": "u1", "waferAgentName": AGENT}}
    ).encode()
    msg.headers.return_value = [
        (WPKafkaClient.KAFKA_HEADER__CORRELATION_ID, b"corr-1"),
        (WPKafkaClient.KAFKA_HEADER__REPLY_TOPIC, b"svt.wp-agent.request.reply"),
    ]
    return msg


class _Listener:
    """A KafkaClient whose Kafka, heartbeat and connection watch are test doubles."""

    def __init__(self, monkeypatch, polls):
        self.order = []
        self.polls = 0
        self._poll_actions = polls

        self.consumer = MagicMock()
        self.consumer.poll.side_effect = self._poll
        self.consumer.close.side_effect = lambda: self.order.append("no new requests")

        monkeypatch.setattr(KafkaClient, "_initialize_reply_consumer", lambda _self: None)
        monkeypatch.setattr(KafkaClient, "skip_request_backlog", lambda _self, _consumer: 0)
        monkeypatch.setattr(WPKafkaClient, "KafkaConsumer", lambda _config: self.consumer)
        for name in ("WPAgentCache", "ListenerHealthCheck"):
            monkeypatch.setattr(WPKafkaClient, name, MagicMock())

        self.watch = MagicMock()
        self.watch.stop.side_effect = lambda: self.order.append("watch stopped")
        monkeypatch.setattr(WPKafkaClient, "ProberConnectionWatch", lambda **_kw: self.watch)

        self.heartbeat = MagicMock()
        self.heartbeat.stop.side_effect = lambda: self.order.append("heartbeat stopped")
        monkeypatch.setattr(WPKafkaClient, "ListenerHealthMonitor", lambda *_a, **_kw: self.heartbeat)

        self.client = KafkaClient(bootstrap_servers="kafka:9094", agent_name=AGENT)
        self.client.producer = MagicMock()
        self.client.producer.flush.side_effect = lambda **_kw: self.order.append("messages sent")

    def _poll(self, _timeout):
        self.polls += 1
        assert self.polls < 200, "the listener did not stop"
        if self.polls <= len(self._poll_actions):
            return self._poll_actions[self.polls - 1]()
        return None

    def watch_prober(self, prober):
        prober.local_mode = lambda: self.order.append("local mode")
        prober.disconnect = lambda: self.order.append("connection closed")

    def status_events(self):
        return [
            json.loads(call.kwargs["value"])["data"]
            for call in self.client.producer.produce.call_args_list
            if call.args and call.args[0] == CONNECTION_STATUS_TOPIC
        ]


def _sigterm():
    signal.raise_signal(signal.SIGTERM)
    return None


def test_sigterm_stops_the_listener_in_order(machine, monkeypatch):
    prober = _initialized(machine)
    listener = _Listener(monkeypatch, polls=[_sigterm])
    listener.watch_prober(prober)
    handler_before = signal.getsignal(signal.SIGTERM)

    listener.client.listen()

    assert [step for step in listener.order if step != "messages sent"] == [
        "no new requests", "watch stopped", "local mode", "connection closed", "heartbeat stopped",
    ]
    assert listener.order[-1] == "messages sent"
    assert not machine.is_initialized()
    assert signal.getsignal(signal.SIGTERM) is handler_before


def test_ctrl_c_stops_the_listener_the_same_way(machine, monkeypatch):
    prober = _initialized(machine)

    def ctrl_c():
        raise KeyboardInterrupt

    listener = _Listener(monkeypatch, polls=[ctrl_c])
    listener.watch_prober(prober)
    listener.client.listen()
    assert "connection closed" in listener.order
    assert listener.order.index("watch stopped") < listener.order.index("connection closed")


def test_the_stop_tells_that_the_agent_is_not_initialized_any_more(machine, monkeypatch):
    _initialized(machine)
    listener = _Listener(monkeypatch, polls=[_sigterm])
    listener.client.listen()
    events = listener.status_events()
    assert [(e["connected"], e["initialized"]) for e in events] == [(True, False)]
    assert events[0]["waferAgentName"] == AGENT


def test_stop_of_an_agent_that_was_never_initialized(machine, monkeypatch):
    listener = _Listener(monkeypatch, polls=[_sigterm])
    listener.client.listen()
    assert listener.order[:2] == ["no new requests", "watch stopped"]
    assert listener.status_events() == []
    with pytest.raises(ProberNotConnectedError, match="stopping"):
        machine.get_prober(*MOCK)


def test_a_running_command_finishes_before_the_connection_is_closed(machine, monkeypatch):
    prober = _initialized(machine)
    started, release = threading.Event(), threading.Event()

    def stop_while_the_command_runs():
        assert started.wait(2.0)
        threading.Timer(0.2, release.set).start()    # the command finishes 0.2 s after the stop
        return _sigterm()

    listener = _Listener(monkeypatch, polls=[_request, stop_while_the_command_runs])
    listener.watch_prober(prober)

    def slow_command(_command, _params):
        started.set()
        assert release.wait(5.0)
        listener.order.append("command finished")
        return {"status": "Success", "type": "GetAgentStateReply", "data": {"output": "done"}}

    monkeypatch.setattr(WPKafkaClient, "execute_command", slow_command)

    listener.client.listen()

    order = listener.order
    assert order.index("no new requests") < order.index("command finished") < order.index("local mode")
    assert order.index("local mode") < order.index("connection closed")
    replies = [
        call for call in listener.client.producer.produce.call_args_list
        if call.args and call.args[0] == "svt.wp-agent.request.reply"
    ]
    assert len(replies) == 1                         # the command sent its reply before the stop ended


def test_a_command_that_does_not_finish_is_cut_without_local_mode(machine, monkeypatch):
    prober = _initialized(machine)
    started, release, finished = threading.Event(), threading.Event(), threading.Event()

    def stop_while_the_command_runs():
        assert started.wait(2.0)
        return _sigterm()

    listener = _Listener(monkeypatch, polls=[_request, stop_while_the_command_runs])
    listener.watch_prober(prober)

    def stuck_command(_command, _params):
        started.set()
        release.wait(5.0)
        finished.set()
        return {"status": "Success", "type": "GetAgentStateReply", "data": {"output": "late"}}

    monkeypatch.setattr(WPKafkaClient, "execute_command", stuck_command)
    monkeypatch.setattr(WPKafkaClient, "STOP_COMMAND_WAIT", 0.05)

    try:
        listener.client.listen()
        assert not finished.is_set()                 # the listener did not wait for the command
        assert "connection closed" in listener.order
        assert "local mode" not in listener.order    # a second command would mix with the running one
    finally:
        release.set()
        assert finished.wait(2.0)


def test_requests_that_wait_for_a_worker_are_dropped_at_the_stop(machine, monkeypatch):
    started, release = threading.Event(), threading.Event()
    executed = []

    def stop_when_all_workers_are_busy():
        assert started.wait(2.0)
        threading.Timer(0.2, release.set).start()
        return _sigterm()

    # 4 workers: the 5th and the 6th request wait for a free one
    listener = _Listener(monkeypatch, polls=[_request] * 6 + [stop_when_all_workers_are_busy])

    def command(_command, _params):
        executed.append(1)
        if len(executed) == 4:
            started.set()
        assert release.wait(5.0)
        return {"status": "Success", "type": "GetAgentStateReply", "data": {"output": "done"}}

    monkeypatch.setattr(WPKafkaClient, "execute_command", command)
    listener.client.listen()
    assert len(executed) == 4

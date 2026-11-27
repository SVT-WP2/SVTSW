"""
The Initialize command: the only way the agent connects to its WP machine. The start of
the agent and the connection watch never do it; a command that needs the prober before
Initialize gets an error reply (no Error state).

Run:  python3 -m pytest tests/unit/TestInitialize.py -q -o python_files="Test*.py"
"""

import threading

import pytest

import WPCmdMap
from drivers.WPFactory import ProberFactory
from services.WPProberConnectionWatch import (
    ProberConnectionWatch, add_connection_listener, remove_connection_listener,
)
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandActivity import command_running

AGENT = "TestAgent"


@pytest.fixture(autouse=True)
def machine(globals_instance):
    """The agent after its start: the machine is known (mock: always on), nothing is connected."""
    factory = ProberFactory.get_instance()
    factory.reset()
    globals_instance.wpAgentName = AGENT
    globals_instance.set_address("mock:35555")
    globals_instance.set_machine_type("mock")
    sm.force_state(S.ServiceOn)
    yield factory
    factory.reset()
    sm.force_state(S.ServiceOn)


@pytest.fixture
def events():
    """The `connected` value of every status change that the listeners got."""
    seen = []

    def listener(connected, _initialized):
        seen.append(connected)

    add_connection_listener(listener)
    yield seen
    remove_connection_listener(listener)


def _initialize(**data):
    return WPCmdMap.execute_command("Initialize", {"waferAgentName": AGENT, **data})


def test_the_watch_never_initializes_the_machine(machine, globals_instance):
    w = ProberConnectionWatch()
    w.check_once()
    w.check_once()
    assert globals_instance.prober_connected is True   # the machine is on
    assert not machine.is_initialized()


def test_initialize_connects_to_the_machine_of_this_agent(machine, globals_instance):
    res = _initialize()
    assert res["status"] == "Success", res
    assert res["type"] == "InitializeReply"
    assert machine.get_current_config() == ("mock", "mock:35555")
    assert (res["data"]["proberConnected"], res["data"]["proberInitialized"]) == (True, True)
    assert sm.current_state == S.ServiceOn


def test_reply_before_initialize_says_not_initialized(machine):
    ProberConnectionWatch().check_once()
    res = WPCmdMap.execute_command("GetAgentState", {"user": "u1", "waferAgentName": AGENT})
    assert res["status"] == "Success", res
    assert (res["data"]["proberConnected"], res["data"]["proberInitialized"]) == (True, False)


def test_initialize_keeps_the_state_of_a_logged_in_user(machine, globals_instance):
    """A user may log in before the machine is initialized: the reported state stays UserLogged."""
    assert WPCmdMap.execute_command("UserLogIn", {"user": "user3", "waferAgentName": AGENT})["status"] == "Success"
    assert sm.current_state == S.UserLogged

    res = _initialize()

    assert res["status"] == "Success", res
    assert sm.current_state == S.UserLogged
    assert globals_instance.wpag_state == "UserLogged"
    assert res["data"]["WPAG_State"] == "UserLogged"


@pytest.mark.parametrize("extra", [{"address": "other:1"}, {"machineType": "sentio"}, {"projectName": "P"}])
def test_initialize_takes_no_machine_from_the_request(machine, extra):
    res = _initialize(**extra)
    assert res["error"]["code"] == 400
    assert next(iter(extra)) in res["error"]["message"]
    assert not machine.is_initialized()


def test_initialize_while_the_machine_is_off(machine, globals_instance):
    globals_instance.set_machine_type("sentio")
    globals_instance.set_address("127.0.0.1:1")   # closed port: the quick TCP check fails
    res = _initialize()
    assert res["error"]["code"] == 503
    assert "not connected" in res["error"]["message"]
    assert not machine.is_initialized()
    assert globals_instance.prober_connected is False
    assert sm.current_state == S.ServiceOn


def test_initialize_again_needs_force(machine):
    _initialize()
    first = machine.get_current_prober()

    res = _initialize()
    assert res["status"] == "Success" and "Already initialized" in res["error"]["message"]
    assert machine.get_current_prober() is first

    assert _initialize(force=True)["status"] == "Success"
    assert machine.get_current_prober() is not first


def test_listeners_get_the_change_to_initialized(machine, globals_instance, events):
    ProberConnectionWatch().check_once()
    assert events == [True]                 # the machine is on, not initialized
    _initialize()
    assert events == [True, True]           # same connection status, now initialized
    assert globals_instance.prober_status_published == (True, True)
    ProberConnectionWatch().check_once()
    assert events == [True, True]           # healthy: no new event


def test_prober_command_before_initialize_fails_without_error_state(machine, logged_in_user):
    sm.force_state(S.UsedByDeveloper)
    res = WPCmdMap.execute_command("GetChuckPosition", {"user": "test_user", "waferAgentName": AGENT})
    assert res["status"] != "Success"
    assert res["error"]["code"] == 503
    assert "not initialized" in res["error"]["message"]
    assert sm.current_state == S.UsedByDeveloper


@pytest.mark.parametrize("command, data", [
    ("TakeScreenshot", {}),
    ("TakeImage", {}),
    ("GetChuckXY", {}),
    ("MoveChuckXYPrecise", {"x": 0, "y": 0}),
])
def test_imaging_command_before_initialize_fails_without_error_state(machine, logged_in_user, command, data):
    sm.force_state(S.UsedByDeveloper)
    res = WPCmdMap.execute_command(command, {"user": "test_user", "waferAgentName": AGENT, **data})
    assert res["error"]["code"] == 503
    assert "not initialized" in res["error"]["message"]
    assert sm.current_state == S.UsedByDeveloper


def test_get_info_before_initialize_is_a_503_reply(machine):
    res = WPCmdMap.execute_command("GetInfo", {"waferAgentName": AGENT})
    assert (res["type"], res["error"]["code"]) == ("GetInfoReply", 503)
    assert "Send Initialize" in res["error"]["message"]


def test_show_status_works_before_initialize(machine):
    ProberConnectionWatch().check_once()
    res = WPCmdMap.execute_command("ShowStatus", {"waferAgentName": AGENT})
    assert res["status"] == "Success", res
    assert "Machine: connected, not initialized" in res["error"]["message"]


def test_align_wafer_needs_its_die(machine, logged_in_user):
    """Initialize takes no alignment die any more: AlignWafer gets it in the request."""
    _initialize()
    sm.force_state(S.UsedByDeveloper)
    res = WPCmdMap.execute_command("AlignWafer", {"user": "test_user", "waferAgentName": AGENT})
    assert res["error"]["code"] == 400
    assert "align_die_col" in res["error"]["message"]
    assert sm.current_state == S.UsedByDeveloper


def test_unhandled_not_initialized_error_is_a_503_reply(machine, monkeypatch):
    monkeypatch.setitem(WPCmdMap.COMMAND_ROUTER, "GetInfo", lambda **_kw: machine.get_current_prober())
    res = WPCmdMap.execute_command("GetInfo", {"waferAgentName": AGENT})
    assert (res["type"], res["error"]["code"]) == ("GetInfoReply", 503)
    assert "Send Initialize" in res["error"]["message"]
    assert sm.current_state == S.ServiceOn


@pytest.fixture
def other_command():
    """A command that runs in another thread (as a worker of the Kafka listener) until the test ends."""
    started, done = threading.Event(), threading.Event()

    def run():
        with command_running():
            started.set()
            done.wait(5)

    worker = threading.Thread(target=run)
    worker.start()
    started.wait(5)
    yield
    done.set()
    worker.join(5)


def test_forced_initialize_is_refused_while_another_command_runs(machine, other_command):
    _initialize()
    first = machine.get_current_prober()
    res = _initialize(force=True)
    assert res["error"]["code"] == 409
    assert "Another command is running" in res["error"]["message"]
    assert machine.get_current_prober() is first
    assert first.is_alive()                  # its connection is not closed


def test_first_initialize_runs_next_to_another_command(machine, other_command):
    """Without a connection there is nothing to cut."""
    assert _initialize()["status"] == "Success"


def test_forced_initialize_counts_only_the_other_commands(machine):
    """Initialize itself runs as a command of the listener (and so does a sequence that sends it)."""
    _initialize()
    with command_running():
        assert _initialize(force=True)["status"] == "Success"


def test_forced_initialize_keeps_the_connection_when_the_machine_does_not_answer(machine, globals_instance):
    _initialize()
    first = machine.get_current_prober()
    globals_instance.set_machine_type("sentio")
    globals_instance.set_address("127.0.0.1:1")   # closed port: the quick TCP check fails

    res = _initialize(force=True)

    assert res["error"]["code"] == 503
    assert "keeps its current connection" in res["error"]["message"]
    assert machine.get_current_prober() is first
    assert globals_instance.prober_connected is True   # the status of the live connection stays


def test_forced_initialize_keeps_the_old_connection_when_the_connect_fails(machine, globals_instance, monkeypatch):
    _initialize()
    first = machine.get_current_prober()

    def unreachable(_machine_type, _address):
        raise OSError("connection refused")

    monkeypatch.setattr(machine, "_open", unreachable)
    res = _initialize(force=True)

    assert res["status"] != "Success"
    assert machine.get_current_prober() is first
    assert first.is_alive()
    assert globals_instance.prober_connected is True


def test_initialize_waits_for_a_running_change_of_the_connection(machine):
    """One change of the connection at a time: Initialize waits for the reconnect of the watch."""
    held, release = threading.Event(), threading.Event()

    def reconnecting_watch():
        with machine.lock:
            held.set()
            release.wait(5)

    watch = threading.Thread(target=reconnecting_watch)
    watch.start()
    held.wait(5)
    results = []
    init = threading.Thread(target=lambda: results.append(_initialize()))
    init.start()
    init.join(0.3)
    assert init.is_alive() and not results   # waits for the lock
    release.set()
    init.join(5)
    watch.join(5)
    assert results[0]["status"] == "Success", results


def test_reconnect_prober_is_refused_while_another_command_runs(machine, globals_instance, other_command):
    _initialize()
    first = machine.get_current_prober()
    globals_instance.set_user("u1", "Expert")
    sm.force_state(S.OpenedProject)
    res = WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT})
    assert res["error"]["code"] == 409
    assert machine.get_current_prober() is first
    assert sm.current_state == S.OpenedProject   # the session is kept


def test_reconnect_prober_needs_an_initialized_agent(machine, globals_instance):
    globals_instance.set_user("u1", "Expert")
    sm.force_state(S.UserLogged)
    res = WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT})
    assert res["error"]["code"] == 400
    assert "not initialized" in res["error"]["message"]
    assert not machine.is_initialized()
    assert sm.current_state == S.UserLogged

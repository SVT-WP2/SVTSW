"""
The global watcher of the WP machine connection: WPAgent runs while the machine is off,
reports when it is on (it never initializes the machine: see TestInitialize.py), sends
every status change to the listeners, and a command that needs the prober gets an error
(no Error state) while the machine is off.

Run:  python3 -m pytest tests/unit/TestConnectionStatus.py -q -o python_files="Test*.py"
"""

import pytest

import services.WPProberConnectionWatch as watch_module
import WPCmdMap
from drivers.WPFactory import ProberFactory, ProberNotConnectedError
from services.WPProberConnectionWatch import (
    ProberConnectionWatch, add_connection_listener, remove_connection_listener, set_prober_connected,
)
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

AGENT = "TestAgent"


@pytest.fixture(autouse=True)
def machine(globals_instance):
    """The target of the watch is known (as after the DB lookup at start), nothing is connected."""
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


def test_starts_with_the_machine_off(machine, globals_instance, events):
    globals_instance.set_machine_type("sentio")
    globals_instance.set_address("127.0.0.1:1")   # closed port: the quick TCP check fails
    w = ProberConnectionWatch()
    assert w.check_once() is False
    assert w.check_once() is False
    assert globals_instance.prober_connected is False
    assert events == [False]            # one event, not one per check
    assert not machine.is_initialized()
    assert sm.current_state == S.ServiceOn


def test_reports_the_machine_that_comes_on_without_initializing_it(machine, globals_instance, events, monkeypatch):
    machine_on = []
    monkeypatch.setattr(watch_module, "is_reachable", lambda *_args, **_kwargs: bool(machine_on))
    w = ProberConnectionWatch()
    w.check_once()
    machine_on.append(True)
    w.check_once()
    w.check_once()                      # still on: no new event
    assert globals_instance.prober_connected is True
    assert events == [False, True]
    assert not machine.is_initialized()  # connecting to the machine is the Initialize command


def test_reconnects_without_a_session_in_serviceon(machine, globals_instance):
    old = machine.get_prober("mock", "mock:35555")
    set_prober_connected(False, "machine was switched off")
    assert ProberConnectionWatch().check_once() is False
    assert globals_instance.prober_connected is True
    assert machine.get_prober("mock", "mock:35555") is not old
    assert sm.current_state == S.ServiceOn


def test_listeners_get_only_the_changes(events):
    set_prober_connected(True)
    set_prober_connected(True)
    set_prober_connected(False)
    set_prober_connected(False)
    assert events == [True, False]


def test_listeners_get_the_stored_status(machine):
    seen = []

    def listener(connected, initialized):
        seen.append((connected, initialized))

    add_connection_listener(listener)
    try:
        set_prober_connected(True)
        machine.get_prober("mock", "mock:35555")      # the agent is initialized now
        set_prober_connected(True)
        set_prober_connected(False)
    finally:
        remove_connection_listener(listener)
    assert seen == [(True, False), (True, True), (False, True)]


def test_get_current_prober_raises_while_the_machine_is_off(machine):
    prober = machine.get_prober("mock", "mock:35555")
    set_prober_connected(False)
    with pytest.raises(ProberNotConnectedError, match=f"{AGENT} is not connected"):
        machine.get_current_prober()
    set_prober_connected(True)
    assert machine.get_current_prober() is prober


def test_prober_command_fails_while_off_without_error_state(machine, logged_in_user):
    machine.get_prober("mock", "mock:35555")
    sm.force_state(S.UsedByDeveloper)
    set_prober_connected(False)
    res = WPCmdMap.execute_command("GetChuckPosition", {"user": "test_user", "waferAgentName": AGENT})
    assert res["status"] != "Success"
    assert res["error"]["code"] == 503
    assert "not connected" in res["error"]["message"]
    assert sm.current_state == S.UsedByDeveloper


@pytest.mark.parametrize("command, data", [
    ("MoveChuckXY", {"x": 0.0, "y": 0.0, "position": "Zero"}),
    ("MoveChuckZ", {"z": 0.0}),
    ("MoveChuckCenter", {}),
])
def test_machine_lost_after_the_readiness_check_gives_no_error_state(machine, logged_in_user, monkeypatch,
                                                                    command, data):
    """The machine goes off between the readiness check and the use of the prober (another thread)."""
    import actions.WPTestingActions as testing

    machine.get_prober("mock", "mock:35555")
    sm.force_state(S.UsedByDeveloper)
    set_prober_connected(True)

    def ready_then_off():
        set_prober_connected(False)   # e.g. ReconnectProber in another worker finds the machine off
        return None

    monkeypatch.setattr(testing, "_ensure_initialized", ready_then_off)
    res = WPCmdMap.execute_command(command, {"user": "test_user", "waferAgentName": AGENT, **data})
    assert res["error"]["code"] == 503
    assert "not connected" in res["error"]["message"]
    assert sm.current_state == S.UsedByDeveloper


def test_unhandled_not_connected_error_is_a_503_reply(machine, monkeypatch):
    machine.get_prober("mock", "mock:35555")
    set_prober_connected(False)
    monkeypatch.setitem(WPCmdMap.COMMAND_ROUTER, "GetInfo", lambda **_kw: machine.get_current_prober())
    res = WPCmdMap.execute_command("GetInfo", {"waferAgentName": AGENT})
    assert (res["type"], res["error"]["code"]) == ("GetInfoReply", 503)
    assert sm.current_state == S.ServiceOn


def test_get_info_while_off_is_a_503_and_opens_no_connection(machine, globals_instance):
    machine.get_prober("mock", "mock:35555")
    set_prober_connected(False)
    globals_instance.set_address("mock-moved:35555")      # the DB record has moved the machine
    res = WPCmdMap.execute_command("GetInfo", {"waferAgentName": AGENT})
    assert (res["type"], res["error"]["code"]) == ("GetInfoReply", 503)
    assert machine.get_current_config() == ("mock", "mock:35555")


def test_show_status_works_while_the_machine_is_off(machine):
    set_prober_connected(False)
    res = WPCmdMap.execute_command("ShowStatus", {"waferAgentName": AGENT})
    assert res["status"] == "Success", res
    assert "Machine: not connected, not initialized" in res["error"]["message"]


def test_login_works_while_the_machine_is_off(globals_instance):
    set_prober_connected(False)                 # never connected since the start
    res = WPCmdMap.execute_command("UserLogIn", {"user": "user3", "waferAgentName": AGENT})
    assert res["status"] == "Success", res
    assert globals_instance.userLogged == "user3"
    assert sm.current_state == S.UserLogged

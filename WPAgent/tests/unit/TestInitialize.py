"""
The Initialize command: the only way the agent connects to its WP machine. The start of
the agent and the connection watch never do it; a command that needs the prober before
Initialize gets an error reply (no Error state).

Run:  python3 -m pytest tests/unit/TestInitialize.py -q -o python_files="Test*.py"
"""

import pytest

import WPCmdMap
from drivers.WPFactory import ProberFactory
from services.WPProberConnectionWatch import (
    ProberConnectionWatch, add_connection_listener, remove_connection_listener,
)
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

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
    seen = []
    add_connection_listener(seen.append)
    yield seen
    remove_connection_listener(seen.append)


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


def test_unhandled_not_initialized_error_is_a_503_reply(machine, monkeypatch):
    monkeypatch.setitem(WPCmdMap.COMMAND_ROUTER, "GetInfo", lambda **_kw: machine.get_current_prober())
    res = WPCmdMap.execute_command("GetInfo", {"waferAgentName": AGENT})
    assert (res["type"], res["error"]["code"]) == ("GetInfoReply", 503)
    assert "Send Initialize" in res["error"]["message"]
    assert sm.current_state == S.ServiceOn


def test_reconnect_prober_needs_an_initialized_agent(machine, globals_instance):
    globals_instance.set_user("u1", "Expert")
    sm.force_state(S.UserLogged)
    res = WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT})
    assert res["error"]["code"] == 400
    assert "not initialized" in res["error"]["message"]
    assert not machine.is_initialized()
    assert sm.current_state == S.UserLogged

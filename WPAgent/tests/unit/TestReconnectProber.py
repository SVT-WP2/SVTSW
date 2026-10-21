"""
ReconnectProber: reconnect to the machine after it was powered off, without
restarting WPAgent.

Run:  python3 -m pytest tests/unit/TestReconnectProber.py -q
"""

import pytest

import WPCmdMap
from drivers.WPFactory import ProberFactory
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandConstants import EXPERT_COMMANDS, USER_COMMANDS

AGENT = "TestAgent"


@pytest.fixture(autouse=True)
def connected(globals_instance):
    factory = ProberFactory.get_instance()
    factory.reset()
    factory.get_prober("mock", "mock:35555")
    globals_instance.wpAgentName = AGENT
    globals_instance.set_address("mock:35555")
    globals_instance.set_machine_type("mock")
    yield factory
    factory.reset()
    sm.force_state(S.ServiceOn)


def _login(g, hierarchy="Expert"):
    g.set_user("u1", hierarchy)


def _run(**extra):
    return WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT, **extra})


def test_replaces_the_prober_and_resets_the_session(globals_instance, connected):
    _login(globals_instance)
    old = connected.get_current_prober()
    g = globals_instance
    g.set_project_name("P")
    g.opened_project_id = 5
    g.current_die_col = 3
    g.chuck_z_position_state = "Contact"
    g.lock_for_testing("u1", "test")
    sm.force_state(S.AtContact_Locked)

    r = _run()

    assert r["status"] == "Success", r
    assert connected.get_current_prober() is not old
    assert sm.get_state() == S.UserLogged
    assert g.projectName is None and g.opened_project_id == 0
    assert g.current_die_col == 0 and g.chuck_z_position_state == "Unknown"
    assert not g.is_locked_for_testing


@pytest.mark.parametrize("state", [s for s in S if s not in (S.ServiceOn, S.UsedByDeveloper)])
def test_works_from_every_logged_in_state(globals_instance, state):
    _login(globals_instance)
    sm.force_state(state)
    assert _run()["status"] == "Success"
    assert sm.get_state() == S.UserLogged


def test_developer_stays_developer(globals_instance):
    _login(globals_instance, "Developer")
    sm.force_state(S.UsedByDeveloper)
    assert _run()["status"] == "Success"
    assert sm.get_state() == S.UsedByDeveloper


def test_user_level_is_refused(globals_instance):
    _login(globals_instance, "User")
    sm.force_state(S.Aligned)
    assert _run()["error"]["code"] == 403
    assert sm.get_state() == S.Aligned


def test_not_possible_before_login(globals_instance):
    sm.force_state(S.ServiceOn)
    assert _run()["status"] != "Success"


def test_failed_reconnect_keeps_the_old_prober_and_state(globals_instance, connected, monkeypatch):
    _login(globals_instance)
    sm.force_state(S.Aligned)
    old = connected.get_current_prober()

    class Unreachable:
        def __init__(self, address):
            raise ConnectionError("machine is off")

    monkeypatch.setitem(__import__("drivers.WPFactory", fromlist=["x"]).prober_classes, "mock", Unreachable)
    r = _run()

    assert r["error"]["code"] == 503 and "machine is off" in r["error"]["message"]
    assert connected.get_current_prober() is old
    assert sm.get_state() == S.Aligned


def test_refused_when_never_initialized(globals_instance):
    _login(globals_instance)
    sm.force_state(S.Aligned)
    globals_instance.address = None
    assert _run()["error"]["code"] == 400


def test_registered_as_expert_command():
    assert "ReconnectProber" in WPCmdMap.COMMAND_ROUTER
    assert "ReconnectProber" in EXPERT_COMMANDS and "ReconnectProber" not in USER_COMMANDS

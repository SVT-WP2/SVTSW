"""
ProberConnectionWatch: the agent goes to Error when the prober stops answering.

Run:  python3 -m pytest tests/unit/TestProberConnectionWatch.py -q
"""

import time

import pytest

import WPCmdMap
from drivers.WPFactory import ProberFactory
from services.WPProberConnectionWatch import ProberConnectionWatch
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

AGENT = "TestAgent"


@pytest.fixture(autouse=True)
def connected(globals_instance):
    factory = ProberFactory.get_instance()
    factory.reset()
    factory.get_prober("mock", "mock:35555")
    globals_instance.wpAgentName = AGENT
    globals_instance.set_address("mock:35555")
    globals_instance.set_machine_type("mock")
    sm.force_state(S.OpenedProject)
    yield factory
    factory.reset()
    sm.force_state(S.ServiceOn)


def _power_off(factory):
    factory.get_prober(*factory.get_current_config()).disconnect()


def test_healthy_prober_keeps_the_state():
    w = ProberConnectionWatch(failures=1)
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


def test_error_only_after_consecutive_failures(connected):
    w = ProberConnectionWatch(failures=3)
    _power_off(connected)
    assert w.check_once() is False
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject
    assert w.check_once() is True
    assert sm.current_state == S.Error


def test_one_good_probe_resets_the_counter(connected):
    w = ProberConnectionWatch(failures=2)
    prober = connected.get_prober("mock", "mock:35555")
    prober.disconnect()
    w.check_once()
    prober.connect()
    w.check_once()
    prober.disconnect()
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


def test_probe_exception_counts_as_failure(connected):
    w = ProberConnectionWatch(failures=1)
    prober = connected.get_prober("mock", "mock:35555")

    def boom():
        raise OSError("socket closed")

    prober.is_alive = boom
    assert w.check_once() is True
    assert sm.current_state == S.Error


def test_skipped_while_a_command_is_running(connected):
    w = ProberConnectionWatch(is_busy=lambda: True, failures=1)
    _power_off(connected)
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


@pytest.mark.parametrize("state", [S.ServiceOn, S.Error])
def test_nothing_to_do_in_serviceon_or_error(connected, state):
    sm.force_state(state)
    w = ProberConnectionWatch(failures=1)
    _power_off(connected)
    assert w.check_once() is False
    assert sm.current_state == state


def test_no_prober_initialized_is_ignored(connected):
    connected.reset()
    assert ProberConnectionWatch(failures=1).check_once() is False
    assert sm.current_state == S.OpenedProject


def test_reconnect_prober_recovers_from_the_error(connected, globals_instance):
    globals_instance.set_user("u1", "Expert")
    w = ProberConnectionWatch(failures=1)
    _power_off(connected)
    assert w.check_once() is True
    res = WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT})
    assert res["status"] == "Success"
    assert sm.current_state == S.UserLogged
    assert ProberConnectionWatch(failures=1).check_once() is False


def test_background_thread_puts_agent_in_error(connected):
    w = ProberConnectionWatch(interval=0.02, failures=2)
    _power_off(connected)
    w.start()
    deadline = time.time() + 2
    while time.time() < deadline and sm.current_state != S.Error:
        time.sleep(0.02)
    w.stop()
    assert sm.current_state == S.Error

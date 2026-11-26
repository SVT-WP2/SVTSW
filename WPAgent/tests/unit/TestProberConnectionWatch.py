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
    w = ProberConnectionWatch(failures=1, auto_reconnect=False)
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


def test_error_only_after_consecutive_failures(connected):
    w = ProberConnectionWatch(failures=3, auto_reconnect=False)
    _power_off(connected)
    assert w.check_once() is False
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject
    assert w.check_once() is True
    assert sm.current_state == S.Error


def test_one_good_probe_resets_the_counter(connected):
    w = ProberConnectionWatch(failures=2, auto_reconnect=False)
    prober = connected.get_prober("mock", "mock:35555")
    prober.disconnect()
    w.check_once()
    prober.connect()
    w.check_once()
    prober.disconnect()
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


def test_probe_exception_counts_as_failure(connected):
    w = ProberConnectionWatch(failures=1, auto_reconnect=False)
    prober = connected.get_prober("mock", "mock:35555")

    def boom():
        raise OSError("socket closed")

    prober.is_alive = boom
    assert w.check_once() is True
    assert sm.current_state == S.Error


def test_skipped_while_a_command_is_running(connected):
    w = ProberConnectionWatch(is_busy=lambda: True, failures=1, auto_reconnect=False)
    _power_off(connected)
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject


@pytest.mark.parametrize("state", [S.ServiceOn, S.Error])
def test_nothing_to_do_in_serviceon_or_error(connected, state):
    sm.force_state(state)
    w = ProberConnectionWatch(failures=1, auto_reconnect=False)
    _power_off(connected)
    assert w.check_once() is False
    assert sm.current_state == state


def test_no_prober_initialized_is_ignored(connected):
    connected.reset()
    assert ProberConnectionWatch(failures=1, auto_reconnect=False).check_once() is False
    assert sm.current_state == S.OpenedProject


def test_reconnect_prober_recovers_from_the_error(connected, globals_instance):
    globals_instance.set_user("u1", "Expert")
    w = ProberConnectionWatch(failures=1, auto_reconnect=False)
    _power_off(connected)
    assert w.check_once() is True
    res = WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": AGENT})
    assert res["status"] == "Success"
    assert sm.current_state == S.UserLogged
    assert ProberConnectionWatch(failures=1, auto_reconnect=False).check_once() is False


def test_auto_reconnect_succeeds_without_error(connected, globals_instance):
    globals_instance.set_user("u1", "Expert")
    old = connected.get_prober("mock", "mock:35555")
    w = ProberConnectionWatch(failures=2)
    old.disconnect()
    assert w.check_once() is False
    assert w.check_once() is False          # reconnected: no Error state
    assert sm.current_state == S.UserLogged  # session forgotten, like ReconnectProber
    assert connected.get_prober("mock", "mock:35555") is not old
    assert w.check_once() is False           # new connection is healthy
    assert sm.current_state == S.UserLogged


def test_auto_reconnect_failure_goes_to_error_and_keeps_trying(connected, globals_instance, monkeypatch):
    globals_instance.set_user("u1", "Expert")
    calls = []
    real_reconnect = connected.reconnect

    def unreachable(machine_type, address):
        calls.append(address)
        raise OSError("machine is off")

    monkeypatch.setattr(connected, "reconnect", unreachable)
    connected.get_prober("mock", "mock:35555").disconnect()
    w = ProberConnectionWatch(failures=1)
    assert w.check_once() is True
    assert sm.current_state == S.Error
    assert globals_instance.prober_connected is False
    assert w.check_once() is False           # still off: one more try, no new Error
    assert len(calls) == 2

    monkeypatch.setattr(connected, "reconnect", real_reconnect)   # the machine is on again
    assert w.check_once() is False
    assert globals_instance.prober_connected is True
    assert sm.current_state == S.UserLogged  # session forgotten, like ReconnectProber


def test_no_reconnect_of_a_connection_that_was_replaced_meanwhile(connected, globals_instance):
    """The watch found a dead connection, but Initialize / ReconnectProber replaced it meanwhile."""
    globals_instance.set_user("u1", "Expert")
    lost = connected.get_prober("mock", "mock:35555")
    lost.disconnect()
    fresh = connected.reconnect("mock", "mock:35555")     # another thread
    w = ProberConnectionWatch(failures=1)
    assert w._reconnect(connected, lost) is None
    assert connected.peek_prober() is fresh
    assert sm.current_state == S.OpenedProject             # the session is kept


def test_no_reconnect_when_a_command_started_meanwhile(connected):
    lost = connected.get_prober("mock", "mock:35555")
    lost.disconnect()
    w = ProberConnectionWatch(failures=1, is_busy=lambda: False)
    w.is_busy = lambda: True                               # the command started after the first check
    assert w._reconnect(connected, lost) is None
    assert connected.peek_prober() is lost
    assert sm.current_state == S.OpenedProject


def test_lost_connection_that_was_replaced_meanwhile_sets_no_error(connected, globals_instance, monkeypatch):
    lost = connected.get_prober("mock", "mock:35555")
    lost.disconnect()
    globals_instance.prober_connected = True

    def replaced_meanwhile():
        connected.reconnect("mock", "mock:35555")         # Initialize of another thread
        return False                                      # the TCP check of the watch failed

    w = ProberConnectionWatch(failures=1)
    monkeypatch.setattr(w, "_is_machine_reachable", replaced_meanwhile)
    assert w.check_once() is False
    assert sm.current_state == S.OpenedProject
    assert globals_instance.prober_connected is True


def test_background_thread_puts_agent_in_error(connected):
    w = ProberConnectionWatch(interval=0.02, failures=2, auto_reconnect=False)
    _power_off(connected)
    w.start()
    deadline = time.time() + 2
    while time.time() < deadline and sm.current_state != S.Error:
        time.sleep(0.02)
    w.stop()
    assert sm.current_state == S.Error

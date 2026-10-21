"""
MoveChuckNextDie / MoveChuckPreviousDie / MoveChuckRowColumn always start on the
off-axis side and end in OnDie_OffAxis_withoutPTPA, whatever state they start from.

Run:  python3 -m pytest tests/unit/TestDieMovesOffAxis.py -q
"""

import pytest
from unittest.mock import patch

import actions.WPTestingActions as ta
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

SOURCE_STATES = [
    S.Aligned,
    S.OnDie_Wide,
    S.OnDie_OffAxis_withoutPTPA,
    S.OnDie_OffAxis_withPTPA,
    S.OnDie_Wide_withPTPA,
    S.OnDie_Wide_withoutPTPA,
]

MOVES = [
    ("MoveChuckNextDie", lambda: ta.move_chuck_next_die(user="dev", waferAgentName="TestAgent")),
    ("MoveChuckPreviousDie", lambda: ta.move_chuck_previous_die(user="dev", waferAgentName="TestAgent")),
    ("MoveChuckRowColumn", lambda: ta.move_chuck_die(col=1, row=2, user="dev", waferAgentName="TestAgent")),
]


@pytest.fixture
def prober(globals_instance):
    globals_instance.wpAgentName = "TestAgent"
    globals_instance.set_user("dev", "Developer")
    globals_instance.set_wafer_loaded(7, "West")
    mp = MockProberImpl("mock:35555")
    calls = []
    for name in ("move_chuck_offaxis_area", "go_to_die", "step_next_die", "step_prev_die"):
        original = getattr(mp, name)

        def wrapper(*a, _n=name, _o=original, **k):
            calls.append(_n)
            return _o(*a, **k)

        setattr(mp, name, wrapper)
    mp.calls = calls
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), \
         patch("actions.WPTestingActions.get_current_prober", return_value=mp):
        yield mp
    sm.force_state(S.ServiceOn)


@pytest.mark.parametrize("state", SOURCE_STATES)
@pytest.mark.parametrize("command,run", MOVES)
def test_ends_off_axis_without_ptpa(prober, state, command, run):
    sm.force_state(S.UserLogged)  # not UsedByDeveloper, so the table is really used
    sm.force_state(state)
    assert run()["status"] == "Success"
    assert sm.get_state() == S.OnDie_OffAxis_withoutPTPA


@pytest.mark.parametrize("command,run", MOVES)
def test_goes_to_off_axis_side_before_moving(prober, command, run):
    sm.force_state(S.Aligned)
    assert run()["status"] == "Success"
    assert prober.calls[0] == "move_chuck_offaxis_area"
    assert len(prober.calls) == 2

"""
MoveChuckDiePrecise: move to a die (BAM00, SEG0, SVT label) by calculated coordinates:
home position (stored after FindHome / InitProbing) + (die index - home die index) * die size,
in the off-axis area, with move_chuck_xy_precise. No teaching, no PTPA.

Run:  python3 -m pytest tests/unit/TestMoveChuckDiePrecise.py -q -p no:cacheprovider
"""

import pytest
from unittest.mock import MagicMock, patch

import actions.WPImagingActions as ia
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandConstants import EXPERT_COMMANDS, USER_COMMANDS
from utilities.WPResponseBuilder import ResponseBuilder

AGENT = "TestAgent"
HOME = (1000.0, 2000.0)
HOME_DIE = (1, 1)
DIE_W, DIE_H = 28882.707, 23475.515  # MockProberImpl.get_die_size()


@pytest.fixture
def setup(globals_instance):
    globals_instance.wpAgentName = AGENT
    globals_instance.set_user("u1", "Expert")
    globals_instance.home_xy = HOME
    globals_instance.home_die = HOME_DIE
    mp = MockProberImpl("mock:35555")
    calls = []

    def fake_precise(x, y, position="Relative", abs_target_x=None, abs_target_y=None,
                     precision_um=1.0, **kw):
        calls.append((abs_target_x, abs_target_y, precision_um))
        mp.area_when_moving = mp.get_current_working_area()
        return ResponseBuilder.success("MoveChuckXYPreciseReply", "x=1, y=2, err=(+0.10,-0.20) µm, iter=1")

    sm.force_state(S.Aligned)
    with patch("actions.WPImagingActions._ensure_initialized", return_value=None), \
         patch("actions.WPImagingActions.get_current_prober", return_value=mp), \
         patch("actions.WPImagingActions.move_chuck_xy_precise", side_effect=fake_precise):
        mp.moves = calls
        yield mp
    sm.force_state(S.ServiceOn)


def _run(**data):
    return WPCmdMap.execute_command(
        "MoveChuckDiePrecise", {"user": "u1", "waferAgentName": AGENT, **data}
    )


# --- the calculation -------------------------------------------------------


def test_target_is_home_plus_die_steps(setup):
    # BAM01 is die (col -2, row 0); home die (1, 1): 3 columns and 1 row away.
    # Orientation DL: a higher column / row is +X / +Y on the chuck.
    r = _run(label="BAM01")
    assert r["status"] == "Success", r
    tx, ty, precision = setup.moves[0]
    assert tx == pytest.approx(HOME[0] - 3 * DIE_W)
    assert ty == pytest.approx(HOME[1] - 1 * DIE_H)
    assert precision == 1.0


def test_home_die_stays_at_home(setup):
    assert _run(label="BAM09")["status"] == "Success"  # BAM09 = die (1, 1)
    assert setup.moves[0][:2] == pytest.approx(HOME)


def test_measured_row_distance_on_dev(setup):
    # BAM15 = die (1, 9): 8 rows below home; taught on DEV: dy = +187811.8 µm
    _run(label="BAM15")
    assert setup.moves[0][1] - HOME[1] == pytest.approx(8 * DIE_H)
    assert abs(setup.moves[0][1] - HOME[1] - 187811.8) < 10
    assert setup.moves[0][0] == pytest.approx(HOME[0])


@pytest.mark.parametrize("orient,xs,ys", [("DL", 1, 1), ("DR", -1, 1), ("UL", 1, -1), ("UR", -1, -1)])
def test_directions_follow_the_axis_orientation(setup, orient, xs, ys):
    setup.get_axis_orient = lambda: orient
    _run(label="BAM01")  # 3 columns and 1 row from home (col -2 / row 0 against 1 / 1)
    tx, ty, _ = setup.moves[0]
    assert tx - HOME[0] == pytest.approx(xs * -3 * DIE_W)
    assert ty - HOME[1] == pytest.approx(ys * -1 * DIE_H)


def test_svt_label_works(setup):
    assert _run(label="babyMOSAIX-1_1_ER2-W1")["status"] == "Success"  # BAM03 = die (0, 0)
    assert setup.moves[0][0] - HOME[0] == pytest.approx(-1 * DIE_W)


def test_precision_is_passed_on(setup):
    _run(label="BAM01", precision_um=5)
    assert setup.moves[0][2] == 5.0


def test_state_after_the_move(setup):
    _run(label="BAM01")
    assert sm.get_state() == S.OnDie_OffAxis_withoutPTPA


# --- off-axis area and dry run ---------------------------------------------


def test_goes_to_the_offaxis_area_before_the_xy_move(setup):
    assert setup.get_current_working_area() == "Probing"
    assert _run(label="BAM01")["status"] == "Success"
    assert setup.area_when_moving == "OffAxisCamera"


def test_dry_run_moves_nothing_and_keeps_the_state(setup):
    r = _run(label="BAM01", dry_run=True)
    assert r["status"] == "Success", r
    msg = r["error"]["message"]
    assert "DRY RUN" in msg and "Nothing was moved" in msg
    assert f"target=({HOME[0] - 3 * DIE_W:.2f},{HOME[1] - DIE_H:.2f})" in msg
    assert setup.moves == []
    assert setup.get_current_working_area() == "Probing"
    assert sm.get_state() == S.Aligned


def test_dry_run_accepts_a_string_flag(setup):
    assert "DRY RUN" in _run(label="BAM01", dry_run="true")["error"]["message"]
    assert setup.moves == []


def test_refuses_when_the_chuck_cannot_be_put_in_the_offaxis_area(setup):
    setup.move_chuck_offaxis_area = lambda: None
    r = _run(label="BAM01")
    assert r["status"] != "Success" and r["error"]["code"] == 409
    assert setup.moves == [] and sm.get_state() == S.Aligned


def test_error_state_when_the_area_changes_during_the_move(setup):
    def leave_area(*a, **k):
        setup._working_area = "Probing"
        return ResponseBuilder.success("MoveChuckXYPreciseReply", "ok")

    with patch("actions.WPImagingActions.move_chuck_xy_precise", side_effect=leave_area):
        r = _run(label="BAM01")
    assert r["status"] != "Success" and "left the off-axis area" in r["error"]["message"]
    assert sm.get_state() == S.Error


# --- refusals ----------------------------------------------------------------


def test_failed_move_returns_error_and_keeps_the_state(setup):
    err = ResponseBuilder.error("MoveChuckXYPreciseReply", "Precision not reached", 500)
    with patch("actions.WPImagingActions.move_chuck_xy_precise", return_value=err):
        r = _run(label="BAM01")
    assert r["status"] != "Success"
    assert "BAM01" in r["error"]["message"] and "Precision not reached" in r["error"]["message"]
    assert sm.get_state() == S.Aligned


def test_unknown_or_missing_label(setup):
    assert _run(label="XYZ")["error"]["code"] == 400
    assert _run()["error"]["code"] == 400
    assert setup.moves == []


def test_needs_the_home_position_and_die(setup, globals_instance):
    for attr in ("home_xy", "home_die"):
        setattr(globals_instance, attr, HOME if attr == "home_xy" else HOME_DIE)
    globals_instance.home_xy = None
    r = _run(label="BAM01")
    assert r["error"]["code"] == 400 and "FindHome" in r["error"]["message"]
    globals_instance.home_xy, globals_instance.home_die = HOME, None
    assert _run(label="BAM01")["error"]["code"] == 400
    assert setup.moves == []


def test_unknown_axis_orientation_is_refused(setup):
    setup.get_axis_orient = lambda: "??"
    r = _run(label="BAM01")
    assert r["error"]["code"] == 400 and "axis orientation" in r["error"]["message"]
    assert setup.moves == [] and sm.get_state() == S.Aligned


def test_far_away_die_is_refused(setup, globals_instance):
    globals_instance.home_die = (1000, 1)  # as if the home die index were wrong
    r = _run(label="BAM01")
    assert r["error"]["code"] == 400 and "wafer map" in r["error"]["message"]
    assert setup.moves == []


# --- permissions and state machine -----------------------------------------


def test_expert_command():
    assert "MoveChuckDiePrecise" in EXPERT_COMMANDS
    assert "MoveChuckDiePrecise" not in USER_COMMANDS


def test_a_plain_user_is_refused(setup, globals_instance):
    globals_instance.set_user("u1", "User")
    assert _run(label="BAM01")["status"] != "Success"
    assert setup.moves == []


@pytest.mark.parametrize("state", [
    S.Aligned, S.OnDie_Wide, S.OnDie_OffAxis_withoutPTPA,
    S.OnDie_OffAxis_withPTPA, S.OnDie_Wide_withPTPA, S.OnDie_Wide_withoutPTPA,
])
def test_allowed_from_the_die_move_states(state):
    sm.force_state(state)
    assert sm.can_execute("MoveChuckDiePrecise")
    sm.force_state(S.ServiceOn)


@pytest.mark.parametrize("state", [S.UserLogged, S.OpenedProject, S.AtContact, S.Error])
def test_not_allowed_elsewhere(state):
    sm.force_state(state)
    assert not sm.can_execute("MoveChuckDiePrecise")
    sm.force_state(S.ServiceOn)


# --- home position, die size, orientation ----------------------------------


def test_find_home_stores_position_and_die(globals_instance):
    import actions.WPTestingActions as ta

    mp = MockProberImpl("mock:35555")
    mp._chuck_xy = {"x": 12.5, "y": -7.0}
    mp._current_die = {"col": 1, "row": 1}
    ta._remember_home(mp)
    assert globals_instance.home_xy == (12.5, -7.0)
    assert globals_instance.home_die == (1, 1)


def test_find_home_command_stores_the_home(globals_instance):
    mp = MockProberImpl("mock:35555")
    globals_instance.wpAgentName = AGENT
    globals_instance.set_user("dev", "Developer")
    sm.force_state(S.UsedByDeveloper)
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), \
         patch("actions.WPTestingActions.get_current_prober", return_value=mp):
        r = WPCmdMap.execute_command("FindHome", {"user": "dev", "waferAgentName": AGENT})
    assert r["status"] == "Success", r
    assert globals_instance.home_xy == mp.get_chuck_xy()
    sm.force_state(S.ServiceOn)


def test_sentio_reads_die_size_and_orientation_from_the_wafer_map():
    from drivers.WPSentioProber import SentioProberImpl

    impl = object.__new__(SentioProberImpl)
    impl.prober = MagicMock()
    impl.prober.map.get_index_size.return_value = (28882.707, 23475.515)
    impl.prober.map.get_axis_orient.return_value.to_string.return_value = "DL"
    assert impl.get_die_size() == (28882.707, 23475.515)
    assert impl.get_axis_orient() == "DL"

"""
MoveChuckPrecise: move to a die (BAM00, SEG0, SVT label) by the coordinates stored in
configs/WPMapConversion.json (dx_um / dy_um, offset from the FindHome position), no PTPA.

Run:  python3 -m pytest tests/unit/TestMoveChuckPrecise.py -q -p no:cacheprovider
"""

import json
import pathlib

import pytest
from unittest.mock import patch

import actions.WPImagingActions as ia
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandConstants import EXPERT_COMMANDS, USER_COMMANDS
from utilities.WPChuckPositioning import move_to_xy

AGENT = "TestAgent"
HOME = (1000.0, 2000.0)
CONFIG = pathlib.Path(__file__).resolve().parents[2] / "configs" / "WPMapConversion.json"


@pytest.fixture
def setup(globals_instance, monkeypatch):
    globals_instance.wpAgentName = AGENT
    globals_instance.set_user("u1", "Expert")
    globals_instance.home_xy = HOME
    mp = MockProberImpl("mock:35555")
    moves = []

    def fake_move(prober, target_x, target_y, precision_um=1.0, **kw):
        moves.append((target_x, target_y, precision_um))
        mp.area_when_moving = prober.get_current_working_area()
        return {"converged": True, "x": target_x, "y": target_y, "err_x": 0.1, "err_y": -0.2, "iterations": 1}

    entry = ia._map_entry_for_label("BAM00")
    monkeypatch.setitem(entry, "dx_um", -86648.121)
    monkeypatch.setitem(entry, "dy_um", 0.0)
    sm.force_state(S.Aligned)
    with patch("actions.WPImagingActions._ensure_initialized", return_value=None), \
         patch("actions.WPImagingActions.get_current_prober", return_value=mp), \
         patch("actions.WPImagingActions.move_to_xy", side_effect=fake_move):
        mp.moves = moves
        yield mp
    sm.force_state(S.ServiceOn)


def _run(**data):
    return WPCmdMap.execute_command(
        "MoveChuckPrecise", {"user": "u1", "waferAgentName": AGENT, **data}
    )


def test_moves_to_home_plus_offset(setup):
    r = _run(label="BAM00")
    assert r["status"] == "Success", r
    assert setup.moves == [(HOME[0] - 86648.121, HOME[1], 1.0)]
    assert sm.get_state() == S.OnDie_OffAxis_withoutPTPA


def test_precision_is_passed_on(setup):
    _run(label="BAM00", precision_um=5)
    assert setup.moves[0][2] == 5.0


def test_failed_move_returns_error_and_keeps_the_state(setup):
    miss = {"converged": False, "x": 0, "y": 0, "err_x": 7.5, "err_y": -2.0, "iterations": 4}
    with patch("actions.WPImagingActions.move_to_xy", return_value=miss):
        r = _run(label="BAM00")
    assert r["status"] != "Success"
    assert "BAM00" in r["error"]["message"] and "precision not reached" in r["error"]["message"]
    assert sm.get_state() == S.Aligned


def test_label_without_stored_coordinates_does_not_move(setup):
    r = _run(label="BAM01")  # dx_um / dy_um are still null
    assert r["status"] != "Success" and r["error"]["code"] == 400
    assert "No coordinates" in r["error"]["message"]
    assert setup.moves == []


def test_unknown_or_missing_label(setup):
    assert _run(label="XYZ")["error"]["code"] == 400
    assert _run()["error"]["code"] == 400
    assert setup.moves == []


def test_needs_the_home_position(setup, globals_instance):
    globals_instance.home_xy = None
    r = _run(label="BAM00")
    assert r["error"]["code"] == 400 and "FindHome" in r["error"]["message"]
    assert setup.moves == []


def test_labels_resolve_to_the_right_entries():
    assert ia._map_entry_for_label("BAM00")["id_its3"] == 0
    assert ia._map_entry_for_label("BAM19")["id_its3"] == 19
    seg = ia._map_entry_for_label("SEG4")
    assert seg["SN_prefix"] == "MOSAIX" and seg["id_its3"] == 4
    svt = ia._map_entry_for_label("babyMOSAIX-1_1_ER2-W1")
    assert svt["SN_prefix"] == "babyMOSAIX" and svt["id_its3"] == 3
    assert ia._map_entry_for_label("BAM99") is None
    assert ia._map_entry_for_label("nonsense") is None


def test_every_map_entry_has_coordinate_fields():
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    assert len(data) == 25
    assert all("dx_um" in e and "dy_um" in e for e in data)


def test_expert_only():
    assert "MoveChuckPrecise" in EXPERT_COMMANDS
    assert "MoveChuckPrecise" not in USER_COMMANDS


def test_a_plain_user_is_refused(setup, globals_instance):
    globals_instance.set_user("u1", "User")
    r = _run(label="BAM00")
    assert r["status"] != "Success"
    assert setup.moves == []


@pytest.mark.parametrize("state", [
    S.Aligned, S.OnDie_Wide, S.OnDie_OffAxis_withoutPTPA,
    S.OnDie_OffAxis_withPTPA, S.OnDie_Wide_withPTPA, S.OnDie_Wide_withoutPTPA,
])
def test_allowed_from_the_die_move_states(state):
    sm.force_state(state)
    assert sm.can_execute("MoveChuckPrecise")
    sm.force_state(S.ServiceOn)


@pytest.mark.parametrize("state", [S.UserLogged, S.OpenedProject, S.AtContact, S.Error])
def test_not_allowed_elsewhere(state):
    sm.force_state(state)
    assert not sm.can_execute("MoveChuckPrecise")
    sm.force_state(S.ServiceOn)


def test_find_home_stores_the_home_position(globals_instance):
    import actions.WPTestingActions as ta

    mp = MockProberImpl("mock:35555")
    mp._chuck_xy = {"x": 12.5, "y": -7.0}
    ta._remember_home(mp)
    assert globals_instance.home_xy == (12.5, -7.0)


def test_find_home_command_and_init_probing_store_the_home_position(globals_instance):
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


# ---------------------------------------------------------------------------
# move_to_xy: closed loop against a simulated stage
# ---------------------------------------------------------------------------


class _Stage:
    """Stage with an absolute-move error and a constant per-move coupling drift."""

    def __init__(self, abs_error=(30.0, -20.0), coupling=(-5.6, -10.4)):
        self.x = self.y = 0.0
        self.abs_error, self.coupling = abs_error, coupling
        self.moves = []

    def move_chuck_xy(self, x, y, position):
        self.moves.append((x, y, position))
        if position == "Zero":
            self.x, self.y = x + self.abs_error[0], y + self.abs_error[1]
        else:
            self.x += x + self.coupling[0]
            self.y += y + self.coupling[1]

    def get_chuck_xy(self):
        return self.x, self.y


def test_closed_loop_converges_despite_error_and_coupling():
    st = _Stage()
    r = move_to_xy(st, 5000.0, -3000.0, precision_um=1.0, settle_s=0, log=lambda *_: None)
    assert r["converged"] and r["iterations"] >= 1
    assert abs(st.x - 5000.0) <= 1.0 and abs(st.y + 3000.0) <= 1.0
    assert st.moves[0] == (5000.0, -3000.0, "Zero")  # absolute first
    assert all(m[2] == "Relative" for m in st.moves[1:])


def test_closed_loop_no_correction_when_already_there():
    st = _Stage(abs_error=(0.2, -0.3))
    r = move_to_xy(st, 100.0, 100.0, precision_um=1.0, settle_s=0, log=lambda *_: None)
    assert r["converged"] and r["iterations"] == 0 and len(st.moves) == 1


def test_closed_loop_reports_failure_when_precision_not_reached():
    st = _Stage()
    r = move_to_xy(st, 0.0, 0.0, precision_um=0.0, max_iterations=0, settle_s=0, log=lambda *_: None)
    assert not r["converged"] and r["iterations"] == 0
    assert (r["err_x"], r["err_y"]) == (-30.0, 20.0)


# ---------------------------------------------------------------------------
# TeachDie
# ---------------------------------------------------------------------------


@pytest.fixture
def teach(globals_instance, monkeypatch, tmp_path):
    cfg = tmp_path / "WPMapConversion.json"
    cfg.write_bytes(CONFIG.read_bytes())
    monkeypatch.setattr(ia, "MAP_CONVERSION_PATH", str(cfg))
    # use a fresh converter that reads the temporary copy
    from utilities.WPMapConverter import CoordinateConverter

    conv = CoordinateConverter(str(cfg))
    monkeypatch.setattr(ia, "get_converter", lambda: conv)
    globals_instance.wpAgentName = AGENT
    globals_instance.set_user("dev", "Developer")
    globals_instance.home_xy = HOME
    mp = MockProberImpl("mock:35555")
    mp._chuck_xy = {"x": HOME[0] - 86648.1234, "y": HOME[1] + 12.5}
    mp._working_area = "OffAxisCamera"
    sm.force_state(S.UsedByDeveloper)
    with patch("actions.WPImagingActions._ensure_initialized", return_value=None), \
         patch("actions.WPImagingActions.get_current_prober", return_value=mp):
        yield cfg, conv
    sm.force_state(S.ServiceOn)


def _teach(**data):
    return WPCmdMap.execute_command("TeachDie", {"user": "dev", "waferAgentName": AGENT, **data})


def test_teach_die_stores_offset_from_home(teach):
    cfg, conv = teach
    r = _teach(label="BAM00")
    assert r["status"] == "Success", r
    saved = {e["id_its3"]: e for e in json.loads(cfg.read_text(encoding="utf-8")) if e["asic_type"] == "BABYMOSAIX"}
    assert saved[0]["dx_um"] == -86648.123 and saved[0]["dy_um"] == 12.5
    assert saved[1]["dx_um"] is None  # other dies untouched
    assert ia._map_entry_for_label("BAM00")["dx_um"] == -86648.123  # loaded converter updated


def test_teach_die_keeps_file_format(teach):
    cfg, _ = teach
    before = cfg.read_bytes()
    _teach(label="BAM00")
    after = cfg.read_bytes()
    assert after.count(b"\n") == after.count(b"\r\n")  # still CRLF only
    assert len(after.splitlines()) == len(before.splitlines())  # nothing else reformatted


def test_teach_die_then_move_uses_the_taught_offset(teach):
    _teach(label="BAM00")
    sm.force_state(S.Aligned)
    with patch("actions.WPImagingActions.move_to_xy", return_value={
        "converged": True, "x": 0, "y": 0, "err_x": 0, "err_y": 0, "iterations": 0}) as m:
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters as G
        G.getInstance().set_user("u1", "Expert")
        r = WPCmdMap.execute_command("MoveChuckPrecise", {"user": "u1", "waferAgentName": AGENT, "label": "BAM00"})
    assert r["status"] == "Success", r
    assert m.call_args[0][1:3] == pytest.approx((HOME[0] - 86648.123, HOME[1] + 12.5))


def test_teach_die_needs_home_and_valid_label(teach, globals_instance):
    assert _teach(label="XYZ")["error"]["code"] == 400
    assert _teach()["error"]["code"] == 400
    globals_instance.home_xy = None
    assert _teach(label="BAM00")["error"]["code"] == 400


def test_teach_die_is_developer_only(teach, globals_instance):
    assert "TeachDie" not in EXPERT_COMMANDS and "TeachDie" not in USER_COMMANDS
    globals_instance.set_user("dev", "Expert")
    sm.force_state(S.Aligned)
    r = _teach(label="BAM00")
    assert r["status"] != "Success"


# ---------------------------------------------------------------------------
# Off-axis area safety and dry run
# ---------------------------------------------------------------------------


def test_goes_to_the_offaxis_area_before_the_xy_move(setup):
    assert setup.get_current_working_area() == "Probing"
    r = _run(label="BAM00")
    assert r["status"] == "Success", r
    assert setup.area_when_moving == "OffAxisCamera"


def test_dry_run_moves_nothing_and_keeps_the_state(setup):
    r = _run(label="BAM00", dry_run=True)
    assert r["status"] == "Success", r
    msg = r["error"]["message"]
    assert "DRY RUN" in msg and "Nothing was moved" in msg
    assert f"target=({HOME[0] - 86648.121:.2f},{HOME[1]:.2f})" in msg
    assert setup.moves == []
    assert setup.get_current_working_area() == "Probing"  # not even the area changed
    assert sm.get_state() == S.Aligned


def test_dry_run_accepts_a_string_flag(setup):
    assert "DRY RUN" in _run(label="BAM00", dry_run="true")["error"]["message"]
    assert setup.moves == []


def test_refuses_when_the_chuck_cannot_be_put_in_the_offaxis_area(setup):
    setup.move_chuck_offaxis_area = lambda: None  # the area does not change
    r = _run(label="BAM00")
    assert r["status"] != "Success" and r["error"]["code"] == 409
    assert setup.moves == []
    assert sm.get_state() == S.Aligned


def test_error_state_when_the_area_changes_during_the_move(setup):
    def leave_area(prober, x, y, precision_um=1.0, **kw):
        prober._working_area = "Probing"
        return {"converged": True, "x": x, "y": y, "err_x": 0, "err_y": 0, "iterations": 0}

    with patch("actions.WPImagingActions.move_to_xy", side_effect=leave_area):
        r = _run(label="BAM00")
    assert r["status"] != "Success" and "left the off-axis area" in r["error"]["message"]
    assert sm.get_state() == S.Error


def test_implausible_stored_offset_is_refused(setup, monkeypatch):
    entry = ia._map_entry_for_label("BAM00")
    monkeypatch.setitem(entry, "dx_um", 1.0e9)
    r = _run(label="BAM00")
    assert r["error"]["code"] == 400 and "WPMapConversion.json" in r["error"]["message"]
    assert setup.moves == []


def test_teach_die_refused_outside_the_offaxis_area(teach):
    cfg, _ = teach
    before = cfg.read_bytes()
    mp = ia.get_current_prober()
    mp._working_area = "Probing"
    r = _teach(label="BAM00")
    assert r["status"] != "Success" and r["error"]["code"] == 409
    assert cfg.read_bytes() == before

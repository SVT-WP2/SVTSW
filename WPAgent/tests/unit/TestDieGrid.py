"""
Precise die moves: MoveChuckRowColumn precise=true (actions/WPTestingActions.py,
actions/WPDieGridActions.py, utilities/WPDieGrid.py). No calibration step: the
column / row directions are learned from SENTIO's step_die during the move.

Run:  python3 -m pytest tests/unit/TestDieGrid.py -q
"""

import pytest
from unittest.mock import patch

import actions.WPContactingActions as ca
import actions.WPDieGridActions as da
import actions.WPTestingActions as ta
from drivers.WPMockProber import MockProberImpl
from sentio_prober_control.Sentio.Enumerations import ChuckXYReference
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities import WPDieGrid

PROJECT = "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
U = {"user": "dev", "waferAgentName": "TestAgent"}

# Simulated machine: +1 column moves the chuck -X, +1 row moves it +Y
PITCH = (2967.5, 2476.25)
COL_STEP = (-PITCH[0], 0.0)
ROW_STEP = (0.0, PITCH[1])
ORIGIN = (50000.0, -20000.0)          # chuck XY of the home of die (0, 0), off-axis


class Prober(MockProberImpl):
    """Mock prober whose step_die really moves the chuck on a die grid (with a few um
    of step error, like the real stage), plus the Sentio-level calls of MoveChuckXYPrecise."""

    def __init__(self, col_step=COL_STEP, row_step=ROW_STEP, pitch=PITCH):
        super().__init__("mock:35555")
        self.prober = self
        self.col_step, self.row_step, self.pitch = col_step, row_step, pitch
        self._noise = [(2.1, -3.4), (-1.7, 2.9), (3.0, 1.2), (0.4, -2.2)]

    def die_xy(self, col, row):
        return (ORIGIN[0] + col * self.col_step[0] + row * self.row_step[0],
                ORIGIN[1] + col * self.col_step[1] + row * self.row_step[1])

    def go_to_die(self, col, row, subsite=0):
        x, y = self.die_xy(col, row)
        nx, ny = self._noise[0]
        self._noise = self._noise[1:] + self._noise[:1]
        self._chuck_xy = {"x": x + nx, "y": y + ny}
        return super().go_to_die(col, row, subsite)

    def get_current_index(self):
        return f"0,{self._current_die['col']},{self._current_die['row']}"

    def get_die_size(self):
        return self.pitch

    def move_chuck_xy(self, a, b, c):
        if isinstance(c, str):
            x, y, relative = a, b, c == "Relative"
        else:
            x, y, relative = b, c, a is ChuckXYReference.Relative
        if relative:
            x, y = self._chuck_xy["x"] + x, self._chuck_xy["y"] + y
        self._chuck_xy = {"x": float(x), "y": float(y)}

    def get_chuck_xy(self, *args):
        return self._chuck_xy["x"], self._chuck_xy["y"]


def _globals(g, hierarchy="Developer"):
    g.wpAgentName = "TestAgent"
    g.set_user("dev", hierarchy)
    g.set_wafer_loaded(7, "West")
    g.set_probe_card(2, "West")
    g.projectName = PROJECT


@pytest.fixture
def setup(globals_instance, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    g = globals_instance
    _globals(g)
    mp = Prober()
    mp.move_chuck_offaxis_area()
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), \
         patch("actions.WPTestingActions.get_current_prober", return_value=mp), \
         patch("actions.WPDieGridActions.get_current_prober", return_value=mp), \
         patch("actions.WPContactingActions._ensure_initialized", return_value=None), \
         patch("actions.WPContactingActions.get_current_prober", return_value=mp), \
         patch("actions.WPImagingActions.get_current_prober", return_value=mp), \
         patch("time.sleep"):
        yield g, mp
    sm.force_state(S.ServiceOn)


def _save_bamtest(mp, ox=123.4, oy=-56.7):
    """Aligned on BAMTest (-4, 1), (ox, oy) um away from the die home; saved."""
    mp.go_to_die(-4, 1)
    bx, by = mp.die_xy(-4, 1)
    mp._chuck_xy = {"x": bx + ox, "y": by + oy}
    assert ca.save_chuck_position(name="BAMTest", label="BAMTest", **U)["status"] == "Success"


# --- maths -----------------------------------------------------------------------

def test_learn_steps_two_columns():
    c = WPDieGrid.learn_steps(2, 0, 2 * COL_STEP[0] + 3, -2, *PITCH)
    assert c == [(COL_STEP, None)]


def test_learn_steps_columns_and_rows_negative_delta():
    c = WPDieGrid.learn_steps(-3, 9, -3 * COL_STEP[0], 9 * ROW_STEP[1] - 4, *PITCH)
    assert c == [(COL_STEP, ROW_STEP)]


def test_learn_steps_swapped_axes():
    # columns along chuck Y on this (rotated) map
    c = WPDieGrid.learn_steps(1, 0, 0.5, PITCH[0], *PITCH)
    assert c == [((0.0, PITCH[0]), None)]


def test_learn_steps_mismatch_and_ambiguous():
    assert WPDieGrid.learn_steps(2, 0, -2000, 0, *PITCH) == []
    amb = WPDieGrid.learn_steps(1, 1, 1000, 1000, 1000, 1000)
    assert len(amb) == 2
    with pytest.raises(ValueError, match="ambiguous"):
        WPDieGrid.choose_steps(amb, {})
    known = {"col_step_um": [1000.0, 0.0]}
    assert WPDieGrid.choose_steps(amb, known) == ((1000.0, 0.0), (0.0, 1000.0))


def test_die_offset_bamtest_to_bam03():
    assert WPDieGrid.die_offset_um(2, 0, COL_STEP, None) == pytest.approx((2 * COL_STEP[0], 0.0))
    assert WPDieGrid.die_offset_um(2, 9, COL_STEP, ROW_STEP) == pytest.approx(
        (2 * COL_STEP[0], 9 * ROW_STEP[1]))


# --- MoveChuckRowColumn precise ---------------------------------------------------

def test_precise_from_saved_bamtest_to_bam03(setup):
    g, mp = setup
    _save_bamtest(mp)
    mp.go_to_die(0, 0)                                          # somewhere else
    r = ta.move_chuck_die(label="BAM03", precise=True, reference="BAMTest", **U)
    assert r["status"] == "Success", r["error"]["message"]
    x3, y3 = mp.die_xy(-2, 1)
    assert mp.get_chuck_xy() == pytest.approx((x3 + 123.4, y3 - 56.7), abs=0.5)
    assert (g.current_die_col, g.current_die_row) == (-2, 1)
    assert WPDieGrid.load_grid(PROJECT)["col_step_um"] == list(COL_STEP)   # remembered


def test_precise_from_current_position(setup):
    g, mp = setup
    mp.go_to_die(-4, 1)
    bx, by = mp.die_xy(-4, 1)
    mp._chuck_xy = {"x": bx + 10.0, "y": by + 20.0}
    r = ta.move_chuck_die(label="BAM08", precise=True, **U)      # (-2, 10)
    assert r["status"] == "Success", r["error"]["message"]
    x8, y8 = mp.die_xy(-2, 10)
    assert mp.get_chuck_xy() == pytest.approx((x8 + 10.0, y8 + 20.0), abs=0.5)


def test_precise_with_col_row(setup):
    g, mp = setup
    _save_bamtest(mp, 0.0, 0.0)
    r = ta.move_chuck_die(col=1, row=11, precise=True, reference="BAMTest", **U)
    assert r["status"] == "Success", r["error"]["message"]
    assert mp.get_chuck_xy() == pytest.approx(mp.die_xy(1, 11), abs=0.5)


def test_precise_same_die_goes_back_to_reference(setup):
    g, mp = setup
    _save_bamtest(mp)
    mp._chuck_xy = {"x": 0.0, "y": 0.0}
    r = ta.move_chuck_die(label="BAMTest", precise=True, reference="BAMTest", **U)
    assert r["status"] == "Success", r["error"]["message"]
    bx, by = mp.die_xy(-4, 1)
    assert mp.get_chuck_xy() == pytest.approx((bx + 123.4, by - 56.7), abs=0.5)


def test_without_flag_unchanged(setup):
    g, mp = setup
    r = ta.move_chuck_die(label="BAM03", **U)
    assert r["status"] == "Success"
    assert mp.get_chuck_xy() == pytest.approx(mp.die_xy(-2, 1), abs=5)   # SENTIO step only


def test_precise_refused_without_moving(setup):
    g, mp = setup
    assert ta.move_chuck_die(label="BAM03", precise=True, reference="nope", **U)["error"]["code"] == 400
    _save_bamtest(mp)
    with patch.object(mp, "get_current_working_area", return_value="Probing"):
        r = ta.move_chuck_die(label="BAM03", precise=True, reference="BAMTest", **U)
    assert r["error"]["code"] == 400 and "work area" in r["error"]["message"]
    assert ta.move_chuck_die(label="BAM03", subsite=2, precise=True, **U)["error"]["code"] == 400


def test_precise_wrong_die_size_enters_error_state(setup):
    g, mp = setup
    mp.pitch = (2000.0, 2476.25)                                # map does not match the stage
    _save_bamtest(mp)
    sm.force_state(S.Aligned)
    r = ta.move_chuck_die(label="BAM03", precise=True, reference="BAMTest", **U)
    assert r["error"]["code"] == 500 and "does not match the die size" in r["error"]["message"]
    assert sm.get_state() == S.Error


def test_precise_as_expert_through_state_machine(setup):
    g, mp = setup
    _save_bamtest(mp)
    g.set_user("exp", "Expert")
    sm.force_state(S.Aligned)
    r = ta.move_chuck_die(label="BAM03", precise=True, reference="BAMTest",
                          user="exp", waferAgentName="TestAgent")
    assert r["status"] == "Success", r["error"]["message"]
    assert sm.get_state() == S.OnDie_OffAxis_withoutPTPA


def test_get_die_size(setup):
    r = da.get_die_size(**U)
    assert r["status"] == "Success", r["error"]["message"]
    assert "2967.500 x 2476.250" in r["error"]["message"]

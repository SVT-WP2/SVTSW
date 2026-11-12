"""
MoveChuckToSavedPosition / MoveChuckBySavedOffset (actions/WPContactingActions.py)
and the shared LEC raster start of the die-imaging sequences (utilities/WPImagingConfig.py).

Run:  python3 -m pytest tests/unit/TestContactingMoves.py -q
"""

import json

import pytest
from unittest.mock import patch

import actions.WPContactingActions as ca
from drivers.WPMockProber import MockProberImpl
from sentio_prober_control.Sentio.Enumerations import ChuckXYReference
from utilities import WPContacting
from utilities.WPImagingConfig import raster_start

PROJECT = "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
U = {"user": "dev", "waferAgentName": "TestAgent"}


class Prober(MockProberImpl):
    """Mock prober with relative moves and the Sentio-level calls used by MoveChuckXYPrecise."""

    def __init__(self):
        super().__init__("mock:35555")
        self.prober = self            # MoveChuckXYPrecise talks to prober.prober

    def move_chuck_xy(self, a, b, c):
        if isinstance(c, str):        # agent level: (x, y, "Zero" / "Relative")
            x, y, relative = a, b, c == "Relative"
        else:                         # Sentio level: (reference, x, y)
            x, y, relative = b, c, a is ChuckXYReference.Relative
        if relative:
            x, y = self._chuck_xy["x"] + x, self._chuck_xy["y"] + y
        self._chuck_xy = {"x": float(x), "y": float(y)}

    def get_chuck_xy(self, *args):
        return self._chuck_xy["x"], self._chuck_xy["y"]


@pytest.fixture
def setup(globals_instance, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)                     # Contacting/ is relative to the working directory
    g = globals_instance
    g.wpAgentName = "TestAgent"
    g.set_user("dev", "Developer")
    g.set_wafer_loaded(7, "West")
    g.set_probe_card(2, "West")
    g.projectName = PROJECT
    mp = Prober()
    mp.move_chuck_offaxis_area()
    with patch("actions.WPContactingActions._ensure_initialized", return_value=None), \
         patch("actions.WPContactingActions.get_current_prober", return_value=mp), \
         patch("actions.WPImagingActions.get_current_prober", return_value=mp), \
         patch("time.sleep"):
        yield g, mp


def _save(mp, name="ptpa_ref", x=1000.0, y=-2000.0):
    mp._chuck_xy = {"x": x, "y": y}
    assert ca.save_chuck_position(name=name, label="BAMTest", **U)["status"] == "Success"


def _offset(dx=23.25, dy=25.45, name="pad_target"):
    WPContacting.save_offset(PROJECT, name, {"dx_um": dx, "dy_um": dy, "corner": "bottom_left",
                                             "inset_um": 20.0, "die": "BAMTest"})


def test_move_to_saved_position_then_offset(setup):
    g, mp = setup
    _save(mp)
    _offset()
    mp._chuck_xy = {"x": 9000.0, "y": 500.0}                      # somewhere else
    r = ca.move_chuck_to_saved_position(name="ptpa_ref", **U)
    assert r["status"] == "Success", r["error"]["message"]
    assert mp.get_chuck_xy() == pytest.approx((1000.0, -2000.0), abs=0.15)
    r = ca.move_chuck_by_saved_offset(name="pad_target", **U)
    assert r["status"] == "Success", r["error"]["message"]
    assert mp.get_chuck_xy() == pytest.approx((1023.25, -1974.55), abs=0.15)


def test_missing_position_or_offset(setup):
    g, mp = setup
    assert ca.move_chuck_to_saved_position(name="nope", **U)["error"]["code"] == 400
    assert ca.move_chuck_by_saved_offset(name="nope", **U)["error"]["code"] == 400
    g.projectName = ""
    assert ca.move_chuck_to_saved_position(**U)["error"]["code"] == 400
    assert ca.move_chuck_by_saved_offset(**U)["error"]["code"] == 400


@pytest.mark.parametrize("dx, dy", [(40.5, 0.0), (0.0, -41.0)])
def test_offset_above_limit_enters_error_state(setup, dx, dy):
    from stateMachine.WpAgentStateMachine import WPAgentState as S
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
    g, mp = setup
    _save(mp)
    _offset(dx=dx, dy=dy)
    sm.force_state(S.Aligned)
    r = ca.move_chuck_by_saved_offset(**U)
    assert r["error"]["code"] == 500 and "max_offset_um=40" in r["error"]["message"]
    assert sm.get_state() == S.Error
    assert mp.get_chuck_xy() == (1000.0, -2000.0)                # nothing moved
    sm.force_state(S.ServiceOn)


def test_raster_start_lec(tmp_path):
    assert raster_start() == (29750.0, -27500.0)
    assert raster_start("LEC") == (29750.0, -27500.0)
    with pytest.raises(ValueError, match="known"):
        raster_start("BAM")
    cfg = tmp_path / "c.json"
    cfg.write_text(json.dumps({"_help": {}, "LEC": {"start_x_um": "x"}}))
    with pytest.raises(ValueError):
        raster_start(path=str(cfg))


def test_generate_raster_steps_uses_config():
    from actions.WPImagingActions import generate_raster_steps
    r = generate_raster_steps(num_columns=1, num_rows=2, y_col_correction_um=0, x_row_correction_um=0)
    first = next(s for s in r["steps"] if s.get("action") == "move")
    assert (first["x"], first["y"]) == (29750.0, -27500.0)
    r = generate_raster_steps(num_columns=1, num_rows=2, start_x_um=5, start_y_um=6,
                              y_col_correction_um=0, x_row_correction_um=0)
    first = next(s for s in r["steps"] if s.get("action") == "move")
    assert (first["x"], first["y"]) == (5.0, 6.0)


def test_move_to_pad_target_sequence(setup):
    """sequencer/MoveToPadTarget.yaml: both steps, through the router, as a built-in sequence."""
    import os
    import WPCmdMap
    from utilities.WPSequenceContext import trusted_sequence
    from actions.WPSequencerActionsYAML import run_sequencer_yaml
    g, mp = setup
    _save(mp)
    _offset()
    mp._chuck_xy = {"x": 9000.0, "y": 500.0}
    yaml_path = os.path.join(os.path.dirname(WPCmdMap.__file__), "sequencer", "MoveToPadTarget.yaml")
    with trusted_sequence("MoveToPadTarget"):
        r = run_sequencer_yaml(filepath=yaml_path, executor=WPCmdMap._exec_in_sequence, **U)
    assert r["status"] == "Success", r["error"]["message"]
    assert mp.get_chuck_xy() == pytest.approx((1023.25, -1974.55), abs=0.15)

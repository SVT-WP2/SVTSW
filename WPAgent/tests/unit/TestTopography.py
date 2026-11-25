"""
In-house LEC topography: GetDieList, MeasureLECTopographyDie, ComputeTopographyCorrection
(actions/WPTopographyActions.py, utilities/WPTopography.py) and the LECTopography_* sequences.

Run:  python3 -m pytest tests/unit/TestTopography.py -q
"""

import json
import os

import pytest
from unittest.mock import patch

import actions.WPTopographyActions as ta
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities import WPTopography as topo
from utilities.WPImagingConfig import raster_start

BABY = "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
MOSAIX = "ER2B_MOSAIX_Vertical_V0_NotchW_ArrowW"
U = {"user": "dev", "waferAgentName": "TestAgent"}
WAFER = "L3W15"


class Prober(MockProberImpl):
    """Mock prober whose focus height depends on the die and on chuck Y (tilt)."""

    def __init__(self):
        super().__init__("mock:35555")
        self.die_height = {}          # (col, row) -> focus height at the die position (um)
        self.tilt = 0.0               # um of focus per um of chuck Y
        self.fail_at = set()          # point numbers (call order) whose autofocus raises
        self.calls = 0
        self.home_y = 0.0

    def go_to_die(self, col, row, subsite=0):
        super().go_to_die(col, row, subsite)
        self._chuck_xy = {"x": 100000.0 + col * 30000.0, "y": -400000.0 + row * 25000.0}
        self.home_y = self._chuck_xy["y"]

    def auto_focus(self):
        i, self.calls = self.calls, self.calls + 1
        if i in self.fail_at:
            raise RuntimeError("focus not found")
        die = (self._current_die["col"], self._current_die["row"])
        return self.die_height.get(die, 15300.0) + self.tilt * (self._chuck_xy["y"] - self.home_y)


@pytest.fixture
def setup(globals_instance, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)                    # Contacting/ is relative to the working directory
    g = globals_instance
    g.wpAgentName = "TestAgent"
    g.set_user("dev", "Developer")
    g.set_wafer_loaded(7, "West")
    g.projectName = BABY
    mp = Prober()
    with patch("actions.WPTopographyActions._ensure_initialized", return_value=None), \
         patch("actions.WPTopographyActions.get_current_prober", return_value=mp), \
         patch("time.sleep"):
        yield g, mp
    sm.force_state(S.ServiceOn)


def _measure(label, **kw):
    return ta.measure_lec_topography_die(label=label, wafer=WAFER, **U, **kw)


# --- GetDieList ----------------------------------------------------------------

def test_die_list_per_project(setup):
    g, mp = setup
    r = ta.get_die_list(**U)
    labels = [s["label"] for s in r["steps"]]
    assert r["status"] == "Success" and "BAMTest" in labels and "BAM00" in labels
    assert not any(lab.startswith("S3G") or lab.startswith("S6G") for lab in labels)
    assert {"label": "BAMTest", "col": -4, "row": 1} in r["steps"]
    g.projectName = MOSAIX
    labels = [s["label"] for s in ta.get_die_list(**U)["steps"]]
    assert labels and all(lab[:3] in ("S3G", "S6G") for lab in labels)
    g.projectName = ""
    assert ta.get_die_list(**U)["error"]["code"] == 400


# --- MeasureLECTopographyDie ------------------------------------------------------

def test_measure_die_positions_and_statistics(setup):
    g, mp = setup
    mp.die_height[(-4, 1)] = 15310.0
    mp.tilt = 0.001                                # 1 um per mm along Y
    r = _measure("BAMTest")
    assert r["status"] == "Success", r["error"]["message"]
    rec = topo.die_measurement(WAFER, "BAMTest")
    sx, sy = raster_start("LEC")
    x0, y0 = 100000.0 - 4 * 30000.0, -400000.0 + 25000.0
    assert [(p["x_um"], p["y_um"]) for p in rec["points"]] == [(x0 + sx, y0 + sy - i * 2476) for i in range(9)]
    assert rec["n_points"] == 9 and rec["complete"]
    assert rec["slope_um_per_mm"] == pytest.approx(1.0, abs=1e-3)
    expected = [15310.0 + 0.001 * (sy - i * 2476) for i in range(9)]
    assert rec["mean_focus_um"] == pytest.approx(sum(expected) / 9, abs=0.01)
    assert rec["die"] == {"col": -4, "row": 1} and rec["project"] == BABY and rec["wafer_type"] == "ER2B"
    assert all("chuck_z_um" in p for p in rec["points"])
    assert mp.get_chuck_xy() == (x0, y0)           # back at the die position
    assert os.path.exists(os.path.join("Contacting", "topography", WAFER, "LEC_topography.json"))


def test_failed_autofocus_is_recorded_and_skipped(setup):
    g, mp = setup
    mp.fail_at = {2, 5}
    r = _measure("BAMTest")
    assert r["status"] == "Success"
    rec = topo.die_measurement(WAFER, "BAMTest")
    assert rec["n_points"] == 7 and rec["complete"]
    assert [f["index"] for f in rec["failed"]] == [2, 5]
    mp.calls, mp.fail_at = 0, set(range(5))
    r = _measure("BAMTest")
    assert r["status"] == "Success" and "INCOMPLETE" in r["error"]["message"]
    assert not topo.die_measurement(WAFER, "BAMTest")["complete"]
    assert len(topo.load_topography(WAFER)["history"]) == 2


def test_measure_refusals_and_move_failure(setup):
    g, mp = setup
    assert _measure("S3G0")["error"]["code"] == 400                     # MOSAIX die, baby project open
    assert ta.measure_lec_topography_die(label="BAMTest", wafer="", **U)["error"]["code"] == 400
    sm.force_state(S.Aligned)
    with patch.object(mp, "go_to_die", side_effect=RuntimeError("fence")):
        r = _measure("BAMTest")
    assert r["error"]["code"] == 500 and sm.get_state() == S.Error
    assert topo.load_topography(WAFER)["dies"] == {}


def test_measure_selected_positions(setup):
    g, mp = setup
    r = _measure("BAMTest", positions=[8, 0, 4, 4])            # sorted, duplicates dropped
    assert r["status"] == "Success", r["error"]["message"]
    rec = topo.die_measurement(WAFER, "BAMTest")
    sx, sy = raster_start("LEC")
    y0 = -400000.0 + 25000.0
    assert [p["index"] for p in rec["points"]] == [0, 4, 8] and rec["positions"] == [0, 4, 8]
    assert [p["y_um"] for p in rec["points"]] == [y0 + sy - i * 2476 for i in (0, 4, 8)]
    assert rec["min_points"] == 2 and rec["complete"]
    assert _measure("BAMTest", positions="0,4,8")["status"] == "Success"      # command-line form
    for bad in ([9], [-1], ["a"]):
        assert _measure("BAMTest", positions=bad)["error"]["code"] == 400


# --- ComputeTopographyCorrection -------------------------------------------------

def _two_dies(mp, ref_height, die_height):
    mp.die_height[(-4, 1)] = ref_height              # BAMTest
    mp.die_height[(-2, 1)] = die_height              # BAM03
    assert _measure("BAMTest")["status"] == "Success"
    assert _measure("BAM03")["status"] == "Success"


def test_correction_sign_and_storage(setup):
    g, mp = setup
    _two_dies(mp, 15300.0, 15308.5)                  # BAM03 8.5 um higher
    path = topo.die_file_path(WAFER, "BAM03")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump({"label": "BAM03", "wafer": WAFER, "other": {"keep": 1}}, f)
    r = ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)
    assert r["status"] == "Success", r["error"]["message"]
    data = json.load(open(path))
    c = data["topography_correction"]
    assert c["dz_um"] == pytest.approx(8.5) and c["od_correction_um"] == pytest.approx(-8.5)
    assert c["reference"] == "BAMTest" and data["other"] == {"keep": 1}


@pytest.mark.parametrize("dz", [40.5, -41.0])
def test_correction_above_limit_enters_error_state(setup, dz):
    g, mp = setup
    _two_dies(mp, 15300.0, 15300.0 + dz)
    sm.force_state(S.Aligned)
    r = ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)
    assert r["error"]["code"] == 500 and "max_abs_um=40" in r["error"]["message"]
    assert sm.get_state() == S.Error
    assert not os.path.exists(topo.die_file_path(WAFER, "BAM03"))


def test_correction_compares_the_same_positions(setup):
    """Reference on all 9 positions, die on 3: only those 3 positions are compared."""
    g, mp = setup
    mp.tilt = 0.001                                  # same shape along the column on every die
    mp.die_height[(-4, 1)] = 15300.0
    mp.die_height[(-2, 1)] = 15303.0
    assert _measure("BAMTest")["status"] == "Success"
    assert _measure("BAM03", positions=[0, 1, 2])["status"] == "Success"
    r = ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)
    assert r["status"] == "Success", r["error"]["message"]
    c = json.load(open(topo.die_file_path(WAFER, "BAM03")))["topography_correction"]
    assert c["positions"] == [0, 1, 2] and c["n_common"] == 3
    assert c["dz_um"] == pytest.approx(3.0, abs=0.01) and c["sd_diff_um"] == pytest.approx(0.0, abs=0.01)
    # a plain difference of means would mix the tilt in
    assert abs(topo.die_measurement(WAFER, "BAM03")["mean_focus_um"]
               - topo.die_measurement(WAFER, "BAMTest")["mean_focus_um"] - 3.0) > 0.1
    # no positions in common
    assert _measure("BAM03", positions=[1, 2])["status"] == "Success"
    assert _measure("BAMTest", positions=[5, 6])["status"] == "Success"
    r = ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)
    assert r["error"]["code"] == 400 and "share 0" in r["error"]["message"]


def test_correction_on_measured_wafer_l3w14():
    """BAM00 vs BAMTest, focus heights of the first real run (wafer L3W14, 25.11.2026)."""
    bamtest = [8553.5, 8551.2, 8548.2, 8549.3, 8546.9, 8543.6, 8548.5, 8546.7, 8543.3]
    bam00 = [8550.7, 8548.2, 8544.7, 8544.7, 8543.2, 8541.0, 8547.3, 8546.1, 8543.7]
    ref = {"points": [{"index": i, "focus_um": z} for i, z in enumerate(bamtest)]}
    die = {"points": [{"index": i, "focus_um": z} for i, z in enumerate(bam00)]}
    c = topo.topography_correction(die, ref)
    assert c["dz_um"] == pytest.approx(-2.4) and c["od_correction_um"] == pytest.approx(2.4)
    die3 = {"points": [p for p in die["points"] if p["index"] in (0, 4, 8)]}
    assert topo.topography_correction(die3, ref)["dz_um"] == pytest.approx(-2.03, abs=0.01)


def test_correction_refusals(setup):
    g, mp = setup
    assert ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)["error"]["code"] == 400
    _two_dies(mp, 15300.0, 15301.0)
    assert ta.compute_topography_correction(die="BAM03", wafer=WAFER, reference="BAM99",
                                            **U)["error"]["code"] == 400
    mp.calls, mp.fail_at = 0, set(range(9))
    _measure("BAM03")                                # now incomplete
    r = ta.compute_topography_correction(die="BAM03", wafer=WAFER, **U)
    assert r["error"]["code"] == 400 and "incomplete" in r["error"]["message"]


def test_summarize():
    s = topo.summarize([{"y_um": 0, "focus_um": 10}, {"y_um": 1000, "focus_um": 12}], min_points=3)
    assert s["mean_focus_um"] == 11 and s["std_focus_um"] == 1 and s["slope_um_per_mm"] == 2
    assert s["range_um"] == 2 and not s["complete"]
    assert topo.summarize([], 1) == {"n_points": 0, "complete": False}


# --- sequence ------------------------------------------------------------------

def test_lec_topography_er2b_sequence(setup):
    """Both projects, every die of each: OpenProject / FindHome stubbed, the rest through the router."""
    import WPCmdMap
    from utilities.WPSequenceContext import trusted_sequence
    from actions.WPSequencerActionsYAML import run_sequencer_yaml
    g, mp = setup
    opened = []

    def executor(command, data):
        if command == "OpenProject":
            g.projectName = data["projectName"]
            opened.append(g.projectName)
            return {"status": "Success"}
        if command == "FindHome":
            return {"status": "Success"}
        return WPCmdMap._exec_in_sequence(command, data)

    yaml_path = os.path.join(os.path.dirname(WPCmdMap.__file__), "sequencer", "LECTopography_ER2B.yaml")
    with trusted_sequence("LECTopographyER2B"):
        r = run_sequencer_yaml(filepath=yaml_path, executor=executor, wafer=WAFER, **U)
    assert r["status"] == "Success", r["error"]["message"]
    assert opened == [BABY, MOSAIX]
    from utilities.WPDieMaps import die_map
    all_labels = {d["label"] for d in die_map("ER2B")["dies"]}
    dies = topo.load_topography(WAFER)["dies"]
    assert set(dies) == all_labels
    assert all(rec["positions"] == [0, 4, 8] and rec["n_points"] == 3 for rec in dies.values())

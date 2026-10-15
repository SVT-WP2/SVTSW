"""
InitProbing aligns with the alignment project of the opened project's ASIC family
(configs/WPInitProbingConfig.json), opened only on the prober, and then opens the
user's project again.

Run:  python3 -m pytest tests/unit/TestInitProbing.py -q
"""

import json

import pytest
from unittest.mock import patch

import actions.WPTestingActions as ta
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities import WPInitProbingConfig as cfg

USER_PROJECT = "MyMosaixProject"
ALIGN_PROJECT = "AlignProject"
PRE_STEPS = ["go_to_separation", "move_chuck_offaxis_area", "move_chuck_center", "auto_focus"]
STEPS = PRE_STEPS + ["align_wafer", "find_home"]


@pytest.fixture
def config_file(tmp_path, monkeypatch):
    path = tmp_path / "WPInitProbingConfig.json"
    path.write_text(json.dumps({"MOSAIX": ALIGN_PROJECT, "babyMosaix": "BabyAlign"}), encoding="utf-8")
    monkeypatch.setattr(cfg, "CONFIG_PATH", str(path))
    return path


@pytest.fixture
def setup(globals_instance, config_file):
    globals_instance.wpAgentName = "TestAgent"
    globals_instance.set_user("u1", "Expert")
    globals_instance.set_wafer_loaded(7, "West")
    globals_instance.set_probe_card(3, "West")
    globals_instance.set_project_name(USER_PROJECT)
    mp = MockProberImpl("mock:35555")
    calls = []
    for name in STEPS + ["open_project"]:
        original = getattr(mp, name)

        def wrapper(*a, _n=name, _o=original, **k):
            calls.append((_n, a[0] if (_n == "open_project" and a) else None))
            if _n in mp.fail:
                raise RuntimeError(f"{_n} failed")
            return _o(*a, **k)

        setattr(mp, name, wrapper)
    mp.calls, mp.fail = calls, set()
    sm.force_state(S.OpenedProject)
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), \
         patch("actions.WPTestingActions.get_current_prober", return_value=mp), \
         patch("actions.WPDataBaseActions.get_project_family_by_name", return_value="MOSAIX") as fam:
        mp.family = fam
        yield mp
    sm.force_state(S.ServiceOn)


def _run():
    return WPCmdMap.execute_command("InitProbing", {"user": "u1", "waferAgentName": "TestAgent"})


def test_aligns_with_the_configured_project_then_reopens_the_users(setup, globals_instance):
    r = _run()
    assert r["status"] == "Success", r
    # moves + autofocus with the user's project, alignment with the alignment project,
    # find home with the user's project again
    assert setup.calls == (
        [(s, None) for s in PRE_STEPS]
        + [("open_project", ALIGN_PROJECT), ("align_wafer", None), ("open_project", USER_PROJECT)]
        + [("find_home", None)]
    )
    assert sm.get_state() == S.Aligned
    msg = r["error"]["message"]
    assert ALIGN_PROJECT in msg and USER_PROJECT in msg and "MOSAIX" in msg


def test_global_project_is_not_changed(setup, globals_instance):
    globals_instance.opened_project_id = 42
    assert _run()["status"] == "Success"
    assert globals_instance.projectName == USER_PROJECT
    assert globals_instance.opened_project_id == 42


def test_family_is_looked_up_from_the_opened_project(setup):
    _run()
    setup.family.assert_called_once_with(USER_PROJECT)


def test_family_names_are_case_insensitive(setup):
    setup.family.return_value = "BabyMOSAIX"
    _run()
    assert ("open_project", "BabyAlign") in setup.calls


def test_no_extra_open_when_the_project_is_its_own_alignment_project(setup, globals_instance):
    globals_instance.set_project_name(ALIGN_PROJECT.lower())
    assert _run()["status"] == "Success"
    assert [c[0] for c in setup.calls] == STEPS


def test_unknown_family_does_not_touch_the_machine(setup):
    setup.family.return_value = None
    r = _run()
    assert r["error"]["code"] == 404
    assert setup.calls == []
    assert sm.get_state() == S.OpenedProject


def test_family_without_alignment_project_is_refused(setup):
    setup.family.return_value = "NKF7"
    r = _run()
    assert r["error"]["code"] == 400 and "NKF7" in r["error"]["message"]
    assert setup.calls == []
    assert sm.get_state() == S.OpenedProject


def test_no_open_project_is_refused(setup, globals_instance):
    globals_instance.set_project_name(None)
    assert _run()["error"]["code"] == 400
    assert setup.calls == []


def test_failed_alignment_still_reopens_the_users_project(setup):
    setup.fail.add("align_wafer")
    r = _run()
    assert r["status"] != "Success"
    assert "align_wafer failed" in r["error"]["message"]
    assert setup.calls[-1] == ("open_project", USER_PROJECT)
    assert "find_home" not in [c[0] for c in setup.calls]  # not on an unaligned wafer
    assert sm.get_state() == S.Error


def test_failed_find_home_is_reported_as_find_home(setup):
    setup.fail.add("find_home")
    r = _run()
    assert r["status"] != "Success"
    # the user's project was already open again when find_home ran
    assert setup.calls[-2:] == [("open_project", USER_PROJECT), ("find_home", None)]
    assert "find_home failed" in r["error"]["message"]
    assert "Could not open project" not in r["error"]["message"]
    assert sm.get_state() == S.Error


@pytest.mark.parametrize("step", PRE_STEPS)
def test_failure_before_the_switch_never_touches_the_projects(setup, step):
    setup.fail.add(step)
    r = _run()
    assert r["status"] != "Success" and f"{step} failed" in r["error"]["message"]
    assert "open_project" not in [c[0] for c in setup.calls]
    assert sm.get_state() == S.Error


def test_failure_to_reopen_the_users_project_is_reported(setup):
    original = setup.open_project

    def flaky(path, _o=original):
        if path == USER_PROJECT:
            raise RuntimeError("cannot open")
        return _o(path)

    setup.open_project = flaky
    r = _run()
    assert r["status"] != "Success"
    assert USER_PROJECT in r["error"]["message"] and ALIGN_PROJECT in r["error"]["message"]
    assert "find_home" not in [c[0] for c in setup.calls]  # not while the wrong project is open
    assert sm.get_state() == S.Error


# ── config loader ─────────────────────────────────────────────────────────────


def test_loader_is_case_insensitive(config_file):
    assert cfg.get_alignment_project("mosaix") == ALIGN_PROJECT
    assert cfg.get_alignment_project(" BABYMOSAIX ") == "BabyAlign"
    assert cfg.get_alignment_project("other") is None
    assert cfg.get_alignment_project(None) is None


def test_loader_reports_a_missing_or_broken_file(tmp_path):
    with pytest.raises(ValueError, match="not found"):
        cfg.load_alignment_projects(str(tmp_path / "nope.json"))
    bad = tmp_path / "bad.json"
    bad.write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="not valid JSON"):
        cfg.load_alignment_projects(str(bad))
    lst = tmp_path / "list.json"
    lst.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON object"):
        cfg.load_alignment_projects(str(lst))


def test_real_config_covers_both_mosaix_families():
    projects = cfg.load_alignment_projects(cfg.CONFIG_PATH)
    assert projects.get("MOSAIX") and projects.get("BABYMOSAIX")

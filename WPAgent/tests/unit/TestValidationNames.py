"""
A command must be validated under the name it is registered with in COMMAND_ROUTER.

@validate_command derives the name from the Python function name (move_chuck_die ->
"MoveChuckDie"). When the router key differs ("MoveChuckRowColumn"), the permission lists,
parameter schemas and orientation checks - all keyed by the router name - never matched,
so e.g. an Expert was refused "Command 'MoveChuckDie' requires Developer access".

Run:  python3 -m pytest tests/unit/TestValidationNames.py -q
"""

import ast
import os

import pytest
from unittest.mock import patch

import actions.WPTestingActions  # noqa: F401  (registers submodule for patch())
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

ACTION_MODULES = {
    "testing_actions": "actions/WPTestingActions.py",
    "project_actions": "actions/WPProjectActions.py",
    "database_actions": "actions/WPDataBaseActions.py",
    "command_actions": "actions/WPCommandActions.py",
    "user_actions": "actions/WPLoginActions.py",
    "imaging_actions": "actions/WPImagingActions.py",
    "sequencer_actions": "actions/WPSequencerActions.py",
}

# Known, pre-existing mismatches that are developer-only. Fixing them would switch on the
# parameter-schema and orientation checks for them, so they are left for a separate decision.
KNOWN_MISMATCH = {"MoveChuckXY", "MoveChuckToWorkArea"}


def _router_functions():
    tree = ast.parse(open(os.path.join(ROOT, "WPCmdMap.py"), encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "COMMAND_ROUTER" for t in node.targets):
            for key, value in zip(node.value.keys, node.value.values):
                if isinstance(value, ast.Attribute) and isinstance(value.value, ast.Name):
                    yield key.value, value.value.id, value.attr


def _plain_validate_command_functions():
    """{(module alias, function name)} decorated with plain @validate_command."""
    found = set()
    for alias, path in ACTION_MODULES.items():
        tree = ast.parse(open(os.path.join(ROOT, path), encoding="utf-8").read())
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and any(
                isinstance(d, ast.Name) and d.id == "validate_command" for d in node.decorator_list
            ):
                found.add((alias, node.name))
    return found


def test_plain_validate_command_name_matches_router_key():
    plain = _plain_validate_command_functions()
    mismatched = set()
    for key, alias, func in _router_functions():
        if (alias, func) in plain:
            derived = "".join(w.capitalize() for w in func.split("_"))
            if derived != key:
                mismatched.add(key)
    assert mismatched == KNOWN_MISMATCH


# ── behaviour ─────────────────────────────────────────────────────────────────

def _login(g, hierarchy):
    g.wpAgentName = "T"
    g.set_user("u1", hierarchy)


@pytest.fixture(autouse=True)
def _reset_state():
    yield
    sm.force_state(S.ServiceOn)


def _run(command, data, state, hierarchy, globals_instance):
    _login(globals_instance, hierarchy)
    globals_instance.set_wafer_loaded(7, "West")
    sm.force_state(state)
    prober = MockProberImpl("m")
    d = dict(data, user="u1", waferAgentName="T")
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), patch(
        "actions.WPTestingActions.get_current_prober", return_value=prober
    ), patch("time.sleep"):
        return WPCmdMap.execute_command(command, d)


def _code(r):
    return (r.get("error") or {}).get("code")


class TestRoleOfMisnamedCommands:
    def test_expert_can_run_move_chuck_row_column(self, globals_instance):
        r = _run("MoveChuckRowColumn", {"col": 1, "row": 2}, S.Aligned, "Expert", globals_instance)
        assert r["status"] == "Success", r

    def test_user_cannot_run_move_chuck_row_column(self, globals_instance):
        r = _run("MoveChuckRowColumn", {"col": 1, "row": 2}, S.Aligned, "User", globals_instance)
        assert _code(r) == 403
        assert "MoveChuckRowColumn" in r["error"]["message"]

    def test_user_can_run_move_chuck_unload_wafer(self, globals_instance):
        r = _run("MoveChuckUnloadWafer", {}, S.Aligned, "User", globals_instance)
        assert r["status"] == "Success", r

    def test_user_can_run_move_chuck_off_axis(self, globals_instance):
        r = _run("MoveChuckOffAxis", {}, S.OnDie_Wide_withoutPTPA, "User", globals_instance)
        assert r["status"] == "Success", r

    def test_developer_still_runs_all_three(self, globals_instance):
        for command, data in (("MoveChuckRowColumn", {"col": 1, "row": 2}), ("MoveChuckUnloadWafer", {}), ("MoveChuckOffAxis", {})):
            r = _run(command, data, S.UsedByDeveloper, "Developer", globals_instance)
            assert r["status"] == "Success", (command, r)


class TestReplyTypesUnchanged:
    """Clients and the AsyncAPI spec know these reply types - fixing the name must not rename them."""

    @pytest.mark.parametrize(
        "command,data,state,reply",
        [
            ("MoveChuckRowColumn", {"col": 1, "row": 2}, S.Aligned, "MoveChuckDieReply"),
            ("MoveChuckUnloadWafer", {}, S.Aligned, "MoveChuckUnloadedWaferReply"),
            ("MoveChuckOffAxis", {}, S.OnDie_Wide_withoutPTPA, "MoveChuckOffaxisReply"),
        ],
    )
    def test_reply_type(self, globals_instance, command, data, state, reply):
        r = _run(command, data, state, "Developer", globals_instance)
        assert r["type"] == reply

    def test_validation_error_uses_the_same_reply_type(self, globals_instance):
        r = _run("MoveChuckRowColumn", {"col": 1, "row": 2}, S.Aligned, "User", globals_instance)
        assert r["type"] == "MoveChuckDieReply"


class TestChecksKeyedByRouterNameNowApply:
    """MoveChuckRowColumn is in the orientation-check list; before the fix that check never ran for it."""

    def _with_project(self, g, wafer_orientation):
        g.projectName = "ER2_MOSAIX_Vertical_V0_NotchE_ArrowE"   # expects wafer + probe card East
        g.probe_card_orientation = "East"
        g.set_wafer_loaded(7, wafer_orientation)

    def test_wrong_wafer_orientation_is_refused(self, globals_instance):
        _login(globals_instance, "Expert")
        self._with_project(globals_instance, "West")
        sm.force_state(S.Aligned)
        prober = MockProberImpl("m")
        with patch("actions.WPTestingActions._ensure_initialized", return_value=None), patch(
            "actions.WPTestingActions.get_current_prober", return_value=prober
        ), patch("time.sleep"):
            r = WPCmdMap.execute_command("MoveChuckRowColumn", {"col": 1, "row": 2, "user": "u1", "waferAgentName": "T"})
        assert _code(r) == 400 or r["status"] != "Success"
        assert "orientation" in r["error"]["message"].lower()

    def test_matching_orientation_runs(self, globals_instance):
        _login(globals_instance, "Expert")
        self._with_project(globals_instance, "East")
        sm.force_state(S.Aligned)
        prober = MockProberImpl("m")
        with patch("actions.WPTestingActions._ensure_initialized", return_value=None), patch(
            "actions.WPTestingActions.get_current_prober", return_value=prober
        ), patch("time.sleep"):
            r = WPCmdMap.execute_command("MoveChuckRowColumn", {"col": 1, "row": 2, "user": "u1", "waferAgentName": "T"})
        assert r["status"] == "Success", r

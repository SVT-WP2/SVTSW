"""
Regression tests for SetContactHeight, the MoveChuckAsic sequence, and
cross-consistency of the state machine / permission sets / command router.

Run:  python3 -m pytest tests/unit/TestSetContactHeightAndAsic.py -q
"""

import ast
import os
import pytest
from unittest.mock import patch

import actions.WPTestingActions  # noqa: F401  (registers submodule for patch())
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S, WPAgentStateMachine
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandConstants import BYPASS_COMMANDS, USER_COMMANDS, EXPERT_COMMANDS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))


# ── helpers ───────────────────────────────────────────────────────────────────
def _login(g, hierarchy="Expert"):
    g.wpAgentName = "T"
    g.set_user("u1", hierarchy)


def _run(cmd, data, prober):
    d = dict(data, user="u1", waferAgentName="T")
    with patch("actions.WPTestingActions._ensure_initialized", return_value=None), patch(
        "actions.WPTestingActions.get_current_prober", return_value=prober
    ), patch("time.sleep"):
        return WPCmdMap.execute_command(cmd, d)


@pytest.fixture(autouse=True)
def _reset_state():
    yield
    sm.force_state(S.ServiceOn)


def _prober(area="Probing"):
    mp = MockProberImpl("mock:1")
    mp._working_area = area
    return mp


def _code(r):
    return (r.get("error") or {}).get("code")


# ── SetContactHeight ──────────────────────────────────────────────────────────
class TestSetContactHeight:
    @pytest.mark.parametrize("state", [S.OnDie_Wide_withPTPA, S.OnDie_Wide_withoutPTPA])
    def test_explicit_value_is_written_and_state_kept(self, globals_instance, state):
        _login(globals_instance)
        sm.force_state(state)
        mp = _prober()
        r = _run("SetContactHeight", {"contactHeight": 15279.0}, mp)
        assert r["status"] == "Success"
        assert mp._chuck_z == 15279.0
        assert globals_instance.contact_height == 15279.0
        assert sm.get_state() == state

    def test_defaults_to_value_saved_at_open_project(self, globals_instance):
        _login(globals_instance)
        globals_instance.contact_height = 15280.0
        sm.force_state(S.OnDie_Wide_withPTPA)
        mp = _prober()
        r = _run("SetContactHeight", {}, mp)
        assert r["status"] == "Success"
        assert mp._chuck_z == 15280.0

    def test_no_value_and_nothing_saved_is_400_not_error_state(self, globals_instance):
        _login(globals_instance)
        globals_instance.contact_height = None
        sm.force_state(S.OnDie_Wide_withPTPA)
        r = _run("SetContactHeight", {}, _prober())
        assert _code(r) == 400
        assert sm.get_state() == S.OnDie_Wide_withPTPA  # caller mistake: no Error state

    @pytest.mark.parametrize("bad", ["abc", -5, 0, True, float("inf"), float("nan")])
    def test_bad_values_rejected_before_touching_prober(self, globals_instance, bad):
        _login(globals_instance)
        sm.force_state(S.OnDie_Wide_withPTPA)
        mp = _prober()
        before = mp._chuck_z
        r = _run("SetContactHeight", {"contactHeight": bad}, mp)
        assert _code(r) == 400
        assert mp._chuck_z == before
        assert sm.get_state() == S.OnDie_Wide_withPTPA

    def test_refused_at_off_axis_camera_without_error_state(self, globals_instance):
        _login(globals_instance)
        sm.force_state(S.OnDie_Wide_withPTPA)
        mp = _prober(area="OffAxisCamera")
        before = mp._chuck_z
        r = _run("SetContactHeight", {"contactHeight": 15279.0}, mp)
        assert _code(r) == 400
        assert "off-axis" in r["error"]["message"].lower()
        assert mp._chuck_z == before
        assert sm.get_state() == S.OnDie_Wide_withPTPA

    @pytest.mark.parametrize(
        "state",
        [S.OpenedProject, S.Aligned, S.OnDie_OffAxis_withoutPTPA,
         S.OnDie_OffAxis_withPTPA, S.OnDie_Wide, S.AtContact, S.AtContact_Locked],
    )
    def test_blocked_by_state_machine_elsewhere(self, globals_instance, state):
        _login(globals_instance)
        sm.force_state(state)
        r = _run("SetContactHeight", {"contactHeight": 15279.0}, _prober())
        assert _code(r) == 409
        assert sm.get_state() == state

    def test_user_level_is_forbidden(self, globals_instance):
        _login(globals_instance, "User")
        sm.force_state(S.OnDie_Wide_withPTPA)
        assert _code(_run("SetContactHeight", {"contactHeight": 15279.0}, _prober())) == 403

    def test_developer_allowed_in_any_state(self, globals_instance):
        _login(globals_instance, "Developer")
        sm.force_state(S.UsedByDeveloper)
        assert _run("SetContactHeight", {"contactHeight": 15279.0}, _prober())["status"] == "Success"

    def test_reply_carries_contact_height(self, globals_instance):
        _login(globals_instance)
        sm.force_state(S.OnDie_Wide_withPTPA)
        r = _run("SetContactHeight", {"contactHeight": 15279.0}, _prober())
        assert r["data"]["contactHeight"] == 15279.0


# ── MoveChuckAsic ─────────────────────────────────────────────────────────────
class _Rec(MockProberImpl):
    def __init__(self):
        super().__init__("m")
        self.calls = []

    def move_chuck_offaxis_area(self):
        self.calls.append("offaxis"); return super().move_chuck_offaxis_area()

    def go_to_die(self, c, r, s=0):
        self.calls.append("die"); return super().go_to_die(c, r, s)

    def auto_focus(self):
        self.calls.append("autofocus"); return super().auto_focus()

    def run_ptpa(self):
        self.calls.append("ptpa"); return super().run_ptpa()

    def move_chuck_wide(self):
        self.calls.append("wide"); return super().move_chuck_wide()


ASIC_OK = {"serialNumber": "BAM00", "waferId": 7}


class TestMoveChuckAsic:
    @pytest.mark.parametrize(
        "state",
        [S.Aligned, S.OnDie_OffAxis_withoutPTPA, S.OnDie_OffAxis_withPTPA,
         S.OnDie_Wide_withPTPA, S.OnDie_Wide_withoutPTPA, S.OnDie_Wide],
    )
    def test_full_sequence_then_wide_with_ptpa_state(self, globals_instance, state):
        _login(globals_instance)
        globals_instance.loaded_wafer_id = 7
        sm.force_state(state)
        mp = _Rec()
        with patch("actions.WPDataBaseActions.get_asic_by_id", return_value=ASIC_OK):
            r = _run("MoveChuckAsic", {"asicId": 1}, mp)
        assert r["status"] == "Success"
        assert mp.calls == ["offaxis", "die", "autofocus", "ptpa", "wide"]
        assert sm.get_state() == S.OnDie_Wide_withPTPA

    def test_asic_on_other_wafer_does_nothing(self, globals_instance):
        _login(globals_instance)
        globals_instance.loaded_wafer_id = 7
        sm.force_state(S.Aligned)
        mp = _Rec()
        with patch("actions.WPDataBaseActions.get_asic_by_id",
                   return_value={"serialNumber": "BAM00", "waferId": 99}):
            r = _run("MoveChuckAsic", {"asicId": 1}, mp)
        assert _code(r) == 400 and mp.calls == []
        assert sm.get_state() == S.Aligned

    def test_string_asic_id_rejected_by_validator(self, globals_instance):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        assert _code(_run("MoveChuckAsic", {"asicId": "1"}, _Rec())) == 400

    def test_blocked_at_contact(self, globals_instance):
        _login(globals_instance)
        sm.force_state(S.AtContact)
        assert _code(_run("MoveChuckAsic", {"asicId": 1}, _Rec())) == 409

    def test_failure_mid_sequence_enters_error_state(self, globals_instance):
        class Boom(_Rec):
            def run_ptpa(self):
                self.calls.append("ptpa"); raise Exception("PTPA failed")

        _login(globals_instance)
        globals_instance.loaded_wafer_id = 7
        sm.force_state(S.Aligned)
        mp = Boom()
        with patch("actions.WPDataBaseActions.get_asic_by_id", return_value=ASIC_OK):
            r = _run("MoveChuckAsic", {"asicId": 1}, mp)
        assert _code(r) == 500
        assert "wide" not in mp.calls            # sequence stopped at the failure
        assert sm.get_state() == S.Error         # never claims PTPA/wide succeeded


# ── structural consistency ────────────────────────────────────────────────────
def _router_keys():
    tree = ast.parse(open(os.path.join(ROOT, "WPCmdMap.py"), encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            getattr(t, "id", "") == "COMMAND_ROUTER" for t in node.targets
        ):
            return {k.value for k in node.value.keys}
    raise AssertionError("COMMAND_ROUTER not found")


# Known, pre-existing inconsistencies. A NEW one makes the tests below fail;
# fixing one of these also fails the test, which forces removing it from here.
KNOWN_DEAD_CLASSIFIED = {"GetLockStatus", "ChangeProject", "ListAvailableCommands", "ShowProjectStatus"}
KNOWN_UNREACHABLE_FOR_NON_DEV = {"DisableOvertravel", "SetPTPA"}


class TestStructuralConsistency:
    def test_transition_targets_are_valid_states(self):
        for state, table in WPAgentStateMachine().transitions.items():
            for cmd, target in table.items():
                assert isinstance(target, S), f"{state.name}.{cmd} -> {target!r}"

    def test_every_state_has_an_outgoing_table(self):
        t = WPAgentStateMachine().transitions
        assert [s.name for s in S if s not in t] == []

    def test_transition_commands_exist_in_router(self):
        router = _router_keys()
        used = {c for tab in WPAgentStateMachine().transitions.values() for c in tab} - {"Error"}
        assert used - router == {"ChangeProject"}  # known (documented) leftover

    def test_classified_commands_exist_in_router(self):
        router = _router_keys()
        classified = BYPASS_COMMANDS | USER_COMMANDS | EXPERT_COMMANDS
        assert classified - router == KNOWN_DEAD_CLASSIFIED

    def test_no_command_is_both_user_and_expert(self):
        assert USER_COMMANDS & EXPERT_COMMANDS == set()

    def test_user_expert_commands_are_reachable_by_non_developers(self):
        tables = WPAgentStateMachine().transitions
        allowed = {c for s, tab in tables.items() if s != S.UsedByDeveloper for c in tab}
        stuck = {c for c in (USER_COMMANDS | EXPERT_COMMANDS) & _router_keys()
                 if c not in allowed and c not in BYPASS_COMMANDS}
        assert stuck == KNOWN_UNREACHABLE_FOR_NON_DEV

    def test_every_literal_transition_used_by_actions_is_in_a_table(self):
        import glob, re
        tables = WPAgentStateMachine().transitions
        in_tables = {c for tab in tables.values() for c in tab} | BYPASS_COMMANDS
        used = set()
        for f in glob.glob(os.path.join(ROOT, "actions", "*.py")):
            used |= set(re.findall(r'agentStateMachine\.transition\("(\w+)"\)',
                                   open(f, encoding="utf-8").read()))
        assert used - in_tables == {"AlignWafer"}  # known: AlignWafer is developer-only

    def test_validator_float_rejects_bool(self):
        from utilities.WPValidator import WPCommandValidator
        v = WPCommandValidator()
        assert v._check_type(1.5, "float") and v._check_type(2, "float")
        assert not v._check_type(True, "float") and not v._check_type(True, "int")
        assert v._check_type(True, "bool")

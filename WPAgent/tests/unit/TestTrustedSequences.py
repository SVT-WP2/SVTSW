"""
Experts may run the built-in YAML sequences (TakeImage*, BrightnessCorrection) even though
the steps use developer-only commands. The caller is checked once, at the sequence command;
its steps run as a trusted sequence (see utilities/WPSequenceContext.py).

Run:  python3 -m pytest tests/unit/TestTrustedSequences.py -q
"""

import pytest
from unittest.mock import patch

import actions.WPTestingActions  # noqa: F401  (registers submodule for patch())
import WPCmdMap
from drivers.WPMockProber import MockProberImpl
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm
from utilities.WPCommandConstants import EXPERT_COMMANDS, SEQUENCE_COMMANDS, USER_COMMANDS
from utilities.WPSequenceContext import in_trusted_sequence

SEQ = "TakeImageL2"

STEPS_DEV_ONLY = """
params:
  user:
  waferAgentName:
steps:
  - command: MoveChuckCenter
    params:
      user: $user
      waferAgentName: $waferAgentName
  - command: MoveChuckRowColumn
    params:
      col: 1
      row: 2
      user: $user
      waferAgentName: $waferAgentName
"""


def _login(g, hierarchy="Expert"):
    g.wpAgentName = "T"
    g.set_user("u1", hierarchy)


@pytest.fixture(autouse=True)
def _reset_state():
    yield
    sm.force_state(S.ServiceOn)


def _run_command(command, data, tmp_path, yaml_text=STEPS_DEV_ONLY):
    path = tmp_path / "seq.yaml"
    path.write_text(yaml_text, encoding="utf-8")
    router = dict(WPCmdMap.COMMAND_ROUTER)
    router[SEQ] = WPCmdMap._yaml_command(SEQ, str(path))
    d = dict(data, user="u1", waferAgentName="T")
    with patch.dict(WPCmdMap.COMMAND_ROUTER, router, clear=True), patch(
        "actions.WPTestingActions._ensure_initialized", return_value=None
    ), patch("actions.WPTestingActions.get_current_prober", return_value=MockProberImpl("m")), patch(
        "time.sleep"
    ):
        return WPCmdMap.execute_command(command, d)


def _code(r):
    return (r.get("error") or {}).get("code")


class TestTrustedSequences:
    def test_expert_runs_sequence_with_developer_only_steps(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        r = _run_command(SEQ, {}, tmp_path)
        assert r["status"] == "Success", r

    def test_state_is_unchanged_after_sequence(self, globals_instance, tmp_path):
        """MoveChuckRowColumn would normally move Aligned -> OnDie_OffAxis_withoutPTPA."""
        _login(globals_instance)
        sm.force_state(S.Aligned)
        assert _run_command(SEQ, {}, tmp_path)["status"] == "Success"
        assert sm.get_state() == S.Aligned

    @pytest.mark.parametrize("state", [S.UserLogged, S.OpenedProject, S.Aligned])
    def test_can_start_from_these_states(self, globals_instance, tmp_path, state):
        _login(globals_instance)
        sm.force_state(state)
        assert _run_command(SEQ, {}, tmp_path)["status"] == "Success"

    @pytest.mark.parametrize("state", [S.AtContact, S.OnDie_Wide_withPTPA, S.Unloaded, S.Error])
    def test_blocked_from_other_states(self, globals_instance, tmp_path, state):
        _login(globals_instance)
        sm.force_state(state)
        assert _code(_run_command(SEQ, {}, tmp_path)) == 409
        assert sm.get_state() == state

    def test_developer_only_command_still_forbidden_outside_a_sequence(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        assert _code(_run_command("MoveChuckCenter", {}, tmp_path)) in (403, 409)

    def test_user_level_cannot_run_sequence(self, globals_instance, tmp_path):
        _login(globals_instance, "User")
        sm.force_state(S.Aligned)
        assert _code(_run_command(SEQ, {}, tmp_path)) == 403

    def test_developer_can_still_run_sequence(self, globals_instance, tmp_path):
        _login(globals_instance, "Developer")
        sm.force_state(S.UsedByDeveloper)
        assert _run_command(SEQ, {}, tmp_path)["status"] == "Success"

    def test_wrong_agent_name_rejected(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        path = tmp_path / "seq.yaml"
        path.write_text(STEPS_DEV_ONLY, encoding="utf-8")
        handler = WPCmdMap._yaml_command(SEQ, str(path))
        r = handler(user="u1", waferAgentName="OTHER")
        assert _code(r) == 403

    def test_trust_ends_after_the_sequence(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        _run_command(SEQ, {}, tmp_path)
        assert in_trusted_sequence() is False

    def test_trust_ends_when_a_step_fails(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        bad = STEPS_DEV_ONLY.replace("MoveChuckCenter", "NoSuchCommand")
        r = _run_command(SEQ, {}, tmp_path, bad)
        assert r["status"] != "Success"
        assert in_trusted_sequence() is False

    def test_sequence_cannot_start_a_custom_sequence(self, globals_instance, tmp_path):
        _login(globals_instance)
        sm.force_state(S.Aligned)
        nested = """
params:
  user:
  waferAgentName:
steps:
  - command: RunSequencerYAML
    params:
      filepath: other.yaml
      user: $user
      waferAgentName: $waferAgentName
"""
        r = _run_command(SEQ, {}, tmp_path, nested)
        assert r["status"] != "Success"
        assert "not allowed inside a built-in sequence" in r["error"]["message"]

    def test_custom_sequence_commands_stay_developer_only(self):
        assert "RunSequencer" not in EXPERT_COMMANDS | USER_COMMANDS
        assert "RunSequencerYAML" not in EXPERT_COMMANDS | USER_COMMANDS


class TestSequenceCommandSets:
    def test_every_sequence_command_is_registered_and_expert_level(self):
        assert SEQUENCE_COMMANDS <= set(WPCmdMap.COMMAND_ROUTER)
        assert SEQUENCE_COMMANDS <= EXPERT_COMMANDS
        assert not SEQUENCE_COMMANDS & USER_COMMANDS

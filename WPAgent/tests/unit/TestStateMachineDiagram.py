"""
Tests for utilities/WPStateMachineDiagram.py (Mermaid generator).

Run:  python3 -m pytest tests/unit/TestStateMachineDiagram.py -q
"""

from stateMachine.WpAgentStateMachine import WPAgentState, WPAgentStateMachine
from utilities.WPCommandConstants import EXPERT_COMMANDS, SEQUENCE_COMMANDS, USER_COMMANDS
from utilities.WPStateMachineDiagram import (
    ACTION_TRANSITIONS, LEVEL_COLORS, build_mermaid, command_level, main,
)


def test_starts_with_header_and_initial_state():
    out = build_mermaid(style="plain")
    assert "stateDiagram-v2" in out
    assert "[*] --> ServiceOn" in out


def test_every_non_error_transition_is_drawn():
    sm = WPAgentStateMachine()
    out = build_mermaid(sm, style="plain")
    for src, table in sm.transitions.items():
        for command, dst in table.items():
            if command == "Error":
                continue
            lines = [l for l in out.splitlines() if l.startswith(f"    {src.name} --> {dst.name}:")]
            assert lines, f"missing edge {src.name} -> {dst.name}"
            if command in SEQUENCE_COMMANDS:
                continue  # shown as one collapsed entry
            assert any(command in [c.strip() for c in l.split(":", 1)[1].split(",")] for l in lines), command


def test_every_state_with_transitions_appears():
    out = build_mermaid(style="plain")
    for state in WPAgentState:
        if state.name in ("Error",):
            continue
        assert state.name in out


def test_error_transitions_collapsed_into_one_note():
    out = build_mermaid(style="plain")
    assert "--> Error" not in out
    assert out.count("note right of Error") == 1


def test_output_is_deterministic():
    assert build_mermaid() == build_mermaid()
    assert build_mermaid(style="plain") == build_mermaid(style="plain")


def test_cli_writes_file(tmp_path):
    target = tmp_path / "sm.mermaid"
    assert main(["-o", str(target)]) == 0
    assert target.read_text(encoding="utf-8") == build_mermaid(style="colored")
    assert main(["-o", str(target), "--format", "plain"]) == 0
    assert target.read_text(encoding="utf-8") == build_mermaid(style="plain")


# ── colored flowchart ─────────────────────────────────────────────────────────


def _colored_edges():
    """(label, color) for each state-to-state arrow, using the linkStyle lines."""
    out = build_mermaid(style="colored").splitlines()
    arrows = [l for l in out if '-->|"' in l]
    colors = {}
    for l in out:
        l = l.strip()
        if l.startswith("linkStyle "):
            _, idx, style = l.split(" ", 2)
            colors[int(idx)] = style.split(",")[0].split(":")[1]
    # arrow 0 is the start arrow, so arrows[i] is link index i + 1
    return [(a.split('"')[1], colors[i + 1]) for i, a in enumerate(arrows)]


def test_colored_is_a_flowchart_and_default():
    out = build_mermaid()
    assert out.splitlines()[1] == "flowchart LR"
    assert out == build_mermaid(style="colored")


def test_command_level_classification():
    assert command_level("MoveChuckContact") == "user"
    assert command_level("MoveChuckRowColumn") == "expert"
    assert command_level("ResetAgent") == "other"
    assert not (USER_COMMANDS & EXPERT_COMMANDS)


def test_user_commands_green_and_expert_commands_red():
    seen = set()
    for label, color in _colored_edges():
        for command in [c.strip() for c in label.split(",")]:
            if command in USER_COMMANDS:
                assert color == LEVEL_COLORS["user"], command
                seen.add("user")
            elif command in EXPERT_COMMANDS:
                assert color == LEVEL_COLORS["expert"], command
                seen.add("expert")
    assert seen == {"user", "expert"}


def test_every_arrow_has_a_single_color_level():
    """User and expert commands never share one arrow (it could only be one color)."""
    for label, _ in _colored_edges():
        levels = {
            command_level(c.strip()) if not c.strip().startswith("TakeImage") else "expert"
            for c in label.split(",")
        }
        assert len(levels) == 1, label


def test_sequences_collapsed_into_one_entry():
    for label, _ in _colored_edges():
        assert "TakeImageL2" not in label
    assert "TakeImage* / BrightnessCorrection sequences" in build_mermaid()


def test_colored_has_legend_and_error_note():
    out = build_mermaid()
    assert "subgraph Legend" in out
    assert "Every state moves to Error when a command fails." in out


def test_link_styles_match_arrow_count():
    out = build_mermaid().splitlines()
    arrows = [l for l in out if "-->" in l or "-.-" in l]
    indexes = sorted(int(l.strip().split(" ")[1]) for l in out if l.strip().startswith("linkStyle"))
    assert indexes == list(range(len(arrows)))


# ── login / logout (state set by the action, not by the transition table) ─────


def test_login_and_logout_are_drawn_in_both_formats():
    for style in ("colored", "plain"):
        out = build_mermaid(style=style)
        assert "UserLogIn" in out and "UserLogOut" in out, style
        assert "UserLogIn (Developer)" in out, style


def test_login_edges_are_green_in_colored_format():
    out = build_mermaid().splitlines()
    arrows = [l for l in out if '-->|"' in l]
    colors = {}
    for l in out:
        l = l.strip()
        if l.startswith("linkStyle "):
            _, idx, style = l.split(" ", 2)
            colors[int(idx)] = style.split(",")[0].split(":")[1]
    for i, arrow in enumerate(arrows):
        if '-->|"UserLog' in arrow:
            assert colors[i + 1] == LEVEL_COLORS["user"], arrow


def test_login_edges_match_what_the_login_action_does():
    """Guard against drift: the diagram says login forces these states, so the action must."""
    import os
    root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    src = open(os.path.join(root, "actions", "WPLoginActions.py"), encoding="utf-8").read()
    assert "force_state(WPAgentState.UserLogged)" in src
    assert "force_state(WPAgentState.UsedByDeveloper)" in src
    assert "agentStateMachine.reset()" in src
    targets = {(s, d) for s, d, _, _ in ACTION_TRANSITIONS}
    assert ("ServiceOn", "UserLogged") in targets
    assert ("ServiceOn", "UsedByDeveloper") in targets
    assert ("AnyState", "ServiceOn") in targets


def test_logout_reset_goes_back_to_service_on():
    sm = WPAgentStateMachine()
    sm.force_state(WPAgentState.Aligned)
    sm.reset()
    assert sm.current_state == WPAgentState.ServiceOn

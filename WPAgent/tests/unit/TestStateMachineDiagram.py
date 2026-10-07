"""
Tests for utilities/WPStateMachineDiagram.py (Mermaid generator).

Run:  python3 -m pytest tests/unit/TestStateMachineDiagram.py -q
"""

from stateMachine.WpAgentStateMachine import WPAgentState, WPAgentStateMachine
from utilities.WPStateMachineDiagram import build_mermaid, main


def test_starts_with_header_and_initial_state():
    out = build_mermaid()
    assert "stateDiagram-v2" in out
    assert "[*] --> ServiceOn" in out


def test_every_non_error_transition_is_drawn():
    sm = WPAgentStateMachine()
    out = build_mermaid(sm)
    for src, table in sm.transitions.items():
        for command, dst in table.items():
            if command == "Error":
                continue
            lines = [l for l in out.splitlines() if l.startswith(f"    {src.name} --> {dst.name}:")]
            assert lines, f"missing edge {src.name} -> {dst.name}"
            assert any(command in [c.strip() for c in l.split(":", 1)[1].split(",")] for l in lines), command


def test_every_state_with_transitions_appears():
    out = build_mermaid()
    for state in WPAgentState:
        if state.name in ("Error",):
            continue
        assert state.name in out


def test_error_transitions_collapsed_into_one_note():
    out = build_mermaid()
    assert "--> Error" not in out
    assert out.count("note right of Error") == 1


def test_output_is_deterministic():
    assert build_mermaid() == build_mermaid()


def test_cli_writes_file(tmp_path):
    target = tmp_path / "sm.mermaid"
    assert main(["-o", str(target)]) == 0
    assert target.read_text(encoding="utf-8") == build_mermaid()

"""Giving the machine back (D16): `local_mode()` is the last call of every request that touched the machine, whatever
its result; a closed connection gets none; the tool stays usable after a failure (D15)."""

import logging
from pathlib import Path

import pytest
from conftest import calls_by_request, run_tool

from wptool.engine import Request


@pytest.fixture
def engine(mock_engine):
    assert mock_engine.execute(Request(command="Initialize")).ok
    mock_engine.connection.simulator.calls.clear()
    return mock_engine


@pytest.fixture
def sim(engine):
    return engine.connection.simulator


def names(sim):
    return [name for name, _ in sim.calls]


def test_a_successful_machine_command_ends_with_local_mode(engine, sim):
    assert engine.execute(Request(command="_Move", params={"x": 5})).ok
    assert names(sim)[-1] == "local_mode"
    assert names(sim).count("local_mode") == 1


def test_an_exception_of_the_machine_gives_500_and_local_mode(engine, sim):
    sim.fail_next("move_chuck_xy", RuntimeError("SENTIO refused the move"))
    reply = engine.execute(Request(command="_Move", params={"x": 5}))
    assert reply.error == {"code": 500, "message": "_Move failed: SENTIO refused the move"}
    assert names(sim)[-2:] == ["move_chuck_xy", "local_mode"]


def test_a_409_of_the_separation_check_the_query_then_local_mode(engine, sim):
    sim.move_chuck_wide()
    sim.go_to_contact()
    sim.calls.clear()
    assert engine.execute(Request(command="_Move")).error["code"] == 409
    assert names(sim) == ["get_chuck_position", "local_mode"]


def test_a_503_of_the_position_query_then_local_mode(engine, sim):
    sim.position_text = "Error: busy"
    assert engine.execute(Request(command="_Move")).error["code"] == 503
    assert names(sim) == ["get_chuck_position", "local_mode"]


@pytest.mark.parametrize(
    "request_",
    [
        Request(command="_Move", params={"x": "far"}),
        Request(command="_Move", params={"z": 1}),
        Request(command="LocalMode", params={"x": 1}),
        Request(command="MoveChuckAsic"),
        Request(command="Nope"),
        Request(command="_Echo", params={"text": "offline"}),
        Request(command="_Fail"),
    ],
    ids=["wrong type", "unknown key", "unknown key 2", "step 2", "unknown", "offline", "offline failure"],
)
def test_a_request_that_does_not_touch_the_machine_gets_no_call_at_all(engine, sim, request_):
    engine.execute(request_)
    assert sim.calls == []


def test_after_the_give_back_the_machine_is_not_touched(engine, sim):
    assert engine.execute(Request(command="_Query")).ok
    assert engine.connection.machine.touched is False
    engine.connection.give_back()
    assert names(sim).count("local_mode") == 1


def test_a_request_starts_untouched(engine, sim):
    # A call outside a request (none in the tool today) does not make the next request give the machine back.
    engine.connection.machine.get_chuck_position()
    sim.calls.clear()
    engine.execute(Request(command="_Echo"))
    assert sim.calls == []


def test_local_mode_calls_local_mode_once(engine, sim):
    reply = engine.execute(Request(command="LocalMode"))
    assert reply.data["message"] == "Local mode"
    assert names(sim).count("local_mode") == 1
    assert names(sim)[-1] == "local_mode"


@pytest.mark.parametrize("command", ["Disconnect", "Shutdown"])
def test_disconnect_and_shutdown_call_it_once_in_close_never_after(engine, sim, command, caplog):
    caplog.set_level(logging.WARNING)
    assert engine.execute(Request(command=command)).ok
    assert sim.calls == [("local_mode", ()), ("disconnect", ())]
    # Nothing on the closed connection: no call, no error.
    assert [r for r in caplog.records if r.levelno >= logging.WARNING] == []
    engine.connection.close()
    assert sim.calls == [("local_mode", ()), ("disconnect", ())]


def test_initialize_force_gives_the_old_connection_back_in_close_and_the_new_one_at_the_end(engine, sim, caplog):
    caplog.set_level(logging.WARNING)
    assert engine.execute(Request(command="Initialize", params={"force": True})).ok
    assert names(sim)[:2] == ["local_mode", "disconnect"]
    assert names(sim)[-1] == "local_mode"
    assert names(sim).count("local_mode") == 2
    assert [r for r in caplog.records if r.levelno >= logging.WARNING] == []


def test_show_status_touches_the_machine_and_gives_it_back(engine, sim):
    assert engine.execute(Request(command="ShowStatus")).ok
    assert names(sim)[-1] == "local_mode"


def test_an_error_of_local_mode_is_logged_not_raised(engine, sim, caplog):
    caplog.set_level(logging.WARNING, logger="wptool.machine")
    sim.fail_next("local_mode", RuntimeError("no answer"))
    reply = engine.execute(Request(command="_Move"))
    assert reply.ok
    assert any("local_mode() failed: no answer" in r.getMessage() for r in caplog.records)


def test_the_next_command_runs_after_every_failure(engine, sim):
    sim.fail_next("move_chuck_xy", RuntimeError("refused"))
    assert engine.execute(Request(command="_Move")).error["code"] == 500
    assert engine.execute(Request(command="_Move", params={"x": "far"})).error["code"] == 400
    sim.go_to_contact()
    assert engine.execute(Request(command="_Move")).error["code"] == 409
    sim.go_to_separation()
    assert engine.execute(Request(command="Disconnect")).ok
    assert engine.execute(Request(command="_Move")).error["code"] == 503
    assert engine.execute(Request(command="Initialize")).ok
    assert engine.execute(Request(command="_Move")).ok


def test_the_commands_never_call_local_mode_themselves():
    # The engine gives the machine back (D16); a command that called it would give SENTIO two calls, or one
    # before a later query.
    folder = Path(__file__).parent.parent / "wptool" / "commands"
    for path in folder.glob("*.py"):
        assert ".local_mode(" not in path.read_text(encoding="utf-8"), path.name


SCRIPT = """\
- Initialize
- _Move x=10
- ShowStatus
- _Echo text=offline
- LocalMode
- Disconnect
- _Echo text=after
- Initialize
"""


def test_in_run_every_step_that_touched_the_machine_ends_with_local_mode(tmp_path, config_file, log_file):
    script = tmp_path / "flow.yaml"
    script.write_text(SCRIPT, encoding="utf-8")
    result = run_tool(["run", str(script), "--mock", "--config", str(config_file)], cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    requests = calls_by_request(log_file)
    assert [command for command, _ in requests] == [
        "Initialize", "_Move", "ShowStatus", "_Echo", "LocalMode", "Disconnect", "_Echo", "Initialize", "<end>",
    ]
    for command, calls in requests[:-1]:
        if command == "_Echo":
            assert calls == []
        elif command == "Disconnect":
            assert calls == ["local_mode()", "disconnect()"]
        else:
            assert calls[-1] == "local_mode()", (command, calls)
            assert calls.count("local_mode()") == 1, (command, calls)
    # The end of run closes the connection of the last Initialize.
    assert requests[-1] == ("<end>", ["local_mode()", "disconnect()"])

"""The machine facts in every machine reply: read live after the command, never kept (D10), and a failed read never
fails the command."""

import dataclasses
import json
import math

import pytest

from wptool.driver import Machine
from wptool.engine import Request
from wptool.facts import FACT_NAMES, read_machine_facts
from wptool.simulator import SimulatedProber
from wptool.state import ToolState


def expected(sim: SimulatedProber) -> dict:
    """The facts as the simulator reports them now."""
    return {
        "waferMapDiePosition": {"colIndex": sim.col, "rowIndex": sim.row},
        "dieIndex": sim.die_index(sim.col, sim.row),
        "totalDiesNumber": sim.dies_number(),
        "chuckZPositionState": sim._hint(),
        "currentWorkingArea": sim.area.removesuffix("Camera"),
        "cameraMountPoint": sim.area,
        "x": sim.x,
        "y": sim.y,
        "z": sim.z,
        "errors": [],
    }


@pytest.fixture
def engine(mock_engine):
    return mock_engine


@pytest.fixture
def sim(engine):
    return engine.connection.simulator


def test_initialize_has_the_facts(engine, sim):
    reply = engine.execute(Request(command="Initialize"))
    assert reply.data["facts"] == expected(sim)
    assert reply.data["facts"] == {
        "waferMapDiePosition": {"colIndex": 0, "rowIndex": 0},
        "dieIndex": sim.die_index(0, 0),
        "totalDiesNumber": 180,
        "chuckZPositionState": "In Default",
        "currentWorkingArea": "OffAxis",
        "cameraMountPoint": "OffAxisCamera",
        "x": 1000.0,
        "y": -2000.0,
        "z": 9800.0,
        "errors": [],
    }
    assert list(reply.data["facts"]) == list(FACT_NAMES)


@pytest.mark.parametrize("command, params", [("LocalMode", {}), ("_Query", {}), ("_Move", {"x": 15, "y": -3}), ("Initialize", {})])
def test_every_machine_reply_has_the_facts_after_the_command(engine, sim, command, params):
    engine.execute(Request(command="Initialize"))
    sim.go_to_die(-3, 7)
    reply = engine.execute(Request(command=command, params=params))
    assert reply.ok, reply
    assert reply.data["facts"] == expected(sim)


def test_the_facts_of_a_move_are_those_after_it(engine, sim):
    engine.execute(Request(command="Initialize"))
    sim.move_chuck_wide()
    reply = engine.execute(Request(command="_Move", params={"x": 100, "y": 50, "position": "Zero"}))
    facts = reply.data["facts"]
    assert (facts["x"], facts["y"]) == (100.0, 50.0)
    assert facts["chuckZPositionState"] == "In Separation"
    assert facts["currentWorkingArea"] == facts["cameraMountPoint"] == "Probing"


def test_disconnect_and_shutdown_have_no_facts(engine):
    engine.execute(Request(command="Initialize"))
    assert "facts" not in engine.execute(Request(command="Disconnect")).data
    engine.execute(Request(command="Initialize"))
    assert "facts" not in engine.execute(Request(command="Shutdown")).data


def test_an_error_reply_has_no_facts(engine, sim):
    engine.execute(Request(command="Initialize"))
    sim.go_to_contact()
    reply = engine.execute(Request(command="_Move"))
    assert reply.data is None and reply.error["code"] == 409


def test_show_status_connected_reads_the_facts_live(engine, sim):
    engine.execute(Request(command="Initialize"))
    first = engine.execute(Request(command="ShowStatus")).data
    assert first["facts"] == expected(sim)
    assert first["message"].endswith(" | Machine: mock:0, connected | Chuck: In Default | Area: OffAxisCamera")
    # Somebody uses SENTIO's own screen: the next ShowStatus shows it.
    sim.move_chuck_wide()
    sim.go_to_contact()
    second = engine.execute(Request(command="ShowStatus")).data
    assert second["facts"]["chuckZPositionState"] == "In Contact"
    assert second["facts"]["cameraMountPoint"] == "Probing"
    assert second["message"].endswith("| Chuck: In Contact | Area: Probing")
    assert second["machine"] == {"address": "mock", "port": 0} and second["proberConnected"] is True


def test_show_status_not_connected_has_no_facts(engine, sim):
    data = engine.execute(Request(command="ShowStatus")).data
    assert "facts" not in data
    assert data["message"] == "Tool: wp-tool 0.1.0 | Machine: none, not connected"
    engine.execute(Request(command="Initialize"))
    engine.execute(Request(command="Disconnect"))
    data = engine.execute(Request(command="ShowStatus")).data
    assert "facts" not in data
    assert data["message"] == "Tool: wp-tool 0.1.0 | Machine: mock:0, not connected"
    assert sim.calls[-1] == ("disconnect", ())


def test_a_failed_query_gives_null_an_error_text_and_a_success(engine, sim):
    sim.fail_next("get_chuck_z", TimeoutError("no answer"))
    reply = engine.execute(Request(command="Initialize"))
    assert reply.ok
    facts = reply.data["facts"]
    assert facts["z"] is None
    assert facts["errors"] == ["get_chuck_z: no answer"]
    assert facts["x"] == sim.x and facts["chuckZPositionState"] == "In Default"


@pytest.mark.parametrize("command", ["Initialize", "LocalMode", "_Query", "_Move", "ShowStatus"])
def test_every_query_failing_still_gives_a_success(engine, sim, command):
    if command != "Initialize":
        engine.execute(Request(command="Initialize"))
    for name in ("get_current_index", "get_dies_number", "get_current_working_area", "get_chuck_xy", "get_chuck_z"):
        sim.fail_next(name, RuntimeError(f"{name} failed"))
    if command == "_Move":
        sim.position_text = "In Separation"
    else:
        sim.position_text = "Error: no answer"
    reply = engine.execute(Request(command=command))
    assert reply.ok, reply
    facts = reply.data["facts"]
    values = {name: facts[name] for name in FACT_NAMES if name != "errors"}
    if command == "_Move":
        assert values.pop("chuckZPositionState") == "In Separation"
    assert set(values.values()) == {None}
    assert len(facts["errors"]) == (5 if command == "_Move" else 6)
    if command != "_Move":
        assert "get_chuck_position: no answer" in facts["errors"]


def test_a_number_that_is_not_finite_is_null(engine, sim):
    sim.z = math.nan
    sim.x = math.inf
    reply = engine.execute(Request(command="Initialize"))
    assert reply.ok
    assert reply.data["facts"]["z"] is None and reply.data["facts"]["x"] is None and reply.data["facts"]["y"] is None
    assert len(reply.data["facts"]["errors"]) == 2
    json.dumps(reply.data, allow_nan=False)


def test_an_answer_that_cannot_be_read_is_null():
    class Odd:
        def __getattr__(self, name):
            return lambda *args: {"get_current_index": "Error, no map", "get_dies_number": "n/a", "get_chuck_xy": None}.get(name, "0")

    facts = read_machine_facts(Machine(Odd(), "192.0.2.10:35555"))
    assert facts["waferMapDiePosition"] is None and facts["dieIndex"] is None
    assert facts["totalDiesNumber"] is None
    assert facts["x"] is None and facts["y"] is None
    assert facts["z"] == 0.0
    assert len(facts["errors"]) == 3


def test_read_machine_facts_lets_ctrl_c_through():
    sim = SimulatedProber()
    sim.fail_next("get_chuck_z", KeyboardInterrupt())
    with pytest.raises(KeyboardInterrupt):
        read_machine_facts(Machine(sim.link(), "mock:0"))


def test_each_query_once_in_the_order_of_wpagent():
    sim = SimulatedProber()
    read_machine_facts(Machine(sim.link(), "mock:0"))
    assert [name for name, _ in sim.calls] == [
        "get_current_index", "get_dies_number", "get_chuck_position", "get_current_working_area", "get_chuck_xy", "get_chuck_z",
    ]


def test_the_facts_are_never_kept(engine, sim):
    for command in ("Initialize", "ShowStatus", "LocalMode", "_Move", "_Query", "Initialize", "Disconnect", "ShowStatus"):
        engine.execute(Request(command=command))
        # ToolState has only the connection, after any command.
        assert [field.name for field in dataclasses.fields(ToolState)] == ["machine", "proberConnected"]
        assert not hasattr(engine.state, "__dict__")
        assert set(engine.state.snapshot()) == {"machine", "proberConnected"}


def test_the_next_request_asks_the_machine_again(engine, sim):
    engine.execute(Request(command="Initialize"))
    sim.calls.clear()
    engine.execute(Request(command="LocalMode"))
    engine.execute(Request(command="LocalMode"))
    assert [name for name, _ in sim.calls].count("get_chuck_z") == 2

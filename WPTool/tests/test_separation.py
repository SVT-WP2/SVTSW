"""The separation check (D11): before every command with `moves_chuck`, on the simulator. Nothing switches it off."""

import pytest

from wptool.checks.separation import ALLOWED, ANY_AREA, check_separation
from wptool.driver import Machine
from wptool.engine import Request
from wptool.replies import ToolError
from wptool.simulator import SimulatedProber


@pytest.fixture
def engine(mock_engine):
    assert mock_engine.execute(Request(command="Initialize")).ok
    mock_engine.connection.simulator.calls.clear()
    return mock_engine


@pytest.fixture
def sim(engine):
    return engine.connection.simulator


def move(engine, **params):
    return engine.execute(Request(command="_Move", params={"x": 10, "y": 0, "position": "Relative", **params}))


def moves(sim):
    return [call for call in sim.calls if call[0].startswith("move_chuck")]


def test_the_allowed_pairs():
    # Confirmed or corrected by the run on WPMIT; a pair is added only from that run.
    assert ALLOWED == {("In Separation", ANY_AREA), ("In Default", "OffAxisCamera")}


# Allowed


def test_in_default_in_the_off_axis_area(engine, sim):
    # The start of the simulator, as WPMIT reports it there.
    reply = move(engine)
    assert reply.ok, reply
    assert sim.calls[:3] == [("get_chuck_position", ()), ("get_current_working_area", ()), ("move_chuck_xy", (10.0, 0.0, "Relative"))]


def test_in_separation_in_probing(engine, sim):
    sim.move_chuck_wide()
    sim.calls.clear()
    assert move(engine).ok
    # In Separation is allowed in any area: the area is not asked.
    assert sim.calls[:2] == [("get_chuck_position", ()), ("move_chuck_xy", (10.0, 0.0, "Relative"))]


def test_in_separation_in_the_off_axis_area(engine, sim):
    sim.position_text = "In Separation"
    assert sim.get_current_working_area() == "OffAxisCamera"
    assert move(engine).ok


def test_in_separation_in_an_area_of_no_table(engine, sim):
    sim.position_text = "In Separation"
    sim.area = "FrontLoad"
    assert move(engine).ok


# Refused


def test_in_default_in_probing_is_409(engine, sim):
    sim.move_chuck_wide()
    sim.position_text = "In Default"
    sim.calls.clear()
    reply = move(engine)
    assert reply.error == {
        "code": 409,
        "message": "The chuck is not in separation (SENTIO reports 'In Default' in Probing): run MoveChuckSeparation first",
    }
    assert moves(sim) == []


def test_in_default_after_a_z_move_in_probing_is_409(engine, sim):
    sim.move_chuck_wide()
    sim.move_chuck_z(5000.0)
    sim.calls.clear()
    assert move(engine).error["code"] == 409
    assert moves(sim) == []


def test_at_contact_is_409(engine, sim):
    sim.move_chuck_wide()
    sim.go_to_contact()
    sim.calls.clear()
    reply = move(engine)
    assert reply.error == {
        "code": 409,
        "message": "The chuck is not in separation (SENTIO reports 'In Contact'): run MoveChuckSeparation first",
    }
    # The hint alone decides: the area is not asked. Then the machine is given back.
    assert sim.calls == [("get_chuck_position", ()), ("local_mode", ())]


@pytest.mark.parametrize("hint", ["In Hover", "In Lift", "In Transfer", "In Overtravel", "In 3.0", "In separation", "Separation", ""])
def test_another_value_is_409(engine, sim, hint):
    sim.position_text = hint
    reply = move(engine)
    assert reply.error["code"] == 409
    assert f"SENTIO reports '{hint}'" in reply.error["message"]
    assert moves(sim) == []


@pytest.mark.parametrize("area", ["Probing", "FrontLoad", "SideLoad", "Offaxis", "OffAxis", ""])
def test_in_default_in_any_other_area_is_409(engine, sim, area):
    sim.area = area
    sim.position_text = "In Default"
    reply = move(engine)
    assert reply.error["code"] == 409
    assert moves(sim) == []


def test_an_error_text_of_the_query_is_503(engine, sim):
    sim.position_text = "Error: socket timed out"
    reply = move(engine)
    assert reply.error == {"code": 503, "message": "No answer from the machine to the position query: socket timed out"}
    assert moves(sim) == []


def test_an_exception_of_the_query_is_503(engine, sim):
    sim.fail_next("get_chuck_position", TimeoutError("no answer in 30 s"))
    reply = move(engine)
    assert reply.error == {"code": 503, "message": "No answer from the machine to the position query: no answer in 30 s"}
    assert moves(sim) == []


def test_an_error_of_the_area_query_is_503(engine, sim):
    sim.fail_next("get_current_working_area", ConnectionResetError("reset"))
    reply = move(engine)
    assert reply.error == {"code": 503, "message": "No answer from the machine to the position query: reset"}
    assert moves(sim) == []


def test_without_a_connection_the_503_of_the_connection_comes_first(mock_engine):
    reply = mock_engine.execute(Request(command="_Move"))
    assert reply.error == {"code": 503, "message": "Not connected to a machine: run Initialize first"}
    assert mock_engine.connection.simulator.calls == []


def test_at_contact_then_initialize_force_then_a_move_is_409(engine, sim):
    # The same simulator after the reconnect: a real machine stays at contact.
    sim.move_chuck_wide()
    sim.go_to_contact()
    assert engine.execute(Request(command="Initialize", params={"force": True})).ok
    sim.calls.clear()
    assert move(engine).error["code"] == 409
    assert moves(sim) == []


def test_a_refusal_does_not_block_the_tool(engine, sim):
    sim.go_to_contact()
    assert move(engine).error["code"] == 409
    sim.go_to_separation()
    assert move(engine).ok


def test_commands_without_moves_chuck_get_no_check(engine, sim):
    sim.go_to_contact()
    for command in ("LocalMode", "_Query", "ShowStatus", "Initialize", "Disconnect"):
        assert engine.execute(Request(command=command)).ok, command


def test_nothing_switches_it_off(engine, sim):
    sim.go_to_contact()
    for params in ({"force": True}, {"user": "someone"}, {"waferAgentName": "machine-1"}):
        reply = engine.execute(Request(command="_Move", params=params, context={"check": False}))
        assert reply.error["code"] in (400, 409), params
    assert moves(sim) == []


def test_the_check_alone():
    sim = SimulatedProber()
    machine = Machine(sim.link(), "mock:0")
    check_separation(machine)
    sim.go_to_contact()
    with pytest.raises(ToolError) as e:
        check_separation(machine)
    assert e.value.code == 409

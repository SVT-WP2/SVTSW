"""The driver layer: the reading of each text answer, the references of an XY move, the "touched" mark, the log, and
the rule that no command reaches the SENTIO library object (D19)."""

import logging
import re
from pathlib import Path

import pytest

from wptool.driver import Machine, MachineError
from wptool.simulator import SimulatedProber


class Answers:
    """A driver that gives fixed answers and records the calls."""

    def __init__(self, **answers):
        self.answers = answers
        self.calls = []

    def __getattr__(self, name):
        def method(*args):
            self.calls.append((name, args))
            answer = self.answers.get(name)
            if isinstance(answer, BaseException):
                raise answer
            return answer

        return method


def machine_with(**answers):
    driver = Answers(**answers)
    return Machine(driver, "192.0.2.10:35555"), driver


@pytest.mark.parametrize(
    "method, answer, value",
    [
        ("get_current_index", "46,-1,1", (46, -1, 1)),
        ("get_current_index", "3,0,2,0", (3, 0, 2)),  # WPAgent's mock gives a fourth part
        ("get_dies_number", "180", 180),  # the SENTIO driver: str() of the library's int
        ("get_dies_number", "100,100,0", 100),  # WPAgent's mock: "total,good,bad"
        ("get_chuck_position", "In Separation", "In Separation"),
        ("get_chuck_position", " In Default ", "In Default"),
        ("get_current_working_area", "OffAxisCamera", "OffAxisCamera"),
        ("get_chuck_xy", (1000, -2000.5), (1000.0, -2000.5)),
        ("get_chuck_z", 9800, 9800.0),
        ("get_contact_height", "10000.0", 10000.0),
        ("auto_focus", 15300, 15300.0),
        ("is_alive", True, True),
    ],
)
def test_the_answers_become_python_values(method, answer, value):
    machine, _ = machine_with(**{method: answer})
    result = getattr(machine, method)()
    assert result == value
    assert type(result) is type(value)
    if isinstance(value, tuple):
        assert [type(v) for v in result] == [type(v) for v in value]


@pytest.mark.parametrize(
    "method, answer",
    [
        ("get_current_index", "46,1"),
        ("get_current_index", "Error"),
        ("get_dies_number", "many"),
        ("get_chuck_xy", (1.0,)),
        ("get_chuck_xy", None),
        ("get_chuck_z", "high"),
        ("auto_focus", None),
    ],
)
def test_an_answer_that_cannot_be_read_is_a_machine_error(method, answer, caplog):
    caplog.set_level(logging.WARNING, logger="wptool.machine")
    machine, _ = machine_with(**{method: answer})
    with pytest.raises(MachineError, match=f"^{method} gave an answer that cannot be read"):
        getattr(machine, method)()
    assert any("cannot be read" in r.getMessage() for r in caplog.records)


def test_the_error_text_of_the_position_query_is_a_machine_error():
    machine, _ = machine_with(get_chuck_position="Error: socket timed out")
    with pytest.raises(MachineError) as e:
        machine.get_chuck_position()
    assert str(e.value) == "socket timed out"


def test_the_moves_give_python_values():
    machine, driver = machine_with(move_chuck_xy=(15, 0), move_chuck_z=9000)
    assert machine.move_chuck_xy(15, 0, "Relative") == (15.0, 0.0)
    assert machine.move_chuck_z(9000) == 9000.0
    machine, _ = machine_with()
    assert machine.move_chuck_xy(1, 1, "Zero") is None
    assert machine.move_chuck_z(1) is None


@pytest.mark.parametrize("reference", ["Zero", "Relative", "Center"])
def test_the_three_references(reference):
    machine, driver = machine_with(move_chuck_xy=(1.0, 2.0))
    machine.move_chuck_xy(1.0, 2.0, reference)
    assert driver.calls == [("move_chuck_xy", (1.0, 2.0, reference))]


@pytest.mark.parametrize("reference", ["Home", "User", "relative", "", None])
def test_another_reference_is_a_value_error_and_nothing_is_sent(reference):
    machine, driver = machine_with()
    with pytest.raises(ValueError, match="Unknown reference"):
        machine.move_chuck_xy(1.0, 2.0, reference)
    assert driver.calls == []
    assert machine.touched is False


def test_any_call_marks_the_machine_touched():
    for name in ("is_alive", "local_mode", "get_chuck_position", "move_chuck_wide", "disconnect"):
        machine, _ = machine_with(get_chuck_position="In Default", is_alive=True)
        assert machine.touched is False
        getattr(machine, name)()
        assert machine.touched is True, name


def test_a_failed_call_marks_the_machine_touched_too():
    machine, _ = machine_with(go_to_contact=RuntimeError("no"))
    with pytest.raises(RuntimeError):
        machine.go_to_contact()
    assert machine.touched is True


def test_every_call_is_logged_at_debug_and_its_error_at_warning(caplog):
    caplog.set_level(logging.DEBUG, logger="wptool.machine")
    machine, _ = machine_with(open_project=None, go_to_die=RuntimeError("die (9, 9) is not on the map"))
    machine.open_project("ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW")
    machine.move_chuck_xy(15, 0.5, "Relative")
    with pytest.raises(RuntimeError):
        machine.go_to_die(9, 9)
    lines = [(r.levelname, r.getMessage()) for r in caplog.records if r.name == "wptool.machine"]
    assert lines == [
        ("DEBUG", "machine: open_project('ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW')"),
        ("DEBUG", "machine: move_chuck_xy(15, 0.5, 'Relative')"),
        ("DEBUG", "machine: go_to_die(9, 9)"),
        ("WARNING", "machine: go_to_die(9, 9) failed: die (9, 9) is not on the map"),
    ]


def test_the_layer_on_the_simulator():
    sim = SimulatedProber()
    machine = Machine(sim.link(), "mock:0")
    assert machine.get_current_index() == (sim.die_index(0, 0), 0, 0)
    assert machine.get_dies_number() == sim.dies_number()
    machine.go_to_die(-4, 11)
    assert machine.get_current_index()[1:] == (-4, 11)
    assert machine.get_chuck_position() == "In Default"
    assert machine.get_current_working_area() == "OffAxisCamera"
    assert machine.move_chuck_xy(10, 0, "Relative") == (sim.x, sim.y)


def test_no_command_reaches_the_sentio_library_object():
    """D19: only the driver layer holds the driver, and nothing in the tool uses `.prober`."""
    package = Path(__file__).parent.parent / "wptool"
    for path in package.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        # Not in code; a mention in a text has backticks: `.prober`.
        assert not re.search(r"(?<!`)\.prober\b", text), f"{path.name} uses .prober"
        if path.name != "driver.py":
            assert not re.search(r"\._driver\b", text), f"{path.name} reaches the driver behind the layer"

"""The state of the tool is the connection only (D10)."""

import dataclasses

import pytest

from wptool.state import ToolState, connection_text

D10 = (
    "ToolState keeps only the connection: machine and proberConnected (D10, every request is independent). "
    "A new field is a change of design: ask on the ticket first, and change this test only with that decision."
)


def test_the_fields_are_the_connection_only():
    assert [field.name for field in dataclasses.fields(ToolState)] == ["machine", "proberConnected"], D10


def test_no_other_attribute_can_be_kept():
    # Not even one that a method sets (self.lastProject = ...): the state has slots and no __dict__.
    state = ToolState()
    assert not hasattr(state, "__dict__"), D10
    try:
        state.lastProject = "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
    except AttributeError:
        pass
    else:
        pytest.fail(D10)
    state.machine = {"address": "192.0.2.10", "port": 35555}
    state.proberConnected = True


def test_the_start():
    state = ToolState()
    assert state.machine is None
    assert state.proberConnected is False
    assert state.snapshot() == {"machine": None, "proberConnected": False}


def test_the_snapshot_is_a_copy():
    state = ToolState(machine={"address": "192.0.2.10", "port": 35555}, proberConnected=True)
    snapshot = state.snapshot()
    assert snapshot == {"machine": {"address": "192.0.2.10", "port": 35555}, "proberConnected": True}
    snapshot["machine"]["port"] = 1
    assert state.machine["port"] == 35555


def test_the_connection_for_people():
    assert connection_text(ToolState().snapshot()) == "none, not connected"
    connected = ToolState(machine={"address": "192.0.2.10", "port": 35555}, proberConnected=True)
    assert connection_text(connected.snapshot()) == "192.0.2.10:35555, connected"
    # After a Disconnect (#408) the machine of the last Initialize stays.
    assert connection_text({"machine": {"address": "mock", "port": 0}, "proberConnected": False}) == "mock:0, not connected"

"""The simulator (D19): the SENTIO semantics, the tables, the die map, the test hooks, and the return formats of the
shared SENTIO driver."""

import pytest

import fake_sentio
from wptool import simulator
from wptool.simulator import (
    AREA_AFTER,
    CENTER_XY,
    HINT_AT_CONTACT,
    HINT_SEPARATED,
    HOME_XY,
    METHODS,
    SimulatedProber,
    SimulatorError,
    map_die_range,
)


@pytest.fixture
def sim():
    return SimulatedProber()


# XY moves


def test_zero_sets_relative_adds_center_is_the_center_plus_xy(sim):
    assert sim.move_chuck_xy(100, -50, "Zero") == (100.0, -50.0)
    assert sim.move_chuck_xy(15, 0, "Relative") == (115.0, -50.0)
    assert sim.move_chuck_xy(-3.5, 2, "Relative") == (111.5, -48.0)
    # SENTIO's Center reference: MoveChuckSafePosition sends (37500, 160000, "Center").
    assert sim.move_chuck_xy(37500, 160000, "Center") == (CENTER_XY[0] + 37500, CENTER_XY[1] + 160000)
    sim.center_xy = (10.0, 20.0)
    assert sim.move_chuck_xy(1, 2, "Center") == (11.0, 22.0)
    assert sim.get_chuck_xy() == (11.0, 22.0)


def test_another_reference_is_refused(sim):
    with pytest.raises(SimulatorError):
        sim.move_chuck_xy(1, 1, "Home")
    assert sim.get_chuck_xy() == HOME_XY


def test_move_error_is_added_to_every_xy_move(sim):
    sim.move_error_um = (1.5, -0.5)
    assert sim.move_chuck_xy(0, 0, "Zero") == (1.5, -0.5)
    assert sim.move_chuck_xy(10, 10, "Relative") == (13.0, 9.0)
    assert sim.move_chuck_xy(0, 0, "Center") == (1.5, -0.5)


def test_center_and_home_set_positions_that_tests_can_read(sim):
    sim.move_chuck_xy(500, 500, "Zero")
    sim.move_chuck_center()
    assert sim.get_chuck_xy() == sim.center_xy == CENTER_XY
    sim.move_chuck_home()
    assert sim.get_chuck_xy() == sim.home_xy == HOME_XY
    assert HOME_XY != CENTER_XY


# Work area and Z hint


def test_the_start_is_separated_in_the_off_axis_area(sim):
    assert sim.get_current_working_area() == "OffAxisCamera"
    # What WPMIT reports there (D11): the pair that production relies on.
    assert sim.get_chuck_position() == "In Default"


def test_the_work_area_after_each_move(sim):
    sim.move_chuck_wide()
    assert sim.get_current_working_area() == "Probing"
    sim.move_chuck_offaxis_area()
    assert sim.get_current_working_area() == "OffAxisCamera"
    sim.move_chuck_center()
    assert sim.get_current_working_area() == "Probing"
    sim.move_chuck_offaxis_area()
    sim.move_chuck_home()
    assert sim.get_current_working_area() == "Probing"


def test_the_tables_in_one_place():
    # The run on WPMIT corrects these values here.
    assert AREA_AFTER == {
        "move_chuck_offaxis_area": "OffAxisCamera",
        "move_chuck_wide": "Probing",
        "move_chuck_center": "Probing",
        "move_chuck_home": "Probing",
    }
    assert HINT_SEPARATED == {"OffAxisCamera": "In Default", "Probing": "In Separation"}
    assert HINT_AT_CONTACT == "In Contact"


def test_the_z_hint_by_work_area_and_at_contact(sim):
    assert sim.get_chuck_position() == "In Default"
    sim.move_chuck_wide()
    assert sim.get_chuck_position() == "In Separation"
    sim.go_to_contact()
    assert sim.get_chuck_position() == "In Contact"
    sim.go_to_separation()
    assert sim.get_chuck_position() == "In Separation"
    sim.move_chuck_offaxis_area()
    assert sim.get_chuck_position() == "In Default"


def test_contact_and_separation_heights(sim):
    separated = sim.get_chuck_z()
    sim.go_to_contact()
    assert sim.get_chuck_z() == sim.contact_height == sim.get_contact_height()
    sim.go_to_separation()
    assert sim.get_chuck_z() == separated == sim.contact_height - sim.separation_gap
    # The overtravel is added at contact when it is on.
    sim.set_overtravel(25.0)
    sim.enable_overtravel(True)
    sim.go_to_contact()
    assert sim.get_chuck_z() == sim.contact_height + 25.0
    sim.go_to_separation()
    sim.set_contact_height(12000.0)
    assert sim.get_contact_height() == 12000.0
    # The contact height is a setting: the chuck does not move.
    assert sim.get_chuck_z() == separated


def test_a_z_move_is_a_height_without_a_name(sim):
    sim.move_chuck_wide()
    assert sim.move_chuck_z(5000.0) == 5000.0
    assert sim.get_chuck_z() == 5000.0
    assert sim.get_chuck_position() == "In Default"
    sim.go_to_separation()
    assert sim.get_chuck_position() == "In Separation"


def test_a_test_can_set_any_other_text(sim):
    sim.position_text = "In Hover"
    assert sim.get_chuck_position() == "In Hover"
    sim.position_text = "Error: no answer"
    assert sim.get_chuck_position() == "Error: no answer"
    sim.position_text = None
    assert sim.get_chuck_position() == "In Default"


# The die map


def test_the_die_range_covers_both_map_files_widened_by_2():
    # Columns -4 to 1 and rows -2 to 11 in the two map files of the shared package today.
    assert map_die_range() == (-6, 3, -4, 13)
    sim = SimulatedProber()
    assert (sim.col_min, sim.col_max, sim.row_min, sim.row_max) == (-6, 3, -4, 13)
    assert sim.get_dies_number() == str(10 * 18)


def test_without_the_shared_package_the_range_is_minus_5_to_5(monkeypatch):
    monkeypatch.setattr(simulator, "MAP_PACKAGE", "svt_wp_core_is_not_installed")
    assert map_die_range() == (-5, 5, -5, 5)
    assert SimulatedProber().get_dies_number() == "121"


def test_die_moves_with_negative_indices(sim):
    assert sim.get_current_index() == f"{sim.die_index(0, 0)},0,0"
    assert sim.go_to_die(-4, -2) == (-4, -2, 0)
    assert sim.get_current_index() == f"{sim.die_index(-4, -2)},-4,-2"
    assert sim.get_chuck_xy() == (HOME_XY[0] - 4 * sim.die_pitch_um[0], HOME_XY[1] - 2 * sim.die_pitch_um[1])
    sim.align_wafer(-1, 1, 0)
    assert sim.get_current_index().endswith(",-1,1")
    assert sim.aligned
    # The index counts the dies of the map, one by one.
    assert sim.die_index(sim.col_min, sim.row_min) == 0
    assert sim.die_index(sim.col_max, sim.row_max) == sim.dies_number() - 1


@pytest.mark.parametrize("col, row", [(-7, 0), (4, 0), (0, -5), (0, 14)])
def test_a_die_outside_the_range_raises(sim, col, row):
    with pytest.raises(SimulatorError, match="not on the wafer map"):
        sim.go_to_die(col, row)
    with pytest.raises(SimulatorError):
        sim.align_wafer(col, row)
    assert sim.get_current_index() == f"{sim.die_index(0, 0)},0,0"


# Project, PTPA, focus, home


def test_project_ptpa_and_overtravel(sim):
    sim.open_project("ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW")
    assert sim.project == "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
    sim.set_ptpa(True)
    assert sim.ptpa_enabled is True
    sim.set_ptpa(False)
    assert sim.ptpa_enabled is False
    sim.set_overtravel(30.0)
    sim.enable_overtravel(False)
    assert (sim.overtravel_gap, sim.overtravel_enabled) == (30.0, False)


def test_auto_focus_returns_a_value(sim):
    assert sim.auto_focus() == 15300.0
    sim.focus_um = 15000
    assert sim.auto_focus() == 15000.0


@pytest.mark.parametrize("method, shift", [("run_ptpa", "ptpa_shift_um"), ("find_home", "find_home_shift_um")])
def test_ptpa_and_find_home_change_xy_and_the_contact_height(sim, method, shift):
    before = (*sim.get_chuck_xy(), sim.get_contact_height())
    getattr(sim, method)()
    dx, dy, dz = getattr(sim, shift)
    after = (*sim.get_chuck_xy(), sim.get_contact_height())
    assert after == pytest.approx((before[0] + dx, before[1] + dy, before[2] + dz))
    assert after != before
    setattr(sim, shift, (1.0, 2.0, 3.0))
    getattr(sim, method)()
    assert (*sim.get_chuck_xy(), sim.get_contact_height()) == pytest.approx((after[0] + 1, after[1] + 2, after[2] + 3))


# The test hooks


def test_fail_next_raises_once(sim):
    sim.fail_next("get_chuck_z", TimeoutError("no answer"))
    with pytest.raises(TimeoutError, match="no answer"):
        sim.get_chuck_z()
    assert sim.get_chuck_z() == sim.z
    with pytest.raises(ValueError):
        sim.fail_next("no_such_method", RuntimeError())


def test_a_failed_call_is_recorded_and_changes_nothing(sim):
    sim.fail_next("move_chuck_xy", RuntimeError("refused"))
    with pytest.raises(RuntimeError):
        sim.move_chuck_xy(100, 0, "Zero")
    assert sim.calls == [("move_chuck_xy", (100, 0, "Zero"))]
    assert sim.get_chuck_xy() == HOME_XY


def test_calls_in_order(sim):
    link = sim.link()
    link.get_chuck_position()
    link.move_chuck_xy(15, 0, "Relative")
    link.local_mode()
    link.is_alive()
    link.disconnect()
    assert sim.calls == [
        ("get_chuck_position", ()),
        ("move_chuck_xy", (15, 0, "Relative")),
        ("local_mode", ()),
        ("is_alive", ()),
        ("disconnect", ()),
    ]
    assert sim.local_mode_calls == 1


def test_a_link_is_one_connection_and_the_machine_keeps_its_state(sim):
    first = sim.link()
    first.go_to_contact()
    assert first.is_alive() is True
    first.disconnect()
    assert first.is_alive() is False
    first.disconnect()  # safe twice, as the SENTIO driver
    with pytest.raises(ConnectionError):
        first.get_chuck_position()
    second = sim.link()
    # A real machine keeps its state: still at contact.
    assert second.is_alive() is True
    assert second.get_chuck_position() == "In Contact"
    assert first.connected is False and second.connected is True
    with pytest.raises(AttributeError):
        getattr(second, "prober")  # the simulator has no SENTIO library object


# The return formats of the shared SENTIO driver


QUERIES = [
    ("get_current_index", ()),
    ("get_dies_number", ()),
    ("get_chuck_position", ()),
    ("get_current_working_area", ()),
    ("get_chuck_xy", ()),
    ("get_chuck_z", ()),
    ("get_contact_height", ()),
    ("auto_focus", ()),
    ("move_chuck_xy", (15.0, 0.0, "Relative")),
    ("move_chuck_z", (9000.0,)),
]
# The calls whose value the SENTIO driver does not return (None). set_ptpa returns the library's response there,
# which the driver layer does not use; the simulator returns None.
NO_VALUE = [
    ("local_mode", ()),
    ("open_project", ("ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW",)),
    ("move_chuck_center", ()),
    ("move_chuck_home", ()),
    ("move_chuck_offaxis_area", ()),
    ("move_chuck_wide", ()),
    ("go_to_contact", ()),
    ("go_to_separation", ()),
    ("find_home", ()),
    ("align_wafer", (-1, 1, 0)),
    ("run_ptpa", ()),
    ("set_contact_height", (10000.0,)),
    ("set_overtravel", (20.0,)),
    ("enable_overtravel", (True,)),
]


def _shape(value):
    if isinstance(value, tuple):
        return ("tuple", tuple(_shape(item) for item in value))
    return type(value).__name__


@pytest.fixture
def sentio(monkeypatch):
    impl, library = fake_sentio.install(monkeypatch)
    return impl("192.0.2.10:35555"), library


@pytest.mark.parametrize("method, args", QUERIES)
def test_the_return_formats_equal_those_of_the_sentio_driver(sim, sentio, method, args):
    driver, _ = sentio
    assert _shape(getattr(sim, method)(*args)) == _shape(getattr(driver, method)(*args))


def test_the_text_answers_have_the_same_form(sim, sentio):
    driver, library = sentio
    # "index,col,row", "n" (the library gives the number of dies as an int, the driver makes it a text).
    assert driver.get_current_index().count(",") == sim.get_current_index().count(",") == 2
    assert driver.get_dies_number() == "180" and sim.get_dies_number().isdigit()
    assert driver.get_chuck_position() == "In Separation"
    library.answers.z_position_hint = "Default"
    assert driver.get_chuck_position() == sim.get_chuck_position() == "In Default"


@pytest.mark.parametrize("method, args", NO_VALUE)
def test_the_calls_without_a_value(sim, sentio, method, args):
    driver, _ = sentio
    assert getattr(driver, method)(*args) is None
    assert getattr(sim, method)(*args) is None


def test_go_to_die_gives_col_row_site_as_the_library(sim, sentio):
    driver, _ = sentio
    assert _shape(driver.go_to_die(-1, 1)) == _shape(sim.go_to_die(-1, 1)) == ("tuple", ("int", "int", "int"))


def test_the_simulator_has_every_method_of_the_driver_layer_with_the_same_arguments(sentio):
    import inspect

    driver, _ = sentio
    for name in METHODS:
        mine = list(inspect.signature(getattr(SimulatedProber, name)).parameters)
        theirs = list(inspect.signature(getattr(type(driver), name)).parameters)
        assert mine == theirs, name
    for name in ("is_alive", "disconnect"):
        assert hasattr(type(driver), name) and hasattr(simulator.SimulatorLink, name)

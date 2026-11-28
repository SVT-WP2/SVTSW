"""What the shared SENTIO driver sends to the SENTIO library, for each method that the driver layer uses. No network.

The library is replaced by a recording fake (`fake_sentio`, through `sys.modules`). The expected calls are those of the
column "SENTIO" of the inventory, part B3, sections D.1 and D.2. This documents the production driver; it changes
nothing in it.
"""

import pytest

import fake_sentio
from fake_sentio import ChuckSite, ChuckXYReference, ChuckZReference, DieNumber, WorkArea
from wptool.checks.separation import ALLOWED, ANY_AREA
from wptool.driver import Machine, MachineError

try:
    # The real library (the extra sentio of the shared package), read before a test puts the fake in its place.
    from sentio_prober_control.Sentio.Enumerations import ZPositionHint
except ImportError:
    ZPositionHint = None


@pytest.fixture
def fake(monkeypatch):
    impl, library = fake_sentio.install(monkeypatch)
    driver = impl("192.0.2.10:35555")
    library.calls.clear()
    return Machine(driver, "192.0.2.10:35555"), library


def test_the_driver_connects_with_tcpip_and_the_address(monkeypatch):
    impl, library = fake_sentio.install(monkeypatch)
    impl("192.0.2.10:35555")
    assert library.calls == [("create_prober", ("tcpip", "192.0.2.10:35555"))]


# (layer method, its arguments, the library calls in order: D.1 and D.2 of the inventory)
CALLS = [
    ("disconnect", (), [("comm.disconnect", ())]),  # sends no command
    ("is_alive", (), []),  # sends nothing (no socket in the fake: "alive")
    ("local_mode", (), [("local_mode", ())]),
    ("open_project", ("ER2B_babyMOSAIX",), [("open_project", ("ER2B_babyMOSAIX", True))]),
    ("move_chuck_xy", (15.0, 0.0, "Relative"), [("move_chuck_xy", (ChuckXYReference.Relative, 15.0, 0.0))]),
    ("move_chuck_xy", (1.0, 2.0, "Zero"), [("move_chuck_xy", (ChuckXYReference.Zero, 1.0, 2.0))]),
    ("move_chuck_xy", (37500.0, 160000.0, "Center"), [("move_chuck_xy", (ChuckXYReference.Center, 37500.0, 160000.0))]),
    ("move_chuck_z", (9000.0,), [("move_chuck_z", (ChuckZReference.Zero, 9000.0))]),
    ("move_chuck_center", (), [("send_cmd", ("move_chuck_center",))]),
    ("move_chuck_home", (), [("move_chuck_home", ())]),
    ("move_chuck_offaxis_area", (), [("move_chuck_work_area", (WorkArea.Offaxis,))]),
    ("move_chuck_wide", (), [("move_chuck_work_area", (WorkArea.Probing,))]),
    ("go_to_contact", (), [("move_chuck_contact", ())]),
    ("go_to_separation", (), [("move_chuck_separation", ())]),
    ("go_to_die", (-1, 1), [("map.step_die", (-1, 1, 0))]),
    ("find_home", (), [("vision.find_home", ())]),
    ("auto_focus", (), [("vision.auto_focus", ())]),
    ("align_wafer", (-1, 1, 0), [("map.step_die", (-1, 1, 0)), ("vision.align_wafer", ())]),
    (
        "run_ptpa",
        (),
        [("send_cmd", ("vis:compensation:start_execute OffAxis, BothWithProbeTips",)), ("wait_complete", (7,))],
    ),
    ("set_ptpa", (True,), [("send_cmd", ("vis:compensation:enable Both, True",))]),
    ("set_ptpa", (False,), [("send_cmd", ("vis:compensation:enable Both, False",))]),
    ("get_contact_height", (), [("get_chuck_site_height", (ChuckSite.Wafer,))]),
    ("set_contact_height", (10050.0,), [("send_cmd", ("set_chuck_site_heights Wafer,Contact,10050.0",))]),
    ("set_overtravel", (20.0,), [("send_cmd", ("set_chuck_overtravel_gap 20.0",))]),
    ("enable_overtravel", (True,), [("enable_chuck_overtravel", (True,))]),
    ("get_chuck_xy", (), [("get_chuck_xy", (ChuckSite.Wafer, ChuckXYReference.Zero))]),
    ("get_chuck_z", (), [("get_chuck_z", (ChuckZReference.Zero,))]),
    ("get_chuck_position", (), [("status.get_prop", ("Z_Position_Hint", "chuck"))]),
    ("get_current_working_area", (), [("send_cmd", ("get_chuck_position_hint",))]),
    ("get_current_index", (), [("send_cmd", ("map:die:get_current_index",))]),
    ("get_dies_number", (), [("map.get_num_dies", (DieNumber.Selected,))]),
]


@pytest.mark.parametrize("method, args, expected", CALLS, ids=[f"{c[0]}{c[1]}" for c in CALLS])
def test_the_library_calls_of_each_method(fake, method, args, expected):
    machine, library = fake
    getattr(machine, method)(*args)
    assert library.calls == expected


def test_every_method_of_the_layer_is_documented():
    layer = {name for name in vars(Machine) if not name.startswith("_")}
    assert layer == {call[0] for call in CALLS}


def test_the_answers_through_the_layer(fake):
    machine, library = fake
    assert machine.get_current_index() == (46, 0, 0)
    assert machine.get_dies_number() == 180
    assert machine.get_chuck_position() == "In Separation"
    assert machine.get_current_working_area() == "OffAxisCamera"
    assert machine.get_chuck_xy() == (1000.0, -2000.0)
    assert machine.get_chuck_z() == 9800.0
    assert machine.get_contact_height() == 10000.0
    assert machine.auto_focus() == 15300.0
    assert machine.move_chuck_xy(15, 0, "Relative") == (15.0, 0.0)
    assert machine.is_alive() is True


def test_a_failed_position_query_is_the_text_error(fake):
    machine, library = fake
    library.answers.z_position_hint = TimeoutError("timed out")
    assert machine._driver.get_chuck_position() == "Error: timed out"
    # The layer turns it into an error.
    with pytest.raises(MachineError, match="^timed out$"):
        machine.get_chuck_position()


def test_another_reference_reaches_the_library_as_none(fake):
    # Why the layer refuses it (test_driver_layer.py): the SENTIO driver passes None.
    machine, library = fake
    with pytest.raises(AttributeError):
        machine._driver.move_chuck_xy(1.0, 1.0, "Home")
    assert library.calls == [("move_chuck_xy", (None, 1.0, 1.0))]


def test_the_z_hints_of_the_library_and_the_separation_check(fake):
    """Every value of ZPositionHint in sentio-prober-control 24.4.0, as the driver gives it.

    A new value in another version fails here: decide whether it means separation (only from a run on WPMIT).
    """
    if ZPositionHint is None:
        pytest.skip("the real SENTIO library is not installed (pip install -r requirements.txt)")
    machine, library = fake
    seen = {}
    for hint in ZPositionHint:
        library.answers.z_position_hint = hint.toSentioAbbr()
        seen[hint.toSentioAbbr()] = machine.get_chuck_position()
    assert seen == {
        "Default": "In Default",
        "Contact": "In Contact",
        "Hover": "In Hover",
        "Separation": "In Separation",
        "Lift": "In Lift",
        "Transfer": "In Transfer",
    }
    allowed_hints = {hint for hint, _ in ALLOWED}
    # Only these two are ever allowed; Hover, Lift, Transfer and Contact stay refused.
    assert allowed_hints == {"In Separation", "In Default"}
    assert ("In Separation", ANY_AREA) in ALLOWED
    assert ("In Default", ANY_AREA) not in ALLOWED


@pytest.mark.parametrize("answer, hint", [("Contact", "In Contact"), ("OverContact", "In Contact"), ("sep", "In Separation"), (3.0, "In 3.0")])
def test_how_the_driver_maps_other_answers(fake, answer, hint):
    # WPSentioProber.py lines 309-317: a text with "contact" is In Contact, one with "sep" is In Separation. The
    # library's get_prop gives a number as a float when the answer reads as one.
    machine, library = fake
    library.answers.z_position_hint = answer
    assert machine.get_chuck_position() == hint

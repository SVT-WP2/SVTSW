"""

Unit tests for actions/WPTestingActions.py
Covers the main hardware-command functions using MockProberImpl.

Strategy
--------
* All action functions are decorated with @validate_command, which needs
  a logged-in user and a permissive state machine state.
* UsedByDeveloper state bypasses all state-machine checks.
* _ensure_initialized() is patched to return None ("ready") so tests
  don't need a real hardware factory.
* get_current_prober() is patched to return a real MockProberImpl.
* The root conftest stubs drivers.WPFactory, so we always patch at the
  use-site inside actions.WPTestingActions.
"""

import pytest
from unittest.mock import patch, MagicMock
import actions.WPTestingActions  # ensure submodule registers on the 'actions' package so patch() can resolve it

# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def developer_logged_in(globals_instance):
    """Log in a developer so @validate_command always passes."""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
    from stateMachine.WpAgentStateMachine import WPAgentState

    globals_instance.wpAgentName = "TestAgent"
    globals_instance.set_user("user1", "Developer")
    agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
    yield
    agentStateMachine.force_state(WPAgentState.ServiceOn)


@pytest.fixture
def prober():
    """
    Provide a fresh MockProberImpl and wire it into WPTestingActions by
    patching both _ensure_initialized (so prober-not-ready check is skipped)
    and get_current_prober (so actions get our mock instead of the stub).
    """
    from drivers.WPMockProber import MockProberImpl

    mp = MockProberImpl("mock:35555")
    with patch(
        "actions.WPTestingActions._ensure_initialized", return_value=None
    ), patch("actions.WPTestingActions.get_current_prober", return_value=mp):
        yield mp


def _status(r):
    return r["status"].lower()


# ─────────────────────────────────────────────────────────────
# update_current_info (no decorator, direct call)
# ─────────────────────────────────────────────────────────────


class TestUpdateCurrentInfo:

    def test_updates_die_position(self, globals_instance, prober):
        from actions.WPTestingActions import update_current_info

        prober.go_to_die(3, 7)
        update_current_info(currentProber=prober)
        assert globals_instance.current_die_col == 3
        assert globals_instance.current_die_row == 7

    def test_updates_total_dies(self, globals_instance, prober):
        from actions.WPTestingActions import update_current_info

        update_current_info(currentProber=prober)
        assert globals_instance.total_dies_number == 100  # mock default

    def test_updates_chuck_position_separation(self, globals_instance, prober):
        from actions.WPTestingActions import update_current_info

        update_current_info(currentProber=prober)
        assert globals_instance.chuck_z_position_state == "In Separation"

    def test_updates_chuck_position_contact(self, globals_instance, prober):
        from actions.WPTestingActions import update_current_info

        prober.go_to_contact()
        update_current_info(currentProber=prober)
        assert globals_instance.chuck_z_position_state == "In Contact"

    def test_updates_working_area(self, globals_instance, prober):
        from actions.WPTestingActions import update_current_info

        update_current_info(currentProber=prober)
        # Probing → removesuffix("Camera") → "Probing"
        assert globals_instance.current_working_area == "Probing"


# ─────────────────────────────────────────────────────────────
# Chuck contact / separation
# ─────────────────────────────────────────────────────────────


class TestChuckContactSeparation:

    def test_move_chuck_contact_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_contact

        result = move_chuck_contact(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_contact_sets_prober_at_contact(self, prober):
        from actions.WPTestingActions import move_chuck_contact

        move_chuck_contact(user="user1", waferAgentName="TestAgent")
        assert prober._at_contact is True

    def test_move_chuck_separation_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_separation

        result = move_chuck_separation(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_separation_clears_contact_flag(self, prober):
        from actions.WPTestingActions import move_chuck_contact, move_chuck_separation

        move_chuck_contact(user="user1", waferAgentName="TestAgent")
        move_chuck_separation(user="user1", waferAgentName="TestAgent")
        assert prober._at_contact is False


# ─────────────────────────────────────────────────────────────
# Chuck XY movement
# ─────────────────────────────────────────────────────────────


class TestMoveChuckXY:

    def test_move_chuck_xy_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_xy

        result = move_chuck_xy(
            x=100.0, y=-50.0, position="Site", user="user1", waferAgentName="TestAgent"
        )
        assert _status(result) == "success"

    def test_move_chuck_xy_updates_prober_state(self, prober):
        from actions.WPTestingActions import move_chuck_xy

        move_chuck_xy(
            x=123.4, y=56.7, position="Site", user="user1", waferAgentName="TestAgent"
        )
        assert prober._chuck_xy["x"] == 123.4
        assert prober._chuck_xy["y"] == 56.7

    def test_move_chuck_home_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_home

        result = move_chuck_home(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_home_resets_xy(self, prober):
        from actions.WPTestingActions import move_chuck_xy, move_chuck_home

        move_chuck_xy(
            x=50.0, y=50.0, position="Site", user="user1", waferAgentName="TestAgent"
        )
        move_chuck_home(user="user1", waferAgentName="TestAgent")
        assert prober._chuck_xy == {"x": 0.0, "y": 0.0}


# ─────────────────────────────────────────────────────────────
# Die navigation
# ─────────────────────────────────────────────────────────────


class TestDieNavigation:

    def test_move_chuck_next_die_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_next_die

        result = move_chuck_next_die(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_next_die_advances_col(self, prober):
        from actions.WPTestingActions import move_chuck_next_die

        initial_col = prober._current_die["col"]
        move_chuck_next_die(user="user1", waferAgentName="TestAgent")
        assert prober._current_die["col"] == initial_col + 1

    def test_move_chuck_previous_die_succeeds(self, prober):
        from actions.WPTestingActions import (
            move_chuck_next_die,
            move_chuck_previous_die,
        )

        move_chuck_next_die(user="user1", waferAgentName="TestAgent")
        result = move_chuck_previous_die(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_previous_die_decrements_col(self, prober):
        from actions.WPTestingActions import (
            move_chuck_next_die,
            move_chuck_previous_die,
        )

        move_chuck_next_die(user="user1", waferAgentName="TestAgent")
        col_after_next = prober._current_die["col"]
        move_chuck_previous_die(user="user1", waferAgentName="TestAgent")
        assert prober._current_die["col"] == col_after_next - 1

    def test_move_chuck_die_by_col_row_succeeds(self, prober):
        from actions.WPTestingActions import move_chuck_die

        result = move_chuck_die(col=5, row=3, user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_move_chuck_die_by_col_row_updates_prober(self, prober):
        from actions.WPTestingActions import move_chuck_die

        move_chuck_die(col=5, row=3, user="user1", waferAgentName="TestAgent")
        assert prober._current_die["col"] == 5
        assert prober._current_die["row"] == 3

    def test_move_chuck_die_updates_globals(self, globals_instance, prober):
        from actions.WPTestingActions import move_chuck_die

        move_chuck_die(col=2, row=7, user="user1", waferAgentName="TestAgent")
        assert globals_instance.current_die_col == 2
        assert globals_instance.current_die_row == 7


# ─────────────────────────────────────────────────────────────
# Wafer load / unload
# ─────────────────────────────────────────────────────────────


class TestWaferLoadUnload:

    def test_load_wafer_succeeds(self, prober):
        from actions.WPTestingActions import load_wafer

        # patch the DB update so it doesn't need a real Kafka broker
        with patch(
            "actions.WPDataBaseActions.update_wp_machine_loaded_wafer",
            return_value={"status": "Success"},
        ):
            result = load_wafer(
                waferId=42.0, orientation="Up", user="user1", waferAgentName="TestAgent"
            )
        assert _status(result) == "success"

    def test_load_wafer_sets_prober_flag(self, prober):
        from actions.WPTestingActions import load_wafer

        with patch(
            "actions.WPDataBaseActions.update_wp_machine_loaded_wafer",
            return_value={"status": "Success"},
        ):
            load_wafer(
                waferId=42.0, orientation="Up", user="user1", waferAgentName="TestAgent"
            )
        assert prober._wafer_loaded is True

    def test_load_wafer_twice_returns_error(self, globals_instance, prober):
        from actions.WPTestingActions import load_wafer

        globals_instance.loaded_wafer_id = 42  # simulate already loaded
        with patch(
            "actions.WPDataBaseActions.update_wp_machine_loaded_wafer",
            return_value={"status": "Success"},
        ):
            result = load_wafer(
                waferId=99.0,
                orientation="Down",
                user="user1",
                waferAgentName="TestAgent",
            )
        assert _status(result) == "error"

    def test_unload_wafer_succeeds(self, globals_instance, prober):
        from actions.WPTestingActions import unload_wafer

        globals_instance.loaded_wafer_id = 42  # simulate a loaded wafer
        prober._wafer_loaded = True
        with patch(
            "actions.WPDataBaseActions.update_wp_machine_loaded_wafer",
            return_value={"status": "Success"},
        ):
            result = unload_wafer(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_unload_wafer_when_none_loaded_returns_error(
        self, globals_instance, prober
    ):
        from actions.WPTestingActions import unload_wafer

        globals_instance.loaded_wafer_id = None
        result = unload_wafer(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "error"


# ─────────────────────────────────────────────────────────────
# Camera
# ─────────────────────────────────────────────────────────────


class TestSwitchCamera:

    def test_switch_camera_succeeds(self, prober):
        from actions.WPTestingActions import switch_camera

        result = switch_camera(
            mountPoint="OffAxisCamera", user="user1", waferAgentName="TestAgent"
        )
        assert _status(result) == "success"

    def test_switch_camera_updates_prober(self, prober):
        from actions.WPTestingActions import switch_camera

        switch_camera(
            mountPoint="WideFieldCamera", user="user1", waferAgentName="TestAgent"
        )
        assert prober._camera == "WideFieldCamera"

    def test_switch_camera_updates_globals(self, globals_instance, prober):
        from actions.WPTestingActions import switch_camera

        switch_camera(
            mountPoint="OffAxisCamera", user="user1", waferAgentName="TestAgent"
        )
        assert globals_instance.camera_mount_point == "OffAxisCamera"


# ─────────────────────────────────────────────────────────────
# PTPA
# ─────────────────────────────────────────────────────────────


class TestRunPTPA:

    def test_run_ptpa_succeeds(self, prober):
        from actions.WPTestingActions import run_ptpa

        result = run_ptpa(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_set_ptpa_enables(self, prober):
        from actions.WPTestingActions import set_ptpa

        result = set_ptpa(enable=True, user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"
        assert prober._ptpa_enabled is True

    def test_set_ptpa_disables(self, prober):
        from actions.WPTestingActions import set_ptpa

        set_ptpa(enable=True, user="user1", waferAgentName="TestAgent")
        set_ptpa(enable=False, user="user1", waferAgentName="TestAgent")
        assert prober._ptpa_enabled is False


# ─────────────────────────────────────────────────────────────
# get_chuck_position
# ─────────────────────────────────────────────────────────────


class TestGetChuckPosition:

    def test_get_chuck_position_returns_success(self, prober):
        from actions.WPTestingActions import get_chuck_position

        result = get_chuck_position(user="user1", waferAgentName="TestAgent")
        assert _status(result) == "success"

    def test_get_chuck_position_default_is_separation(self, prober):
        from actions.WPTestingActions import get_chuck_position

        # Default mock state has chuck at separation (z=50)
        assert prober.get_chuck_position() == "In Separation"

    def test_get_chuck_position_after_contact(self, prober):
        from actions.WPTestingActions import move_chuck_contact

        move_chuck_contact(user="user1", waferAgentName="TestAgent")
        assert prober.get_chuck_position() == "In Contact"

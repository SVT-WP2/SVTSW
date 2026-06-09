"""
Tests for drivers/WPMockProber.py

MockProberImpl is a pure in-memory simulation - no network, no hardware.
These tests verify the state machine behaves correctly for all operations.
"""

import pytest
from drivers.WPMockProber import MockProberImpl

# ──────────────────────────────────────────────────────────────
# Construction / defaults
# ──────────────────────────────────────────────────────────────


class TestMockProberDefaults:

    def test_connected_by_default(self, mock_prober):
        assert mock_prober.is_alive() is True

    def test_default_address(self, mock_prober):
        assert mock_prober.address == "mock-prober:35555"

    def test_custom_address(self):
        p = MockProberImpl("10.0.0.1:35555")
        assert p.address == "10.0.0.1:35555"

    def test_no_project_by_default(self, mock_prober):
        assert mock_prober._project is None

    def test_chuck_at_separation_by_default(self, mock_prober):
        assert mock_prober.get_chuck_position() == "In Separation"

    def test_wafer_not_loaded_by_default(self, mock_prober):
        assert mock_prober._wafer_loaded is False

    def test_is_alive(self, mock_prober):
        assert mock_prober.is_alive() is True

    def test_repr(self, mock_prober):
        r = repr(mock_prober)
        assert "MockProberImpl" in r
        assert "mock-prober" in r


# ──────────────────────────────────────────────────────────────
# Connect / disconnect
# ──────────────────────────────────────────────────────────────


class TestConnectDisconnect:

    def test_connect(self, mock_prober):
        mock_prober.disconnect()
        assert mock_prober.is_alive() is False
        mock_prober.connect()
        assert mock_prober.is_alive() is True

    def test_disconnect(self, mock_prober):
        mock_prober.disconnect()
        assert mock_prober.is_alive() is False


# ──────────────────────────────────────────────────────────────
# Project
# ──────────────────────────────────────────────────────────────


class TestOpenProject:

    def test_open_project_sets_current_project(self, mock_prober):
        mock_prober.open_project("ER2_NKF7_Vertical_East")
        assert mock_prober._project == "ER2_NKF7_Vertical_East"

    def test_open_project_returns_string(self, mock_prober):
        result = mock_prober.open_project("TestProject")
        assert isinstance(result, str)
        assert "TestProject" in result

    def test_open_project_resets_die(self, mock_prober):
        mock_prober.go_to_die(5, 3)
        mock_prober.open_project("NewProject")
        assert mock_prober._current_die == {"col": 0, "row": 0, "subsite": 0}


# ──────────────────────────────────────────────────────────────
# Wafer load / unload
# ──────────────────────────────────────────────────────────────


class TestWaferLoadUnload:

    def test_load_wafer_sets_flag(self, mock_prober):
        mock_prober.load_wafer()
        assert mock_prober._wafer_loaded is True

    def test_load_wafer_sets_z_to_separation(self, mock_prober):
        mock_prober.load_wafer()
        assert mock_prober._chuck_z == 50.0

    def test_unload_wafer_clears_flag(self, mock_prober):
        mock_prober.load_wafer()
        mock_prober.unload_wafer()
        assert mock_prober._wafer_loaded is False

    def test_unload_wafer_resets_die_position(self, mock_prober):
        mock_prober.load_wafer()
        mock_prober.go_to_die(3, 5)
        mock_prober.unload_wafer()
        assert mock_prober._current_die == {"col": 0, "row": 0, "subsite": 0}


# ──────────────────────────────────────────────────────────────
# Chuck XY / Z movement
# ──────────────────────────────────────────────────────────────


class TestChuckMovement:

    def test_move_chuck_xy(self, mock_prober):
        mock_prober.move_chuck_xy(100.5, -50.0)
        assert mock_prober._chuck_xy["x"] == 100.5
        assert mock_prober._chuck_xy["y"] == -50.0

    def test_move_chuck_z(self, mock_prober):
        mock_prober.move_chuck_z(75.0)
        assert mock_prober._chuck_z == 75.0

    def test_move_chuck_home_resets_position(self, mock_prober):
        mock_prober.move_chuck_xy(50.0, 50.0)
        mock_prober.move_chuck_home()
        assert mock_prober._chuck_xy == {"x": 0.0, "y": 0.0}
        assert mock_prober._chuck_z == 0.0

    def test_go_to_contact_sets_z(self, mock_prober):
        mock_prober.go_to_contact()
        assert mock_prober._chuck_z == 100.0

    def test_go_to_separation_sets_z(self, mock_prober):
        mock_prober.go_to_contact()
        mock_prober.go_to_separation()
        assert mock_prober._chuck_z == 50.0


# ──────────────────────────────────────────────────────────────
# Chuck position queries
# ──────────────────────────────────────────────────────────────


class TestChuckPositionQueries:

    def test_get_chuck_position_default(self, mock_prober):
        assert mock_prober.get_chuck_position() == "In Separation"

    def test_get_chuck_position_after_contact(self, mock_prober):
        mock_prober.go_to_contact()
        assert mock_prober.get_chuck_position() == "In Contact"

    def test_get_chuck_position_after_separation(self, mock_prober):
        mock_prober.go_to_contact()
        mock_prober.go_to_separation()
        assert mock_prober.get_chuck_position() == "In Separation"

    def test_get_current_index_format(self, mock_prober):
        result = mock_prober.get_current_index()
        parts = result.split(",")
        assert len(parts) == 3
        assert all(p.lstrip("-").isdigit() for p in parts)

    def test_get_dies_number_format(self, mock_prober):
        result = mock_prober.get_dies_number()
        parts = result.split(",")
        assert len(parts) == 3
        assert int(parts[0]) > 0  # total > 0

    def test_get_current_working_area_default(self, mock_prober):
        assert mock_prober.get_current_working_area() == "Probing"

    def test_get_current_working_area_offaxis(self, mock_prober):
        mock_prober.move_chuck_offaxis_area()
        assert mock_prober.get_current_working_area() == "OffAxisCamera"

    def test_get_current_working_area_wide(self, mock_prober):
        mock_prober.move_chuck_wide()
        assert mock_prober.get_current_working_area() == "WideFieldCamera"


# ──────────────────────────────────────────────────────────────
# Die stepping
# ──────────────────────────────────────────────────────────────


class TestDieStepping:

    def test_step_next_die_increments_col(self, mock_prober):
        mock_prober._current_die = {"col": 2, "row": 1, "subsite": 0}
        mock_prober.step_next_die()
        assert mock_prober._current_die["col"] == 3

    def test_step_next_die_wraps_to_next_row(self, mock_prober):
        mock_prober._current_die = {"col": 9, "row": 1, "subsite": 0}
        mock_prober.step_next_die()
        assert mock_prober._current_die["col"] == 0
        assert mock_prober._current_die["row"] == 2

    def test_step_prev_die_decrements_col(self, mock_prober):
        mock_prober._current_die = {"col": 5, "row": 2, "subsite": 0}
        mock_prober.step_prev_die()
        assert mock_prober._current_die["col"] == 4

    def test_step_prev_die_wraps_to_previous_row(self, mock_prober):
        mock_prober._current_die = {"col": 0, "row": 3, "subsite": 0}
        mock_prober.step_prev_die()
        assert mock_prober._current_die["col"] == 9
        assert mock_prober._current_die["row"] == 2

    def test_go_to_die(self, mock_prober):
        mock_prober.go_to_die(7, 4)
        assert mock_prober._current_die["col"] == 7
        assert mock_prober._current_die["row"] == 4

    def test_go_to_die_updates_index(self, mock_prober):
        mock_prober.go_to_die(3, 2)
        idx, col, row = mock_prober.get_current_index().split(",")
        assert int(col) == 3
        assert int(row) == 2

    def test_align_wafer_sets_die(self, mock_prober):
        mock_prober.align_wafer(2, 3, 1)
        assert mock_prober._current_die == {"col": 2, "row": 3, "subsite": 1}


# ──────────────────────────────────────────────────────────────
# Camera
# ──────────────────────────────────────────────────────────────


class TestCamera:

    def test_default_camera(self, mock_prober):
        assert mock_prober.get_camera_status() == "TopCamera"

    def test_switch_camera(self, mock_prober):
        mock_prober.switch_camera("OffAxisCamera")
        assert mock_prober.get_camera_status() == "OffAxisCamera"

    def test_switch_camera_returns_string(self, mock_prober):
        result = mock_prober.switch_camera("WideFieldCamera")
        assert isinstance(result, str)
        assert "WideFieldCamera" in result


# ──────────────────────────────────────────────────────────────
# Overtravel
# ──────────────────────────────────────────────────────────────


class TestOvertravel:

    def test_set_overtravel(self, mock_prober):
        mock_prober.set_overtravel(15.5)
        assert mock_prober._overtravel_gap == 15.5

    def test_enable_overtravel(self, mock_prober):
        mock_prober.enable_overtravel(True)
        assert mock_prober._overtravel_enabled is True

    def test_disable_overtravel(self, mock_prober):
        mock_prober.enable_overtravel(True)
        mock_prober.enable_overtravel(False)
        assert mock_prober._overtravel_enabled is False


# ──────────────────────────────────────────────────────────────
# PTPA
# ──────────────────────────────────────────────────────────────


class TestPTPA:

    def test_set_ptpa_enables(self, mock_prober):
        mock_prober.set_ptpa(True)
        assert mock_prober._ptpa_enabled is True

    def test_set_ptpa_disables(self, mock_prober):
        mock_prober.set_ptpa(True)
        mock_prober.set_ptpa(False)
        assert mock_prober._ptpa_enabled is False

    def test_run_ptpa_returns_ok(self, mock_prober):
        result = mock_prober.run_ptpa()
        assert "0" in result
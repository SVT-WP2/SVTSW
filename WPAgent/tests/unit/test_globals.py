"""
Tests for globals/WPAagentGlobalParameters.py

Covers: singleton behaviour, state setters/getters, lock/unlock,
die position, wafer/probe-card helpers, and reset().
"""

import pytest
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

# ──────────────────────────────────────────────────────────────
# Singleton
# ──────────────────────────────────────────────────────────────


class TestSingleton:

    def test_getInstance_returns_same_object(self):
        a = SvtWPAagentGlobalParameters.getInstance()
        b = SvtWPAagentGlobalParameters.getInstance()
        assert a is b

    def test_getInstance_is_correct_type(self):
        g = SvtWPAagentGlobalParameters.getInstance()
        assert isinstance(g, SvtWPAagentGlobalParameters)


# ──────────────────────────────────────────────────────────────
# Default values
# ──────────────────────────────────────────────────────────────


class TestDefaults:

    def test_prober_status_default(self, globals_instance):
        assert globals_instance.prober_status == "available"

    def test_wpag_state_default(self, globals_instance):
        assert globals_instance.wpag_state == "ServiceOff"

    def test_chuck_z_state_default(self, globals_instance):
        assert globals_instance.chuck_z_position_state == "Unknown"

    def test_no_wafer_loaded_by_default(self, globals_instance):
        assert globals_instance.loaded_wafer_id is None
        assert globals_instance.wafer_orientation is None

    def test_no_probe_card_by_default(self, globals_instance):
        assert globals_instance.probe_card_id is None
        assert globals_instance.probe_card_orientation is None

    def test_die_position_zero_by_default(self, globals_instance):
        assert globals_instance.current_die_col == 0
        assert globals_instance.current_die_row == 0
        assert globals_instance.current_die_subsite == 0

    def test_not_locked_by_default(self, globals_instance):
        assert globals_instance.is_locked_for_testing is False


# ──────────────────────────────────────────────────────────────
# Basic setters
# ──────────────────────────────────────────────────────────────


class TestSetters:

    def test_set_address(self, globals_instance):
        globals_instance.set_address("192.168.1.10")
        assert globals_instance.address == "192.168.1.10"

    def test_set_machine_type(self, globals_instance):
        globals_instance.set_machine_type("sentio")
        assert globals_instance.machineType == "sentio"

    def test_set_project_name(self, globals_instance):
        globals_instance.set_project_name("ER2_NKF7_Vertical_East")
        assert globals_instance.projectName == "ER2_NKF7_Vertical_East"

    def test_set_overdrive(self, globals_instance):
        globals_instance.set_overdrive(25)
        assert globals_instance.overdrive == 25

    def test_set_user(self, globals_instance):
        globals_instance.set_user("alice", "Expert")
        assert globals_instance.userLogged == "alice"
        assert globals_instance.userLoggedHierarchy == "Expert"

    def test_set_wpag_state(self, globals_instance):
        globals_instance.set_wpag_state("WP_Testing")
        assert globals_instance.wpag_state == "WP_Testing"

    def test_set_chuck_position_valid(self, globals_instance):
        globals_instance.set_chuck_position("Contact")
        assert globals_instance.chuck_z_position_state == "Contact"

    def test_set_chuck_position_separation(self, globals_instance):
        globals_instance.set_chuck_position("Separation")
        assert globals_instance.chuck_z_position_state == "Separation"

    def test_set_initialization_mode_manual(self, globals_instance):
        globals_instance.set_initialization_mode("manual")
        assert globals_instance.initialization_mode == "manual"

    def test_set_initialization_mode_database(self, globals_instance):
        globals_instance.set_initialization_mode("database")
        assert globals_instance.initialization_mode == "database"

    def test_set_initialization_mode_invalid_raises(self, globals_instance):
        with pytest.raises(ValueError):
            globals_instance.set_initialization_mode("cloud")


# ──────────────────────────────────────────────────────────────
# Wafer helpers
# ──────────────────────────────────────────────────────────────


class TestWaferHelpers:

    def test_set_wafer_loaded(self, globals_instance):
        globals_instance.set_wafer_loaded(99, "North")
        assert globals_instance.loaded_wafer_id == 99
        assert globals_instance.wafer_orientation == "North"

    def test_clear_wafer_removes_id_and_orientation(self, globals_instance):
        globals_instance.set_wafer_loaded(5, "South")
        globals_instance.clear_wafer()
        assert globals_instance.loaded_wafer_id is None
        assert globals_instance.wafer_orientation is None

    def test_clear_wafer_resets_die_position(self, globals_instance):
        globals_instance.set_wafer_loaded(5, "East")
        globals_instance.set_current_die(3, 7, 2)
        globals_instance.clear_wafer()
        assert globals_instance.current_die_col == 0
        assert globals_instance.current_die_row == 0
        assert globals_instance.current_die_subsite == 0


# ──────────────────────────────────────────────────────────────
# Probe card helpers
# ──────────────────────────────────────────────────────────────


class TestProbeCardHelpers:

    def test_set_probe_card(self, globals_instance):
        globals_instance.set_probe_card(12, "East")
        assert globals_instance.probe_card_id == 12
        assert globals_instance.probe_card_orientation == "East"

    def test_clear_probe_card(self, globals_instance):
        globals_instance.set_probe_card(12, "East")
        globals_instance.clear_probe_card()
        assert globals_instance.probe_card_id is None
        assert globals_instance.probe_card_orientation is None


# ──────────────────────────────────────────────────────────────
# Die position
# ──────────────────────────────────────────────────────────────


class TestDiePosition:

    def test_set_current_die(self, globals_instance):
        globals_instance.set_current_die(4, 6, 2)
        assert globals_instance.current_die_col == 4
        assert globals_instance.current_die_row == 6
        assert globals_instance.current_die_subsite == 2

    def test_set_current_die_default_subsite(self, globals_instance):
        globals_instance.set_current_die(1, 2)
        assert globals_instance.current_die_subsite == 0


# ──────────────────────────────────────────────────────────────
# Lock / unlock
# ──────────────────────────────────────────────────────────────


class TestLocking:

    def test_lock_sets_flag(self, globals_instance):
        globals_instance.lock_for_testing("bob", "Running test suite")
        assert globals_instance.is_locked_for_testing is True
        assert globals_instance.locked_by_user == "bob"
        assert globals_instance.lock_reason == "Running test suite"

    def test_unlock_clears_flag(self, globals_instance):
        globals_instance.lock_for_testing("bob")
        globals_instance.unlock_from_testing()
        assert globals_instance.is_locked_for_testing is False
        assert globals_instance.locked_by_user is None

    def test_get_lock_info_when_locked(self, globals_instance):
        globals_instance.lock_for_testing("carol", "Integration test", "seq-001")
        info = globals_instance.get_lock_info()
        assert info["is_locked"] is True
        assert info["locked_by"] == "carol"
        assert info["test_sequence_id"] == "seq-001"
        assert info["locked_duration_seconds"] >= 0

    def test_get_lock_info_when_unlocked(self, globals_instance):
        info = globals_instance.get_lock_info()
        assert info["is_locked"] is False
        assert info["locked_by"] is None

    def test_lock_with_sequence_id(self, globals_instance):
        globals_instance.lock_for_testing("dave", test_sequence_id="seq-42")
        assert globals_instance.test_sequence_id == "seq-42"


# ──────────────────────────────────────────────────────────────
# Alignment / home die
# ──────────────────────────────────────────────────────────────


class TestAlignmentDie:

    def test_set_and_get_alignment_die(self, globals_instance):
        globals_instance.set_alignment_die({"col": 2, "row": 3})
        assert globals_instance.get_alignment_die() == {"col": 2, "row": 3}

    def test_set_and_get_home_die(self, globals_instance):
        globals_instance.set_home_die({"col": 0, "row": 0})
        assert globals_instance.get_home_die() == {"col": 0, "row": 0}


# ──────────────────────────────────────────────────────────────
# is_initialized
# ──────────────────────────────────────────────────────────────


class TestIsInitialized:

    def test_not_initialized_by_default(self, globals_instance):
        assert globals_instance.is_initialized() is False

    def test_initialized_when_address_and_type_set(self, globals_instance):
        globals_instance.set_address("192.168.1.1")
        globals_instance.set_machine_type("sentio")
        assert globals_instance.is_initialized() is True

    def test_not_initialized_with_only_address(self, globals_instance):
        globals_instance.set_address("192.168.1.1")
        assert globals_instance.is_initialized() is False


# ──────────────────────────────────────────────────────────────
# reset()
# ──────────────────────────────────────────────────────────────


class TestReset:

    def test_reset_clears_address(self, globals_instance):
        globals_instance.set_address("10.0.0.1")
        globals_instance.reset()
        assert globals_instance.address is None

    def test_reset_clears_user(self, globals_instance):
        globals_instance.set_user("alice", "Expert")
        globals_instance.reset()
        assert globals_instance.userLogged is None

    def test_reset_restores_wpag_state(self, globals_instance):
        globals_instance.set_wpag_state("WP_Testing")
        globals_instance.reset()
        assert globals_instance.wpag_state == "ServiceOff"

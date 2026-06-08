"""


Unit tests for stateMachine/WpAgentStateMachine.py

Each test creates its own WPAgentStateMachine instance so there is
no shared state across tests.
"""

import pytest
from stateMachine.WpAgentStateMachine import (
    WPAgentStateMachine,
    WPAgentState,
    BYPASS_COMMANDS,
)


@pytest.fixture
def sm():
    """Fresh state machine for every test."""
    return WPAgentStateMachine()


# ─────────────────────────────────────────────────────────────
# Initial state
# ─────────────────────────────────────────────────────────────


class TestDefaults:

    def test_initial_state_is_service_on(self, sm):
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_initial_state_name(self, sm):
        assert sm.get_state_name() == "ServiceOn"

    def test_not_in_developer_mode_by_default(self, sm):
        assert sm.is_developer_mode() is False

    def test_previous_state_none_at_start(self, sm):
        assert sm.previous_state is None

    def test_current_command_none_at_start(self, sm):
        assert sm.current_command is None


# ─────────────────────────────────────────────────────────────
# force_state
# ─────────────────────────────────────────────────────────────


class TestForceState:

    def test_force_state_changes_state(self, sm):
        sm.force_state(WPAgentState.OpenedProject)
        assert sm.get_state() == WPAgentState.OpenedProject

    def test_force_state_records_previous(self, sm):
        sm.force_state(WPAgentState.Aligned)
        assert sm.previous_state == WPAgentState.ServiceOn

    def test_force_developer_mode(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        assert sm.is_developer_mode() is True

    def test_force_error_state(self, sm):
        sm.force_state(WPAgentState.Error)
        assert sm.get_state() == WPAgentState.Error


# ─────────────────────────────────────────────────────────────
# reset
# ─────────────────────────────────────────────────────────────


class TestReset:

    def test_reset_returns_to_service_on(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.reset()
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_reset_clears_current_command(self, sm):
        sm.transition("OpenProject")
        sm.reset()
        assert sm.current_command is None

    def test_reset_from_error_state(self, sm):
        sm.enter_error_state("test error")
        sm.reset()
        assert sm.get_state() == WPAgentState.ServiceOn


# ─────────────────────────────────────────────────────────────
# enter_error_state
# ─────────────────────────────────────────────────────────────


class TestEnterErrorState:

    def test_enter_error_state_sets_error(self, sm):
        sm.enter_error_state("something broke")
        assert sm.get_state() == WPAgentState.Error

    def test_enter_error_state_records_previous(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.enter_error_state()
        assert sm.previous_state == WPAgentState.Aligned

    def test_enter_error_state_from_developer_mode(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.enter_error_state("dev error")
        assert sm.get_state() == WPAgentState.Error


# ─────────────────────────────────────────────────────────────
# can_execute
# ─────────────────────────────────────────────────────────────


class TestCanExecute:

    def test_bypass_commands_always_allowed(self, sm):
        for cmd in BYPASS_COMMANDS:
            assert sm.can_execute(cmd) is True

    def test_bypass_allowed_in_any_state(self, sm):
        for state in [WPAgentState.Aligned, WPAgentState.AtContact, WPAgentState.Error]:
            sm.force_state(state)
            for cmd in BYPASS_COMMANDS:
                assert (
                    sm.can_execute(cmd) is True
                ), f"{cmd} should be allowed in {state}"

    def test_developer_mode_allows_all(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        for cmd in [
            "OpenProject",
            "LoadWafer",
            "MoveChuckContact",
            "TestingLock",
            "UnknownCommand123",
        ]:
            assert sm.can_execute(cmd) is True

    def test_service_on_allows_open_project(self, sm):
        assert sm.can_execute("OpenProject") is True

    def test_service_on_blocks_load_wafer(self, sm):
        assert sm.can_execute("LoadWafer") is False

    def test_service_on_blocks_move_chuck_contact(self, sm):
        assert sm.can_execute("MoveChuckContact") is False

    def test_at_contact_allows_testing_lock(self, sm):
        sm.force_state(WPAgentState.AtContact)
        assert sm.can_execute("TestingLock") is True

    def test_at_contact_allows_separation(self, sm):
        sm.force_state(WPAgentState.AtContact)
        assert sm.can_execute("MoveChuckSeparation") is True

    def test_at_contact_locked_blocks_separation(self, sm):
        sm.force_state(WPAgentState.AtContact_Locked)
        assert sm.can_execute("MoveChuckSeparation") is False

    def test_at_contact_locked_allows_unlock(self, sm):
        sm.force_state(WPAgentState.AtContact_Locked)
        assert sm.can_execute("TestingUnlock") is True

    def test_unknown_command_blocked(self, sm):
        assert sm.can_execute("CompletelyFakeCommand") is False


# ─────────────────────────────────────────────────────────────
# transition
# ─────────────────────────────────────────────────────────────


class TestTransition:

    def test_valid_transition_returns_true(self, sm):
        assert sm.transition("OpenProject") is True

    def test_valid_transition_changes_state(self, sm):
        sm.transition("OpenProject")
        assert sm.get_state() == WPAgentState.OpenedProject

    def test_invalid_transition_returns_false(self, sm):
        # ServiceOn → LoadWafer is not valid
        assert sm.transition("LoadWafer") is False

    def test_invalid_transition_does_not_change_state(self, sm):
        sm.transition("LoadWafer")  # invalid from ServiceOn
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_bypass_command_returns_true_any_state(self, sm):
        sm.force_state(WPAgentState.Error)
        assert sm.transition("UserLogIn") is True

    def test_developer_bypass_stays_in_developer(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.transition("LoadWafer")
        assert sm.get_state() == WPAgentState.UsedByDeveloper

    def test_developer_bypass_returns_true_for_any_command(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        assert sm.transition("MoveChuckContact") is True
        assert sm.transition("UnknownCommand") is True

    def test_error_command_enters_error_from_any_state(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    def test_transition_records_command(self, sm):
        sm.transition("OpenProject")
        assert sm.current_command == "OpenProject"


# ─────────────────────────────────────────────────────────────
# Multi-step paths through the state machine
# ─────────────────────────────────────────────────────────────


class TestStatePaths:

    def test_probing_path(self, sm):
        """ServiceOn → OpenedProject → Aligned → OnDie_OffAxis_withoutPTPA"""
        sm.transition("OpenProject")
        assert sm.get_state() == WPAgentState.OpenedProject

        sm.transition("InitProbing")
        assert sm.get_state() == WPAgentState.Aligned

        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_contact_lock_unlock_path(self, sm):
        """AtContact → lock → AtContact_Locked → unlock → AtContact"""
        sm.force_state(WPAgentState.AtContact)
        sm.transition("TestingLock")
        assert sm.get_state() == WPAgentState.AtContact_Locked

        sm.transition("TestingUnlock")
        assert sm.get_state() == WPAgentState.AtContact

    def test_separation_from_contact(self, sm):
        """AtContact → MoveChuckSeparation → OnDie_Wide"""
        sm.force_state(WPAgentState.AtContact)
        sm.transition("MoveChuckSeparation")
        assert sm.get_state() == WPAgentState.OnDie_Wide

    def test_error_recovery_path(self, sm):
        """Error → ResetAgent → UserLogged"""
        sm.force_state(WPAgentState.Error)
        sm.transition("ResetAgent")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_unload_path(self, sm):
        """Aligned → UnloadWafer → Unloaded → LoadWafer → UserLogged"""
        sm.force_state(WPAgentState.Aligned)
        sm.transition("UnloadWafer")
        assert sm.get_state() == WPAgentState.Unloaded

        sm.transition("LoadWafer")
        assert sm.get_state() == WPAgentState.UserLogged


# ─────────────────────────────────────────────────────────────
# get_available_commands
# ─────────────────────────────────────────────────────────────


class TestGetAvailableCommands:

    def test_service_on_includes_open_project(self, sm):
        assert "OpenProject" in sm.get_available_commands()

    def test_developer_mode_returns_all_marker(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        cmds = sm.get_available_commands()
        assert len(cmds) == 1
        assert "ALL COMMANDS" in cmds[0]

    def test_at_contact_includes_lock_and_separation(self, sm):
        sm.force_state(WPAgentState.AtContact)
        cmds = sm.get_available_commands()
        assert "TestingLock" in cmds
        assert "MoveChuckSeparation" in cmds
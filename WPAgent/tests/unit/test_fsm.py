"""
tests/unit/test_fsm.py

Exhaustive FSM tests for WPAgentStateMachine.

Covers:
  - Every valid transition (all states × all commands in their transition table)
  - Every invalid transition (commands that must be rejected in wrong states)
  - Full happy-path workflows (normal user flow, developer flow)
  - BYPASS_COMMANDS allowed in every state
  - Developer mode: force_state, is_developer_mode, can_execute bypass, transition bypass
  - Error state entry and recovery
  - reset() behaviour
  - previous_state and current_command tracking
  - get_available_commands()
"""

import pytest
from stateMachine.WpAgentStateMachine import (
    WPAgentStateMachine,
    WPAgentState,
    BYPASS_COMMANDS,
)

# ─── fixture ────────────────────────────────────────────────────────────────


@pytest.fixture
def sm():
    """Fresh, isolated state machine for every test."""
    return WPAgentStateMachine()


# ═══════════════════════════════════════════════════════════════════════════
# 1. INITIAL STATE
# ═══════════════════════════════════════════════════════════════════════════


class TestInitialState:

    def test_starts_in_service_on(self, sm):
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_state_name_is_string(self, sm):
        assert sm.get_state_name() == "ServiceOn"

    def test_previous_state_is_none(self, sm):
        assert sm.previous_state is None

    def test_current_command_is_none(self, sm):
        assert sm.current_command is None

    def test_is_not_developer_mode(self, sm):
        assert sm.is_developer_mode() is False


# ═══════════════════════════════════════════════════════════════════════════
# 2. BYPASS COMMANDS — allowed in every state
# ═══════════════════════════════════════════════════════════════════════════


class TestBypassCommands:

    ALL_STATES = list(WPAgentState)

    @pytest.mark.parametrize("state", ALL_STATES)
    @pytest.mark.parametrize("cmd", list(BYPASS_COMMANDS))
    def test_bypass_allowed_in_every_state(self, sm, state, cmd):
        sm.force_state(state)
        assert sm.can_execute(cmd) is True

    @pytest.mark.parametrize("state", ALL_STATES)
    @pytest.mark.parametrize("cmd", list(BYPASS_COMMANDS))
    def test_bypass_transition_succeeds_in_every_state(self, sm, state, cmd):
        sm.force_state(state)
        assert sm.transition(cmd) is True

    @pytest.mark.parametrize("state", ALL_STATES)
    @pytest.mark.parametrize("cmd", list(BYPASS_COMMANDS))
    def test_bypass_does_not_change_state(self, sm, state, cmd):
        """
        Bypass commands are always executable.  When the current state has an
        explicit transition for the command (e.g. Error → ResetAgent → UserLogged),
        the transition table wins and the state DOES change.  Otherwise the state
        is left unchanged.
        """
        sm.force_state(state)
        # Compute expected outcome before the call
        expected = sm.transitions.get(state, {}).get(cmd, state)
        sm.transition(cmd)
        assert sm.get_state() == expected


# ═══════════════════════════════════════════════════════════════════════════
# 3. VALID TRANSITIONS — every entry in the transitions table
# ═══════════════════════════════════════════════════════════════════════════


class TestValidTransitions:

    # ServiceOn
    def test_service_on_open_project(self, sm):
        assert sm.transition("OpenProject") is True
        assert sm.get_state() == WPAgentState.OpenedProject

    def test_service_on_error(self, sm):
        assert sm.transition("Error") is True
        assert sm.get_state() == WPAgentState.Error

    # OpenedProject
    def test_opened_project_init_probing(self, sm):
        sm.force_state(WPAgentState.OpenedProject)
        sm.transition("InitProbing")
        assert sm.get_state() == WPAgentState.Aligned

    def test_opened_project_move_chuck_safe(self, sm):
        sm.force_state(WPAgentState.OpenedProject)
        sm.transition("MoveChuckSafePosition")
        assert sm.get_state() == WPAgentState.ChuckSafePosition

    def test_opened_project_error(self, sm):
        sm.force_state(WPAgentState.OpenedProject)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # Aligned
    def test_aligned_unload_wafer(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("UnloadWafer")
        assert sm.get_state() == WPAgentState.Unloaded

    def test_aligned_move_chuck_unload_wafer(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckUnloadWafer")
        assert sm.get_state() == WPAgentState.ChuckUnloaded

    def test_aligned_move_chuck_safe_position(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckSafePosition")
        assert sm.get_state() == WPAgentState.ChuckSafePosition

    def test_aligned_move_chuck_asic(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_aligned_move_chuck_next_die(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_aligned_move_chuck_previous_die(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_aligned_move_chuck_row_column(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_aligned_error(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # ChuckSafePosition
    def test_chuck_safe_init_probing(self, sm):
        sm.force_state(WPAgentState.ChuckSafePosition)
        sm.transition("InitProbing")
        assert sm.get_state() == WPAgentState.Aligned

    def test_chuck_safe_unload_wafer(self, sm):
        sm.force_state(WPAgentState.ChuckSafePosition)
        sm.transition("UnloadWafer")
        assert sm.get_state() == WPAgentState.Unloaded

    def test_chuck_safe_move_chuck_unload_wafer(self, sm):
        sm.force_state(WPAgentState.ChuckSafePosition)
        sm.transition("MoveChuckUnloadWafer")
        assert sm.get_state() == WPAgentState.ChuckUnloaded

    def test_chuck_safe_error(self, sm):
        sm.force_state(WPAgentState.ChuckSafePosition)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # ChuckUnloaded
    def test_chuck_unloaded_load_wafer(self, sm):
        sm.force_state(WPAgentState.ChuckUnloaded)
        sm.transition("MoveChuckLoadedWafer")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_chuck_unloaded_error(self, sm):
        sm.force_state(WPAgentState.ChuckUnloaded)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # Unloaded
    def test_unloaded_load_wafer(self, sm):
        sm.force_state(WPAgentState.Unloaded)
        sm.transition("LoadWafer")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_unloaded_error(self, sm):
        sm.force_state(WPAgentState.Unloaded)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # UserLogged
    def test_user_logged_open_project(self, sm):
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("OpenProject")
        assert sm.get_state() == WPAgentState.OpenedProject

    def test_user_logged_move_chuck_unload_wafer(self, sm):
        """Can unload wafer from UserLogged — changed mind after loading."""
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("MoveChuckUnloadWafer")
        assert sm.get_state() == WPAgentState.ChuckUnloaded

    def test_user_logged_error(self, sm):
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # OnDie_Wide
    def test_on_die_wide_contact(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        sm.transition("MoveChuckContact")
        assert sm.get_state() == WPAgentState.AtContact

    def test_on_die_wide_asic(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_on_die_wide_next_die(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_on_die_wide_previous_die(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_on_die_wide_row_column(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    # AtContact
    def test_at_contact_testing_lock(self, sm):
        sm.force_state(WPAgentState.AtContact)
        sm.transition("TestingLock")
        assert sm.get_state() == WPAgentState.AtContact_Locked

    def test_at_contact_separation(self, sm):
        sm.force_state(WPAgentState.AtContact)
        sm.transition("MoveChuckSeparation")
        assert sm.get_state() == WPAgentState.OnDie_Wide

    def test_at_contact_error(self, sm):
        sm.force_state(WPAgentState.AtContact)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # AtContact_Locked
    def test_at_contact_locked_unlock(self, sm):
        sm.force_state(WPAgentState.AtContact_Locked)
        sm.transition("TestingUnlock")
        assert sm.get_state() == WPAgentState.AtContact

    def test_at_contact_locked_error(self, sm):
        sm.force_state(WPAgentState.AtContact_Locked)
        sm.transition("Error")
        assert sm.get_state() == WPAgentState.Error

    # OnDie_OffAxis_withoutPTPA
    def test_offaxis_no_ptpa_run_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("RunPTPA")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA

    def test_offaxis_no_ptpa_asic(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_offaxis_no_ptpa_wide(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("MoveChuckWide")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_offaxis_no_ptpa_next_die(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_offaxis_no_ptpa_previous_die(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_offaxis_no_ptpa_row_column(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_offaxis_no_ptpa_autofocus(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withoutPTPA)
        sm.transition("AutoFocus")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    # OnDie_OffAxis_withPTPA
    def test_offaxis_with_ptpa_asic(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_offaxis_with_ptpa_wide(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("MoveChuckWide")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_offaxis_with_ptpa_next_die(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA

    def test_offaxis_with_ptpa_previous_die(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA

    def test_offaxis_with_ptpa_row_column(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA

    def test_offaxis_with_ptpa_autofocus(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        sm.transition("AutoFocus")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA

    def test_offaxis_with_ptpa_no_run_ptpa_again(self, sm):
        """RunPTPA must NOT be available once PTPA is done."""
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        assert sm.can_execute("RunPTPA") is False

    # OnDie_Wide_withPTPA
    def test_wide_with_ptpa_contact(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckContact")
        assert sm.get_state() == WPAgentState.AtContact

    def test_wide_with_ptpa_asic(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_wide_with_ptpa_set_overdrive(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("SetOverdrive")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_wide_with_ptpa_next_die_loses_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_wide_with_ptpa_previous_die_loses_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_wide_with_ptpa_row_column_loses_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    # OnDie_Wide_withoutPTPA
    def test_wide_without_ptpa_asic_gains_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA

    def test_wide_without_ptpa_contact(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckContact")
        assert sm.get_state() == WPAgentState.AtContact

    def test_wide_without_ptpa_offaxis(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckOffAxis")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA

    def test_wide_without_ptpa_set_overdrive(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("SetOverdrive")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_wide_without_ptpa_next_die(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_wide_without_ptpa_previous_die(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckPreviousDie")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    def test_wide_without_ptpa_row_column(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withoutPTPA)
        sm.transition("MoveChuckRowColumn")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

    # Error
    def test_error_reset_agent(self, sm):
        sm.force_state(WPAgentState.Error)
        sm.transition("ResetAgent")
        assert sm.get_state() == WPAgentState.UserLogged

    # UsedByDeveloper — explicit developer commands stay in dev mode
    @pytest.mark.parametrize(
        "cmd",
        [
            "MoveChuckXY",
            "MoveChuckZ",
            "MoveChuckCenter",
            "MoveChuckHome",
            "MoveChuckToWorkArea",
            "FindHome",
            "SwitchCamera",
            "SetOvertravel",
            "DisableOvertravel",
            "LocalMode",
            "TakeScreenshot",
        ],
    )
    def test_developer_commands_stay_in_dev_mode(self, sm, cmd):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.transition(cmd)
        assert sm.get_state() == WPAgentState.UsedByDeveloper

    def test_developer_error_leaves_dev_mode(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.enter_error_state("dev error")
        assert sm.get_state() == WPAgentState.Error


# ═══════════════════════════════════════════════════════════════════════════
# 4. INVALID TRANSITIONS — commands rejected in wrong states
# ═══════════════════════════════════════════════════════════════════════════


class TestInvalidTransitions:

    def test_cannot_init_probing_from_service_on(self, sm):
        """InitProbing requires an open project — not valid from ServiceOn."""
        assert sm.can_execute("InitProbing") is False

    def test_cannot_init_probing_from_user_logged(self, sm):
        """Must open a project first before InitProbing."""
        sm.force_state(WPAgentState.UserLogged)
        assert sm.can_execute("InitProbing") is False

    def test_cannot_move_chuck_safe_from_user_logged(self, sm):
        """MoveChuckSafePosition requires an open project."""
        sm.force_state(WPAgentState.UserLogged)
        assert sm.can_execute("MoveChuckSafePosition") is False

    def test_cannot_open_project_from_aligned(self, sm):
        sm.force_state(WPAgentState.Aligned)
        assert sm.can_execute("OpenProject") is False

    def test_cannot_contact_from_aligned(self, sm):
        sm.force_state(WPAgentState.Aligned)
        assert sm.can_execute("MoveChuckContact") is False

    def test_cannot_load_wafer_from_opened_project(self, sm):
        sm.force_state(WPAgentState.OpenedProject)
        assert sm.can_execute("LoadWafer") is False

    def test_cannot_run_ptpa_from_wide_with_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        assert sm.can_execute("RunPTPA") is False

    def test_cannot_run_ptpa_from_offaxis_with_ptpa(self, sm):
        sm.force_state(WPAgentState.OnDie_OffAxis_withPTPA)
        assert sm.can_execute("RunPTPA") is False

    def test_cannot_lock_from_separation(self, sm):
        sm.force_state(WPAgentState.OnDie_Wide)
        assert sm.can_execute("TestingLock") is False

    def test_cannot_contact_from_at_contact(self, sm):
        """Already at contact — can't contact again."""
        sm.force_state(WPAgentState.AtContact)
        assert sm.can_execute("MoveChuckContact") is False

    def test_cannot_unlock_from_at_contact(self, sm):
        """Not locked — unlock makes no sense."""
        sm.force_state(WPAgentState.AtContact)
        assert sm.can_execute("TestingUnlock") is False

    def test_cannot_lock_from_at_contact_locked(self, sm):
        """Already locked — can't lock again."""
        sm.force_state(WPAgentState.AtContact_Locked)
        assert sm.can_execute("TestingLock") is False

    def test_invalid_transition_returns_false(self, sm):
        result = sm.transition(
            "InitProbing"
        )  # invalid from ServiceOn (needs OpenedProject first)
        assert result is False

    def test_invalid_transition_does_not_change_state(self, sm):
        sm.transition("InitProbing")  # invalid from ServiceOn
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_unknown_command_rejected(self, sm):
        assert sm.can_execute("NonExistentCommand") is False

    def test_unknown_command_transition_returns_false(self, sm):
        assert sm.transition("NonExistentCommand") is False


# ═══════════════════════════════════════════════════════════════════════════
# 5. DEVELOPER MODE
# ═══════════════════════════════════════════════════════════════════════════


class TestDeveloperMode:

    def test_force_state_to_developer(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        assert sm.is_developer_mode() is True

    def test_developer_mode_allows_any_command(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        for cmd in [
            "MoveChuckContact",
            "InitProbing",
            "OpenProject",
            "LoadWafer",
            "MoveChuckXY",
            "FindHome",
            "RunPTPA",
            "TestingLock",
        ]:
            assert sm.can_execute(cmd) is True, f"{cmd} should be allowed in dev mode"

    def test_developer_transition_stays_in_dev_mode(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.transition(
            "MoveChuckContact"
        )  # normally only valid from OnDie_Wide/WithPTPA
        assert sm.get_state() == WPAgentState.UsedByDeveloper

    def test_developer_transition_records_command(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.transition("MoveChuckXY")
        assert sm.current_command == "MoveChuckXY"

    def test_developer_get_available_commands(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        available = sm.get_available_commands()
        assert available == ["ALL COMMANDS ALLOWED (Developer Mode)"]

    def test_non_developer_is_not_dev_mode(self, sm):
        for state in [
            WPAgentState.ServiceOn,
            WPAgentState.Aligned,
            WPAgentState.AtContact,
            WPAgentState.Error,
        ]:
            sm.force_state(state)
            assert sm.is_developer_mode() is False


# ═══════════════════════════════════════════════════════════════════════════
# 6. ERROR STATE
# ═══════════════════════════════════════════════════════════════════════════


class TestErrorState:

    def test_enter_error_state_from_any_state(self, sm):
        for state in [
            WPAgentState.ServiceOn,
            WPAgentState.Aligned,
            WPAgentState.AtContact,
            WPAgentState.UsedByDeveloper,
        ]:
            sm.force_state(state)
            sm.enter_error_state("test error")
            assert sm.get_state() == WPAgentState.Error

    def test_enter_error_records_previous(self, sm):
        sm.force_state(WPAgentState.Aligned)
        sm.enter_error_state()
        assert sm.previous_state == WPAgentState.Aligned

    def test_error_only_allows_reset(self, sm):
        sm.force_state(WPAgentState.Error)
        assert sm.can_execute("ResetAgent") is True
        assert sm.can_execute("OpenProject") is False
        assert sm.can_execute("InitProbing") is False
        assert sm.can_execute("MoveChuckXY") is False

    def test_reset_from_error_goes_to_user_logged(self, sm):
        sm.force_state(WPAgentState.Error)
        sm.transition("ResetAgent")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_error_via_transition_command(self, sm):
        sm.transition("Error")  # valid from ServiceOn
        assert sm.get_state() == WPAgentState.Error


# ═══════════════════════════════════════════════════════════════════════════
# 7. STATE TRACKING (previous_state, current_command)
# ═══════════════════════════════════════════════════════════════════════════


class TestStateTracking:

    def test_previous_state_updated_on_transition(self, sm):
        sm.transition("OpenProject")
        assert sm.previous_state == WPAgentState.ServiceOn

    def test_current_command_updated_on_transition(self, sm):
        sm.transition("OpenProject")
        assert sm.current_command == "OpenProject"

    def test_previous_state_chained(self, sm):
        sm.transition("OpenProject")  # ServiceOn → OpenedProject
        sm.transition("InitProbing")  # OpenedProject → Aligned
        assert sm.previous_state == WPAgentState.OpenedProject
        assert sm.get_state() == WPAgentState.Aligned

    def test_force_state_updates_previous(self, sm):
        sm.force_state(WPAgentState.Aligned)
        assert sm.previous_state == WPAgentState.ServiceOn

    def test_invalid_transition_does_not_update_previous(self, sm):
        sm.transition("InitProbing")  # invalid from ServiceOn
        assert sm.previous_state is None  # unchanged

    def test_get_current_command(self, sm):
        sm.transition("OpenProject")
        assert sm.get_current_command() == "OpenProject"


# ═══════════════════════════════════════════════════════════════════════════
# 8. RESET
# ═══════════════════════════════════════════════════════════════════════════


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
        sm.enter_error_state("crash")
        sm.reset()
        assert sm.get_state() == WPAgentState.ServiceOn

    def test_reset_from_developer_mode(self, sm):
        sm.force_state(WPAgentState.UsedByDeveloper)
        sm.reset()
        assert sm.get_state() == WPAgentState.ServiceOn
        assert sm.is_developer_mode() is False


# ═══════════════════════════════════════════════════════════════════════════
# 9. FULL WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════════


class TestFullWorkflows:

    def test_normal_testing_workflow(self, sm):
        """Standard probe station workflow from login to contact."""
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("OpenProject")
        assert sm.get_state() == WPAgentState.OpenedProject
        sm.transition("InitProbing")
        assert sm.get_state() == WPAgentState.Aligned
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withoutPTPA
        sm.transition("RunPTPA")
        assert sm.get_state() == WPAgentState.OnDie_OffAxis_withPTPA
        sm.transition("MoveChuckWide")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA
        sm.transition("MoveChuckContact")
        assert sm.get_state() == WPAgentState.AtContact
        sm.transition("TestingLock")
        assert sm.get_state() == WPAgentState.AtContact_Locked
        sm.transition("TestingUnlock")
        assert sm.get_state() == WPAgentState.AtContact
        sm.transition("MoveChuckSeparation")
        assert sm.get_state() == WPAgentState.OnDie_Wide

    def test_asic_shortcut_workflow(self, sm):
        """MoveChuckAsic from Aligned goes directly to Wide_withPTPA."""
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("OpenProject")
        sm.transition("InitProbing")
        sm.transition("MoveChuckAsic")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withPTPA
        sm.transition("MoveChuckContact")
        assert sm.get_state() == WPAgentState.AtContact

    def test_unload_and_reload_workflow(self, sm):
        """Full wafer unload/reload cycle."""
        sm.force_state(WPAgentState.UserLogged)
        sm.transition("OpenProject")
        sm.transition("MoveChuckSafePosition")
        assert sm.get_state() == WPAgentState.ChuckSafePosition
        sm.transition("UnloadWafer")
        assert sm.get_state() == WPAgentState.Unloaded
        sm.transition("LoadWafer")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_chuck_unload_reload_cycle(self, sm):
        """Physical chuck unload/reload via chuck movement commands."""
        sm.force_state(WPAgentState.Aligned)
        sm.transition("MoveChuckSafePosition")
        assert sm.get_state() == WPAgentState.ChuckSafePosition
        sm.transition("MoveChuckUnloadWafer")
        assert sm.get_state() == WPAgentState.ChuckUnloaded
        sm.transition("MoveChuckLoadedWafer")
        assert sm.get_state() == WPAgentState.UserLogged

    def test_error_recovery_workflow(self, sm):
        """Error during testing → reset → resume from UserLogged."""
        sm.force_state(WPAgentState.AtContact)
        sm.enter_error_state("prober timeout")
        assert sm.get_state() == WPAgentState.Error
        sm.transition("ResetAgent")
        assert sm.get_state() == WPAgentState.UserLogged
        # Can restart from UserLogged
        assert sm.can_execute("OpenProject") is True

    def test_ptpa_is_cleared_on_die_navigation(self, sm):
        """Moving to next die from Wide_withPTPA drops PTPA flag."""
        sm.force_state(WPAgentState.OnDie_Wide_withPTPA)
        sm.transition("MoveChuckNextDie")
        assert sm.get_state() == WPAgentState.OnDie_Wide_withoutPTPA

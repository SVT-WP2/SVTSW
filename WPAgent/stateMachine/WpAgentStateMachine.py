
from enum import Enum, auto

# Commands that work in ANY state
BYPASS_COMMANDS = {
        "UserLogIn",
        "UserLogOut",
        "Help"
    }

class WPAgentState(Enum):
    ServiceOn = auto()
    OpenedProject = auto()
    Aligned = auto()
    ChuckSafePosition = auto()
    ChuckUnloaded = auto()
    Unloaded = auto()
    OnDie_Wide_withPTPA = auto()
    OnDie_OffAxis_withoutPTPA = auto()
    OnDie_OffAxis_withPTPA = auto()
    OnDie_Wide_withoutPTPA = auto()
    OnDie_Wide = auto()
    AtContact = auto()
    AtContact_Locked = auto()
    Error = auto()
    UsedByDeveloper = auto() # ← Developer mode - ALL commands have to be allowed
    UserLogged = auto()


class WPAgentStateMachine:
    """

    state transitions according to our diagram with developer Bypass
    """

    def __init__(self):
        self.current_state = WPAgentState.ServiceOn
        self.previous_state = None
        self.current_command = None

        #  transitions
        self.transitions = {
            # From ServiceOn
            WPAgentState.ServiceOn: {
                'OpenProject': WPAgentState.OpenedProject,
                'Error': WPAgentState.Error,
            },

            # From OpenedProject
            WPAgentState.OpenedProject: {
                'AlignWafer': WPAgentState.Aligned,
                'MoveChuckSafePosition': WPAgentState.ChuckSafePosition,
                'Error': WPAgentState.Error,
            },

            # From Aligned
            WPAgentState.Aligned: {
                'UnloadWafer': WPAgentState.Unloaded,
                'MoveChuckUnloaded': WPAgentState.ChuckUnloaded,
                'MoveChuckSafePosition': WPAgentState.ChuckSafePosition,
                'MoveChuckAsic': WPAgentState.OnDie_Wide_withPTPA,
                'MoveChuckNextDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckPreviousDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckRowColumn': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'Error': WPAgentState.Error,
            },

            # From ChuckSafePosition
            WPAgentState.ChuckSafePosition: {
                'InitProbing': WPAgentState.Aligned,
                'UnloadWafer': WPAgentState.Unloaded,
                'MoveChuckUnloadWafer': WPAgentState.ChuckUnloaded,
                'Error': WPAgentState.Error,
            },

            # From ChuckUnloaded
            WPAgentState.ChuckUnloaded: {
                'MoveChuckLoadedWafer': WPAgentState.UserLogged,
                'Error': WPAgentState.Error,
            },

            # From Unloaded
            WPAgentState.Unloaded: {
                'LoadWafer': WPAgentState.UserLogged,
                'Error': WPAgentState.Error,
            },

            # From OnDie_Wide
            WPAgentState.OnDie_Wide: {
                'MoveChuckContact': WPAgentState.AtContact,
                'MoveChuckAsic': WPAgentState.OnDie_Wide_withPTPA,
                'MoveChuckNextDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckPreviousDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckRowColumn': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'Error': WPAgentState.Error,
            },



            # From AtContact
            WPAgentState.AtContact: {
                'TestingLock': WPAgentState.AtContact_Locked,
                'MoveChuckSeparation': WPAgentState.OnDie_Wide,
                'Error': WPAgentState.Error,
            },

            # From AtContact_Locked
            WPAgentState.AtContact_Locked: {
                'TestingUnlock': WPAgentState.AtContact,
                'Error': WPAgentState.Error,
            },

            # From OnDie_OffAxis_withoutPTPA
            WPAgentState.OnDie_OffAxis_withoutPTPA: {
                'MoveChuckAsic': WPAgentState.OnDie_Wide_withPTPA,
                'RunPTPA': WPAgentState.OnDie_OffAxis_withPTPA,
                'MoveChuckWide': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckNextDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckPreviousDie': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckRowColumn': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'AutoFocus': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'Error': WPAgentState.Error,
            },

            # From OnDie_Wide_withPTPA
            WPAgentState.OnDie_Wide_withPTPA: {
                'MoveChuckAsic': WPAgentState.OnDie_Wide_withPTPA,
                'SetOverdrive': WPAgentState.OnDie_Wide_withPTPA,
                'MoveChuckContact': WPAgentState.AtContact,
                'MoveChuckNextDie': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckPreviousDie': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckRowColumn': WPAgentState.OnDie_Wide_withoutPTPA,
                'Error': WPAgentState.Error,
            },

            # From OnDie_Wide_withoutPTPA
            WPAgentState.OnDie_Wide_withoutPTPA: {
                'MoveChuckAsic': WPAgentState.OnDie_Wide_withPTPA,
                'SetOverdrive': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckContact': WPAgentState.AtContact,
                'MoveChuckOffAxis': WPAgentState.OnDie_OffAxis_withoutPTPA,
                'MoveChuckNextDie': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckPreviousDie': WPAgentState.OnDie_Wide_withoutPTPA,
                'MoveChuckRowColumn': WPAgentState.OnDie_Wide_withoutPTPA,
                'Error': WPAgentState.Error,
            },

            # From Error
            WPAgentState.Error: {
                'ResetAgent': WPAgentState.UserLogged,
            },

            WPAgentState.UsedByDeveloper: {
                # NOTE: In can_execute(),  allow ALL commands
                'Error': WPAgentState.Error,
            },
        }

    def _sync_to_global_params(self):
        """Auto-sync current state to global parameters to not to write same thing a few times """
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
        g = SvtWPAagentGlobalParameters.getInstance()
        g.wpag_state = self.current_state.name

    def get_state(self):
        """Get current state"""
        return self.current_state

    def is_developer_mode(self) -> bool:
        """Check if in developer mode (bypass all restrictions)"""
        return self.current_state == WPAgentState.UsedByDeveloper

    def get_state_name(self):
        """Get current state name as string"""
        return self.current_state.name

    def transition(self, command: str) -> bool:
        """
        Attempt state transition based on command

        Args:
            command: Command name triggering the transition

        Returns:
            True if transition successful, False if invalid
        """
        self.current_command = command
        if command in BYPASS_COMMANDS:
            return True
        # DEVELOPER BYPASS
        if self.is_developer_mode():
            # State stays UsedByDeveloper
            self._sync_to_global_params()
            return True

        # Check if transition is valid
        valid_transitions = self.transitions.get(self.current_state, {})

        if command not in valid_transitions:
            print(f"⚠  BAD transition: {self.current_state.name} --[{command}]--> ???")
            print(f"   Valid transitions from {self.current_state.name}: {list(valid_transitions.keys())}")
            return False

        # run transition
        new_state = valid_transitions[command]
        self.previous_state = self.current_state
        self.current_state = new_state

        self._sync_to_global_params()

        return True

    def force_state(self, state: WPAgentState):
        """
        Force a specific state (use with caution!) mainly for UsedByDeveloper

        Args:
            state: Target state
        """
        self.previous_state = self.current_state
        self.current_state = state
        self._sync_to_global_params()

    def is_in_state(self, state: WPAgentState) -> bool:
        """Check if currently in specified state"""
        return self.current_state == state

    def can_execute(self, command: str) -> bool:
        """
        Check if command can be executed in current state

        Args:
            command: Command to check

        Returns:
            True if command is valid for current state
        """
        if command in BYPASS_COMMANDS:
            return True
        # DEVELOPER BYPASS:
        if self.is_developer_mode():
            return True
        valid_transitions = self.transitions.get(self.current_state, {})
        return command in valid_transitions

    def get_available_commands(self):
        """Get list of commands available in current state"""
        if self.is_developer_mode():
            return ["ALL COMMANDS ALLOWED (Developer Mode)"]
        return list(self.transitions.get(self.current_state, {}).keys())

    def reset(self):
        """Reset to initial state"""
        self.previous_state = self.current_state
        self.current_state = WPAgentState.ServiceOn
        self.current_command = None
        self._sync_to_global_params()
        print(f" State machine reset to {self.current_state.name}")

    def enter_error_state(self, error_message: str = None):
        """Enter error state"""
        self.previous_state = self.current_state
        self.current_state = WPAgentState.Error
        self._sync_to_global_params()
        if error_message:
            print(f"  error state: {error_message}")
        else:
            print(f"  error state from {self.previous_state.name}")

    def get_current_command(self):
        """Get the command that led to current state"""
        return self.current_command


# Singleton instance
_state_machine_instance = None


def get_state_machine() -> WPAgentStateMachine:
    """Get the global state machine instance"""
    global _state_machine_instance
    if _state_machine_instance is None:
        _state_machine_instance = WPAgentStateMachine()
    return _state_machine_instance


def reset_state_machine():
    """Reset the global state machine"""
    global _state_machine_instance
    if _state_machine_instance is not None:
        _state_machine_instance.reset()
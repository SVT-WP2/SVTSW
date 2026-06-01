from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder
from typing import Optional, List, Tuple, Any
from utilities.WPAgentTypes import AgentResponse
from utilities.WPCommandConstants import BYPASS_COMMANDS as _GLOBAL_BYPASS_COMMANDS, USER_COMMANDS, EXPERT_COMMANDS
import re


class UserHierarchy:
    USER = "User"
    EXPERT = "Expert"
    DEVELOPER = "Developer"


class WPCommandValidator:
    # Command permissions by hierarchy level
    # Commands that bypass all checks — single source of truth from WPCommandConstants
    BYPASS_COMMANDS = _GLOBAL_BYPASS_COMMANDS

    # Commands that are EXEMPT from testing lock (READ-ONLY monitoring)
    LOCK_EXEMPT_COMMANDS = {
        # Lock management - must always work!
        "TestingLock",
        "TestingUnlock",
        "GetLockStatus",
        # Status and monitoring (READ-ONLY)
        "ShowStatus",
        # Position queries (READ-ONLY)
        "GetChuckPosition",
        "GetCurrentPosition",
        "GetWaferMap",
        "GetProjectInfo",
        "ShowProjectStatus",
        # System commands
        "Help",
        # Login/logout
        "UserLogIn",
        "UserLogOut",
    }

    def __init__(self):
        self.g = SvtWPAagentGlobalParameters.getInstance()

    def validate_command(
        self,
        command: str,
        params: dict,
        payload_user: Optional[str] = None,
        payload_agent_name: Optional[str] = None,
        reply_type: Optional[str] = None,
    ) -> Optional[AgentResponse]:
        """
        Validate command execution

        Args:
            command: Command name
            params: Command parameters
            payload_user: User from request payload (optional)
            payload_agent_name: Agent name from request payload (optional)
            reply_type: Reply type for error responses (e.g., "OpenProjectReply")

        Returns:
            None if valid, error response dict if invalid
        """
        if not reply_type:
            reply_type = f"{command}Reply"

        # Skip validation for bypass commands
        if command in self.BYPASS_COMMANDS:
            return None

        # 1. Validate agent name
        agent_error = self._validate_agent_name(payload_agent_name, reply_type)
        if agent_error:
            return agent_error

        # 2. Validate user login
        user_error = self._validate_user_login(payload_user, reply_type)
        if user_error:
            return user_error

        # 3. Validate testing lock (NEW!)
        lock_error = self._validate_testing_lock(command, payload_user, reply_type)
        if lock_error:
            return lock_error

        # 4. Validate user permissions
        permission_error = self._validate_user_permission(command, reply_type)
        if permission_error:
            return permission_error

        # 5. Validate parameters (if schema defined)
        param_error = self._validate_parameters(command, params, reply_type)
        if param_error:
            return param_error

        # 6. Validate probe card and wafer orientation
        orientation_error = self._validate_orientations(command, reply_type)
        if orientation_error:
            return orientation_error

        return None

    def _validate_agent_name(
        self, payload_agent_name: Optional[str], reply_type: str
    ) -> Optional[AgentResponse]:
        """Validate agent name matches if provided"""

        if not self.g.wpAgentName:
            return ResponseBuilder.error(
                reply_type,
                "Agent not initialized. Please start with: python main.py listen <CONFIG_NAME>",
                500,
            )

        if payload_agent_name != self.g.wpAgentName:
            return ResponseBuilder.error(
                reply_type,
                f"Wrong agent: This is '{self.g.wpAgentName}', not '{payload_agent_name}'",
                403,
            )

        return None

    def _validate_user_login(
        self, payload_user: Optional[str], reply_type: str
    ) -> Optional[AgentResponse]:
        """Validate user is logged in"""

        # Check if user is logged in
        if not self.g.userLogged:
            return ResponseBuilder.error(
                reply_type, "No user logged in. Please call UserLogIn first.", 401
            )

        # If payload has user, validate it matches
        if payload_user and payload_user != self.g.userLogged:
            return ResponseBuilder.error(
                reply_type,
                f"User mismatch: Current user is '{self.g.userLogged}', not '{payload_user}'",
                401,
            )

        return None

    def _validate_testing_lock(
        self, command: str, payload_user: Optional[str], reply_type: str
    ) -> Optional[AgentResponse]:
        """
        Validate testing lock status.

        Blocks control commands when agent is locked for testing,
        but allows monitoring/status commands to continue.

        Authorization:
        - Lock owner can execute commands
        - Developer can always execute commands
        - All other users blocked from control commands
        """

        # Check if lock validation is enabled in global parameters
        if not hasattr(self.g, "is_locked_for_testing"):
            return None  # Lock system not initialized yet

        # Skip if command is exempt from lock (monitoring/status commands)
        if command in self.LOCK_EXEMPT_COMMANDS:
            return None

        # Check if agent is locked for testing
        if not self.g.is_locked_for_testing:
            return None  # Not locked - allow command

        # Get user from payload or current logged user
        current_user = payload_user or self.g.userLogged

        # Get user hierarchy
        user_hierarchy = (
            self.g.userLoggedHierarchy
            if hasattr(self.g, "userLoggedHierarchy")
            else None
        )

        # Check if user can override lock
        can_override = (
            current_user == self.g.locked_by_user  # User who locked it
            or user_hierarchy
            == UserHierarchy.DEVELOPER  # Developer can always override
        )

        if not can_override:
            # Get lock info for detailed error message
            lock_info = (
                self.g.get_lock_info() if hasattr(self.g, "get_lock_info") else {}
            )
            locked_duration = lock_info.get("locked_duration_seconds", 0)

            return ResponseBuilder.error(
                reply_type,
                f"🔒 WP Agent is locked for testing by '{self.g.locked_by_user}'. "
                f"Reason: {self.g.lock_reason}. "
                f"Locked for {locked_duration:.0f} seconds. "
                f"Only '{self.g.locked_by_user}' or a Developer can execute commands during testing.",
                423,  # HTTP 423 Locked
            )

        # User authorized - allow command
        return None

    def _validate_user_permission(
        self, command: str, reply_type: str
    ) -> Optional[AgentResponse]:
        """Validate user has permission for this command"""

        if not self.g.userLoggedHierarchy:
            return ResponseBuilder.error(
                reply_type, "User hierarchy not set. Please log in again.", 401
            )

        hierarchy = self.g.userLoggedHierarchy

        # ============================================================
        # DEVELOPER: ALL COMMANDS ALLOWED - No restrictions!
        # ============================================================
        if hierarchy == UserHierarchy.DEVELOPER:
            return None  # All commands allowed!
        # ============================================================

        # Expert has access to User + Expert commands
        if hierarchy == UserHierarchy.EXPERT:
            if command in USER_COMMANDS or command in EXPERT_COMMANDS:
                return None
            else:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Developer access. Current level: Expert",
                    403,
                )

        # User has access to User commands only
        if hierarchy == UserHierarchy.USER:
            if command in USER_COMMANDS:
                return None
            elif command in EXPERT_COMMANDS:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Expert access. Current level: User",
                    403,
                )
            else:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Developer access. Current level: User",
                    403,
                )

        # Unknown hierarchy
        return ResponseBuilder.error(
            reply_type, f"Unknown user hierarchy: {hierarchy}", 500
        )

    def _validate_parameters(
        self, command: str, params: dict, reply_type: str
    ) -> Optional[AgentResponse]:
        """
        Validate command parameters

        Checks:
        - Required parameters present
        - Parameter types correct
        - No unknown parameters (typos)
        """

        # Get parameter schema for this command
        schema = self._get_parameter_schema(command)
        if not schema:
            return None  # No schema defined - skip validation

        # Check required parameters
        for param_name, param_def in schema.items():
            if param_def.get("required", False):
                if param_name not in params:
                    return ResponseBuilder.error(
                        reply_type, f"Missing required parameter: '{param_name}'", 400
                    )

        # Check parameter types
        for param_name, param_value in params.items():
            if param_name in schema:
                expected_type = schema[param_name].get("type")
                if expected_type and not self._check_type(param_value, expected_type):
                    return ResponseBuilder.error(
                        reply_type,
                        f"Invalid type for '{param_name}': expected {expected_type}, got {type(param_value).__name__}",
                        400,
                    )
            else:
                # Unknown parameter - Warning only
                print(
                    f"⚠️  Warning: Unknown parameter '{param_name}' for command '{command}'"
                )

        return None

    def _get_parameter_schema(self, command: str) -> Optional[AgentResponse]:
        """
        Get parameter schema for command

        Schemas extracted from Swagger OpenAPI 3.0.3 specification
        All schemas match the data properties defined in component schemas
        """

        schemas = {
            # open_project(project_name: str)
            "OpenProject": {
                "projectName": {"type": "str", "required": True},
            },
            # open_project_with_asic_serial_number(asicSerialNumber: str)
            "OpenProjectWithAsicSerialNumber": {
                "asicSerialNumber": {"type": "str", "required": True},
            },
            # load_wafer(waferId: float, orientation: str)
            "LoadWafer": {
                "waferId": {"type": "float", "required": True},
                "orientation": {"type": "str", "required": False},
            },
            # move_chuck_die - NOW SUPPORTS LABELS!
            "MoveChuckRowColumn": {
                "col": {"type": "int", "required": False},
                "row": {"type": "int", "required": False},
                "label": {"type": "str", "required": False},
                "subsite": {"type": "int", "required": False},
            },
            # move_chuck_asic(asicId from DB)
            "MoveChuckAsic": {
                "asicId": {"type": "int", "required": True},
            },
            # move_chuck_xy(x, y, position)
            "MoveChuckXY": {
                "x": {"type": "float", "required": True},
                "y": {"type": "float", "required": True},
                "position": {"type": "str", "required": True},
            },
            # move_chuck_z(z)
            "MoveChuckZ": {
                "z": {"type": "float", "required": True},
            },
            # set_ptpa(enable: bool) - NEW COMBINED FUNCTION!
            "SetPTPA": {
                "enable": {"type": "bool", "required": True},
            },
            # set_chuck_overtravel(overtravelGap=None)
            "SetOvertravel": {
                "overtravelGap": {"type": "float", "required": True},
            },
            # switch_camera(mountPoint)
            "SwitchCamera": {
                "mountPoint": {"type": "str", "required": True},
            },
            # move_chuck_work_area(work_area=0)
            "MoveChuckToWorkArea": {
                "workArea": {"type": "str", "required": True},
            },
            # run_sequencer(filePath)
            "RunSequencer": {
                "filePath": {"type": "str", "required": True},
            },
            # change_project(project_name: str)
            "ChangeProject": {
                "projectName": {"type": "str", "required": True},
            },
            # ConnectProbeMachine
            "ConnectProbeMachine": {
                "wpMachineId": {"type": "int", "required": True},
                "projectId": {"type": "str", "required": False},
            },
            # align_wafer(align_die_col, align_die_row, subsite)
            "AlignWafer": {
                "align_die_col": {"type": "int", "required": False},
                "align_die_row": {"type": "int", "required": False},
                "subsite": {"type": "int", "required": False},
            },
            # Initialize — all optional
            "Initialize": {
                "serialNumber": {"type": "str", "required": False},
                "address": {"type": "str", "required": False},
                "machineType": {"type": "str", "required": False},
                "projectName": {"type": "str", "required": False},
                "alignmentDie": {"type": "str", "required": False},
                "homeDie": {"type": "str", "required": False},
                "force": {"type": "bool", "required": False},
                "withDB": {"type": "bool", "required": False},
            },
            # Testing lock/unlock
            "TestingLock": {
                "reason": {"type": "str", "required": False},
                "test_sequence_id": {"type": "str", "required": False},
            },
            "TestingUnlock": {
                "force": {"type": "bool", "required": False},
            },
            "GetLockStatus": {
                # No required parameters
            },
        }

        return schemas.get(command)

    def _check_type(self, value: Any, expected_type: str) -> bool:
        """Check if value matches expected type"""

        type_map = {
            "str": str,
            "int": int,
            "float": (int, float),  # Accept int for float
            "bool": bool,
            "dict": dict,
            "list": list,
        }

        expected_python_type = type_map.get(expected_type)
        if not expected_python_type:
            return True  # Unknown type - skip check

        return isinstance(value, expected_python_type)

    def get_user_allowed_commands(self, hierarchy: str = None) -> List[str]:
        """Get list of commands allowed for user hierarchy"""

        if hierarchy is None:
            hierarchy = self.g.userLoggedHierarchy

        if hierarchy == UserHierarchy.DEVELOPER:
            # Developer: ALL COMMANDS (no restrictions!)
            return ["ALL_COMMANDS_ALLOWED"]
        elif hierarchy == UserHierarchy.EXPERT:
            return sorted(USER_COMMANDS | EXPERT_COMMANDS)
        elif hierarchy == UserHierarchy.USER:
            return sorted(USER_COMMANDS)
        else:
            return []

    def is_command_allowed(self, command: str, hierarchy: str = None) -> bool:
        """Check if command is allowed for user hierarchy"""

        if hierarchy is None:
            hierarchy = self.g.userLoggedHierarchy

        # Developer: ALL commands allowed
        if hierarchy == UserHierarchy.DEVELOPER:
            return True

        allowed = self.get_user_allowed_commands(hierarchy)
        return command in allowed

    def _extract_orientations_from_project_name(
        self, project_name: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract wafer and probe card orientations from project name.

        Supports two formats:
        1. New format: "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
           - NotchW = Wafer orientation West
           - ArrowW = Probe card orientation West

        2. Old format: "ER2_NKF7_Vertical_East"
           - East at end = Wafer orientation (probe card assumed same)

        Args:
            project_name: Project name string

        Returns:
            tuple: (wafer_orientation, probe_card_orientation) or (None, None) if not found

        Examples:
            "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW" → ("West", "West")
            "ER2_babyMOSAIX_Vertical_V0_NotchE_ArrowN" → ("East", "North")
            "ER2_NKF7_Vertical_East" → ("East", "East")
        """
        project_name_lower = project_name.lower()

        # Try NEW format first: Notch{X}_Arrow{Y}
        # Pattern: Notch followed by single letter, then Arrow followed by single letter
        match = re.search(r"notch([ewns])_arrow([ewns])", project_name_lower)

        if match:
            # Map single letters to full orientation names
            orientation_map = {"e": "East", "w": "West", "n": "North", "s": "South"}

            wafer_letter = match.group(1)  # First capture group (after Notch)
            probe_letter = match.group(2)  # Second capture group (after Arrow)

            wafer_orientation = orientation_map.get(wafer_letter)
            probe_card_orientation = orientation_map.get(probe_letter)

            return (wafer_orientation, probe_card_orientation)

        # Try OLD format: East/West/North/South at end of name
        orientations = {
            "east": "East",
            "west": "West",
            "north": "North",
            "south": "South",
        }

        for orient_key, orient_value in orientations.items():
            if orient_key in project_name_lower:
                # Old format: same orientation for both wafer and probe card
                return (orient_value, orient_value)

        # No orientation found
        return (None, None)

    def _validate_orientations(self, command: str, reply_type: str) -> Optional[AgentResponse]:
        """
        Validate probe card type and wafer/probe card orientations.

        Supports both old and new project name formats:
        - Old: "ER2_NKF7_Vertical_East"
        - New: "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW"
        """

        # Commands that require orientation validation
        COMMANDS_REQUIRING_ORIENTATION_CHECK = {
            "InitProbing",
            "MoveChuckContact",
            "RunPTPA",
            "SetPTPA",
            "AutoFocus",
            "AlignWafer",
            "MoveChuckAsic",
            "MoveChuckRowColumn",
            "MoveChuckNextDie",
            "MoveChuckPreviousDie",
            "LoadWafer",
            "MoveChuckLoadedWafer",
            "MoveChuckZ",
            "MoveChuckXY",
        }

        # Skip if command doesn't require orientation check
        if command not in COMMANDS_REQUIRING_ORIENTATION_CHECK:
            return None

        # Get project name, probe card, and wafer orientations from globals
        project_name = self.g.projectName
        probe_card_orientation = self.g.probe_card_orientation
        wafer_orientation = self.g.wafer_orientation

        # Skip validation if no project opened yet
        if not project_name:
            return None

        # Check probe card installed
        if not probe_card_orientation:
            return ResponseBuilder.error(
                reply_type,
                "No probe card installed. Please install probe card before probing operations.",
                400,
            )

        # Check wafer loaded
        if not wafer_orientation:
            return ResponseBuilder.error(
                reply_type,
                "No wafer loaded or orientation not set. Please load wafer before probing operations.",
                400,
            )

        # ============================================================
        # VALIDATE PROBE CARD TYPE (Vertical or Cantilever)
        # ============================================================
        project_name_lower = project_name.lower()

        # Check if project name contains probe card type
        has_vertical = "vertical" in project_name_lower
        has_cantilever = "cantilever" in project_name_lower

        if has_vertical or has_cantilever:
            probe_card_lower = probe_card_orientation.lower()

            if has_vertical and "cantilever" in probe_card_lower:
                return ResponseBuilder.error(
                    reply_type,
                    f"Probe card type mismatch: Project '{project_name}' requires Vertical probe card, "
                    f"but Cantilever probe card is installed. Please install correct probe card.",
                    400,
                )

            if has_cantilever and "vertical" in probe_card_lower:
                return ResponseBuilder.error(
                    reply_type,
                    f"Probe card type mismatch: Project '{project_name}' requires Cantilever probe card, "
                    f"but Vertical probe card is installed. Please install correct probe card.",
                    400,
                )

        # ============================================================
        # VALIDATE WAFER AND PROBE CARD ORIENTATIONS
        # ============================================================

        # Extract expected orientations from project name
        expected_wafer_orient, expected_probe_orient = (
            self._extract_orientations_from_project_name(project_name)
        )

        # If project name doesn't specify orientations, just warn
        if not expected_wafer_orient:
            print(
                f"⚠️  Warning: Cannot determine orientations from project name: {project_name}"
            )
            return None

        print(f"\n🔍 Orientation validation:")
        print(
            f"   Project expects: Wafer={expected_wafer_orient}, ProbeCard={expected_probe_orient}"
        )
        print(
            f"   Machine has: Wafer={wafer_orientation}, ProbeCard={probe_card_orientation}"
        )

        # Normalize orientations for comparison
        wafer_orient_normalized = wafer_orientation.strip().lower()
        probe_orient_normalized = probe_card_orientation.strip().lower()
        expected_wafer_normalized = expected_wafer_orient.lower()
        expected_probe_normalized = expected_probe_orient.lower()

        # Check wafer orientation
        if wafer_orient_normalized != expected_wafer_normalized:
            return ResponseBuilder.error(
                reply_type,
                f"Wafer orientation mismatch: Project '{project_name}' requires wafer in {expected_wafer_orient} orientation, "
                f"but wafer is loaded in {wafer_orientation} orientation. "
                f"Please reload wafer with correct orientation.",
                400,
            )

        # Check probe card orientation
        if probe_orient_normalized != expected_probe_normalized:
            return ResponseBuilder.error(
                reply_type,
                f"Probe card orientation mismatch: Project '{project_name}' requires probe card in {expected_probe_orient} orientation, "
                f"but probe card is installed in {probe_card_orientation} orientation. "
                f"Please reinstall probe card with correct orientation.",
                400,
            )

        print(f"   ✅ Orientations match!")
        return None


# Singleton instance
_validator_instance = None


def get_validator() -> WPCommandValidator:
    """Get singleton validator instance"""
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = WPCommandValidator()
    return _validator_instance

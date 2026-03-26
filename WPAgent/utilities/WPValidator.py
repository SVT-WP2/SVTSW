"""
WP Command Validator

Validates:
- User login and hierarchy permissions
- WP Agent name matching
- Command parameters (type, required fields)
- State machine requirements

"""

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder
from typing import Dict, Any, Optional, List


class UserHierarchy:
    USER = "User"
    EXPERT = "Expert"
    DEVELOPER = "Developer"


class WPCommandValidator:
    # Command permissions by hierarchy level
    USER_COMMANDS = {
        "OpenProject",
        "InitProbing",
        "MoveChuckLoadedWafer",
        "LoadWafer",
        "MoveChuckUnloadWafer",
        "UnloadWafer",
        "MoveChuckAsic",
        "MoveChuckSeparation",
        "MoveChuckSafePosition",
        "MoveChuckContact",
        "ShowStatus",
        "MoveChuckOffAxis",
        "TestingLock",
        "TestingUnLock",
        "UserLogIn",
        "UserLogOut",
    }

    EXPERT_COMMANDS = {
        "MoveChuckWide",
        "ChangeProject",
        "MoveChuckNextDie",
        "RunPTPA",
        "MoveChuckPreviousDie",
        "SetOvertravel",
        "DisableOvertravel",
        "AutoFocus",
        "MoveChuckRowColumn",
    }

    DEVELOPER_COMMANDS = {
        # Developers can execute ALL command - no restrictions!
        "SwitchCamera",
        "ListProbers",
        "ListChipTypes",
        "ListOrientations",
        "RunSequencer",
        "MoveChuckToWorkArea",
        "FindHome",
        "MoveChuckZ",
        "ConnectProbeMachine",
        "Initialize",  # WPAGInitializeManual
        "ResetAgent",
        "LocalMode",
        "Help",
        "MoveChuckXY",
        "MoveChuckHome",
        "AlignWafer",
        "MoveChuckCenter",
    }

    # Commands that bypass all checks (system commands)
    BYPASS_COMMANDS = {
        "UserLogIn",
        "UserLogOut",
        "GetInfo",
        "ShowProjectStatus",
        "ShowStatus",
        "Help",
    }

    def __init__(self):
        self.g = SvtWPAagentGlobalParameters.getInstance()

    def validate_command(
            self,
            command: str,
            params: Dict[str, Any],
            payload_user: Optional[str] = None,
            payload_agent_name: Optional[str] = None,
            reply_type: Optional[str] = None
    ) -> Optional[Dict]:
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

        # agent name
        agent_error = self._validate_agent_name(payload_agent_name, reply_type)
        if agent_error:
            return agent_error

        #  user login
        user_error = self._validate_user_login(payload_user, reply_type)
        if user_error:
            return user_error

        #  user permissions
        permission_error = self._validate_user_permission(command, reply_type)
        if permission_error:
            return permission_error

        # parameters (if schema defined)
        param_error = self._validate_parameters(command, params, reply_type)
        if param_error:
            return param_error
        # probe card
        probe_card_error = self._validate_probe_card_orientation(command, reply_type)
        if probe_card_error:
            return probe_card_error

        return None

    def _validate_agent_name(
            self,
            payload_agent_name: Optional[str],
            reply_type: str
    ) -> Optional[Dict]:
        """Validate agent name matches if provided"""

        if not self.g.wpAgentName:
            return ResponseBuilder.error(
                reply_type,
                "Agent not initialized. Please start with: python main.py listen <CONFIG_NAME>",
                500
            )

        if payload_agent_name != self.g.wpAgentName:
            return ResponseBuilder.error(
                reply_type,
                f"Wrong agent: This is '{self.g.wpAgentName}', not '{payload_agent_name}'",
                403
            )

        return None

    def _validate_user_login(
            self,
            payload_user: Optional[str],
            reply_type: str
    ) -> Optional[Dict]:
        """Validate user is logged in"""

        # Check if user is logged in
        if not self.g.userLogged:
            return ResponseBuilder.error(
                reply_type,
                "No user logged in. Please call UserLogIn first.",
                401
            )

        # If payload has user, validate it matches
        if payload_user and payload_user != self.g.userLogged:
            return ResponseBuilder.error(
                reply_type,
                f"User mismatch: Current user is '{self.g.userLogged}', not '{payload_user}'",
                401
            )

        return None

    def _validate_user_permission(
            self,
            command: str,
            reply_type: str
    ) -> Optional[Dict]:
        """Validate user has permission for this command"""

        if not self.g.userLoggedHierarchy:
            return ResponseBuilder.error(
                reply_type,
                "User hierarchy not set. Please log in again.",
                401
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
            if command in self.USER_COMMANDS or command in self.EXPERT_COMMANDS:
                return None
            else:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Developer access. Current level: Expert",
                    403
                )

        # User has access to User commands only
        if hierarchy == UserHierarchy.USER:
            if command in self.USER_COMMANDS:
                return None
            elif command in self.EXPERT_COMMANDS:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Expert access. Current level: User",
                    403
                )
            else:
                return ResponseBuilder.error(
                    reply_type,
                    f"Command '{command}' requires Developer access. Current level: User",
                    403
                )

        # Unknown hierarchy
        return ResponseBuilder.error(
            reply_type,
            f"Unknown user hierarchy: {hierarchy}",
            500
        )

    def _validate_parameters(
            self,
            command: str,
            params: Dict[str, Any],
            reply_type: str
    ) -> Optional[Dict]:
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
            if param_def.get('required', False):
                if param_name not in params:
                    return ResponseBuilder.error(
                        reply_type,
                        f"Missing required parameter: '{param_name}'",
                        400
                    )

        # Check parameter types
        for param_name, param_value in params.items():
            if param_name in schema:
                expected_type = schema[param_name].get('type')
                if expected_type and not self._check_type(param_value, expected_type):
                    return ResponseBuilder.error(
                        reply_type,
                        f"Invalid type for '{param_name}': expected {expected_type}, got {type(param_value).__name__}",
                        400
                    )
            else:
                # Unknown parameter - Warning only
                print(f" Warning: Unknown parameter '{param_name}' for command '{command}'")

        return None

    def _get_parameter_schema(self, command: str) -> Optional[Dict]:
        """
        Get parameter schema for command

        Schemas extracted from Swagger OpenAPI 3.0.3 specification
        All schemas match the data properties defined in component schemas
        """

        schemas = {
            # OpenProject / Initialize
            "OpenProject": {
                "asicSerialNumber": {"type": "str", "required": True},
            },

            # InitProbing
            "InitProbing": {
                "wpMachineId": {"type": "int", "required": True},
            },

            # LoadWafer
            "LoadWafer": {
                "waferId": {"type": "str", "required": True},
                "orientation": {"type": "str", "required": False},
            },

            # MoveChuckLoadedWafer
            "MoveChuckLoadedWafer": {
                "waferId": {"type": "int", "required": False},
            },

            # MoveChuckAsic
            "MoveChuckAsic": {
                "machineId": {"type": "int", "required": True},
                "asicId": {"type": "str", "required": True},
            },

            # ChangeProject
            "ChangeProject": {
                "projectName": {"type": "str", "required": True},
                "projectId": {"type": "int", "required": False},
            },

            # MoveChuckRowColumn / MoveChuckDie
            "MoveChuckRowColumn": {
                "wpMachineId": {"type": "int", "required": True},
                "row": {"type": "int", "required": True},
                "col": {"type": "int", "required": True},
            },
            "GoToDie": {  # Alias
                "row": {"type": "int", "required": True},
                "col": {"type": "int", "required": True},
            },

            # MoveChuckXY
            "MoveChuckXY": {
                "x": {"type": "float", "required": True},
                "y": {"type": "float", "required": True},
            },

            # MoveChuckZ
            "MoveChuckZ": {
                "z": {"type": "float", "required": True},
            },

            # SetOverdrive / SetOvertravel
            "SetOverdrive": {
                "overdrive": {"type": "float", "required": True},
            },
            "SetOvertravel": {  # Alias
                "overtravelGap": {"type": "float", "required": True},
            },

            # SwitchCamera
            "SwitchCamera": {
                "mountPoint": {"type": "str", "required": True},
            },

            # MoveChuckToWorkArea
            "MoveChuckToWorkArea": {
                "workArea": {"type": "str", "required": True},
            },
            "MoveChuckWorkArea": {  # Alias
                "workArea": {"type": "str", "required": True},
            },

            # RunSequencer
            "RunSequencer": {
                "filePath": {"type": "str", "required": True},
            },

            # UserLogIn
            "UserLogIn": {
                "user": {"type": "str", "required": True},
            },

            # ConnectProbeMachine
            "ConnectProbeMachine": {
                "wpMachineId": {"type": "int", "required": True},
                "projectId": {"type": "str", "required": False},
            },

            # WPAGInitializeManual / Initialize
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

            # SetChuckZPositionState
            "SetChuckZPositionState": {
                "wpMachineId": {"type": "int", "required": True},
                "chuckZPositionState": {"type": "str", "required": True},
            },

            # GetMoveChuckAsic
            "GetMoveChuckAsic": {
                "wpMachineId": {"type": "int", "required": True},
                "asicId": {"type": "int", "required": True},
            },

            # WPAGInitializeDB
            "WPAGInitializeDB": {
                "withDB": {"type": "bool", "required": True},
            },

            # - MoveChuckUnloadWafer
            # - UnloadWafer
            # - MoveChuckSeparation
            # - MoveChuckSafePosition
            # - MoveChuckContact
            # - MoveChuckWide
            # - MoveChuckNextDie
            # - MoveChuckPreviousDie
            # - RunPTPA
            # - DisableOverdrive
            # - AutoFocus
            # - ShowStatus
            # - MoveChuckOffAxis
            # - TestingLock
            # - TestingUnLock
            # - UserLogOut
            # - MoveChuckCenter
            # - AlignWafer
            # - FindHome
            # - MoveChuckHome
            # - ResetAgent
            # - LocalMode
            # - Help
            # - ListProbers
            # - ListChipTypes
            # - ListOrientations
            # - GetAgentState
            # - GetDiesNumber
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
            return sorted(self.USER_COMMANDS | self.EXPERT_COMMANDS)
        elif hierarchy == UserHierarchy.USER:
            return sorted(self.USER_COMMANDS)
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

    def _validate_probe_card_orientation(
            self,
            command: str,
            reply_type: str
    ) -> Optional[Dict]:

        # Commands that require orientation validation
        COMMANDS_REQUIRING_ORIENTATION_CHECK = {
            "InitProbing",
            "MoveChuckContact",
            "RunPTPA",
            "AutoFocus",
            "AlignWafer",
            "MoveChuckAsic",
            "MoveChuckRowColumn",
            "MoveChuckNextDie",
            "MoveChuckPreviousDie",
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
                400
            )

        # Check wafer loaded
        if not wafer_orientation:
            return ResponseBuilder.error(
                reply_type,
                "No wafer loaded or orientation not set. Please load wafer before probing operations.",
                400
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
                    400
                )

            if has_cantilever and "vertical" in probe_card_lower:
                return ResponseBuilder.error(
                    reply_type,
                    f"Probe card type mismatch: Project '{project_name}' requires Cantilever probe card, "
                    f"but Vertical probe card is installed. Please install correct probe card.",
                    400
                )

        # ============================================================
        # VALIDATE WAFER ORIENTATION (East/West/North/South)
        # ============================================================

        # Extract orientation from project name
        # Expected format: ends with _{East|West|North|South}
        # Examples: "ER2_NKF7_Vertical_East", "ER2_MOSS_Cantilever_West"

        # Check for orientation keywords in project name
        orientations = {
            "east": "East",
            "west": "West",
            "north": "North",
            "south": "South"
        }

        project_orientation = None
        for orient_key, orient_value in orientations.items():
            if orient_key in project_name_lower:
                project_orientation = orient_value
                break

        # If project name specifies orientation, validate it
        if project_orientation:
            wafer_orient_normalized = wafer_orientation.strip().lower()
            project_orient_normalized = project_orientation.lower()

            if wafer_orient_normalized != project_orient_normalized:
                return ResponseBuilder.error(
                    reply_type,
                    f"Wafer orientation mismatch: Project '{project_name}' requires {project_orientation} orientation, "
                    f"but wafer is loaded in {wafer_orientation} orientation. "
                    f"Please reload wafer with correct orientation or change project.",
                    400
                )
        else:
            # Project name doesn't specify orientation - just warn
            print(f"⚠️  Warning: Cannot determine wafer orientation from project name: {project_name}")

        return None


# Singleton instance
_validator_instance = None


def get_validator() -> WPCommandValidator:
    """Get singleton validator instance"""
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = WPCommandValidator()
    return _validator_instance

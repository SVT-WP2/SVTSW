class SvtWPAagentGlobalParameters:
    """
    Singleton class to store global parameters for the WP Agent.
    Supports both manual and database-driven configuration.
    """

    _instance = None

    def __init__(self):
        # Core parameters
        self.address = None
        self.machineType = None
        self.chip_name = None
        self.orientation = None  # Project orientation
        self.projectName = None
        self.prober_status = "available"
        self._alignment_die = None
        self._home_die = None
        self._project_metadata = {}

        # Database-related parameters
        self.wpMachineId = None  # Database ID of the prober
        self.machine_name = None  # Human-readable name from database
        self.initialization_mode = None  # "manual" or "database"
        self.wpAgentName = None

        # User info
        self.userLogged = None
        self.userLoggedHierarchy = None

        # ASIC info
        self.asic_serial_number = 0

        # Agent FSM State
        self.wpag_state = "ServiceOff"  # ServiceOn, WP_Idle, WP_Testing, WP_Error, etc.

        # Loaded wafer
        self.loaded_wafer_id = None  # None = no wafer, or wafer ID
        self.wafer_orientation = (
            None  # "North", "East", "South", "West" - WAFER orientation
        )

        # Installed probe card
        self.probe_card_id = None  # None = no probe card, or probe card ID
        self.probe_card_orientation = None  # "North", "East", "South", "West"

        # Project (add ID to complement existing project_name)
        self.opened_project_id = 0

        # Configuration
        self.overdrive = 0
        self.camera_mount_point = ""  # "Top", "Bottom", "Side", etc.
        self.current_working_area = ""  # "LoadPosition", "TestArea", etc.

        # Die position
        self.current_die_col = 0
        self.current_die_row = 0
        self.current_die_subsite = 0

        # Chuck Z position
        self.chuck_z_position_state = "Unknown"  # "Contact", "Separation", "Unknown"

        # Total dies in wafer
        self.total_dies_number = 0

        # Project paths for now its only Sentio machine
        self.sentio_projects_base_path = (
            "C:\\ProgramData\\MPI Corporation\\SENTIO\\projects\\"
        )
        self.projects_base_path = self.sentio_projects_base_path

        # Locker for testing
        self.is_locked_for_testing = False
        self.locked_by_user = None
        self.locked_at_timestamp = None
        self.lock_reason = None
        self.test_sequence_id = None  # ID of running test sequence

    def lock_for_testing(
        self,
        user: str,
        reason: str = "Testing in progress",
        test_sequence_id: str = None,
    ):
        """Lock the agent for testing"""
        import time

        self.is_locked_for_testing = True
        self.locked_by_user = user
        self.locked_at_timestamp = time.time()
        self.lock_reason = reason
        self.test_sequence_id = test_sequence_id
        print(f"🔒 WP Agent locked by {user}: {reason}")

    def unlock_from_testing(self):
        """Unlock the agent"""
        print(f"🔓 WP Agent unlocked (was locked by {self.locked_by_user})")
        self.is_locked_for_testing = False
        self.locked_by_user = None
        self.locked_at_timestamp = None
        self.lock_reason = None
        self.test_sequence_id = None

    def get_lock_info(self):
        """Get current lock status"""
        if not self.is_locked_for_testing:
            return {
                "is_locked": False,
                "locked_by": None,
                "locked_at": None,
                "reason": None,
                "test_sequence_id": None,
            }

        import time

        locked_duration = (
            time.time() - self.locked_at_timestamp if self.locked_at_timestamp else 0
        )

        return {
            "is_locked": True,
            "locked_by": self.locked_by_user,
            "locked_at": self.locked_at_timestamp,
            "locked_duration_seconds": locked_duration,
            "reason": self.lock_reason,
            "test_sequence_id": self.test_sequence_id,
        }

    @classmethod
    def getInstance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def set_alignment_die(self, die_position):
        """Set alignment die position"""
        self._alignment_die = die_position

    def get_alignment_die(self):
        """Get alignment die position"""
        return self._alignment_die

    def set_home_die(self, die_position):
        """Set home die position"""
        self._home_die = die_position

    def get_home_die(self):
        """Get home die position"""
        return self._home_die

    def set_project_metadata(self, metadata):
        """Store project metadata (project_id, asic_family, orientation, etc.)"""
        self._project_metadata = metadata

    def get_project_metadata(self):
        """Get project metadata"""
        return self._project_metadata

    def set_address(self, address):
        self.address = address

    def set_machine_type(self, machine_type):
        self.machineType = machine_type

    def set_chip_name(self, chip_name):
        self.chip_name = chip_name

    def set_orientation(self, orientation):
        """Set project orientation"""
        self.orientation = orientation

    def set_overdrive(self, overdriveGap):
        """Set project overdrive gap"""
        self.overdrive = overdriveGap

    def set_project_name(self, project_name):
        self.projectName = project_name

    def set_prober_status(self, prober_status):
        self.prober_status = prober_status

    def set_machine_id(self, machine_id):
        """Set the database ID of the prober"""
        self.wpMachineId = machine_id

    def set_machine_name(self, machine_name):
        """Set the human-readable name of the prober from database"""
        self.machine_name = machine_name

    def set_initialization_mode(self, mode):
        """Set how the prober was initialized: 'manual' or 'database'"""
        if mode not in ["manual", "database"]:
            raise ValueError(
                f"Invalid initialization mode: {mode}. Must be 'manual' or 'database'"
            )
        self.initialization_mode = mode

    def get_info(self):
        """Get all current parameter values as a dictionary"""
        info = {
            "address": self.address,
            "machine_type": self.machineType,
            "chip_name": self.chip_name,
            "orientation": self.orientation,
            "projectName": self.projectName,
            "prober_status": self.prober_status,
            "initialization_mode": self.initialization_mode,
        }

        # Add database-specific info if available
        if self.wpMachineId is not None:
            info["machine_id"] = self.wpMachineId
        if self.machine_name is not None:
            info["machine_name"] = self.machine_name

        return info

    def get_log_context(self):
        """Get a formatted string for logging context"""
        machine_info = self.machine_name or self.address or "N/A"
        project_info = self.projectName or "N/A"
        return f"[{machine_info} | {project_info} | {self.prober_status}]"

    def load_from_dict(self, config: dict):
        """
        Load parameters from a dictionary (e.g. test config or mock).

        Args:
            config: Dictionary containing parameter values
        """
        self._apply_data(config)
        self.initialization_mode = config.get("initialization_mode", "manual")

    def _apply_data(self, data: dict):
        """
        Internal method to apply data from a dictionary to instance variables.

        Args:
            data: Dictionary with parameter values
        """
        self.address = data.get("address")
        self.machineType = data.get("machine_type", "sentio")
        self.chip_name = data.get("chip_name")
        self.orientation = data.get("orientation")
        self.projectName = data.get("projectName")
        self.prober_status = data.get("status", data.get("prober_status", "idle"))

        # Database-specific fields
        if "machine_id" in data:
            self.set_machine_id(data["machine_id"])
        if "machine_name" in data:
            self.machine_name = data["machine_name"]
        if "initialization_mode" in data:
            self.initialization_mode = data["initialization_mode"]

    def reset(self):
        """Reset all parameters to default values"""
        self.address = None
        self.machineType = None
        self.chip_name = None
        self.orientation = None
        self.projectName = None
        self.prober_status = "available"
        self.wpMachineId = None
        self.machine_name = None
        self.initialization_mode = None

        self.userLogged = None
        self.userLoggedHierarchy = None
        self.asic_serial_number = 0
        self.wpag_state = "ServiceOff"
        self.loaded_wafer_id = None
        self.wafer_orientation = None
        self.probe_card_id = None
        self.probe_card_orientation = None
        self.opened_project_id = 0
        self.overdrive = 0
        self.camera_mount_point = ""
        self.current_working_area = ""
        self.current_die_col = 0
        self.current_die_row = 0
        self.current_die_subsite = 0
        self.chuck_z_position_state = "Unknown"
        self.total_dies_number = 0

    def is_initialized(self):
        """Check if core parameters are set"""
        return self.address is not None and self.machineType is not None

    # ===  HELPER METHODS  ===

    def set_wafer_loaded(self, wafer_id, orientation):
        """
        Set wafer as loaded.

        Args:
            wafer_id: Wafer database ID
            orientation: Wafer orientation ("North", "East", "South", "West")
        """
        self.loaded_wafer_id = wafer_id
        self.wafer_orientation = orientation

    def set_probe_card(self, probe_card_id, orientation):
        """
        Set installed probe card.

        Args:
            probe_card_id: Probe card database ID
            orientation: Probe card orientation ("North", "East", "South", "West")
        """
        self.probe_card_id = probe_card_id
        self.probe_card_orientation = orientation

    def set_current_die(self, col, row, subsite=0):
        """
        Set current die position.

        Args:
            col: Column index
            row: Row index
            subsite: Subsite index (default: 0)
        """
        self.current_die_col = col
        self.current_die_row = row
        self.current_die_subsite = subsite

    def set_project(self, project_id, project_name):
        """
        Set opened project.

        Args:
            project_id: Project database ID
            project_name: Project name
        """
        self.opened_project_id = project_id
        self.projectName = project_name

    def set_user(self, username=None, hierarchy=None):
        """Set current user"""
        self.userLogged = username
        self.userLoggedHierarchy = hierarchy

    def set_wpag_state(self, state):
        """
        Set WP Agent state.

        Args:
            state: Agent state (e.g., "ServiceOn", "WP_Idle", "WP_Testing", "WP_Error")
        """
        self.wpag_state = state

    def set_chuck_position(self, position):
        """
        Set chuck Z position state.

        Args:
            position: Chuck position ("Contact", "Separation", "Unknown")
        """
        if position not in ["Contact", "Separation", "Unknown", "In Default"]:
            print(
                f"⚠️ Warning: Invalid chuck position '{position}'. Use 'Contact', 'Separation', or 'Unknown'"
            )
        self.chuck_z_position_state = position

    def clear_probe_card(self):
        """Clear probe card when removed"""
        self.probe_card_id = None
        self.probe_card_orientation = None

    def clear_wafer(self):
        """Clear wafer when unloaded"""
        self.loaded_wafer_id = None
        self.wafer_orientation = None
        self.total_dies_number = 0
        self.current_die_col = 0
        self.current_die_row = 0
        self.current_die_subsite = 0

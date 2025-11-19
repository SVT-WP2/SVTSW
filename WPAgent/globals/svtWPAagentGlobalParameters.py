class SvtWPAagentGlobalParameters:
    """
    Singleton class to store global parameters for the WP Agent.
    Supports both manual and database-driven configuration.
    """
    _instance = None

    def __init__(self):
        # Core parameters
        self.address = None
        self.machine_type = None
        self.chip_name = None
        self.orientation = None
        self.project_name = None
        self.prober_status = "available"

        # Database-related parameters
        self.machine_id = None  # Database ID of the prober
        self.machine_name = None  # Human-readable name from database
        self.initialization_mode = None  # "manual" or "database"

    @classmethod
    def getInstance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def set_address(self, address):
        self.address = address

    def set_machine_type(self, machine_type):
        self.machine_type = machine_type

    def set_chip_name(self, chip_name):
        self.chip_name = chip_name

    def set_orientation(self, orientation):
        self.orientation = orientation

    def set_project_name(self, project_name):
        self.project_name = project_name

    def set_prober_status(self, prober_status):
        self.prober_status = prober_status

    def set_machine_id(self, machine_id):
        """Set the database ID of the prober"""
        self.machine_id = machine_id

    def set_machine_name(self, machine_name):
        """Set the human-readable name of the prober from database"""
        self.machine_name = machine_name

    def set_initialization_mode(self, mode):
        """Set how the prober was initialized: 'manual' or 'database'"""
        if mode not in ["manual", "database"]:
            raise ValueError(f"Invalid initialization mode: {mode}. Must be 'manual' or 'database'")
        self.initialization_mode = mode

    def get_info(self):
        """Get all current parameter values as a dictionary"""
        info = {
            "address": self.address,
            "machine_type": self.machine_type,
            "chip_name": self.chip_name,
            "orientation": self.orientation,
            "project_name": self.project_name,
            "prober_status": self.prober_status,
            "initialization_mode": self.initialization_mode
        }

        # Add database-specific info if available
        if self.machine_id is not None:
            info["machine_id"] = self.machine_id
        if self.machine_name is not None:
            info["machine_name"] = self.machine_name

        return info

    def get_log_context(self):
        """Get a formatted string for logging context"""
        machine_info = self.machine_name or self.address or "N/A"
        project_info = self.project_name or "N/A"
        return f"[{machine_info} | {project_info} | {self.prober_status}]"

    def load_from_dict(self, config: dict):
        """
        Load parameters from a dictionary (e.g. test config or mock).

        Args:
            config: Dictionary containing parameter values
        """
        self._apply_data(config)
        self.initialization_mode = config.get("initialization_mode", "manual")

    def load_from_db(self):
        """
        Placeholder for loading from a real database.
        Replace this method later with actual DB access logic.

        Note: This is kept for backward compatibility but should be replaced
        with the new database-driven initialization flow.
        """
        print("📄 Simulating DB load...")
        db_data = {
            "address": "wpmit01.cern.ch:35555",
            "machine_type": "sentio",
            "chip_name": "nkf7",
            "orientation": "E",
            "project_name": "nkf7_12_02_2025_arrow_E",
            "prober_status": "inuse",
            "initialization_mode": "database"
        }
        self._apply_data(db_data)

    def _apply_data(self, data: dict):
        """
        Internal method to apply data from a dictionary to instance variables.

        Args:
            data: Dictionary with parameter values
        """
        self.address = data.get("address")
        self.machine_type = data.get("machine_type", "sentio")
        self.chip_name = data.get("chip_name")
        self.orientation = data.get("orientation")
        self.project_name = data.get("project_name")
        self.prober_status = data.get("status", data.get("prober_status", "idle"))

        # Database-specific fields
        if "machine_id" in data:
            self.machine_id = data["machine_id"]
        if "machine_name" in data:
            self.machine_name = data["machine_name"]
        if "initialization_mode" in data:
            self.initialization_mode = data["initialization_mode"]

    def reset(self):
        """Reset all parameters to default values"""
        self.address = None
        self.machine_type = None
        self.chip_name = None
        self.orientation = None
        self.project_name = None
        self.prober_status = "available"
        self.machine_id = None
        self.machine_name = None
        self.initialization_mode = None
        print("🔄 Global parameters reset")

    def is_initialized(self):
        """Check if core parameters are set"""
        return (
                self.address is not None and
                self.machine_type is not None
        )
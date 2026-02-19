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
        self.orientation = None
        self.projectName = None
        self.prober_status = "available"
        self._alignmentDie = None
        self._homeDie = None
        self._project_metadata = {}

        # Database-related parameters
        self.machineId = None  # Database ID of the prober
        self.machineName = None  # Human-readable name from database
        self.initialization_mode = None  # "manual" or "database"

    @classmethod
    def getInstance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def set_alignmentDie(self, die_position):
        """Set alignment die position"""
        self._alignmentDie = die_position

    def get_alignmentDie(self):
        """Get alignment die position"""
        return self._alignmentDie

    def set_homeDie(self, die_position):
        """Set home die position"""
        self._homeDie = die_position

    def get_homeDie(self):
        """Get home die position"""
        return self._homeDie

    def set_project_metadata(self, metadata):
        """Store project metadata (projectId, asicFamily, orientation, etc.)"""
        self._project_metadata = metadata

    def get_project_metadata(self):
        """Get project metadata"""
        return self._project_metadata

    def set_address(self, address):
        self.address = address

    def set_machineType(self, machineType):
        self.machineType = machineType

    def set_chip_name(self, chip_name):
        self.chip_name = chip_name

    def set_orientation(self, orientation):
        self.orientation = orientation

    def set_projectName(self, projectName):
        self.projectName = projectName

    def set_prober_status(self, prober_status):
        self.prober_status = prober_status

    def set_machineId(self, machineId):
        """Set the database ID of the prober"""
        self.machineId = machineId

    def set_machineName(self, machineName):
        """Set the human-readable name of the prober from database"""
        self.machineName = machineName

    def set_initialization_mode(self, mode):
        """Set how the prober was initialized: 'manual' or 'database'"""
        if mode not in ["manual", "database"]:
            raise ValueError(f"Invalid initialization mode: {mode}. Must be 'manual' or 'database'")
        self.initialization_mode = mode

    def get_info(self):
        """Get all current parameter values as a dictionary"""
        info = {
            "address": self.address,
            "machineType": self.machineType,
            "chip_name": self.chip_name,
            "orientation": self.orientation,
            "projectName": self.projectName,
            "prober_status": self.prober_status,
            "initialization_mode": self.initialization_mode
        }

        # Add database-specific info if available
        if self.machineId is not None:
            info["machineId"] = self.machineId
        if self.machineName is not None:
            info["machineName"] = self.machineName

        return info

    def get_log_context(self):
        """Get a formatted string for logging context"""
        machine_info = self.machineName or self.address or "N/A"
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
        self.machineType = data.get("machineType", "sentio")
        self.chip_name = data.get("chip_name")
        self.orientation = data.get("orientation")
        self.projectName = data.get("projectName")
        self.prober_status = data.get("status", data.get("prober_status", "idle"))

        # Database-specific fields
        if "machineId" in data:
            self.machineId = data["machineId"]
        if "machineName" in data:
            self.machineName = data["machineName"]
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
        self.machineId = None
        self.machineName = None
        self.initialization_mode = None
        print("🔄 Global parameters reset")

    def is_initialized(self):
        """Check if core parameters are set"""
        return (
                self.address is not None and
                self.machineType is not None
        )
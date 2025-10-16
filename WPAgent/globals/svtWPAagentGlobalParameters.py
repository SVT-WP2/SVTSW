class SvtWPAagentGlobalParameters:
    _instance = None

    def __init__(self):
        self.address = None
        self.machine_type = None
        self.chip_name = None
        self.orientation = None
        self.project_name = None
        self.prober_status = "available"
        

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

    def get_info(self):
        return {
            "address": self.address,
            "machine_type": self.machine_type,
            "chip_name": self.chip_name,
            "orientation": self.orientation,
            "project_name": self.project_name,
            "prober_status": self.prober_status
        }

    def get_log_context(self):
        return f"[{self.project_id or 'N/A'} | {self.device_id or 'N/A'} | {self.prober_status}]"

    def load_from_dict(self, config: dict):
        """
        Load parameters from a dictionary (e.g. test config or mock).
        """
        self._apply_data(config)

    def load_from_db(self):
        """
        Placeholder for loading from a real database.
        Replace this method later with actual DB access logic.
        """
        print("🔄 Simulating DB load...")
        db_data = {
            "address": "wpmit01.cern.ch:35555",
            "machine_type": "sentio",
            "chip_name": "nkf7",
            "orientation": "E",
            "project_name": "nkf7_12_02_2025_arrow_E",
            "prober_status": "inuse"
        }
        self._apply_data(db_data)

    def _apply_data(self, data: dict):
        self.address = data.get("address")
        self.machine_type = data.get("machine_type", "sentio")
        self.chip_name = data.get("chip_name")
        self.orientation = data.get("orientation")
        self.project_name = data.get("project_name")
        self.prober_status = data.get("status", "idle")

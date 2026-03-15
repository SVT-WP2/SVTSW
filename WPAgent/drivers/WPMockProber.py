import time
import random


class MockProberImpl:
    """
    Mock Prober - Implements same interface as SentioProberImpl

    """

    def __init__(self, address="mock-prober:35555"):
        """
        Initialize mock prober

        Args:
            address: Mock address (not used, but kept for interface compatibility)
        """
        self.address = address
        self.is_connected = True  # Mock is always "connected"

        # Simulated state
        self.current_project = None
        self.chuck_position = {"x": 0.0, "y": 0.0, "z": 50.0}  # Start at separation
        self.current_die = {"col": 0, "row": 0, "subsite": 0}
        self.wafer_loaded = False
        self.camera_position = "Top"
        self.overdrive = 0
        self.overdrive_enabled = False



    def open_project(self, project_name):
        """Simulate opening a project"""
        time.sleep(0.2)  # Simulate delay
        self.current_project = project_name
        return f"Project {project_name} opened (mock)"


    def load_wafer(self):
        """Simulate loading wafer"""
        time.sleep(0.5)
        self.wafer_loaded = True
        self.chuck_position["z"] = 50.0  # Separation position
        return "Wafer loaded to center (mock)"

    def unload_wafer(self):
        """Simulate unloading wafer"""
        time.sleep(0.5)
        self.wafer_loaded = False
        self.chuck_position = {"x": 0.0, "y": 0.0, "z": 0.0}
        self.current_die = {"col": 0, "row": 0, "subsite": 0}
        return "Wafer unloaded (mock)"

    def align_wafer(self, col, row, subsite=0):
        """Simulate wafer alignment"""
        time.sleep(1.0)
        self.current_die = {"col": col, "row": row, "subsite": subsite}
        return f"Wafer aligned at die {col},{row},{subsite} (mock)"


    def move_chuck_xy(self, x, y):
        """Simulate XY movement"""
        time.sleep(0.3)
        self.chuck_position["x"] = x
        self.chuck_position["y"] = y
        return f"Chuck moved to X={x}, Y={y} (mock)"

    def move_chuck_z(self, z):
        """Simulate Z movement"""
        time.sleep(0.3)
        self.chuck_position["z"] = z
        return f"Chuck moved to Z={z} (mock)"

    def move_chuck_home(self):
        """Simulate moving to home position"""
        time.sleep(0.5)
        self.chuck_position = {"x": 0.0, "y": 0.0, "z": 0.0}
        return "Chuck at home position (mock)"

    def go_to_contact(self):
        """Simulate moving to contact"""
        time.sleep(0.4)
        self.chuck_position["z"] = 100.0  # Contact position
        return "Probes in contact (mock)"

    def go_to_separation(self):
        """Simulate moving to separation"""
        time.sleep(0.4)
        self.chuck_position["z"] = 50.0  # Separation position
        return "Probes in separation (mock)"


    def step_next_die(self):
        """Simulate stepping to next die"""
        time.sleep(0.3)
        self.current_die["col"] += 1
        if self.current_die["col"] > 10:  # Wrap to next row
            self.current_die["col"] = 0
            self.current_die["row"] += 1

        result = f"Die: {self.current_die['col']},{self.current_die['row']}"
        return result

    def step_prev_die(self):
        """Simulate stepping to previous die"""
        time.sleep(0.3)
        self.current_die["col"] -= 1
        if self.current_die["col"] < 0:
            self.current_die["col"] = 10
            self.current_die["row"] -= 1

        result = f"Die: {self.current_die['col']},{self.current_die['row']}"
        return result

    def go_to_die(self, col, row):
        """Simulate going to specific die"""
        time.sleep(0.4)
        self.current_die["col"] = col
        self.current_die["row"] = row
        return f"Moved to die {col},{row} (mock)"


    def switch_camera(self, mount_point):
        """
        Simulate switching camera

        Args:
            mount_point: "Top", "Offaxis", "Wide", etc.
        """
        time.sleep(0.2)
        self.camera_position = mount_point
        return f"Camera switched to {mount_point} (mock)"

    def auto_focus(self):
        """Simulate auto-focus"""
        time.sleep(0.5)
        return "Auto-focus complete (mock)"

    def run_ptpa(self):
        """Simulate PTPA alignment"""
        time.sleep(1.0)
        return "PTPA alignment successful (mock)"


    def find_home(self):
        """Simulate finding home"""
        time.sleep(0.5)
        return "Home position found (mock)"

    def local_mode(self):
        """Simulate switching to local mode"""
        return "Local mode (mock)"

    def clean_probe_station(self):
        """Simulate cleaning"""
        time.sleep(2.0)
        return "Cleaning complete (mock)"

    def move_chuck_work_area(self, area):
        """
        Simulate moving to work area

        Args:
            area: 0 = Probing, 1 = Offaxis, etc.
        """
        time.sleep(0.3)
        area_names = {0: "Probing", 1: "Offaxis"}
        area_name = area_names.get(area, f"Area{area}")
        return f"Moved to work area {area_name} (mock)"


    def set_overtravel(self, value):
        """
        Simulate setting overtravel

        Args:
            value: Overtravel gap value
        """
        self.overdrive = value
        return f"Overtravel set to {value} (mock)"

    def enable_overtravel(self, overtravel=True):
        """
        Simulate enabling/disabling overtravel

        Args:
            overtravel: True to enable, False to disable
        """
        self.overdrive_enabled = overtravel
        status = "enabled" if overtravel else "disabled"
        return f"Overtravel {status} (mock)"


    def get_chuck_position(self):
        """Get current chuck position"""
        return self.chuck_position

    def get_status(self):
        """Get prober status"""
        status = {
            "connected": self.is_connected,
            "project": self.current_project,
            "wafer_loaded": self.wafer_loaded,
            "chuck_position": self.chuck_position,
            "current_die": self.current_die,
            "camera": self.camera_position,
            "overdrive": self.overdrive,
            "overdrive_enabled": self.overdrive_enabled
        }
        return status

    def connect(self):
        """Mock connection (always succeeds)"""
        self.is_connected = True
        return True

    def disconnect(self):
        """Mock disconnection"""
        self.is_connected = False

    def is_alive(self):
        """Check if mock prober is alive (always True)"""
        return self.is_connected

    def __repr__(self):
        return f"MockProberImpl(address='{self.address}', connected={self.is_connected})"

    def __str__(self):
        return f"Mock Prober at {self.address} (simulated)"

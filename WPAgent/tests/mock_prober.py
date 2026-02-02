# ============================================================================
# MOCK PROBER - For Testing Without Real Hardware
# ============================================================================

"""
Mock implementation of the prober interface for testing.
Simulates all prober behavior without requiring actual hardware.
"""

from interfaces.WPProberInterface import AbstractProber


class MockProber(AbstractProber):
    """
    Mock prober that simulates all operations without real hardware.
    Tracks internal state for realistic testing.
    """

    def __init__(self, address):
        self.address = address

        # Simulated state
        self._is_initialized = False
        self._wafer_loaded = False
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        self._chuck_position = {"x": 0.0, "y": 0.0, "z": 10000.0}  # Start at separation
        self._z_state = "Separation"  # "Contact", "Separation", "Lift"
        self._project_opened = False

        print(f"🔧 MockProber created for {address}")

    def initialize(self):
        """Simulate initialization."""
        self._is_initialized = True
        print("✅ Mock prober initialized")

    def open_project(self, path: str):
        """Simulate opening project."""
        self._project_opened = True
        print(f"📂 Mock: Opened project {path}")

    def move_chuck_xy(self, x: float, y: float):
        """Simulate XY movement."""
        self._chuck_position["x"] = x
        self._chuck_position["y"] = y
        print(f"➡️  Mock: Moved chuck to X={x}, Y={y}")
        return (x, y)

    def move_chuck_z(self, z: float):
        """Simulate Z movement."""
        self._chuck_position["z"] = z
        print(f"⬆️  Mock: Moved chuck to Z={z}")
        return z

    def run_ptpa(self):
        """Simulate PTPA."""
        print("🎯 Mock: PTPA executed")

    def step_next_die(self):
        """Simulate stepping to next die."""
        self._current_die["col"] += 1
        print(f"👣 Mock: Stepped to die {self._current_die['col']},{self._current_die['row']}")
        return self._current_die

    def step_prev_die(self):
        """Simulate stepping to previous die."""
        self._current_die["col"] -= 1
        print(f"👣 Mock: Stepped to die {self._current_die['col']},{self._current_die['row']}")
        return self._current_die

    def go_to_die(self, col: int, row: int):
        """Simulate moving to specific die."""
        self._current_die["col"] = col
        self._current_die["row"] = row
        print(f"🎯 Mock: Moved to die {col},{row}")
        return (col, row)

    def switch_camera(self, mount_point: str):
        """Simulate camera switch."""
        print(f"📷 Mock: Switched camera to {mount_point}")

    def move_chuck_home(self):
        """Simulate moving to home."""
        self._chuck_position = {"x": 0.0, "y": 0.0, "z": 10000.0}
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        print("🏠 Mock: Moved chuck home")

    def unload_wafer(self):
        """Simulate unloading wafer."""
        self._wafer_loaded = False
        self._z_state = "Separation"
        self._chuck_position["z"] = 10000.0
        print("📤 Mock: Wafer unloaded")

    def local_mode(self):
        """Simulate local mode."""
        print("🔓 Mock: Local mode")

    def load_wafer(self):
        """Simulate loading wafer."""
        self._wafer_loaded = True
        self._z_state = "Separation"
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        print("📥 Mock: Wafer loaded to center")

    def find_home(self):
        """Simulate finding home."""
        print("🔍 Mock: Home position found")

    def align_wafer(self, align_die_col: int, align_die_row: int, subsite: int = 0):
        """Simulate wafer alignment."""
        print(f"⚡ Mock: Wafer aligned at die {align_die_col},{align_die_row},{subsite}")
        return (align_die_col, align_die_row, subsite)

    def go_to_contact(self):
        """Simulate moving to contact."""
        self._z_state = "Contact"
        self._chuck_position["z"] = 0.0
        print("⬇️  Mock: Moved to contact")

    def go_to_separation(self):
        """Simulate moving to separation."""
        self._z_state = "Separation"
        self._chuck_position["z"] = 10000.0
        print("⬆️  Mock: Moved to separation")

    def auto_focus(self):
        """Simulate auto focus."""
        print("🔍 Mock: Auto-focus completed")

    def move_chuck_work_area(self, work_area):
        """Simulate moving to work area."""
        print(f"🏭 Mock: Moved to work area {work_area}")

    def get_current_index(self):
        """Return current die index."""
        result = f"{self._current_die['col']},{self._current_die['row']},{self._current_die['subsite']}"
        print(f"📍 Mock: Current index = {result}")
        return result

    def get_current_die_position(self):
        """Return current die position as dict."""
        print(f"📍 Mock: Current die position = {self._current_die}")
        return self._current_die

    def get_current_z_position(self):
        """Return current Z position."""
        z = self._chuck_position["z"]
        print(f"📏 Mock: Current Z = {z}")
        return z

    def get_dies_number(self):
        """Return total number of dies."""
        print("🔢 Mock: Total dies = 150")
        return "150"

    def get_camera_status(self):
        """Return camera status."""
        print("📷 Mock: Camera status = Active")
        return "Active"

    def get_chuck_position(self):
        """Return chuck Z state."""
        result = f"In {self._z_state}"
        print(f"📍 Mock: Chuck state = {result}")
        return result

    def get_chuck_xyz_position(self):
        """Return current XYZ position."""
        pos = {
            "x": self._current_die["col"],  # Using die col as X
            "y": self._current_die["row"],  # Using die row as Y
            "z": self._chuck_position["z"]
        }
        print(f"📍 Mock: Chuck XYZ = {pos}")
        return pos
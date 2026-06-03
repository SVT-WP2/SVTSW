import time
import os
import datetime

# Working-area constants (mirrors SENTIO position-hint values)
AREA_PROBING = "Probing"
AREA_OFFAXIS = "OffAxisCamera"
AREA_WIDE = "WideFieldCamera"


class MockProberImpl:
    """
    Full mock of SentioProberImpl.

    Every method returns the same data shape the real prober would return
    so the rest of the codebase (actions, globals, response builder) works
    identically whether a real machine is connected or not.
    """

    def __init__(self, address="mock-prober:35555"):
        self.address = address

        # Connection state
        self._connected = True

        # Chuck state
        self._chuck_xy = {"x": 0.0, "y": 0.0}
        self._chuck_z = 50.0  # 50 um = separation height
        self._at_contact = False
        self._working_area = AREA_PROBING

        # Wafer / project state
        self._project = None
        self._wafer_loaded = False
        self._wafer_id = None
        self._orientation = None

        # Die map (10x10 mock map, 100 total / 100 good / 0 bad)
        self._total_dies = 100
        self._good_dies = 100
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        self._die_index = 0

        # Camera
        self._camera = "TopCamera"

        # Overtravel
        self._overtravel_gap = 0.0
        self._overtravel_enabled = False

        # PTPA
        self._ptpa_enabled = False

        print(f"[MockProber] Initialized at {address}")

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def initialize(self):
        """Simulate hardware initialisation (always succeeds)."""
        time.sleep(0.2)
        print("[MockProber] Initialization complete")
        return "0,OK"

    def connect(self):
        self._connected = True
        return True

    def disconnect(self):
        self._connected = False

    def is_alive(self):
        return self._connected

    # ------------------------------------------------------------------
    # Project
    # ------------------------------------------------------------------

    def open_project(self, path: str):
        time.sleep(0.2)
        self._project = path
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        self._die_index = 0
        print(f"[MockProber] Project opened: {path}")
        return f"0,{path}"

    # ------------------------------------------------------------------
    # Wafer
    # ------------------------------------------------------------------

    def load_wafer(self):
        time.sleep(0.5)
        self._wafer_loaded = True
        self._chuck_z = 50.0
        self._working_area = AREA_PROBING
        print("[MockProber] Wafer loaded")
        return "0,OK"

    def unload_wafer(self):
        time.sleep(0.5)
        self._wafer_loaded = False
        self._wafer_id = None
        self._orientation = None
        self._current_die = {"col": 0, "row": 0, "subsite": 0}
        self._die_index = 0
        self._chuck_xy = {"x": 0.0, "y": 0.0}
        print("[MockProber] Wafer unloaded")
        return "0,OK"

    def align_wafer(self, align_die_col: int, align_die_row: int, subsite: int = 0):
        time.sleep(1.0)
        self._current_die = {
            "col": align_die_col,
            "row": align_die_row,
            "subsite": subsite,
        }
        self._die_index = align_die_col * 10 + align_die_row
        print(f"[MockProber] Wafer aligned at die ({align_die_col}, {align_die_row})")
        return f"0,{align_die_col},{align_die_row},{subsite}"

    # ------------------------------------------------------------------
    # Chuck - XY / Z movement
    # ------------------------------------------------------------------

    def move_chuck_xy(self, x: float, y: float, position: str = "Site"):
        time.sleep(0.3)
        self._chuck_xy = {"x": x, "y": y}
        return f"0,{x},{y}"

    def move_chuck_z(self, z: float):
        time.sleep(0.3)
        self._chuck_z = z
        return f"0,{z}"

    def move_chuck_home(self):
        time.sleep(0.5)
        self._chuck_xy = {"x": 0.0, "y": 0.0}
        self._chuck_z = 0.0
        self._working_area = AREA_PROBING
        return "0,OK"

    def move_chuck_center(self):
        """Move chuck to wafer centre (used before loading / unloading)."""
        time.sleep(0.4)
        self._chuck_xy = {"x": 0.0, "y": 0.0}
        self._working_area = AREA_PROBING
        return "0,OK"

    def move_chuck_offaxis_area(self):
        """Move chuck to off-axis camera area."""
        time.sleep(0.5)
        self._working_area = AREA_OFFAXIS
        self._camera = "OffAxisCamera"
        return "0,OK"

    def move_chuck_wide(self):
        """Move chuck to wide-field camera area."""
        time.sleep(0.5)
        self._working_area = AREA_WIDE
        self._camera = "WideFieldCamera"
        return "0,OK"

    def move_chuck_work_area(self, work_area):
        """Move to a numbered work area: 0=Probing, 1=OffAxis, 2=WideField."""
        time.sleep(0.3)
        mapping = {0: AREA_PROBING, 1: AREA_OFFAXIS, 2: AREA_WIDE}
        self._working_area = mapping.get(int(work_area), AREA_PROBING)
        return f"0,{self._working_area}"

    # ------------------------------------------------------------------
    # Chuck - contact / separation
    # ------------------------------------------------------------------

    def go_to_contact(self):
        time.sleep(0.4)
        self._at_contact = True
        self._chuck_z = 100.0
        return "0,OK"

    def go_to_separation(self):
        time.sleep(0.4)
        self._at_contact = False
        self._chuck_z = 50.0
        return "0,OK"

    # ------------------------------------------------------------------
    # Chuck - position queries
    # ------------------------------------------------------------------

    def get_chuck_position(self) -> str:
        """
        Return "In Contact" or "In Separation".
        Matches SentioProberImpl.get_chuck_position() so
        globals.chuck_z_position_state is set correctly.
        """
        return "In Contact" if self._at_contact else "In Separation"

    def get_current_working_area(self) -> str:
        """
        Return the current working area string.
        update_current_info() calls .removesuffix("Camera") on this value.
        """
        return self._working_area

    # ------------------------------------------------------------------
    # Die navigation
    # ------------------------------------------------------------------

    def step_next_die(self) -> str:
        """Advance to next die. Returns 'index,col,row'."""
        time.sleep(0.3)
        self._current_die["col"] += 1
        if self._current_die["col"] >= 10:
            self._current_die["col"] = 0
            self._current_die["row"] += 1
        self._die_index += 1
        col = self._current_die["col"]
        row = self._current_die["row"]
        return f"{self._die_index},{col},{row}"

    def step_prev_die(self) -> str:
        """Step back one die. Returns 'index,col,row'."""
        time.sleep(0.3)
        self._current_die["col"] -= 1
        if self._current_die["col"] < 0:
            self._current_die["col"] = 9
            self._current_die["row"] -= 1
        self._die_index = max(0, self._die_index - 1)
        col = self._current_die["col"]
        row = self._current_die["row"]
        return f"{self._die_index},{col},{row}"

    def go_to_die(self, col: int, row: int, subsite: int = 0) -> str:
        """Jump directly to a die. Returns 'index,col,row,subsite'."""
        time.sleep(0.4)
        self._current_die = {"col": col, "row": row, "subsite": subsite}
        self._die_index = col * 10 + row
        return f"{self._die_index},{col},{row},{subsite}"

    def get_current_index(self) -> str:
        """
        Return current die as 'index,col,row'.
        update_current_info() parses index [1] as col and [2] as row.
        """
        col = self._current_die["col"]
        row = self._current_die["row"]
        return f"{self._die_index},{col},{row}"

    def get_dies_number(self) -> str:
        """
        Return die counts as 'total,good,bad'.
        update_current_info() parses index [0] as total.
        """
        bad = self._total_dies - self._good_dies
        return f"{self._total_dies},{self._good_dies},{bad}"

    # ------------------------------------------------------------------
    # Camera
    # ------------------------------------------------------------------

    def switch_camera(self, mountPoint: str):
        time.sleep(0.2)
        self._camera = mountPoint
        return f"0,{mountPoint}"

    def get_camera_status(self) -> str:
        return self._camera

    def auto_focus(self):
        time.sleep(0.5)
        return "0,OK"

    def take_screenshot(
        self,
        filename: str = None,
        snapshot_type: str = "CameraRaw",
        save_locally: bool = True,
        output_dir: str = "screenshotsSVT",
    ) -> str:
        """
        Simulate taking a screenshot.
        Creates an empty placeholder file so any code that checks the
        returned path does not crash.
        """
        if filename is None:
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mock_screenshot_{ts}.png"

        if save_locally:
            os.makedirs(output_dir, exist_ok=True)
            path = os.path.join(output_dir, filename)
            open(path, "wb").close()
            print(f"[MockProber] Screenshot saved: {path}")
            return path

        return f"/mock/remote/{filename}"

    # ------------------------------------------------------------------
    # Overtravel
    # ------------------------------------------------------------------

    def set_overtravel(self, overtravelGap: float):
        self._overtravel_gap = overtravelGap
        return f"0,{overtravelGap}"

    def enable_overtravel(self, overtravel: bool):
        self._overtravel_enabled = overtravel
        return f"0,{overtravel}"

    # ------------------------------------------------------------------
    # PTPA
    # ------------------------------------------------------------------

    def set_ptpa(self, enable: bool):
        """Enable or disable PTPA compensation."""
        self._ptpa_enabled = enable
        return f"0,{enable}"

    def run_ptpa(self):
        time.sleep(1.0)
        print("[MockProber] PTPA alignment complete")
        return "0,OK"

    # ------------------------------------------------------------------
    # Home / local / clean
    # ------------------------------------------------------------------

    def find_home(self):
        time.sleep(0.5)
        self._chuck_xy = {"x": 0.0, "y": 0.0}
        self._chuck_z = 0.0
        return "0,OK"

    def local_mode(self):
        return "0,LocalMode"

    def clean_probe_station(self):
        time.sleep(2.0)
        return "0,OK"

    # ------------------------------------------------------------------
    # Repr
    # ------------------------------------------------------------------

    def __repr__(self):
        return (
            f"MockProberImpl(address='{self.address}', "
            f"connected={self._connected}, "
            f"wafer={self._wafer_loaded}, "
            f"die=({self._current_die['col']},{self._current_die['row']}), "
            f"contact={self._at_contact})"
        )

    def __str__(self):
        return f"Mock Prober at {self.address}"

    def get_machine_status(self) -> str:
        """Mock always returns Ready"""
        return "Ready"

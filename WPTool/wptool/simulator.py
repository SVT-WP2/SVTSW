"""The simulator of the prober (D19): `SimulatedProber`, used in the tests and with --mock.

It has the methods of the shared `SentioProberImpl` that the driver layer (`wptool.driver`) uses, with the same return
formats, and it follows the SENTIO semantics: `Zero` sets the position, `Relative` adds to it, `Center` is the center
plus (x, y). WPAgent's `WPMockProber` is not used by the tool.

One simulator per tool process: `Connection.simulator`. Every connection with --mock (also after Disconnect and
Initialize force=true) is a new `SimulatorLink` to the same simulator, as a real machine keeps its state while
connections come and go: only the `connected` of the link changes. A call on a closed link raises, as a call on a
closed socket does.

What only the real machine can tell (the work area after each move, the Z hint) is in the tables below, in one place,
so that the run on WPMIT (the checklist of the plan) can correct them.

Test hooks:
- `move_error_um`: (dx, dy) added to every XY move (`move_chuck_xy`), to test the precise move of #410.
- `fail_next(method_name, exception)`: the next call of that method raises the exception (after it is recorded).
- `calls`: every call as `(method, args)`, in order, the calls of the links (`is_alive`, `disconnect`) too.
- `position_text`: when set, the text that `get_chuck_position()` reports (any `In <value>`, or `Error: ...`).
- `drop_connections()`: every link is lost (a restarted machine): `is_alive()` gives false.
- Every value is a plain attribute that a test can set: `x`, `y`, `z`, `area`, `contact_height`, `col`, `row`, ...
"""

from __future__ import annotations

import importlib.util
import json
import logging
from pathlib import Path

log = logging.getLogger("wptool.simulator")

# --- What only the real machine can tell: the best guess of the plan, until the run on WPMIT corrects it. ---

# The work area at the start, as `get_current_working_area()` reports it (the first part of SENTIO's
# `get_chuck_position_hint`; the driver's comment lists Probing, FrontLoad, SideLoad and OffAxisCamera).
START_AREA = "OffAxisCamera"

# The work area after each move.
AREA_AFTER = {
    "move_chuck_offaxis_area": "OffAxisCamera",  # a status of WPMIT shows it
    "move_chuck_wide": "Probing",  # the driver sends WorkArea.Probing (WPSentioProber.py line 212)
    "move_chuck_center": "Probing",  # not known: the run on WPMIT records it
    "move_chuck_home": "Probing",  # not known: the run on WPMIT records it
}

# The Z hint, as `get_chuck_position()` reports it (the SENTIO driver turns SENTIO's Z_Position_Hint into
# `In <value>`, WPSentioProber.py lines 276-319).
HINT_AT_CONTACT = "In Contact"
# Separated (at the start, and after go_to_separation), by work area. `In Default` in the off-axis area is what WPMIT
# reports there (D11).
HINT_SEPARATED = {"OffAxisCamera": "In Default", "Probing": "In Separation"}
# Separated in an area of no row above (a test that sets another area): the hint that the separation check refuses.
HINT_SEPARATED_OTHER_AREA = "In Default"
# After move_chuck_z: a height that SENTIO has no name for (a guess). The separation check refuses it in Probing.
HINT_AFTER_Z_MOVE = "In Default"

# --- The simulator's own values. ---

CENTER_XY = (0.0, 0.0)  # SENTIO's Center reference
HOME_XY = (1000.0, -2000.0)  # where move_chuck_home moves to, and where die (0, 0) is
DIE_PITCH_UM = (3000.0, 2500.0)  # the die (col, row) is at HOME_XY plus (col, row) times the pitch
CONTACT_HEIGHT_UM = 10000.0
SEPARATION_GAP_UM = 200.0  # the separation height is the contact height minus this gap
FOCUS_UM = 15300.0  # what auto_focus() returns, as WPAgent's mock
# Small fixed changes of (x, y, contact height), so that the "before" and "after" data of those commands differ.
PTPA_SHIFT_UM = (0.35, -0.20, 0.10)  # as WPAgent's mock
FIND_HOME_SHIFT_UM = (0.25, -0.15, 0.05)

# The die map: by default it covers every die of the two map files of the shared package, widened by 2 on each side
# (today columns -4 to 1 and rows -2 to 11, so -6 to 3 and -4 to 13). Without the package: -5 to 5.
MAP_PACKAGE = "svt_wp_core"
MAP_FILES = ("WPMapConversion_ER2.json", "WPMapConversion_ER2B.json")
MAP_MARGIN = 2
DEFAULT_DIE_RANGE = (-5, 5, -5, 5)  # (col_min, col_max, row_min, row_max)

REFERENCES = ("Zero", "Relative", "Center")

# The methods of SentioProberImpl that the driver layer uses. A link passes only these on to the simulator.
METHODS = (
    "local_mode",
    "open_project",
    "move_chuck_xy",
    "move_chuck_z",
    "move_chuck_center",
    "move_chuck_home",
    "move_chuck_offaxis_area",
    "move_chuck_wide",
    "go_to_contact",
    "go_to_separation",
    "go_to_die",
    "find_home",
    "auto_focus",
    "align_wafer",
    "run_ptpa",
    "set_ptpa",
    "get_contact_height",
    "set_contact_height",
    "set_overtravel",
    "enable_overtravel",
    "get_chuck_xy",
    "get_chuck_z",
    "get_chuck_position",
    "get_current_working_area",
    "get_current_index",
    "get_dies_number",
)


class SimulatorError(Exception):
    """What SENTIO would refuse: a die that is not on the map, a reference that does not exist."""


def map_die_range() -> tuple[int, int, int, int]:
    """(col_min, col_max, row_min, row_max): every die of the two map files of the shared package, widened.

    The files are read from the package folder without importing the package. Without the package: -5 to 5.
    """
    try:
        spec = importlib.util.find_spec(MAP_PACKAGE)
    except (ImportError, ValueError, AttributeError):
        spec = None
    if spec is None or not spec.submodule_search_locations:
        log.debug("The shared package %s is not installed: the simulator's die map is %s", MAP_PACKAGE, DEFAULT_DIE_RANGE)
        return DEFAULT_DIE_RANGE
    folder = Path(list(spec.submodule_search_locations)[0]) / "configs"
    cols: list[int] = []
    rows: list[int] = []
    try:
        for name in MAP_FILES:
            data = json.loads((folder / name).read_text(encoding="utf-8"))
            for die in data["dies"]:
                cols.append(int(die["column_local"]))
                rows.append(int(die["row_local"]))
    except (OSError, ValueError, KeyError, TypeError) as e:
        log.warning("Cannot read the die maps of %s (%s): the simulator's die map is %s", folder, e, DEFAULT_DIE_RANGE)
        return DEFAULT_DIE_RANGE
    if not cols:
        return DEFAULT_DIE_RANGE
    return (min(cols) - MAP_MARGIN, max(cols) + MAP_MARGIN, min(rows) - MAP_MARGIN, max(rows) + MAP_MARGIN)


class SimulatedProber:
    """The simulated machine: its state, the methods of the SENTIO driver, and the test hooks (see the module)."""

    def __init__(self, die_range: tuple[int, int, int, int] | None = None):
        self.calls: list[tuple[str, tuple]] = []
        self.links: list[SimulatorLink] = []
        self._fail: dict[str, BaseException] = {}
        self.move_error_um: tuple[float, float] = (0.0, 0.0)
        self.position_text: str | None = None
        self.local_mode_calls = 0

        self.center_xy = CENTER_XY
        self.home_xy = HOME_XY
        self.die_pitch_um = DIE_PITCH_UM
        self.x, self.y = HOME_XY
        self.area = START_AREA
        self.at_contact = False
        self.z_moved = False  # after move_chuck_z, until the next contact or separation
        self.contact_height = CONTACT_HEIGHT_UM
        self.separation_gap = SEPARATION_GAP_UM
        self.z = self.contact_height - self.separation_gap
        self.overtravel_gap = 0.0
        self.overtravel_enabled = False
        self.ptpa_enabled = False
        self.project: str | None = None
        self.aligned = False
        self.focus_um = FOCUS_UM
        self.ptpa_shift_um = PTPA_SHIFT_UM
        self.find_home_shift_um = FIND_HOME_SHIFT_UM

        self.col_min, self.col_max, self.row_min, self.row_max = die_range or map_die_range()
        self.col, self.row = 0, 0
        if not self.on_map(0, 0):
            self.col, self.row = self.col_min, self.row_min

    def __repr__(self) -> str:
        return (
            f"SimulatedProber(x={self.x}, y={self.y}, z={self.z}, area={self.area!r}, contact={self.at_contact}, "
            f"die=({self.col}, {self.row}))"
        )

    # --- Test hooks ---

    def fail_next(self, method_name: str, exception: BaseException) -> None:
        """The next call of `method_name` raises `exception` (once)."""
        if method_name not in METHODS:
            raise ValueError(f"The simulator has no method {method_name}")
        self._fail[method_name] = exception

    def link(self) -> SimulatorLink:
        """A new connection to this simulator."""
        link = SimulatorLink(self)
        self.links.append(link)
        return link

    def drop_connections(self) -> None:
        """Test hook: every connection is lost (the machine restarted, a cable): `is_alive()` gives false."""
        for link in self.links:
            link.connected = False

    def _call(self, method: str, *args) -> None:
        self.calls.append((method, args))
        exception = self._fail.pop(method, None)
        if exception is not None:
            raise exception

    # --- The die map ---

    def on_map(self, col: int, row: int) -> bool:
        return self.col_min <= col <= self.col_max and self.row_min <= row <= self.row_max

    def dies_number(self) -> int:
        return (self.col_max - self.col_min + 1) * (self.row_max - self.row_min + 1)

    def die_index(self, col: int, row: int) -> int:
        return (row - self.row_min) * (self.col_max - self.col_min + 1) + (col - self.col_min)

    def _step_die(self, col: int, row: int) -> None:
        col, row = int(col), int(row)
        if not self.on_map(col, row):
            raise SimulatorError(
                f"The die ({col}, {row}) is not on the wafer map (columns {self.col_min} to {self.col_max}, "
                f"rows {self.row_min} to {self.row_max})"
            )
        self.col, self.row = col, row
        self.x = self.home_xy[0] + col * self.die_pitch_um[0]
        self.y = self.home_xy[1] + row * self.die_pitch_um[1]

    # --- Z ---

    def _hint(self) -> str:
        if self.position_text is not None:
            return self.position_text
        if self.at_contact:
            return HINT_AT_CONTACT
        if self.z_moved:
            return HINT_AFTER_Z_MOVE
        return HINT_SEPARATED.get(self.area, HINT_SEPARATED_OTHER_AREA)

    def _move_area(self, method: str) -> None:
        self.area = AREA_AFTER[method]

    # --- The methods of SentioProberImpl, with its return formats ---

    def local_mode(self) -> None:
        self._call("local_mode")
        self.local_mode_calls += 1

    def open_project(self, path: str) -> None:
        self._call("open_project", path)
        self.project = path

    def move_chuck_xy(self, x: float, y: float, position: str) -> tuple[float, float]:
        self._call("move_chuck_xy", x, y, position)
        if position == "Zero":
            nx, ny = float(x), float(y)
        elif position == "Relative":
            nx, ny = self.x + float(x), self.y + float(y)
        elif position == "Center":
            nx, ny = self.center_xy[0] + float(x), self.center_xy[1] + float(y)
        else:
            # The SENTIO driver passes None to the library, which fails before it sends anything.
            raise SimulatorError(f"Unknown reference for move_chuck_xy: {position!r}")
        self.x = nx + self.move_error_um[0]
        self.y = ny + self.move_error_um[1]
        return self.x, self.y

    def move_chuck_z(self, z: float) -> float:
        self._call("move_chuck_z", z)
        self.z = float(z)
        self.at_contact = False
        self.z_moved = True
        return self.z

    def move_chuck_center(self) -> None:
        self._call("move_chuck_center")
        self.x, self.y = self.center_xy
        self._move_area("move_chuck_center")

    def move_chuck_home(self) -> None:
        self._call("move_chuck_home")
        self.x, self.y = self.home_xy
        self._move_area("move_chuck_home")

    def move_chuck_offaxis_area(self) -> None:
        self._call("move_chuck_offaxis_area")
        self._move_area("move_chuck_offaxis_area")

    def move_chuck_wide(self) -> None:
        self._call("move_chuck_wide")
        self._move_area("move_chuck_wide")

    def go_to_contact(self) -> None:
        self._call("go_to_contact")
        self.at_contact = True
        self.z_moved = False
        self.z = self.contact_height + (self.overtravel_gap if self.overtravel_enabled else 0.0)

    def go_to_separation(self) -> None:
        self._call("go_to_separation")
        self.at_contact = False
        self.z_moved = False
        self.z = self.contact_height - self.separation_gap

    def go_to_die(self, col: int, row: int) -> tuple[int, int, int]:
        self._call("go_to_die", col, row)
        self._step_die(col, row)
        return self.col, self.row, 0

    def find_home(self) -> None:
        self._call("find_home")
        dx, dy, dz = self.find_home_shift_um
        self.x += dx
        self.y += dy
        self.contact_height += dz

    def auto_focus(self) -> float:
        self._call("auto_focus")
        return float(self.focus_um)

    def align_wafer(self, align_die_col: int, align_die_row: int, subsite: int = 0) -> None:
        self._call("align_wafer", align_die_col, align_die_row, subsite)
        self._step_die(align_die_col, align_die_row)
        self.aligned = True

    def run_ptpa(self) -> None:
        self._call("run_ptpa")
        dx, dy, dz = self.ptpa_shift_um
        self.x += dx
        self.y += dy
        self.contact_height += dz

    def set_ptpa(self, enable: bool) -> None:
        # SentioProberImpl returns the library's response here; the driver layer does not use it.
        self._call("set_ptpa", enable)
        self.ptpa_enabled = bool(enable)

    def get_contact_height(self) -> float:
        self._call("get_contact_height")
        return float(self.contact_height)

    def set_contact_height(self, height: float) -> None:
        self._call("set_contact_height", height)
        self.contact_height = float(height)

    def set_overtravel(self, overtravelGap: float) -> None:
        self._call("set_overtravel", overtravelGap)
        self.overtravel_gap = float(overtravelGap)

    def enable_overtravel(self, overtravel: bool) -> None:
        self._call("enable_overtravel", overtravel)
        self.overtravel_enabled = bool(overtravel)

    def get_chuck_xy(self) -> tuple[float, float]:
        self._call("get_chuck_xy")
        return float(self.x), float(self.y)

    def get_chuck_z(self) -> float:
        self._call("get_chuck_z")
        return float(self.z)

    def get_chuck_position(self) -> str:
        self._call("get_chuck_position")
        return self._hint()

    def get_current_working_area(self) -> str:
        self._call("get_current_working_area")
        return self.area

    def get_current_index(self) -> str:
        # The text of SENTIO's map:die:get_current_index, as WPAgent reads it: "index,col,row".
        self._call("get_current_index")
        return f"{self.die_index(self.col, self.row)},{self.col},{self.row}"

    def get_dies_number(self) -> str:
        # The library's map.get_num_dies() gives an int, and the SENTIO driver makes it a text: "n".
        self._call("get_dies_number")
        return str(self.dies_number())


class SimulatorLink:
    """One connection to the simulator. `connected` is the link's; the machine's state is the simulator's."""

    def __init__(self, simulator: SimulatedProber):
        self.simulator = simulator
        self.connected = True

    def is_alive(self) -> bool:
        # The SENTIO driver sends nothing for it either.
        self.simulator.calls.append(("is_alive", ()))
        return self.connected

    def disconnect(self) -> None:
        # Safe to call twice, as SentioProberImpl.disconnect().
        self.simulator.calls.append(("disconnect", ()))
        self.connected = False

    def __getattr__(self, name: str):
        if name not in METHODS:
            raise AttributeError(name)
        if not self.connected:
            raise ConnectionError(f"The connection to the simulator is closed ({name})")
        return getattr(self.simulator, name)

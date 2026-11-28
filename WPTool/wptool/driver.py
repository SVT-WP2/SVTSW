"""The driver layer (D19): `Machine` gives the commands of the tool one clean API on the machine.

It wraps an object with the API of `AbstractProber`: the shared `SentioProberImpl` (`svt_wp_core`), or the simulator's
link (`wptool.simulator`). Every command talks to the machine only through it; no command touches the SENTIO library
object of the driver (`.prober`).

- It returns Python values: it reads the text answers of the SENTIO driver (`get_current_index()` gives
  "index,col,row", the layer gives `(index, col, row)`; `get_dies_number()` gives "n" or "n,...", the layer gives n).
- The answer `Error: ...` of `get_chuck_position()` (the SENTIO driver returns it when the query raises) becomes a
  `MachineError`, as an exception of any other query.
- `touched` becomes true at the first call of any method: the engine then gives the machine back with `local_mode()`
  at the end of the request (D16).
- Every call is logged at DEBUG as `machine: <method>(<args>)`, and its error at WARNING.

Only the methods that the commands of step 1 need. A step-2 command that needs another one adds it here.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

log = logging.getLogger("wptool.machine")

REFERENCES = ("Zero", "Relative", "Center")


class MachineError(Exception):
    """The machine answered with an error, or with a text that cannot be read."""


class Machine:
    def __init__(self, driver: Any, where: str):
        self._driver = driver  # private: no command reaches the driver, nor its SENTIO library object (D19)
        self.where = where  # "192.0.2.10:35555", or "mock:0"
        self.touched = False

    def __repr__(self) -> str:
        return f"Machine({self.where})"

    def _call(self, method: str, *args: Any) -> Any:
        self.touched = True
        shown = ", ".join(repr(arg) for arg in args)
        log.debug("machine: %s(%s)", method, shown)
        try:
            return getattr(self._driver, method)(*args)
        except Exception as e:
            log.warning("machine: %s(%s) failed: %s", method, shown, _text(e))
            raise

    def _read(self, method: str, parse: Callable[[Any], Any]) -> Any:
        """A query and the reading of its answer; an answer that cannot be read is a `MachineError`."""
        answer = self._call(method)
        try:
            return parse(answer)
        except (TypeError, ValueError, IndexError) as e:
            log.warning("machine: %s() gave an answer that cannot be read: %r (%s)", method, answer, e)
            raise MachineError(f"{method} gave an answer that cannot be read: {answer!r}") from None

    # --- The connection ---

    def disconnect(self) -> None:
        self._call("disconnect")

    def is_alive(self) -> bool:
        """Sends nothing to the machine (a command would put SENTIO into remote mode)."""
        return bool(self._call("is_alive"))

    def local_mode(self) -> None:
        self._call("local_mode")

    # --- The project ---

    def open_project(self, name: str) -> None:
        self._call("open_project", name)

    # --- Moves ---

    def move_chuck_xy(self, x: float, y: float, reference: str) -> tuple[float, float] | None:
        """`Zero` sets the position, `Relative` adds to it, `Center` is the center plus (x, y). Any other reference is
        a `ValueError` (the SENTIO driver would pass None to the library). Gives the position after the move."""
        if reference not in REFERENCES:
            raise ValueError(f"Unknown reference '{reference}' for an XY move (the references are {', '.join(REFERENCES)})")
        answer = self._call("move_chuck_xy", x, y, reference)
        if answer is None:
            return None
        return _pair(answer)

    def move_chuck_z(self, z: float) -> float | None:
        answer = self._call("move_chuck_z", z)
        return None if answer is None else float(answer)

    def move_chuck_center(self) -> None:
        self._call("move_chuck_center")

    def move_chuck_home(self) -> None:
        self._call("move_chuck_home")

    def move_chuck_offaxis_area(self) -> None:
        self._call("move_chuck_offaxis_area")

    def move_chuck_wide(self) -> None:
        self._call("move_chuck_wide")

    def go_to_contact(self) -> None:
        self._call("go_to_contact")

    def go_to_separation(self) -> None:
        self._call("go_to_separation")

    def go_to_die(self, col: int, row: int) -> None:
        self._call("go_to_die", col, row)

    # --- Vision ---

    def find_home(self) -> None:
        self._call("find_home")

    def auto_focus(self) -> float:
        """The focus height in µm."""
        return self._read("auto_focus", float)

    def align_wafer(self, col: int, row: int, subsite: int = 0) -> None:
        self._call("align_wafer", col, row, subsite)

    # --- PTPA and heights ---

    def run_ptpa(self) -> None:
        self._call("run_ptpa")

    def set_ptpa(self, enable: bool) -> None:
        self._call("set_ptpa", enable)

    def get_contact_height(self) -> float:
        return self._read("get_contact_height", float)

    def set_contact_height(self, height: float) -> None:
        self._call("set_contact_height", height)

    def set_overtravel(self, gap: float) -> None:
        self._call("set_overtravel", gap)

    def enable_overtravel(self, on: bool) -> None:
        self._call("enable_overtravel", on)

    # --- Queries ---

    def get_chuck_xy(self) -> tuple[float, float]:
        """(x, y) in µm, `Zero` reference."""
        return self._read("get_chuck_xy", _pair)

    def get_chuck_z(self) -> float:
        """Z in µm, `Zero` reference."""
        return self._read("get_chuck_z", float)

    def get_chuck_position(self) -> str:
        """The Z hint as the SENTIO driver gives it: `In Contact`, `In Separation`, `In <value>`.

        Its answer `Error: <text>` is a `MachineError` with the text.
        """
        answer = self._call("get_chuck_position")
        text = str(answer).strip()
        if text.startswith("Error:"):
            reason = text[len("Error:"):].strip() or text
            log.warning("machine: get_chuck_position() answered %r", text)
            raise MachineError(reason)
        return text

    def get_current_working_area(self) -> str:
        """The work area, the first part of SENTIO's position hint: `Probing`, `OffAxisCamera`, ..."""
        return self._read("get_current_working_area", lambda answer: str(answer).strip())

    def get_current_index(self) -> tuple[int, int, int]:
        """(index, col, row) of the current die (SENTIO's text "index,col,row")."""
        return self._read("get_current_index", _index)

    def get_dies_number(self) -> int:
        """The number of dies (the first part of the text)."""
        return self._read("get_dies_number", lambda answer: int(str(answer).split(",")[0]))


def _pair(answer: Any) -> tuple[float, float]:
    x, y = answer
    return float(x), float(y)


def _index(answer: Any) -> tuple[int, int, int]:
    parts = str(answer).split(",")
    return int(parts[0]), int(parts[1]), int(parts[2])


def _text(error: BaseException) -> str:
    return str(error) or type(error).__name__

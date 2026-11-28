"""The machine facts: what the machine says after a command, read live and never kept (D10).

`read_machine_facts(machine)` reads what WPAgent's `update_current_info` reads (`WPTestingActions.py` lines 26-47),
plus the absolute chuck position, through the driver layer, each query once, in this order:

| Query | Facts (the names of WPAgent's reply data where they exist) |
|---|---|
| `get_current_index()` | `dieIndex` (new), `waferMapDiePosition` = `{colIndex, rowIndex}` |
| `get_dies_number()` | `totalDiesNumber` |
| `get_chuck_position()` | `chuckZPositionState` (`In Contact`, `In Separation`, `In Default`, ...) |
| `get_current_working_area()` | `currentWorkingArea` (without the suffix `Camera`), `cameraMountPoint` (as SENTIO gives it) |
| `get_chuck_xy()` | `x`, `y` in µm (new) |
| `get_chuck_z()` | `z` in µm (new) |

It never raises (an `Exception`; Ctrl+C and the signals still stop it). A query that fails, an answer that cannot be
read, or a number that is not finite gives `null` for its facts, and its text goes into `errors` (always a list) and
the log. A failed read never changes the status of the reply: the command has run.

`finish(ctx, data)`: the end of every machine command except Disconnect (it closes first), GetChuckPosition and
GetChuckXY (single queries, #409 and #410): the facts go into the reply as `data.facts`. Then the engine gives the
machine back with `local_mode()`, and nothing comes after it.
"""

from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from wptool.driver import Machine
    from wptool.registry import CommandContext

log = logging.getLogger("wptool.facts")

FACT_NAMES = (
    "waferMapDiePosition",
    "dieIndex",
    "totalDiesNumber",
    "chuckZPositionState",
    "currentWorkingArea",
    "cameraMountPoint",
    "x",
    "y",
    "z",
    "errors",
)


def read_machine_facts(machine: Machine) -> dict:
    facts: dict = {name: None for name in FACT_NAMES}
    facts["errors"] = []

    def read(query: str, ask: Callable[[], Any]) -> Any:
        try:
            value = ask()
            for number in value if isinstance(value, tuple) else (value,):
                if isinstance(number, float) and not math.isfinite(number):
                    raise ValueError(f"not a finite number: {value}")
            return value
        except Exception as e:
            text = f"{query}: {str(e) or type(e).__name__}"
            facts["errors"].append(text)
            log.warning("A machine fact was not read: %s", text)
            return None

    index = read("get_current_index", machine.get_current_index)
    if index is not None:
        facts["dieIndex"] = index[0]
        facts["waferMapDiePosition"] = {"colIndex": index[1], "rowIndex": index[2]}
    facts["totalDiesNumber"] = read("get_dies_number", machine.get_dies_number)
    facts["chuckZPositionState"] = read("get_chuck_position", machine.get_chuck_position)
    area = read("get_current_working_area", machine.get_current_working_area)
    if area is not None:
        facts["currentWorkingArea"] = area.removesuffix("Camera")
        facts["cameraMountPoint"] = area
    xy = read("get_chuck_xy", machine.get_chuck_xy)
    if xy is not None:
        facts["x"], facts["y"] = xy
    facts["z"] = read("get_chuck_z", machine.get_chuck_z)
    return facts


def finish(ctx: CommandContext, data: dict) -> dict:
    """The end of a machine command: the machine facts go into its reply as `data.facts`."""
    data["facts"] = read_machine_facts(ctx.machine)
    return data

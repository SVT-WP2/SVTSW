"""The separation check (D11): before every command whose spec has `moves_chuck=True`. Nothing switches it off.

1. `machine.get_chuck_position()`: the Z hint, as the SENTIO driver gives it (`In <value>`).
2. Allowed only for a pair (Z hint, work area) of `ALLOWED`. When the hint is allowed only in some areas (today
   `In Default`), the check also asks `machine.get_current_working_area()`; otherwise the hint alone decides, and the
   area is not asked.
3. Any other answer or pair: 409. An error of a query (the driver's `Error: ...` text, or an exception): 503.

`In Default` is what WPMIT reports in the off-axis area, where the probes cannot touch the wafer; in another area it
could mean any height (D11). The run on WPMIT confirms the table; a pair is added only from that run.

The Z hints of `sentio-prober-control` 24.4.0 (`Enumerations.ZPositionHint`): Default, Contact, Hover, Separation,
Lift, Transfer. The driver gives them as `In Default`, `In Contact`, ... `Hover` (between separation and contact),
`Lift` and `Transfer` (the loader moves the wafer) stay refused, as does any other value.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from wptool.replies import conflict, unavailable

if TYPE_CHECKING:
    from wptool.driver import Machine

ANY_AREA = "<any work area>"

ALLOWED = frozenset(
    {
        ("In Separation", ANY_AREA),
        ("In Default", "OffAxisCamera"),
    }
)

ADVICE = "run MoveChuckSeparation first"


def check_separation(machine: Machine) -> None:
    """Raises `ToolError` 409 unless the chuck is in separation, 503 when the machine gives no answer."""
    hint = _ask(machine.get_chuck_position)
    if (hint, ANY_AREA) in ALLOWED:
        return
    if not any(allowed_hint == hint for allowed_hint, _ in ALLOWED):
        raise conflict(f"The chuck is not in separation (SENTIO reports '{hint}'): {ADVICE}")
    area = _ask(machine.get_current_working_area)
    if (hint, area) in ALLOWED:
        return
    raise conflict(f"The chuck is not in separation (SENTIO reports '{hint}' in {area}): {ADVICE}")


def _ask(query: Callable[[], str]) -> str:
    try:
        return query()
    except Exception as e:
        raise unavailable(f"No answer from the machine to the position query: {str(e) or type(e).__name__}") from None

"""The commands of WPAgent that are not commands of the WP tool, with the text of their 404 reply.

Two lists of the plan (Documentation/decisions/2026-11-wp-tool-phase-1.md, "Commands"):
- "Not in the tool": dropped for good, each with the reason;
- "Step 2: not in the tool yet": they stay in WPAgent until a ticket of step 2 moves them.

A name is never both registered and in one of these lists (tests/test_engine.py).
"""

from __future__ import annotations

from wptool.replies import ToolError, not_found

# One text per row of the table "Not in the tool".
_USERS = "users belong to the agent (phase 2)."
_LOCK = "the testing lock belongs to the agent (phase 2)."
_RESET = "the tool has no agent state to reset: after a failure the next command just runs."
_PROBERS = "the list of machines is in the DB, and the tool knows one machine: use ShowStatus."
_CHIP_TYPES = "it is only a stub in WPAgent."
_INFO = "use ShowStatus, which has the same."
_HELP = "use wptool describe, or help in the shell."

NOT_IN_TOOL: dict[str, str] = {
    "UserLogIn": _USERS,
    "UserLogOut": _USERS,
    "TestingLock": _LOCK,
    "TestingUnlock": _LOCK,
    "ResetAgent": _RESET,
    "ListProbers": _PROBERS,
    "ListChipTypes": _CHIP_TYPES,
    "GetInfo": _INFO,
    "GetAgentState": _INFO,
    "Help": _HELP,
    "ListAvailableCommands": _HELP,
}

# The table "Step 2: not in the tool yet" (52 commands). Each moves to the tool in its own ticket.
STEP_2: tuple[str, ...] = (
    # Loading is done through the UI (D9).
    "LoadWafer",
    "UnloadWafer",
    "MoveChuckLoadedWafer",
    "MoveChuckUnloadWafer",
    "UpdateLoadedWafer",
    "UpdateInstalledProbeCard",
    # Needs the ASIC record of the DB; MoveChuckRowColumn label=... does the same move.
    "MoveChuckAsic",
    # Not used by production; marked as not tested in #404.
    "MoveChuckNextDie",
    "MoveChuckPreviousDie",
    "MoveChuckToWorkArea",
    "SwitchCamera",
    "TakeScreenshot",
    "StressOpenProject",
    # Not used; OpenProject and Initialize force=true do the same.
    "ChangeProject",
    "ReconnectProber",
    # Not used; needs the contacting store and the die grid files.
    "GetDieSize",
    # The sequencer.
    "RunSequencerYAML",
    "RunSequencer",
    "Sleep",
    # Imaging.
    "TakeImage",
    "ComputeCouplingConstants",
    "BuildFlatfield",
    "StitchImagesFull",
    "CropImage",
    "CleanupRasterImages",
    "GenerateRasterSteps",
    "ArchiveImaging",
    "DeleteImagingFolder",
    "TakeImageWaferER2",
    "TakeImageBAM",
    "TakeImageSEG",
    "TakeImageLEC",
    "TakeImageL2",
    "TakeImageL1_0-3",
    "TakeImageL1_1-4",
    "TakeImageL0_0-2",
    "TakeImageL0_1-3",
    "TakeImageL0_2-4",
    "BrightnessCorrection",
    "TakeImageLECDie",
    # Contacting, needle marks and topography.
    "SaveChuckPosition",
    "MoveChuckToSavedPosition",
    "MoveChuckBySavedOffset",
    "MeasureLECTopographyDie",
    "AnalyzeNeedleMarks",
    "ComputePadTargetOffset",
    "ComputeTopographyCorrection",
    "GetDieList",
    "NeedleOffsetMeasureER2B",
    "MoveToPadTarget",
    "LECTopographyER2",
    "LECTopographyER2B",
)

STEP_2_TEXT = "{command} is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan)."
NOT_IN_TOOL_TEXT = "{command} is not a command of the WP tool: {reason}"
UNKNOWN_TEXT = "Unknown command: {command}"


def refusal(command: str) -> ToolError:
    """The 404 error for a name that is not a registered command: dropped, step 2, or unknown, in this order."""
    if command in NOT_IN_TOOL:
        return not_found(NOT_IN_TOOL_TEXT.format(command=command, reason=NOT_IN_TOOL[command]))
    if command in STEP_2:
        return not_found(STEP_2_TEXT.format(command=command))
    return not_found(UNKNOWN_TEXT.format(command=command))

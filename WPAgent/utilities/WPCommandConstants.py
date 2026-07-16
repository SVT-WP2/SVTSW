"""
WPCommandConstants - Single source of truth for command classification.

Import from here instead of defining local bypass/exempt sets in each module.
"""

# Commands that bypass state machine checks entirely.
# These execute from ANY agent state without requiring a valid transition.
BYPASS_COMMANDS: set[str] = {
    # Auth — must always work regardless of state
    "UserLogIn",
    "UserLogOut",
    # System control
    "Initialize",
    "Reconnect",
    "ResetAgent",
    # Read-only queries — never change state
    "Help",
    "GetAgentState",
    "GetInfo",
    "ShowStatus",
    "ShowProjectStatus",
    "ListProbers",
    "ListChipTypes",
    "ListAvailableCommands",
    # Hardware ops allowed in any state
    "AutoFocus",
}


# ── User hierarchy permission sets ────────────────────────────────────────────
# Add new commands here when registering them in COMMAND_ROUTER.
# Developer hierarchy has no restrictions — all commands always allowed.

USER_COMMANDS: set[str] = {
    "OpenProject",
    "InitProbing",
    "MoveChuckLoadedWafer",
    "LoadWafer",
    "MoveChuckUnloadWafer",
    "UnloadWafer",
    "MoveChuckAsic",
    "MoveChuckSeparation",
    "MoveChuckSafePosition",
    "MoveChuckContact",
    "ShowStatus",
    "MoveChuckOffAxis",
    "TestingLock",
    "TestingUnlock",
    "GetLockStatus",
    "UserLogIn",
    "UserLogOut",
}

EXPERT_COMMANDS: set[str] = {
    "MoveChuckWide",
    "ChangeProject",
    "MoveChuckNextDie",
    "RunPTPA",
    "SetPTPA",
    "MoveChuckPreviousDie",
    "SetChuckOvertravel",
    "DisableOvertravel",
    "AutoFocus",
    "MoveChuckRowColumn",
}

# Developer commands are not listed — Developers can execute ALL commands.
# Any command not in USER_COMMANDS or EXPERT_COMMANDS is implicitly developer-only.

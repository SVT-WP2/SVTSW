"""The state of the tool: the connection to the machine, and nothing else (D10).

Nothing is kept between requests: no project, no contact height, no overtravel, no die, no machine fact, no wafer
(D9). A command that needs a value gets it as a parameter; a fact of the machine is read from the machine when it is
needed (#408). A new field here is a change of design: ask on the ticket first (tests/test_state.py fails).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass


@dataclass
class ToolState:
    # {address, port} of the last Initialize (#408); {address: "mock", port: 0} with --mock. The machine has no name.
    machine: dict | None = None
    proberConnected: bool = False

    def snapshot(self) -> dict:
        """The state as the `status` event and `ShowStatus` give it: a copy, so that nobody changes the state."""
        return {"machine": copy.deepcopy(self.machine), "proberConnected": self.proberConnected}


def connection_text(snapshot: dict) -> str:
    """The connection for people: `192.0.2.10:35555, connected` or `none, not connected`."""
    machine = snapshot.get("machine")
    where = f"{machine['address']}:{machine['port']}" if machine else "none"
    connected = "connected" if snapshot.get("proberConnected") else "not connected"
    return f"{where}, {connected}"

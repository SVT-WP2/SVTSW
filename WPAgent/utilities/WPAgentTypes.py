"""
WPAgentTypes - Shared TypedDicts for WP Agent response structures.
Import from here instead of using Dict[str, Any] for agent responses.
"""

from typing import TypedDict, Optional, Union


class WaferMapPosition(TypedDict):
    colIndex: int
    rowIndex: int
    subsiteIndex: int


class LoadedWafer(TypedDict):
    waferId: int
    orientation: str


class InstalledProbeCard(TypedDict):
    probeCardId: int
    orientation: str


class AgentData(TypedDict):
    userLogged: str
    userLoggedHierarchy: str
    asicSerialNumber: int
    wpMachineId: int
    WPAG_State: str
    wpAgentName: str
    loadedWafer: Union[int, LoadedWafer]
    installedProbeCard: Optional[InstalledProbeCard]
    openedProjectId: int
    projectName: str
    overdrive: int
    cameraMountPoint: str
    currentWorkingArea: str
    waferMapDiePosition: WaferMapPosition
    chuckZPositionState: str
    totalDiesNumber: int


class ErrorInfo(TypedDict):
    code: int
    message: str


class AgentResponse(TypedDict):
    status: str
    type: str
    data: AgentData
    error: ErrorInfo


class KafkaPayload(TypedDict, total=False):
    """Generic inbound/outbound Kafka message envelope."""
    type: str
    data: dict
    status: str
    error: dict


class WaferProbeMachine(TypedDict, total=False):
    id: int
    name: str
    hostName: str
    connectionPort: int
    software: str
    generalLocation: str


class WaferProbeProject(TypedDict, total=False):
    id: int
    name: str
    description: str


class HelpAgentData(AgentData, total=False):
    """Extended AgentData for Help command responses — carries optional help metadata."""
    commandInfo: dict
    totalCommands: int
    categories: dict


class LoadedWaferData(AgentData, total=False):
    """Extended AgentData for wafer query responses."""
    hasWafer: bool
    waferId: int | None


class InstalledProbeCardData(AgentData, total=False):
    """Extended AgentData for probe card query responses."""
    hasProbeCard: bool
    probeCardId: int | None


class ListProbersData(AgentData, total=False):
    """Extended AgentData for list probers response."""
    probers: list
    count: int

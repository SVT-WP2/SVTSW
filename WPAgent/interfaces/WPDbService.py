from typing import Protocol, List, Optional
from utilities.WPAgentTypes import WaferProbeMachine, WaferProbeProject


class IDBService(Protocol):
    """Abstract DB client interface that others will depend on"""

    def get_all_enums(
        self, enum_names: Optional[List[str]] = None, timeout: float = 10.0
    ) -> dict:
        """Get enumeration values from database"""
        ...

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        """Get available chip types"""
        ...

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        """Get available wafer orientations"""
        ...

    def get_all_wafer_probe_machines(
        self, timeout: float = 10.0
    ) -> List[WaferProbeMachine]:
        """Get all wafer probe machines from database"""
        ...

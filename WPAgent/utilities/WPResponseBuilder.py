"""
WP Agent Response Builder
Generates standardized payload for ALL commands.
"""

from typing import cast
from utilities.WPMessagesStatus import WPMessagesStatus
from utilities.WPAgentTypes import AgentData, AgentResponse, ErrorInfo, WaferMapPosition, LoadedWafer, InstalledProbeCard


class ResponseBuilder:

    @staticmethod
    def _build_data() -> AgentData:
        """
        Build complete data object from global state.
        Called for EVERY response (success and error).
        """
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()

        wafer_map_position = WaferMapPosition(
            colIndex=getattr(g, "current_die_col", 0),
            rowIndex=getattr(g, "current_die_row", 0),
            subsiteIndex=getattr(g, "current_die_subsite", 0),
        )

        loaded_wafer_id = getattr(g, "loaded_wafer_id", None)
        if loaded_wafer_id is not None:
            loaded_wafer = LoadedWafer(
                waferId=loaded_wafer_id,
                orientation=getattr(g, "wafer_orientation", "Unknown"),
            )
        else:
            loaded_wafer = cast(LoadedWafer, 1)

        probe_card_id = getattr(g, "probe_card_id", None)
        if probe_card_id is not None:
            installed_probe_card = InstalledProbeCard(
                probeCardId=probe_card_id,
                orientation=getattr(g, "probe_card_orientation", "Unknown"),
            )
        else:
            installed_probe_card = cast(InstalledProbeCard, None)

        return AgentData(
            userLogged=getattr(g, "userLogged", "None"),
            userLoggedHierarchy=getattr(g, "userLoggedHierarchy", "None"),
            asicSerialNumber=getattr(g, "asicSerialNumber", 0),
            wpMachineId=getattr(g, "wpMachineId", 0),
            WPAG_State=getattr(g, "wpag_state", "ServiceOff"),
            wpAgentName=getattr(g, "wpAgentName", "Default"),
            loadedWafer=loaded_wafer,
            installedProbeCard=installed_probe_card,
            openedProjectId=getattr(g, "opened_project_id", 0),
            projectName=getattr(g, "projectName", ""),
            overdrive=getattr(g, "overdrive", 0),
            cameraMountPoint=getattr(g, "camera_mount_point", ""),
            currentWorkingArea=getattr(g, "current_working_area", ""),
            waferMapDiePosition=wafer_map_position,
            chuckZPositionState=getattr(g, "chuck_z_position_state", "Unknown"),
            totalDiesNumber=getattr(g, "total_dies_number", 0),
        )

    @staticmethod
    def success(reply_type: str, message: str = "") -> AgentResponse:
        """Build SUCCESS response."""
        return AgentResponse(
            status=WPMessagesStatus.Success,
            type=reply_type,
            data=ResponseBuilder._build_data(),
            error=ErrorInfo(code=0, message=message),
        )

    @staticmethod
    def error(reply_type: str, message: str, code: int = 1) -> AgentResponse:
        return AgentResponse(
            status=WPMessagesStatus.UnexpectedError,
            type=reply_type,
            data=ResponseBuilder._build_data(),
            error=ErrorInfo(code=code, message=message),
        )


# Shorthand functions
def success(reply_type: str, message: str = "") -> AgentResponse:
    return ResponseBuilder.success(reply_type, message)


def error(reply_type: str, message: str, code: int = 1) -> AgentResponse:
    return ResponseBuilder.error(reply_type, message, code)

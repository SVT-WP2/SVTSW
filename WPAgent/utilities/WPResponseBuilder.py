"""
WP Agent Response Builder
Generates standardized payload for ALL commands.
"""

from typing import Dict, Any


class ResponseBuilder:

    @staticmethod
    def _build_data() -> Dict[str, Any]:
        """
        Build complete data object from global state.
        Called for EVERY response (success and error).
        """
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()

        #response paylod
        data = {
            "userLogged": getattr(g, 'userLogged'),
            "userLoggedHierarchy": getattr(g, 'userLoggedHierarchy'),
            "asicSerialNumber": 0, #(g, 'asic_serial_number', 0),
            "wpMachineId": "4",
            "WPAG_State": getattr(g, 'wpag_state', 'ServiceOff'),
            "wpAgentName": getattr(g, 'wpAgentName'),

            "loadedWafer": None,
            "instaledprobeCard": None,  # Note: your spelling "instaled"

            "openedProjectId": getattr(g, 'opened_project_id', 0),
            "projectName": getattr(g, 'project_name', ''),
            "overdrive": getattr(g, 'overdrive', 0),
            "cameraMountPoint": getattr(g, 'camera_mount_point', ''),
            "currentWorkingArea": getattr(g, 'current_working_area', ''),

            "waferMapDiePosition": None,

            "chuckZPositionState": getattr(g, 'chuck_z_position_state', 'Unknown'),
            "totalDiesNumber": getattr(g, 'total_dies_number', 0)
        }

        # Populate loadedWafer if wafer is loaded
        loaded_wafer_id = getattr(g, 'loaded_wafer_id', None)
        if loaded_wafer_id is not None:
            data["loadedWafer"] = {
                "waferId": loaded_wafer_id,
                "orientation": getattr(g, 'wafer_orientation', 'Unknown')
            }

        # Populate probe card if installed
        probe_card_id = getattr(g, 'probe_card_id', None)
        if probe_card_id is not None:
            data["instaledprobeCard"] = {
                "probeCardId": probe_card_id,
                "orientation": getattr(g, 'probe_card_orientation', 'Unknown')
            }

        # Populate die position if available
        col = getattr(g, 'current_die_col', 0)
        row = getattr(g, 'current_die_row', 0)
        if col != 0 or row != 0:
            data["waferMapDiePosition"] = {
                "colIndex": col,
                "rowIndex": row,
                "subsiteIndex": getattr(g, 'current_die_subsite', 0)
            }

        return data

    @staticmethod
    def success(reply_type: str, message: str = "") -> Dict[str, Any]:
        """
        Build SUCCESS response.
        """
        return {
            "status": "Success",
            "type": reply_type,
            "data": ResponseBuilder._build_data(),
            "error": {
                "code": 0,
                "message": ""
            }
        }

    @staticmethod
    def error(reply_type: str, message: str, code: int = 1) -> Dict[str, Any]:
        return {
            "status": "Error",
            "type": reply_type,
            "data": ResponseBuilder._build_data(),
            "error": {
                "code": code,
                "message": message
            }
        }


# Shorthand functions
def success(reply_type: str, message: str = "") -> Dict[str, Any]:
    return ResponseBuilder.success(reply_type, message)


def error(reply_type: str, message: str, code: int = 1) -> Dict[str, Any]:
    return ResponseBuilder.error(reply_type, message, code)
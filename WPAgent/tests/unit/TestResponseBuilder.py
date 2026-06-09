"""
Unit tests for utilities/WPResponseBuilder.py
"""
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))


def _mock_globals():
    """Patch SvtWPAagentGlobalParameters so tests run without real hardware."""
    g = MagicMock()
    g.userLogged = "testuser"
    g.userLoggedHierarchy = "Developer"
    g.asicSerialNumber = 0
    g.wpMachineId = 1
    g.wpag_state = "ServiceOn"
    g.wpAgentName = "TEST"
    g.opened_project_id = 0
    g.projectName = "TestProject"
    g.overdrive = 0
    g.camera_mount_point = ""
    g.current_working_area = ""
    g.chuck_z_position_state = "Unknown"
    g.total_dies_number = 0
    g.current_die_col = 0
    g.current_die_row = 0
    g.current_die_subsite = 0
    g.loaded_wafer_id = None
    g.probe_card_id = None
    return g


def test_success_status():
    from utilities.WPResponseBuilder import ResponseBuilder
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=_mock_globals()):
        result = ResponseBuilder.success("TestReply", "Operation successful")
    assert result["status"] == "Success"
    assert result["type"] == "TestReply"
    assert result["error"]["code"] == 0
    assert result["error"]["message"] == "Operation successful"
    assert "data" in result


def test_error_status():
    from utilities.WPResponseBuilder import ResponseBuilder
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=_mock_globals()):
        result = ResponseBuilder.error("TestReply", "Something failed", 500)
    assert result["status"] == "UnexpectedError"
    assert result["type"] == "TestReply"
    assert result["error"]["code"] == 500
    assert result["error"]["message"] == "Something failed"
    assert "data" in result


def test_error_default_code():
    from utilities.WPResponseBuilder import ResponseBuilder
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=_mock_globals()):
        result = ResponseBuilder.error("TestReply", "Oops")
    assert result["error"]["code"] == 1


def test_data_contains_required_fields():
    from utilities.WPResponseBuilder import ResponseBuilder
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=_mock_globals()):
        result = ResponseBuilder.success("TestReply")
    data = result["data"]
    for field in ["userLogged", "wpMachineId", "WPAG_State", "wpAgentName",
                  "waferMapDiePosition", "chuckZPositionState"]:
        assert field in data, f"Missing field: {field}"


def test_wafer_map_position_shape():
    from utilities.WPResponseBuilder import ResponseBuilder
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=_mock_globals()):
        result = ResponseBuilder.success("TestReply")
    pos = result["data"]["waferMapDiePosition"]
    assert "colIndex" in pos
    assert "rowIndex" in pos
    assert "subsiteIndex" in pos


def test_loaded_wafer_populated_when_set():
    from utilities.WPResponseBuilder import ResponseBuilder
    g = _mock_globals()
    g.loaded_wafer_id = 42
    g.wafer_orientation = "West"
    with patch("globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance", return_value=g):
        result = ResponseBuilder.success("TestReply")
    wafer = result["data"]["loadedWafer"]
    assert isinstance(wafer, dict)
    assert wafer["waferId"] == 42
    assert wafer["orientation"] == "West"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])

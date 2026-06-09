"""
Quick Smoke Test for ResponseBuilder

"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder
import json


def print_header(text):
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}\n")


def print_json(obj):
    print(json.dumps(obj, indent=2))


def main():
    print_header("WP AGENT - QUICK SMOKE TEST")

    # Test 1: Globals exist
    print("Test 1: Check globals have new fields...")
    g = SvtWPAagentGlobalParameters.getInstance()

    required_fields = [
        "user",
        "asic_serial_number",
        "wp_machine_id",
        "wpag_state",
        "loaded_wafer_id",
        "wafer_orientation",
        "probe_card_id",
        "probe_card_orientation",
        "opened_project_id",
        "overdrive",
        "camera_mount_point",
        "current_working_area",
        "current_die_col",
        "current_die_row",
        "current_die_subsite",
        "chuck_z_position_state",
        "total_dies_number",
    ]

    missing_fields = []
    for field in required_fields:
        if not hasattr(g, field):
            missing_fields.append(field)

    if missing_fields:
        print(f"❌ FAILED: Missing fields: {missing_fields}")
        print("\nDid you copy WPAagentGlobalParameters_NEW.py to globals/?")
        return False
    else:
        print(f"✓ All {len(required_fields)} required fields exist")

    # Test 2: Set some data
    print("\nTest 2: Set test data...")
    g.reset()
    g.user = "test_user"
    g.asicSerialNumber = 12345
    g.wp_machine_id = 1
    g.wpag_state = "WP_Idle"
    g.set_wafer_loaded(999, "North")
    g.set_probe_card(456, "South")
    g.set_project(789, "TestProject")
    g.set_current_die(5, 10, 0)
    g.chuck_z_position_state = "Separation"
    g.total_dies_number = 1234
    print("✓ Test data set")

    # Test 3: Build success response
    print("\nTest 3: Build success response...")
    try:
        response = ResponseBuilder.success("TestReply", "Test successful")
        print("✓ ResponseBuilder.success() works")
    except Exception as e:
        print(f"❌ FAILED: ResponseBuilder.success() error: {e}")
        return False

    # Test 4: Check response structure
    print("\nTest 4: Validate response structure...")

    checks = {
        "status field": "status" in response,
        "status is 'Success'": response.get("status") == "Success",
        "type field": "type" in response,
        "data field": "data" in response,
        "error field": "error" in response,
        "data.user": response.get("data", {}).get("user") == "test_user",
        "data.wpMachineId": response.get("data", {}).get("wpMachineId") == 1,
        "data.WPAG_State": response.get("data", {}).get("WPAG_State") == "WP_Idle",
        "data.chuckZPositionState": response.get("data", {}).get("chuckZPositionState")
        == "Separation",
    }

    all_passed = True
    for check_name, result in checks.items():
        if result:
            print(f"  ✓ {check_name}")
        else:
            print(f"  ✗ {check_name}")
            all_passed = False

    if not all_passed:
        print("\n❌ Some checks failed!")
        print("\nResponse structure:")
        print_json(response)
        return False

    # Test 5: Check complete payload
    print("\nTest 5: Check complete payload has all fields...")
    data = response.get("data", {})

    expected_fields = [
        "user",
        "asicSerialNumber",
        "wpMachineId",
        "WPAG_State",
        "loadedWafer",
        "installedProbeCard",
        "openedProjectId",
        "projectName",
        "overdrive",
        "cameraMountPoint",
        "currentWorkingArea",
        "waferMapDiePosition",
        "chuckZPositionState",
        "totalDiesNumber",
    ]

    missing = [f for f in expected_fields if f not in data]

    if missing:
        print(f"❌ FAILED: Missing payload fields: {missing}")
        return False
    else:
        print(f"✓ All {len(expected_fields)} payload fields present")

    # Test 6: Check wafer object
    print("\nTest 6: Check wafer object structure...")
    wafer = data.get("loadedWafer")
    if wafer is None:
        print("❌ FAILED: loadedWafer should not be null (we loaded wafer 999)")
        return False

    if wafer.get("waferId") != 999:
        print(f"❌ FAILED: waferId should be 999, got {wafer.get('waferId')}")
        return False

    if wafer.get("orientation") != "North":
        print(
            f"❌ FAILED: orientation should be 'North', got {wafer.get('orientation')}"
        )
        return False

    print("✓ Wafer object correct")

    # Test 7: Check die position
    print("\nTest 7: Check die position object...")
    die_pos = data.get("waferMapDiePosition")
    if die_pos is None:
        print("❌ FAILED: waferMapDiePosition should not be null")
        return False

    if die_pos.get("colIndex") != 5 or die_pos.get("rowIndex") != 10:
        print(
            f"❌ FAILED: Die position should be (5, 10), got ({die_pos.get('colIndex')}, {die_pos.get('rowIndex')})"
        )
        return False

    print("✓ Die position correct")

    # Test 8: Build error response
    print("\nTest 8: Build error response...")
    try:
        error_response = ResponseBuilder.error("TestReply", "Test error", 400)
        if error_response.get("status") != "Error":
            print(
                f"❌ FAILED: Error status should be 'Error', got {error_response.get('status')}"
            )
            return False
        if error_response.get("error", {}).get("code") != 400:
            print(
                f"❌ FAILED: Error code should be 400, got {error_response.get('error', {}).get('code')}"
            )
            return False
        print("✓ Error response works")
    except Exception as e:
        print(f"❌ FAILED: ResponseBuilder.error() error: {e}")
        return False

    # Test 9: State change reflection
    print("\nTest 9: Test state changes are reflected...")

    # Change Z position
    g.chuck_z_position_state = "Contact"
    response2 = ResponseBuilder.success("Test2", "Changed to contact")

    if response2["data"]["chuckZPositionState"] != "Contact":
        print("❌ FAILED: State change not reflected")
        return False

    print("✓ State changes reflected in real-time")

    # Success!
    print_header("✅ ALL TESTS PASSED!")

    print("Your implementation is working correctly!")
    print("\nSample Response:")
    print_json(response)

    print("\n" + "=" * 60)
    print("  READY FOR PRODUCTION USE! 🚀")
    print("=" * 60 + "\n")

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

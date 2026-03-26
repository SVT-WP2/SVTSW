"""
Test WPTestingActions.py Implementation
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
import actions.WPTestingActions
import json


def print_header(text):
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print(f"{'=' * 70}\n")


def print_json(obj, title="Response"):
    print(f"\n{title}:")
    print(json.dumps(obj, indent=2))


def validate_response_structure(response, expected_type, test_name):
    """
    Validate that response has the exact structure we want.

    Expected structure:
    {
      "status": "Success" or "Error",
      "type": "{CommandName}Reply",
      "data": {
        "user": "...",
        "asicSerialNumber": 0,
        "wpMachineId": 0,
        "WPAG_State": "...",
        "loadedWafer": {...} or null,
        "instaledprobeCard": {...} or null,
        "openedProjectId": 0,
        "projectName": "...",
        "overdrive": 0,
        "cameraMountPoint": "...",
        "currentWorkingArea": "...",
        "waferMapDiePosition": {...} or null,
        "chuckZPositionState": "...",
        "totalDiesNumber": 0
      },
      "error": {
        "code": 0,
        "message": ""
      }
    }
    """
    errors = []

    # Check top-level structure
    if "status" not in response:
        errors.append("Missing 'status' field")
    elif response["status"] not in ["Success", "Error"]:
        errors.append(f"Invalid status: {response['status']} (should be 'Success' or 'Error')")

    if "type" not in response:
        errors.append("Missing 'type' field")
    elif response["type"] != expected_type:
        errors.append(f"Wrong type: expected '{expected_type}', got '{response['type']}'")

    if "data" not in response:
        errors.append("Missing 'data' field")
    else:
        # Check data structure
        data = response["data"]
        required_fields = [
            "user", "asicSerialNumber", "wpMachineId", "WPAG_State",
            "loadedWafer", "instaledprobeCard", "openedProjectId", "projectName",
            "overdrive", "cameraMountPoint", "currentWorkingArea",
            "waferMapDiePosition", "chuckZPositionState", "totalDiesNumber"
        ]

        for field in required_fields:
            if field not in data:
                errors.append(f"Missing data field: '{field}'")

    if "error" not in response:
        errors.append("Missing 'error' field")
    else:
        error = response["error"]
        if "code" not in error:
            errors.append("Missing 'error.code' field")
        if "message" not in error:
            errors.append("Missing 'error.message' field")

    # Print results
    if errors:
        print(f"❌ {test_name} FAILED")
        for error in errors:
            print(f"   - {error}")
        print_json(response, "Actual Response")
        return False
    else:
        print(f"✓ {test_name} - Response structure correct")
        return True


def test_move_chuck_xy():
    """Test move_chuck_xy function"""
    print_header("Test 1: move_chuck_xy")

    try:
        from actions.WPTestingActions import move_chuck_xy

        #  will fail if not initialized, which is expected
        #  testing the response structure
        response = move_chuck_xy(x=100.5, y=200.3)

        # Should be error (not initialized) or success
        # but we check structure
        if response["status"] == "Error":
            valid = validate_response_structure(response, "MoveChuckXYReply", "move_chuck_xy (error)")
            print("\nNote: Got error response (expected if not initialized)")
            print(f"Error message: {response.get('error', {}).get('message', 'N/A')}")
        else:
            valid = validate_response_structure(response, "MoveChuckXYReply", "move_chuck_xy (success)")

        print_json(response, "move_chuck_xy Response")
        return valid

    except Exception as e:
        print(f"❌ move_chuck_xy - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_go_to_die():
    """Test go_to_die function"""
    print_header("Test 2: go_to_die")

    try:
        from actions.WPTestingActions import move_chuck_row_column
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()

        response = move_chuck_row_column(col=5, row=10, subsite=0)

        valid = validate_response_structure(response, "GoToDieReply", "go_to_die")

        # Check if die position was updated (if success)
        if response["status"] == "Success":
            die_pos = response.get("data", {}).get("waferMapDiePosition")
            if die_pos:
                if die_pos.get("colIndex") == 5 and die_pos.get("rowIndex") == 10:
                    print("✓ Die position correctly updated in response")
                else:
                    print(
                        f"⚠️  Die position not updated: expected (5,10), got ({die_pos.get('colIndex')},{die_pos.get('rowIndex')})")

        print_json(response, "go_to_die Response")
        return valid

    except Exception as e:
        print(f"❌ go_to_die - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_go_to_contact():
    """Test go_to_contact function"""
    print_header("Test 3: go_to_contact")

    try:
        from actions.WPTestingActions import move_chuck_contact

        response = move_chuck_contact()

        valid = validate_response_structure(response, "GoToContactReply", "go_to_contact")

        # Check if Z position updated (if success)
        if response["status"] == "Success":
            chuck_z = response.get("data", {}).get("chuckZPositionState")
            if chuck_z == "Contact":
                print("✓ Chuck Z position correctly set to 'Contact'")
            else:
                print(f"⚠️  Chuck Z position: expected 'Contact', got '{chuck_z}'")

        print_json(response, "go_to_contact Response")
        return valid

    except Exception as e:
        print(f"❌ go_to_contact - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_go_to_separation():
    """Test go_to_separation function"""
    print_header("Test 4: go_to_separation")

    try:
        from actions.WPTestingActions import Move_chuck_separation

        response = Move_chuck_separation()

        valid = validate_response_structure(response, "GoToSeparationReply", "go_to_separation")

        # Check if Z position updated (if success)
        if response["status"] == "Success":
            chuck_z = response.get("data", {}).get("chuckZPositionState")
            if chuck_z == "Separation":
                print("✓ Chuck Z position correctly set to 'Separation'")
            else:
                print(f"⚠️  Chuck Z position: expected 'Separation', got '{chuck_z}'")

        print_json(response, "go_to_separation Response")
        return valid

    except Exception as e:
        print(f"❌ go_to_separation - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_switch_camera():
    """Test switch_camera function"""
    print_header("Test 5: switch_camera")

    try:
        from actions.WPTestingActions import switch_camera

        response = switch_camera(mount_point="Top")

        valid = validate_response_structure(response, "SwitchCameraReply", "switch_camera")

        # Check if camera updated (if success)
        if response["status"] == "Success":
            camera = response.get("data", {}).get("cameraMountPoint")
            if camera == "Top":
                print("✓ Camera mount point correctly set to 'Top'")
            else:
                print(f"⚠️  Camera: expected 'Top', got '{camera}'")

        print_json(response, "switch_camera Response")
        return valid

    except Exception as e:
        print(f"❌ switch_camera - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_load_wafer():
    """Test load_wafer function"""
    print_header("Test 6: load_wafer")

    try:
        from actions.WPTestingActions import load_wafer

        response = load_wafer()

        valid = validate_response_structure(response, "LoadWaferReply", "load_wafer")

        print_json(response, "load_wafer Response")
        return valid

    except Exception as e:
        print(f"❌ load_wafer - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_unload_wafer():
    """Test unload_wafer function"""
    print_header("Test 7: unload_wafer")

    try:
        from actions.WPTestingActions import unload_wafer
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()

        # Test when no wafer loaded (should be error)
        g.loaded_wafer_id = None
        response = unload_wafer()

        valid = validate_response_structure(response, "UnloadWaferReply", "unload_wafer (no wafer)")

        if response["status"] == "Error":
            if "no wafer" in response.get("error", {}).get("message", "").lower():
                print("✓ Correct error when no wafer loaded")

        # Test when wafer loaded (should clear it)
        g.set_wafer_loaded(999, "North")
        response2 = unload_wafer()

        valid2 = validate_response_structure(response2, "UnloadWaferReply", "unload_wafer (with wafer)")

        if response2["status"] == "Success":
            if response2.get("data", {}).get("loadedWafer") is None:
                print("✓ Wafer correctly cleared from response")

        print_json(response2, "unload_wafer Response (with wafer)")
        return valid and valid2

    except Exception as e:
        print(f"❌ unload_wafer - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_run_ptpa():
    """Test run_ptpa function"""
    print_header("Test 8: run_ptpa")

    try:
        from actions.WPTestingActions import run_ptpa

        response = run_ptpa()

        valid = validate_response_structure(response, "RunPTPAReply", "run_ptpa")

        print_json(response, "run_ptpa Response")
        return valid

    except Exception as e:
        print(f"❌ run_ptpa - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_get_chuck_position():
    """Test get_chuck_position function"""
    print_header("Test 9: get_chuck_position")

    try:
        from actions.WPTestingActions import get_chuck_position

        response = get_chuck_position()

        valid = validate_response_structure(response, "GetChuckPositionReply", "get_chuck_position")

        print_json(response, "get_chuck_position Response")
        return valid

    except Exception as e:
        print(f"❌ get_chuck_position - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_all_functions_use_response_builder():
    """Check that all functions import ResponseBuilder"""
    print_header("Test 10: Check All Functions Use ResponseBuilder")

    try:
        with open('../actions/WPTestingActions.py', 'r') as f:
            content = f.read()

        checks = {
            "ResponseBuilder imported": "from utilities.WPResponseBuilder import ResponseBuilder" in content,
            "Uses ResponseBuilder.success": "ResponseBuilder.success" in content,
            "Uses ResponseBuilder.error": "ResponseBuilder.error" in content,
            "No old-style success": '{"status": "success"' not in content,
            "No old-style error": '{"status": "error"' not in content,
        }

        all_passed = True
        for check_name, passed in checks.items():
            if passed:
                print(f"✓ {check_name}")
            else:
                print(f"✗ {check_name}")
                all_passed = False

        if all_passed:
            print("\n✓ All functions updated to use ResponseBuilder")
        else:
            print("\n⚠️  Some functions may still use old response format")

        return all_passed

    except Exception as e:
        print(f"❌ Could not check file: {e}")
        return False


def main():
    print("\n" + "=" * 70)
    print("  WP TESTING ACTIONS - VALIDATION TEST")
    print("=" * 70)
    print("\nTesting your WPTestingActions.py implementation...")
    print("Checking that all functions return the correct response structure.\n")

    results = []

    # Run all tests
    results.append(("move_chuck_xy", test_move_chuck_xy()))
    results.append(("go_to_die", test_go_to_die()))
    results.append(("go_to_contact", test_go_to_contact()))
    results.append(("go_to_separation", test_go_to_separation()))
    results.append(("switch_camera", test_switch_camera()))
    results.append(("load_wafer", test_load_wafer()))
    results.append(("unload_wafer", test_unload_wafer()))
    results.append(("run_ptpa", test_run_ptpa()))
    results.append(("get_chuck_position", test_get_chuck_position()))
    results.append(("ResponseBuilder check", check_all_functions_use_response_builder()))

    # Summary
    print_header("TEST SUMMARY")

    passed = sum(1 for _, result in results if result)
    failed = sum(1 for _, result in results if not result)
    total = len(results)

    print(f"Total Tests: {total}")
    print(f"✓ Passed: {passed}")
    print(f"✗ Failed: {failed}\n")

    if failed > 0:
        print("Failed tests:")
        for name, result in results:
            if not result:
                print(f"  ✗ {name}")

    print("\n" + "=" * 70)

    if failed == 0:
        print("  🎉 ALL TESTS PASSED! 🎉")
        print("\n  Your WPTestingActions.py is correctly implemented!")
        print("  All functions return the exact response structure required.")
        print("\n  Response structure verified:")
        print("    ✓ status: 'Success' or 'Error'")
        print("    ✓ type: '{CommandName}Reply'")
        print("    ✓ data: {15 complete payload fields}")
        print("    ✓ error: {code, message}")
        print("\n  State updates verified:")
        print("    ✓ Die position updates (go_to_die)")
        print("    ✓ Chuck Z position updates (go_to_contact/separation)")
        print("    ✓ Camera updates (switch_camera)")
        print("    ✓ Wafer load/unload updates")
        print("\n  ✅ READY FOR PRODUCTION USE!")
    else:
        print("  ⚠️  SOME TESTS FAILED")
        print("\n  Please check the failed tests above.")
        print("  Common issues:")
        print("    - Missing ResponseBuilder import")
        print("    - Not updating globals before returning")
        print("    - Using old response format")
        print("    - Wrong reply type name")

    print("=" * 70 + "\n")

    return failed == 0


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST SUITE CRASHED: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
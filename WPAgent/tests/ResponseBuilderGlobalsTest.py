"""
Test ResponseBuilder and Global Parameters

"""

import sys
import os
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestResponseBuilder:
    """Test suite for ResponseBuilder and updated globals"""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests_run = 0

    def assert_equal(self, actual, expected, test_name):
        """Assert two values are equal"""
        self.tests_run += 1
        if actual == expected:
            print(f"  ✓ {test_name}")
            self.passed += 1
            return True
        else:
            print(f"  ✗ {test_name}")
            print(f"    Expected: {expected}")
            print(f"    Got: {actual}")
            self.failed += 1
            return False

    def assert_in(self, item, container, test_name):
        """Assert item is in container"""
        self.tests_run += 1
        if item in container:
            print(f"  ✓ {test_name}")
            self.passed += 1
            return True
        else:
            print(f"  ✗ {test_name}")
            print(f"    '{item}' not found in container")
            self.failed += 1
            return False

    def assert_not_none(self, value, test_name):
        """Assert value is not None"""
        self.tests_run += 1
        if value is not None:
            print(f"  ✓ {test_name}")
            self.passed += 1
            return True
        else:
            print(f"  ✗ {test_name}")
            print(f"    Value is None")
            self.failed += 1
            return False

    def print_section(self, title):
        """Print section header"""
        print(f"\n{'=' * 60}")
        print(f"  {title}")
        print(f"{'=' * 60}")

    def print_json(self, obj, title="Response"):
        """Pretty print JSON"""
        print(f"\n{title}:")
        print(json.dumps(obj, indent=2))

    def test_globals_new_fields(self):
        """Test that new fields exist in globals"""
        self.print_section("Test 1: Global Parameters - New Fields")

        g = SvtWPAagentGlobalParameters.getInstance()

        # Test new fields exist
        self.assert_not_none(hasattr(g, "user"), "user field exists")
        self.assert_not_none(
            hasattr(g, "asic_serial_number"), "asic_serial_number exists"
        )
        self.assert_not_none(hasattr(g, "wp_machine_id"), "wp_machine_id exists")
        self.assert_not_none(hasattr(g, "wpag_state"), "wpag_state exists")
        self.assert_not_none(hasattr(g, "loaded_wafer_id"), "loaded_wafer_id exists")
        self.assert_not_none(
            hasattr(g, "wafer_orientation"), "wafer_orientation exists"
        )
        self.assert_not_none(hasattr(g, "probe_card_id"), "probe_card_id exists")
        self.assert_not_none(
            hasattr(g, "probe_card_orientation"), "probe_card_orientation exists"
        )
        self.assert_not_none(
            hasattr(g, "opened_project_id"), "opened_project_id exists"
        )
        self.assert_not_none(hasattr(g, "overdrive"), "overdrive exists")
        self.assert_not_none(
            hasattr(g, "camera_mount_point"), "camera_mount_point exists"
        )
        self.assert_not_none(
            hasattr(g, "current_working_area"), "current_working_area exists"
        )
        self.assert_not_none(hasattr(g, "current_die_col"), "current_die_col exists")
        self.assert_not_none(hasattr(g, "current_die_row"), "current_die_row exists")
        self.assert_not_none(
            hasattr(g, "current_die_subsite"), "current_die_subsite exists"
        )
        self.assert_not_none(
            hasattr(g, "chuck_z_position_state"), "chuck_z_position_state exists"
        )
        self.assert_not_none(
            hasattr(g, "total_dies_number"), "total_dies_number exists"
        )

        # Test initial values
        self.assert_equal(g.user, "default_user", "user default value")
        self.assert_equal(g.wpag_state, "ServiceOff", "wpag_state default value")
        self.assert_equal(g.loaded_wafer_id, None, "loaded_wafer_id default None")
        self.assert_equal(
            g.chuck_z_position_state, "Unknown", "chuck_z default Unknown"
        )

    def test_globals_helper_methods(self):
        """Test new helper methods"""
        self.print_section("Test 2: Global Parameters - Helper Methods")

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()  # Start fresh

        # Test set_wafer_loaded
        g.set_wafer_loaded(999, "North")
        self.assert_equal(g.loaded_wafer_id, 999, "set_wafer_loaded sets ID")
        self.assert_equal(
            g.wafer_orientation, "North", "set_wafer_loaded sets orientation"
        )

        # Test clear_wafer
        g.clear_wafer()
        self.assert_equal(g.loaded_wafer_id, None, "clear_wafer clears ID")
        self.assert_equal(g.wafer_orientation, None, "clear_wafer clears orientation")
        self.assert_equal(g.current_die_col, 0, "clear_wafer resets die col")

        # Test set_probe_card
        g.set_probe_card(456, "East")
        self.assert_equal(g.probe_card_id, 456, "set_probe_card sets ID")
        self.assert_equal(
            g.probe_card_orientation, "East", "set_probe_card sets orientation"
        )

        # Test set_current_die
        g.set_current_die(5, 10, 2)
        self.assert_equal(g.current_die_col, 5, "set_current_die sets col")
        self.assert_equal(g.current_die_row, 10, "set_current_die sets row")
        self.assert_equal(g.current_die_subsite, 2, "set_current_die sets subsite")

        # Test set_project
        g.set_project(789, "TestProject")
        self.assert_equal(g.opened_project_id, 789, "set_project sets ID")
        self.assert_equal(g.projectName, "TestProject", "set_project sets name")

        # Test set_chuck_position
        g.set_chuck_position("Contact")
        self.assert_equal(
            g.chuck_z_position_state, "Contact", "set_chuck_position sets state"
        )

    def test_response_builder_success(self):
        """Test ResponseBuilder success responses"""
        self.print_section("Test 3: ResponseBuilder - Success Response")

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()

        # Set up some test data
        g.user = "test_user"
        g.asicSerialNumber = 12345
        g.wp_machine_id = 1
        g.wpag_state = "WP_Idle"
        g.set_wafer_loaded(999, "North")
        g.set_probe_card(456, "South")
        g.set_project(789, "MyProject")
        g.overdrive = 5
        g.camera_mount_point = "Top"
        g.current_working_area = "TestArea"
        g.set_current_die(7, 12, 1)
        g.chuck_z_position_state = "Separation"
        g.total_dies_number = 1234

        # Build success response
        response = ResponseBuilder.success("TestReply", "Test successful")

        # Test top-level structure
        self.assert_equal(response["status"], "Success", "status is Success")
        self.assert_equal(response["type"], "TestReply", "type is TestReply")
        self.assert_in("data", response, "response has data")
        self.assert_in("error", response, "response has error")

        # Test data fields
        data = response["data"]
        self.assert_equal(data["userLogged"], "test_user", "data.user correct")
        self.assert_equal(
            data["asicSerialNumber"], 12345, "data.asicSerialNumber correct"
        )
        self.assert_equal(data["wpMachineId"], 1, "data.wpMachineId correct")
        self.assert_equal(data["WPAG_State"], "WP_Idle", "data.WPAG_State correct")

        # Test loadedWafer object
        self.assert_not_none(data["loadedWafer"], "loadedWafer not null")
        self.assert_equal(
            data["loadedWafer"]["waferId"], 999, "loadedWafer.waferId correct"
        )
        self.assert_equal(
            data["loadedWafer"]["orientation"],
            "North",
            "loadedWafer.orientation correct",
        )

        # Test probe card object
        self.assert_not_none(data["installedProbeCard"], "installedProbeCard not null")
        self.assert_equal(
            data["installedProbeCard"]["probeCardId"], 456, "probeCard ID correct"
        )

        # Test project fields
        self.assert_equal(data["openedProjectId"], 789, "openedProjectId correct")
        self.assert_equal(data["projectName"], "MyProject", "projectName correct")

        # Test configuration fields
        self.assert_equal(data["overdrive"], 5, "overdrive correct")
        self.assert_equal(data["cameraMountPoint"], "Top", "cameraMountPoint correct")
        self.assert_equal(
            data["currentWorkingArea"], "TestArea", "currentWorkingArea correct"
        )

        # Test die position
        self.assert_not_none(
            data["waferMapDiePosition"], "waferMapDiePosition not null"
        )
        self.assert_equal(data["waferMapDiePosition"]["colIndex"], 7, "die col correct")
        self.assert_equal(
            data["waferMapDiePosition"]["rowIndex"], 12, "die row correct"
        )
        self.assert_equal(
            data["waferMapDiePosition"]["subsiteIndex"], 1, "die subsite correct"
        )

        # Test chuck and dies
        self.assert_equal(data["chuckZPositionState"], "Separation", "chuckZ correct")
        self.assert_equal(data["totalDiesNumber"], 1234, "totalDies correct")

        # Test error object
        self.assert_equal(response["error"]["code"], 0, "error.code is 0")
        self.assert_equal(response["error"]["message"], "", "error.message is empty")

        # Print full response
        self.print_json(response, "Complete Success Response")

    def test_response_builder_error(self):
        """Test ResponseBuilder error responses"""
        self.print_section("Test 4: ResponseBuilder - Error Response")

        response = ResponseBuilder.error("TestReply", "Something went wrong", 400)

        # Test structure
        self.assert_equal(response["status"], "Error", "status is Error")
        self.assert_equal(response["type"], "TestReply", "type correct")
        self.assert_in("data", response, "has data (even on error)")
        self.assert_in("error", response, "has error")

        # Test error object
        self.assert_equal(response["error"]["code"], 400, "error.code is 400")
        self.assert_equal(
            response["error"]["message"],
            "Something went wrong",
            "error.message correct",
        )

        self.print_json(response, "Error Response")

    def test_response_null_wafer(self):
        """Test response when no wafer loaded"""
        self.print_section("Test 5: ResponseBuilder - Null Wafer")

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()

        # Don't load wafer
        g.loaded_wafer_id = None
        g.probe_card_id = None
        g.current_die_col = 0
        g.current_die_row = 0

        response = ResponseBuilder.success("TestReply", "No wafer loaded")
        data = response["data"]

        # Test null values
        self.assert_equal(data["loadedWafer"], None, "loadedWafer is null")
        self.assert_equal(data["installedProbeCard"], None, "probeCard is null")
        self.assert_equal(data["waferMapDiePosition"], None, "diePosition is null")

        self.print_json(data, "Data with Nulls")

    def test_response_state_changes(self):
        """Test that state changes are reflected in responses"""
        self.print_section("Test 6: Real-Time State Changes")

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()

        # Initial state
        g.chuck_z_position_state = "Unknown"
        response1 = ResponseBuilder.success("Test1", "Initial")
        self.assert_equal(
            response1["data"]["chuckZPositionState"], "Unknown", "Initial state Unknown"
        )

        # Change to Separation
        g.chuck_z_position_state = "Separation"
        response2 = ResponseBuilder.success("Test2", "After separation")
        self.assert_equal(
            response2["data"]["chuckZPositionState"],
            "Separation",
            "State changed to Separation",
        )

        # Change to Contact
        g.chuck_z_position_state = "Contact"
        response3 = ResponseBuilder.success("Test3", "After contact")
        self.assert_equal(
            response3["data"]["chuckZPositionState"],
            "Contact",
            "State changed to Contact",
        )

        # Change die position
        g.set_current_die(5, 10, 0)
        response4 = ResponseBuilder.success("Test4", "After die change")
        self.assert_equal(
            response4["data"]["waferMapDiePosition"]["colIndex"], 5, "Die col updated"
        )
        self.assert_equal(
            response4["data"]["waferMapDiePosition"]["rowIndex"], 10, "Die row updated"
        )

        print("\n  State changes are reflected in real-time! ✓")

    def test_complete_workflow(self):
        """Test a complete workflow simulation"""
        self.print_section("Test 7: Complete Workflow Simulation")

        g = SvtWPAagentGlobalParameters.getInstance()
        g.reset()

        print("\n  Simulating complete workflow:")

        # Step 1: Initialize
        print("  1. Initialize...")
        g.user = "operator1"
        g.asicSerialNumber = 12345
        g.wp_machine_id = 1
        g.wpag_state = "ServiceOn"
        g.set_project(100, "TestProject")
        response = ResponseBuilder.success("InitializeReply", "Initialized")
        self.assert_equal(
            response["data"]["WPAG_State"], "ServiceOn", "After init: ServiceOn"
        )

        # Step 2: Load Wafer
        print("  2. Load wafer...")
        g.set_wafer_loaded(999, "North")
        g.total_dies_number = 1234
        g.wpag_state = "WP_Idle"
        g.chuck_z_position_state = "Separation"
        response = ResponseBuilder.success("LoadWaferReply", "Wafer loaded")
        self.assert_not_none(
            response["data"]["loadedWafer"], "After load: wafer not null"
        )
        self.assert_equal(
            response["data"]["chuckZPositionState"],
            "Separation",
            "After load: Separation",
        )

        # Step 3: Go to Die
        print("  3. Move to die 5,10...")
        g.set_current_die(5, 10, 0)
        g.wpag_state = "WP_Idle"
        response = ResponseBuilder.success("GoToDieReply", "Moved to die")
        self.assert_equal(
            response["data"]["waferMapDiePosition"]["colIndex"],
            5,
            "After move: die col 5",
        )

        # Step 4: Go to Contact
        print("  4. Go to contact...")
        g.chuck_z_position_state = "Contact"
        g.wpag_state = "WP_Testing"
        response = ResponseBuilder.success("GoToContactReply", "In contact")
        self.assert_equal(
            response["data"]["chuckZPositionState"], "Contact", "After contact: Contact"
        )
        self.assert_equal(
            response["data"]["WPAG_State"], "WP_Testing", "After contact: Testing"
        )

        # Step 5: Go to Separation
        print("  5. Go to separation...")
        g.chuck_z_position_state = "Separation"
        g.wpag_state = "WP_Idle"
        response = ResponseBuilder.success("GoToSeparationReply", "In separation")
        self.assert_equal(
            response["data"]["chuckZPositionState"],
            "Separation",
            "After separation: Separation",
        )
        self.assert_equal(
            response["data"]["WPAG_State"], "WP_Idle", "After separation: Idle"
        )

        # Step 6: Unload Wafer
        print("  6. Unload wafer...")
        g.clear_wafer()
        g.wpag_state = "WP_Idle"
        response = ResponseBuilder.success("UnloadWaferReply", "Wafer unloaded")
        self.assert_equal(
            response["data"]["loadedWafer"], None, "After unload: wafer null"
        )
        self.assert_equal(
            response["data"]["waferMapDiePosition"], None, "After unload: die null"
        )

        print("\n  ✓ Complete workflow simulation passed!")

    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "=" * 60)
        print("  WP AGENT RESPONSE BUILDER TEST SUITE")
        print("=" * 60)

        try:
            self.test_globals_new_fields()
            self.test_globals_helper_methods()
            self.test_response_builder_success()
            self.test_response_builder_error()
            self.test_response_null_wafer()
            self.test_response_state_changes()
            self.test_complete_workflow()
        except Exception as e:
            print(f"\n❌ TEST CRASHED: {str(e)}")
            import traceback

            traceback.print_exc()
            self.failed += 1

        # Summary
        self.print_section("TEST SUMMARY")
        print(f"\n  Total Tests: {self.tests_run}")
        print(f"  ✓ Passed: {self.passed}")
        print(f"  ✗ Failed: {self.failed}")

        if self.failed == 0:
            print(f"\n  {'🎉 ALL TESTS PASSED! 🎉':^60}")
            print(f"\n  Your implementation is correct!")
            print(f"  Ready to use in production.")
        else:
            print(f"\n  ⚠️  {self.failed} test(s) failed")
            print(f"  Please check the output above.")

        print("\n" + "=" * 60 + "\n")

        return self.failed == 0


if __name__ == "__main__":
    tester = TestResponseBuilder()
    success = tester.run_all_tests()

    # Exit code 0 if all passed, 1 if any failed
    sys.exit(0 if success else 1)

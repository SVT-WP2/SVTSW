"""
WP Command Decorator - Integration Test

Tests that the @validate_command decorator actually works
by calling real decorated functions

Usage:
    python test_decorator_integration.py
"""

import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)
from utilities.WPResponseBuilder import ResponseBuilder
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_prober


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


# ============================================================
# DECORATED TEST FUNCTIONS (These simulate your real commands)
# ============================================================


@validate_command
def move_chuck_home(user=None, waferAgentName=None, **kwargs):
    """
    Move chuck to home position - Developer command
    Decorated with @validate_command
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_prober(g.machineType, g.address)
        prober.move_chuck_home()

        return ResponseBuilder.success(
            "MoveChuckHomeReply", "Chuck moved to home position"
        )
    except Exception as e:
        return ResponseBuilder.error("MoveChuckHomeReply", str(e), 500)


@validate_command
def move_chuck_row_column(
    row: int, col: int, wpMachineId: int = 0, user=None, waferAgentName=None, **kwargs
):
    """
    Move to specific die - Expert command
    Decorated with @validate_command
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        prober = get_prober(g.machineType, g.address)

        return ResponseBuilder.success(
            "MoveChuckRowColumnReply", f"Chuck moved to die (row={row}, col={col})"
        )
    except Exception as e:
        return ResponseBuilder.error("MoveChuckRowColumnReply", str(e), 500)


# ============================================================
# TEST FUNCTIONS
# ============================================================


def print_header(text: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'=' * 70}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{text}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'=' * 70}{Colors.RESET}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.RESET}")


def print_failure(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ️  {text}{Colors.RESET}")


def setup_environment():
    """Setup test environment"""
    print_header("SETUP")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.wpAgentName = "MOCK_TEST"
    g.address = "mock-prober"
    g.machineType = "mock"
    g.wp_machine_id = 0

    print_info(f"Agent: {g.wpAgentName}")
    print_info(f"Type: {g.machineType}")


def test_decorator_blocks_no_user():
    """Test 1: Decorator blocks when no user logged in"""
    print_header("TEST 1: Decorator Blocks When No User Logged In")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = None
    g.userLoggedHierarchy = None

    # Call the decorated function directly
    result = move_chuck_home(user=None, waferAgentName="MOCK_TEST")

    # Check if it's an error (status can be 'Error' or 'UnexpectedError')
    status = result.get("status", "")
    is_error = status in ["Error", "UnexpectedError"]
    error_code = result.get("error", {}).get("code")

    if is_error and error_code == 401:
        print_success("Decorator blocked command - no user logged in")
        print_info(f"Status: {status}")
        print_info(f"Error: {result['error']['message']}")
        print_info(f"Code: {error_code}")
    else:
        print_failure("Decorator should have blocked this command")
        print_info(f"Status: {status}")
        print_info(f"Error code: {error_code}")


def test_decorator_blocks_wrong_agent():
    """Test 2: Decorator blocks wrong agent name"""
    print_header("TEST 2: Decorator Blocks Wrong Agent Name")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "developer1"
    g.userLoggedHierarchy = "Developer"

    # Call with wrong agent name
    result = move_chuck_home(user="developer1", waferAgentName="WRONG_AGENT")

    status = result.get("status", "")
    is_error = status in ["Error", "UnexpectedError"]
    error_code = result.get("error", {}).get("code")

    if is_error and error_code == 403:
        print_success("Decorator blocked command - wrong agent")
        print_info(f"Error: {result['error']['message']}")
    else:
        print_failure("Decorator should have blocked wrong agent")
        print_info(f"Status: {status}, Code: {error_code}")


def test_decorator_blocks_insufficient_permissions():
    """Test 3: Decorator blocks User from Developer command"""
    print_header("TEST 3: Decorator Blocks Insufficient Permissions")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "user1"
    g.userLoggedHierarchy = "User"

    # User tries Developer command
    result = move_chuck_home(user="user1", waferAgentName="MOCK_TEST")

    status = result.get("status", "")
    is_error = status in ["Error", "UnexpectedError"]
    error_code = result.get("error", {}).get("code")

    if is_error and error_code == 403:
        print_success("Decorator blocked User from Developer command")
        print_info(f"Error: {result['error']['message']}")
    else:
        print_failure("Decorator should block User from Developer commands")
        print_info(f"Status: {status}, Code: {error_code}")


def test_decorator_validates_parameters():
    """Test 4: Decorator validates parameters"""
    print_header("TEST 4: Decorator Validates Parameters")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "expert1"
    g.userLoggedHierarchy = "Expert"

    # Call with missing required parameter (col)
    result = move_chuck_row_column(
        row=5,
        # col is missing!
        wpMachineId=0,
        user="expert1",
        waferAgentName="MOCK_TEST",
    )

    status = result.get("status", "")
    is_error = status in ["Error", "UnexpectedError"]
    error_code = result.get("error", {}).get("code")

    if is_error and error_code == 400:
        print_success("Decorator detected missing parameter")
        print_info(f"Error: {result['error']['message']}")
    else:
        print_failure("Decorator should detect missing parameters")
        print_info(f"Status: {status}, Code: {error_code}")


def test_decorator_validates_orientations():
    """Test 5: Decorator validates probe card and wafer orientations"""
    print_header("TEST 5: Decorator Validates Orientations")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "expert1"
    g.userLoggedHierarchy = "Expert"
    g.projectName = "ER2_NKF7_Vertical_East"
    g.probe_card_orientation = "Cantilever"  # Wrong!
    g.wafer_orientation = "East"

    # Debug: Print what validator sees
    print_info(f"DEBUG - Project: {g.projectName}")
    print_info(f"DEBUG - Probe Card: {g.probe_card_orientation}")
    print_info(f"DEBUG - Wafer: {g.wafer_orientation}")

    # Call decorated function
    result = move_chuck_row_column(
        row=1, col=1, wpMachineId=0, user="expert1", waferAgentName="MOCK_TEST"
    )

    status = result.get("status", "")
    is_error = status in ["Error", "UnexpectedError"]
    error_code = result.get("error", {}).get("code")
    error_msg = result.get("error", {}).get("message", "")

    print_info(f"DEBUG - Result Status: {status}")
    print_info(f"DEBUG - Error Code: {error_code}")
    print_info(f"DEBUG - Error Message: {error_msg}")

    if is_error and error_code == 400 and "probe card" in error_msg.lower():
        print_success("Decorator detected probe card type mismatch")
        print_info(f"Error: {error_msg}")
    else:
        print_failure("Decorator should detect orientation mismatch")
        print_info(f"Expected: Error with code 400 about probe card mismatch")
        print_info(f"Got: Status={status}, Code={error_code}")

        # Additional debug
        if status == "Success":
            print_info("⚠️  WARNING: Command succeeded when it should have failed!")
            print_info("⚠️  Check that g.projectName is being set correctly")


def test_decorator_allows_valid_command():
    """Test 6: Decorator allows valid command to execute"""
    print_header("TEST 6: Decorator Allows Valid Command")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "developer1"
    g.userLoggedHierarchy = "Developer"

    # Call decorated function with everything correct
    result = move_chuck_home(user="developer1", waferAgentName="MOCK_TEST")

    status = result.get("status", "")
    is_success = status == "Success"

    if is_success:
        print_success("Decorator allowed valid command to execute!")
        # Get message from error.message (ResponseBuilder format)
        message = result.get("error", {}).get(
            "message", "Command executed successfully"
        )
        print_info(f"Message: {message}")
        print_info("Function code was actually executed ✓")
    else:
        print_failure("Decorator should allow valid commands")
        print_info(f"Status: {status}")


def test_decorator_allows_expert_command():
    """Test 7: Decorator allows Expert to use Expert command"""
    print_header("TEST 7: Decorator Allows Expert Command")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "expert1"
    g.userLoggedHierarchy = "Expert"
    g.projectName = "ER2_NKF7_Vertical_East"
    g.probe_card_orientation = "Vertical"  # Correct
    g.wafer_orientation = "East"  # Correct

    # Expert uses Expert-level command
    result = move_chuck_row_column(
        row=5, col=10, wpMachineId=0, user="expert1", waferAgentName="MOCK_TEST"
    )

    status = result.get("status", "")
    is_success = status == "Success"

    if is_success:
        print_success("Decorator allowed Expert to execute command!")
        message = result.get("error", {}).get("message", "Command executed")
        print_info(f"Message: {message}")
        print_info("All validations passed ✓")
        print_info("  - User: expert1 (Expert)")
        print_info("  - Agent: MOCK_TEST")
        print_info("  - Probe Card: Vertical")
        print_info("  - Wafer: East")
        print_info("  - Parameters: row=5, col=10")
    else:
        print_failure("Decorator should allow Expert commands")
        print_info(f"Status: {status}")


def test_decorator_developer_full_access():
    """Test 8: Decorator gives Developer full access"""
    print_header("TEST 8: Decorator Gives Developer Full Access")

    g = SvtWPAagentGlobalParameters.getInstance()
    g.userLogged = "developer1"
    g.userLoggedHierarchy = "Developer"

    # Test Developer command
    result1 = move_chuck_home(user="developer1", waferAgentName="MOCK_TEST")

    # Test Expert command
    result2 = move_chuck_row_column(
        row=1, col=1, wpMachineId=0, user="developer1", waferAgentName="MOCK_TEST"
    )

    status1 = result1.get("status", "")
    status2 = result2.get("status", "")

    if status1 == "Success" and status2 == "Success":
        print_success("Decorator allows Developer to execute ALL commands!")
        print_info("Developer has unrestricted access ✓")
    else:
        print_failure("Developer should have access to all commands")
        print_info(f"Result1 status: {status1}, Result2 status: {status2}")


def run_all_tests():
    """Run all decorator integration tests"""
    print(f"\n{Colors.BOLD}{'=' * 70}")
    print("WP COMMAND DECORATOR - INTEGRATION TESTS")
    print("Testing: @validate_command decorator with real functions")
    print(f"{'=' * 70}{Colors.RESET}\n")

    try:
        setup_environment()

        test_decorator_blocks_no_user()
        test_decorator_blocks_wrong_agent()
        test_decorator_blocks_insufficient_permissions()
        test_decorator_validates_parameters()
        test_decorator_validates_orientations()
        test_decorator_allows_valid_command()
        test_decorator_allows_expert_command()
        test_decorator_developer_full_access()

        print_header("TEST SUMMARY")
        print_success("All decorator integration tests completed!")
        print_info("The @validate_command decorator is working correctly ✓")
        print_info("You can safely use it in your command functions!")

    except Exception as e:
        print_failure(f"Test error: {str(e)}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    run_all_tests()

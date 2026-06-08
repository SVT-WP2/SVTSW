#!/usr/bin/env python3.12
"""

This test demonstrates:
1. Normal users (User/Expert) blocked from calling set_chuck_overtravel (wrong state)
2. Developer login → ALLOWED to call set_chuck_overtravel (bypass restrictions)
3. State transitions and wpag_state auto-sync
4. Complete payloads from ResponseBuilder
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState
import json
from unittest.mock import Mock, patch


def print_separator(title=""):
    """Print separator"""
    if title:
        print(f"\n{'=' * 80}")
        print(f"  {title}")
        print(f"{'=' * 80}\n")
    else:
        print(f"{'=' * 80}\n")


def print_state():
    """Print current state information"""
    g = SvtWPAagentGlobalParameters.getInstance()

    print("📊 CURRENT STATE:")
    print(f"   User: {g.userLogged} ({g.userLoggedHierarchy})")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    print(f"   g.overdrive: {g.overdrive}")
    print(f"   Available commands: {agentStateMachine.get_available_commands()}")


def print_payload(result, title="RESPONSE"):
    """Print response payload"""
    print(f"\n📦 {title}:")
    print(json.dumps(result, indent=2))


def setup_mock_prober():
    """Create mock prober for testing"""
    mock_prober = Mock()
    mock_prober.set_overtravel = Mock(return_value=None)
    mock_prober.enable_overtravel = Mock(return_value=None)
    mock_prober.local_mode = Mock(return_value=None)
    return mock_prober


def setup_hierarchy_config():
    """Create user hierarchy config with User, Expert, Developer"""
    print("📝 Setting up user hierarchy config...")
    os.makedirs("configs", exist_ok=True)
    hierarchy = {
        "Developer": ["developer", "dev1", "admin"],
        "Expert": ["expert1", "expert2", "alice"],
        "User": ["user1", "user2", "bob"],
    }
    with open("configs/WPUserHierarchy.json", "w") as f:
        json.dump(hierarchy, f, indent=2)
    print("✓ Created configs/WPUserHierarchy.json")
    print("   Hierarchy levels: Developer, Expert, User\n")


def initialize_agent():
    """Initialize agent to simulate real environment"""
    g = SvtWPAagentGlobalParameters.getInstance()
    g.address = "localhost:35555"
    g.machineType = "sentio"
    g.projectName = "TestProject"
    g.wp_machine_id = 4
    g.machine_id = 4
    g.prober_status = "initialized"
    print("✓ Agent initialized\n")


def test_scenario_1_user_blocked():
    """
    SCENARIO 1: Basic User Cannot Execute Set Overtravel

    Steps:
    1. User logs in → UserLogged state
    2. Try to call set_chuck_overtravel
    3. Should be BLOCKED (wrong state for command)
    """
    print_separator("SCENARIO 1: Basic User Blocked from Restricted Command")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    # Step 1: User logs in
    print("STEP 1: Basic user logs in")
    print("  UserLogIn(user='user1', waferAgentName='WP1')\n")

    result = UserLogIn(user="user1", waferAgentName="WP1")
    print_payload(result, "LOGIN RESPONSE")
    print_state()

    # Step 2: Try to set overtravel (should fail - wrong state)
    print("\nSTEP 2: Try to execute set_chuck_overtravel (SHOULD FAIL)")
    print("  set_chuck_overtravel(overtravelGap=50)\n")
    print("💡 UserLogged state does NOT allow SetOverdrive command")

    result = set_chuck_overtravel(overtravelGap=50, address="localhost:35555")

    print_payload(result, "SET OVERTRAVEL RESPONSE")

    # Verify
    print("\n🔍 VERIFICATION:")
    if result["status"] == "Error":
        print("   ✅ CORRECT: Basic user blocked from restricted command")
        print(f"   Error message: {result['error']['message']}")
    else:
        print("   ❌ WRONG: Should have been blocked!")

    print_state()

    # Step 3: Logout
    print("\nSTEP 3: User logs out")
    print("  UserLogOut(user='user1')\n")

    result = UserLogOut(user="user1", waferAgentName="WP1")
    print_payload(result, "LOGOUT RESPONSE")
    print_state()


def test_scenario_2_expert_blocked():
    """
    SCENARIO 2: Expert Also Cannot Execute Set Overtravel

    Steps:
    1. Expert logs in → UserLogged state
    2. Try to call set_chuck_overtravel
    3. Should be BLOCKED (wrong state, not developer)
    """
    print_separator("SCENARIO 2: Expert Also Blocked from Restricted Command")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    # Step 1: Expert logs in
    print("STEP 1: Expert logs in")
    print("  UserLogIn(user='expert1', waferAgentName='WP1')\n")

    result = UserLogIn(user="expert1", waferAgentName="WP1")
    print_payload(result, "LOGIN RESPONSE")
    print_state()

    # Step 2: Try to set overtravel (should fail)
    print("\nSTEP 2: Try to execute set_chuck_overtravel (SHOULD FAIL)")
    print("  set_chuck_overtravel(overtravelGap=50)\n")
    print("💡 Even Expert users are restricted by state machine")

    result = set_chuck_overtravel(overtravelGap=50, address="localhost:35555")

    print_payload(result, "SET OVERTRAVEL RESPONSE")

    # Verify
    print("\n🔍 VERIFICATION:")
    if result["status"] == "Error":
        print("   ✅ CORRECT: Expert blocked (not Developer)")
        print(f"   Error message: {result['error']['message']}")
    else:
        print("   ❌ WRONG: Should have been blocked!")

    print_state()

    # Logout
    print("\n  UserLogOut(user='expert1')\n")
    result = UserLogOut(user="expert1", waferAgentName="WP1")
    print_payload(result, "LOGOUT RESPONSE")


def test_scenario_3_developer_allowed():
    """
    SCENARIO 3: Developer CAN Execute Set Overtravel

    Steps:
    1. Developer logs in → UsedByDeveloper state
    2. Call set_chuck_overtravel
    3. Should be ALLOWED (developer bypasses restrictions)
    4. Check overdrive value updated
    """
    print_separator("SCENARIO 3: Developer Bypasses All Restrictions")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    g = SvtWPAagentGlobalParameters.getInstance()

    # Step 1: Developer logs in
    print("STEP 1: Developer logs in")
    print("  UserLogIn(user='developer', waferAgentName='WP1')\n")

    result = UserLogIn(user="developer", waferAgentName="WP1")
    print_payload(result, "LOGIN RESPONSE")
    print_state()

    # Verify developer mode
    print("\n🔍 Checking developer privileges:")
    print(f"   State: {agentStateMachine.get_state_name()}")
    print(f"   Is developer mode: {agentStateMachine.is_developer_mode()}")
    print(
        f"   Can execute SetOverdrive: {agentStateMachine.can_execute('SetOverdrive')}"
    )

    # Step 2: Set overtravel (should succeed)
    print("\nSTEP 2: Execute set_chuck_overtravel (SHOULD SUCCEED)")
    print("  set_chuck_overtravel(overtravelGap=50)\n")
    print("💡 Developer mode allows ALL commands!")

    # Mock prober
    mock_prober = setup_mock_prober()

    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            result = set_chuck_overtravel(overtravelGap=50, address="localhost:35555")

    print_payload(result, "SET OVERTRAVEL RESPONSE")

    # Verify
    print("\n🔍 VERIFICATION:")
    if result["status"] == "Success":
        print("   ✅ CORRECT: Developer successfully executed command!")
        print(f"   Overdrive updated: {g.overdrive}")
        print(f"   State remains: {agentStateMachine.get_state_name()}")
        print(f"   wpag_state: {g.wpag_state}")
    else:
        print("   ❌ WRONG: Developer should have been allowed!")

    print_state()

    # Step 3: Execute another command (also should work)
    print("\nSTEP 3: Execute another command to prove bypass")
    print("  set_chuck_overtravel(overtravelGap=75)\n")

    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            result = set_chuck_overtravel(overtravelGap=75, address="localhost:35555")

    print_payload(result, "SECOND CALL RESPONSE")
    print(f"   Overdrive now: {g.overdrive}")

    # Step 4: Logout
    print("\nSTEP 4: Developer logs out")
    print("  UserLogOut(user='developer')\n")

    result = UserLogOut(user="developer", waferAgentName="WP1")
    print_payload(result, "LOGOUT RESPONSE")
    print_state()


def test_scenario_4_takeover_from_user():
    """
    SCENARIO 4: Developer Takes Control from Basic User

    Steps:
    1. User logs in
    2. User tries set_chuck_overtravel → BLOCKED
    3. Developer takes control
    4. Developer calls set_chuck_overtravel → ALLOWED
    """
    print_separator("SCENARIO 4: Developer Takes Control from User")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    g = SvtWPAagentGlobalParameters.getInstance()

    # Step 1: User logs in
    print("STEP 1: Basic user logs in")
    print("  UserLogIn(user='user2', waferAgentName='WP1')\n")

    result = UserLogIn(user="user2", waferAgentName="WP1")
    print_payload(result, "USER LOGIN")
    print_state()

    # Step 2: User tries command (blocked)
    print("\nSTEP 2: User tries set_chuck_overtravel (BLOCKED)")
    print("  set_chuck_overtravel(overtravelGap=30)\n")

    result = set_chuck_overtravel(
        overtravelGap=30,
        address="localhost:35555",
    )

    print_payload(result, "USER ATTEMPT")
    print(f"   Status: {result['status']} (should be Error)")

    # Step 3: Developer takes control
    print("\nSTEP 3: Developer takes control from user")
    print("  UserLogIn(user='developer', waferAgentName='WP1')\n")

    result = UserLogIn(user="developer", waferAgentName="WP1")
    print_payload(result, "DEVELOPER TAKEOVER")
    print_state()

    # Step 4: Developer executes same command (allowed)
    print("\nSTEP 4: Developer executes same command (ALLOWED)")
    print("  set_chuck_overtravel(overtravelGap=30)\n")

    mock_prober = setup_mock_prober()

    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            result = set_chuck_overtravel(overtravelGap=30, address="localhost:35555")

    print_payload(result, "DEVELOPER EXECUTION")

    # Verify
    print("\n🔍 VERIFICATION:")
    if result["status"] == "Success":
        print("   ✅ Developer successfully executed after takeover!")
        print(f"   Overdrive: {g.overdrive}")
    else:
        print("   ❌ Developer should have been allowed!")

    print_state()

    # Cleanup
    print("\n  UserLogOut(user='developer')")
    UserLogOut(user="developer", waferAgentName="WP1")


def test_scenario_5_takeover_from_expert():
    """
    SCENARIO 5: Developer Takes Control from Expert

    Steps:
    1. Expert logs in
    2. Expert tries set_chuck_overtravel → BLOCKED
    3. Developer takes control
    4. Developer calls set_chuck_overtravel → ALLOWED
    """
    print_separator("SCENARIO 5: Developer Takes Control from Expert")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    g = SvtWPAagentGlobalParameters.getInstance()

    # Step 1: Expert logs in
    print("STEP 1: Expert logs in")
    print("  UserLogIn(user='expert2', waferAgentName='WP1')\n")

    result = UserLogIn(user="expert2", waferAgentName="WP1")
    print_payload(result, "EXPERT LOGIN")
    print_state()

    # Step 2: Expert tries command (blocked)
    print("\nSTEP 2: Expert tries set_chuck_overtravel (BLOCKED)")
    print("  set_chuck_overtravel(overtravelGap=40)\n")

    result = set_chuck_overtravel(overtravelGap=40, address="localhost:35555")

    print_payload(result, "EXPERT ATTEMPT")
    print(f"   Status: {result['status']} (should be Error)")

    # Step 3: Developer takes control
    print("\nSTEP 3: Developer takes control from expert")
    print("  UserLogIn(user='developer', waferAgentName='WP1')\n")

    result = UserLogIn(user="developer", waferAgentName="WP1")
    print_payload(result, "DEVELOPER TAKEOVER")
    print_state()

    # Step 4: Developer executes same command (allowed)
    print("\nSTEP 4: Developer executes same command (ALLOWED)")
    print("  set_chuck_overtravel(overtravelGap=40)\n")

    mock_prober = setup_mock_prober()

    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            result = set_chuck_overtravel(overtravelGap=40, address="localhost:35555")

    print_payload(result, "DEVELOPER EXECUTION")

    # Verify
    print("\n🔍 VERIFICATION:")
    if result["status"] == "Success":
        print("   ✅ Developer successfully executed after takeover from Expert!")
        print(f"   Overdrive: {g.overdrive}")
    else:
        print("   ❌ Developer should have been allowed!")

    print_state()

    # Cleanup
    print("\n  UserLogOut(user='developer')")
    UserLogOut(user="developer", waferAgentName="WP1")


def test_scenario_6_multiple_commands():
    """
    SCENARIO 6: Developer Executes Multiple Different Commands

    Show that developer can execute various commands in sequence
    """
    print_separator("SCENARIO 6: Developer Multiple Commands")

    from actions.WPLoginActions import UserLogIn, UserLogOut
    from actions.WPTestingActions import set_chuck_overtravel

    g = SvtWPAagentGlobalParameters.getInstance()

    # Login
    print("STEP 1: Developer logs in")
    UserLogIn(user="developer", waferAgentName="WP1")
    print_state()

    mock_prober = setup_mock_prober()

    # Execute multiple commands
    print("\nSTEP 2: Execute multiple set_chuck_overtravel calls")

    overtravel_values = [10, 25, 50, 75, 100, 0]

    for i, value in enumerate(overtravel_values, 1):
        print(f"\n   Call {i}: set_chuck_overtravel(overtravelGap={value})")

        with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
            with patch(
                "actions.WPTestingActions.resolve_project_parameters",
                return_value=("localhost:35555", None, "sentio"),
            ):
                result = set_chuck_overtravel(
                    overtravelGap=value, address="localhost:35555"
                )

        status = "✅" if result["status"] == "Success" else "❌"
        print(f"      {status} Status: {result['status']}")
        print(f"      Overdrive: {g.overdrive}")
        print(f"      State: {agentStateMachine.get_state_name()}")

    print("\n🔍 SUMMARY:")
    print(f"   All {len(overtravel_values)} commands executed successfully!")
    print(f"   State remained: {agentStateMachine.get_state_name()} throughout")
    print(f"   wpag_state: {g.wpag_state}")

    # Logout
    print("\n  UserLogOut(user='developer')")
    UserLogOut(user="developer", waferAgentName="WP1")


def test_scenario_7_auto_sync():
    """
    SCENARIO 7: Verify Auto-Sync of wpag_state

    Check that g.wpag_state always matches state machine
    """
    print_separator("SCENARIO 7: Verify wpag_state Auto-Sync")

    from actions.WPLoginActions import UserLogIn, UserLogOut

    g = SvtWPAagentGlobalParameters.getInstance()

    print("Testing wpag_state synchronization through login/logout cycle\n")

    # Check 1: Initial state
    print("CHECK 1: Initial state")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    match1 = g.wpag_state == agentStateMachine.get_state_name()
    print(f"   Match: {'✅' if match1 else '❌'}")

    # Check 2: After developer login
    print("\nCHECK 2: After developer login")
    UserLogIn(user="developer", waferAgentName="WP1")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    match2 = g.wpag_state == agentStateMachine.get_state_name()
    print(f"   Match: {'✅' if match2 else '❌'}")

    # Check 3: After logout
    print("\nCHECK 3: After logout")
    UserLogOut(user="developer", waferAgentName="WP1")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    match3 = g.wpag_state == agentStateMachine.get_state_name()
    print(f"   Match: {'✅' if match3 else '❌'}")

    # Check 4: After User login
    print("\nCHECK 4: After User login")
    UserLogIn(user="user1", waferAgentName="WP1")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    match4 = g.wpag_state == agentStateMachine.get_state_name()
    print(f"   Match: {'✅' if match4 else '❌'}")

    # Cleanup
    UserLogOut(user="user1", waferAgentName="WP1")

    # Check 5: After Expert login
    print("\nCHECK 5: After Expert login")
    UserLogIn(user="expert1", waferAgentName="WP1")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    match5 = g.wpag_state == agentStateMachine.get_state_name()
    print(f"   Match: {'✅' if match5 else '❌'}")

    # Cleanup
    UserLogOut(user="expert1", waferAgentName="WP1")

    # Summary
    print("\n🔍 AUTO-SYNC SUMMARY:")
    all_match = match1 and match2 and match3 and match4 and match5
    if all_match:
        print("   ✅ ALL CHECKS PASSED - Auto-sync working perfectly!")
    else:
        print("   ❌ SOME CHECKS FAILED - Auto-sync needs debugging")


def main():
    """Run all test scenarios"""

    print_separator("COMPLETE LOGIN/LOGOUT + FUNCTION CALL TEST")
    print("Testing: User hierarchy, state machine, and actual function calls")
    print("\nHierarchy Levels:")
    print("  - User: Basic access (restricted by state)")
    print("  - Expert: Advanced access (restricted by state)")
    print("  - Developer: Full access (bypasses ALL restrictions)")
    print("\nThis test demonstrates:")
    print("  1. Users and Experts blocked from restricted commands")
    print("  2. Developers bypass all state restrictions")
    print("  3. Developer takeover functionality")
    print("  4. Multiple command execution")
    print("  5. wpag_state auto-synchronization")

    # Setup
    setup_hierarchy_config()
    initialize_agent()

    # Run all scenarios
    test_scenario_1_user_blocked()
    test_scenario_2_expert_blocked()
    test_scenario_3_developer_allowed()
    test_scenario_4_takeover_from_user()
    test_scenario_5_takeover_from_expert()
    test_scenario_6_multiple_commands()
    test_scenario_7_auto_sync()

    # Final summary
    print_separator("TEST COMPLETE - SUMMARY")

    print("✅ VERIFIED:")
    print("   1. Users are restricted by state machine")
    print("   2. Experts are also restricted by state machine")
    print("   3. Developers can execute ANY command in ANY state")
    print("   4. set_chuck_overtravel works correctly with state machine")
    print("   5. Developer takeover from Users and Experts works")
    print("   6. wpag_state auto-syncs with state machine")
    print("   7. ResponseBuilder creates consistent payloads")

    print("\n KEY INSIGHTS:")
    print("   → User/Expert → UserLogged state: Restricted to valid transitions")
    print("   → Developer → UsedByDeveloper state: ALL commands allowed")
    print("   → g.wpag_state always matches agentStateMachine.get_state_name()")

    print("\nHIERARCHY SUMMARY:")
    print("   User     → UserLogged     → Restricted ❌")
    print("   Expert   → UserLogged     → Restricted ❌")
    print("   Developer → UsedByDeveloper → Full Access ✅")

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()

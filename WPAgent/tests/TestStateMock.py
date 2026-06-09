#!/usr/bin/env python3.12
"""
Test ACTUAL WPTestingActions.set_chuck_overtravel

This imports the real function from actions/WPTestingActions.py
and mocks only the prober to avoid needing real hardware.

Usage:
    cd /data/akostina/SVTSW/WPAgent
    python3.12 test_real_function.py
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
        print(f"\n{'=' * 70}")
        print(f"  {title}")
        print(f"{'=' * 70}\n")
    else:
        print(f"{'=' * 70}\n")


def print_state_info():
    """Print current state information"""
    g = SvtWPAagentGlobalParameters.getInstance()

    print("📊 CURRENT STATE:")
    print(f"   State Machine: {agentStateMachine.get_state_name()}")
    print(f"   g.wpag_state: {g.wpag_state}")
    print(f"   g.overdrive: {g.overdrive}")
    print(f"   Available commands: {agentStateMachine.get_available_commands()}")


def setup_initial_state():
    """Setup to valid state for testing"""
    g = SvtWPAagentGlobalParameters.getInstance()

    print_separator("SETUP")

    print("Setting up initial state...")

    # Set state to OnDie_Wide_withPTPA (where SetOverdrive is allowed)
    agentStateMachine.force_state(WPAgentState.OnDie_Wide_withPTPA)

    # Initialize globals
    g.address = "localhost:35555"
    g.machineType = "sentio"
    g.machine_type = "sentio"
    g.projectName = "TestProject"
    g.project_name = "TestProject"
    g.wp_machine_id = 4
    g.machine_id = 4
    g.prober_status = "initialized"
    g.overdrive = 0
    g.chuck_z_position_state = "Separation"
    g.current_working_area = "TestArea"

    print("✓ State set to: OnDie_Wide_withPTPA")
    print(f"✓ g.wpag_state: {g.wpag_state}")
    print(f"✓ g.overdrive: {g.overdrive}")


def test_with_mock_prober():
    """Test actual set_chuck_overtravel with mocked prober"""

    print_separator("TEST: Calling REAL set_chuck_overtravel")

    g = SvtWPAagentGlobalParameters.getInstance()

    print("Importing ACTUAL function from actions.WPTestingActions...")
    from actions.WPTestingActions import set_chuck_overtravel

    print("✓ Import successful\n")

    print("BEFORE calling set_chuck_overtravel:")
    print_state_info()

    # Mock the prober to avoid needing real hardware
    mock_prober = Mock()
    mock_prober.set_overtravel = Mock(return_value=None)
    mock_prober.enable_overtravel = Mock(return_value=None)
    mock_prober.local_mode = Mock(return_value=None)

    print("\n📞 Calling: set_chuck_overtravel(overtravelGap=50)")
    print("   (Using mocked prober - no real hardware needed)\n")

    # Patch get_prober to return our mock
    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        # Also patch resolve_project_parameters
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            # Call the REAL function
            result = set_chuck_overtravel(
                overtravelGap=50, address="localhost:35555", machine_type="sentio"
            )

    print_separator("RESULTS")

    print("AFTER calling set_chuck_overtravel:")
    print_state_info()

    print("\n📦 RESPONSE PAYLOAD:")
    print(json.dumps(result, indent=2))

    print("\n🔍 VERIFICATION:")
    print(f"   ✓ Prober.set_overtravel called: {mock_prober.set_overtravel.called}")
    print(
        f"   ✓ Prober.enable_overtravel called: {mock_prober.enable_overtravel.called}"
    )
    print(f"   ✓ State machine state: {agentStateMachine.get_state_name()}")
    print(f"   ✓ g.wpag_state: {g.wpag_state}")
    print(f"   ✓ g.overdrive updated: {g.overdrive}")

    # Check if auto-sync worked
    if g.wpag_state == agentStateMachine.get_state_name():
        print("\n✅ AUTO-SYNC WORKING! g.wpag_state matches state machine!")
    else:
        print(f"\n❌ AUTO-SYNC NOT WORKING! Mismatch:")
        print(f"   State machine: {agentStateMachine.get_state_name()}")
        print(f"   g.wpag_state: {g.wpag_state}")

    return result


def test_invalid_state():
    """Test from invalid state"""

    print_separator("TEST: Calling from INVALID state")

    g = SvtWPAagentGlobalParameters.getInstance()

    # Force to wrong state
    print("Forcing state to Aligned (where SetOverdrive is NOT allowed)...")
    agentStateMachine.force_state(WPAgentState.Aligned)

    print("\nBEFORE calling set_chuck_overtravel:")
    print_state_info()

    print("\n📞 Calling: set_chuck_overtravel(overtravelGap=25)")
    print("   (Should return error - command not allowed in this state)\n")

    from actions.WPTestingActions import set_chuck_overtravel

    result = set_chuck_overtravel(
        overtravelGap=25, address="localhost:35555", machine_type="sentio"
    )

    print("AFTER calling set_chuck_overtravel:")
    print_state_info()

    print("\n📦 RESPONSE PAYLOAD:")
    print(json.dumps(result, indent=2))

    print("\n🔍 VERIFICATION:")
    if result.get("status") == "Error":
        print("   ✓ Correctly returned Error status")
        print(f"   ✓ Error message: {result['error']['message']}")
    else:
        print("   ❌ Expected Error but got Success")


def test_multiple_calls():
    """Test multiple calls in sequence"""

    print_separator("TEST: Multiple calls in sequence")

    g = SvtWPAagentGlobalParameters.getInstance()

    # Setup
    agentStateMachine.force_state(WPAgentState.OnDie_Wide_withPTPA)
    g.overdrive = 0

    from actions.WPTestingActions import set_chuck_overtravel

    mock_prober = Mock()
    mock_prober.set_overtravel = Mock(return_value=None)
    mock_prober.enable_overtravel = Mock(return_value=None)
    mock_prober.local_mode = Mock(return_value=None)

    with patch("actions.WPTestingActions.get_prober", return_value=mock_prober):
        with patch(
            "actions.WPTestingActions.resolve_project_parameters",
            return_value=("localhost:35555", None, "sentio"),
        ):
            print("CALL 1: Set overdrive to 25")
            result1 = set_chuck_overtravel(overtravelGap=25)
            print(f"   State: {agentStateMachine.get_state_name()}")
            print(f"   g.wpag_state: {g.wpag_state}")
            print(f"   g.overdrive: {g.overdrive}")

            print("\nCALL 2: Set overdrive to 50")
            result2 = set_chuck_overtravel(overtravelGap=50)
            print(f"   State: {agentStateMachine.get_state_name()}")
            print(f"   g.wpag_state: {g.wpag_state}")
            print(f"   g.overdrive: {g.overdrive}")

            print("\nCALL 3: Set overdrive to 0")
            result3 = set_chuck_overtravel(overtravelGap=0)
            print(f"   State: {agentStateMachine.get_state_name()}")
            print(f"   g.wpag_state: {g.wpag_state}")
            print(f"   g.overdrive: {g.overdrive}")

    print("\n✅ State should remain OnDie_Wide_withPTPA through all calls")
    print(f"   Final state: {agentStateMachine.get_state_name()}")
    print(f"   Final g.wpag_state: {g.wpag_state}")


def main():
    """Run all tests"""

    print_separator("WP AGENT - REAL FUNCTION TEST")
    print("Testing: ACTUAL actions.WPTestingActions.set_chuck_overtravel")
    print("Goal: Verify auto-sync between state machine and global parameters")

    # Initialize
    setup_initial_state()

    # Test 1: Valid state
    result1 = test_with_mock_prober()

    # Test 2: Invalid state
    result2 = test_invalid_state()

    # Test 3: Multiple calls
    test_multiple_calls()

    # Summary
    print_separator("TEST SUMMARY")

    print("✅ TESTED:")
    print("   1. Real set_chuck_overtravel function from WPTestingActions")
    print("   2. State machine validation")
    print("   3. State transitions")
    print("   4. Global parameter updates (g.overdrive)")
    print("   5. Auto-sync of g.wpag_state with state machine")

    print("\n🔍 CHECK AUTO-SYNC:")
    print("   Look for: '✅ AUTO-SYNC WORKING!' in the output above")
    print("   This confirms g.wpag_state auto-syncs with state machine!")

    print("\n📦 PAYLOAD STRUCTURE:")
    print("   The response includes:")
    print("   - status: Success/Error")
    print("   - type: SetOvertravelReply")
    print("   - data: {user, wpag_state, overdrive, message, ...}")
    print("   - error: {code, message}")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    main()

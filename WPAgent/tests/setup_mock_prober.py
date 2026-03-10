import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from drivers.WPFactory import ProberFactory,prober_classes
from tests.mock_prober import MockProberImpl

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

def setup_mock_prober(address="mock-prober:35555", machineType="sentio"):
    """
    Properly setup mock prober to work with WP Agent.

    This function does EVERYTHING needed to make the mock prober work:
    1. Registers MockProberImpl in prober_classes
    2. Creates and initializes mock prober
    3. Registers it in factory
    4. Sets all globals correctly
    5. Resets state machine

    Args:
        address: Mock prober address
        machine_type: Machine type (default: "sentio")

    Returns:
        MockProberImpl instance
    """

    print("🔧 Setting up mock prober environment...")

    # Step 1: Register MockProberImpl in prober_classes
    # This allows factory.get_prober() to create mock instances
    if "mock" not in prober_classes:
        prober_classes["mock"] = MockProberImpl
        print("  ✓ Registered MockProberImpl in prober_classes")

    # Also register under "sentio" for compatibility
    if machineType == "sentio":
        prober_classes["sentio"] = MockProberImpl
        print(f"  ✓ Registered MockProberImpl as '{machineType}'")

    # Step 2: Reset factory and globals
    factory = ProberFactory.get_instance()
    g = SvtWPAagentGlobalParameters.getInstance()

    factory.reset()
    g.reset()
    print("  ✓ Reset factory and globals")

    # Step 3: Create mock prober
    mock_prober = MockProberImpl(address)
    mock_prober.initialize()
    print(f"  ✓ Created mock prober at {address}")

    # Step 4: Register in factory
    # Set factory's internal state
    factory._prober = mock_prober
    factory._initialized = True
    factory._current_config = (machineType.lower(), address)
    print("  ✓ Registered in factory")

    # Step 5: Set globals
    g.set_address(address)
    g.set_machine_type(machineType)
    g.set_prober_status("initialized")
    print("  ✓ Set globals (address, machine_type, status)")

    # Step 6: Initialize complete state
    g.user = "test_operator"
    g.asic_serial_number = 12345
    g.wp_machine_id = 1
    g.wpag_state = "WP_Idle"  # Ready to execute commands
    g.set_wafer_loaded(999, "North")
    g.set_probe_card(456, "South")
    g.set_project(789, "MockTestProject")
    g.overdrive = 5
    g.camera_mount_point = "Top"
    g.current_working_area = "TestArea"
    g.chuck_z_position_state = "Separation"
    g.total_dies_number = 144
    print("  ✓ Initialized complete state")

    # Step 7: Reset state machine to Idle
    try:
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        agentStateMachine.reset()
        print("  ✓ Reset state machine to Idle")
    except Exception as e:
        print(f"  ⚠️  Could not reset state machine: {e}")

    # Verify setup
    print("\n📊 Verification:")
    print(f"  Factory initialized: {factory.is_initialized()}")
    print(f"  Globals address: {g.address}")
    print(f"  Globals machine_type: {g.machineType}")
    print(f"  Globals prober_status: {g.prober_status}")
    print(f"  Globals wpag_state: {g.wpag_state}")
    print(f"  Globals is_initialized: {g.is_initialized()}")

    # Test check_prober_ready
    from utilities.WPHelpers import check_prober_ready
    is_ready, message = check_prober_ready()
    print(f"  check_prober_ready(): {is_ready} - {message}")

    if is_ready:
        print("\n✅ Mock prober ready! All commands should work now.\n")
    else:
        print(f"\n⚠️  Mock prober NOT ready: {message}\n")

    return mock_prober


def reset_mock_environment():
    """Reset everything back to clean state"""
    factory = ProberFactory.get_instance()
    g = SvtWPAagentGlobalParameters.getInstance()

    factory.reset()
    g.reset()

    # Remove mock from prober_classes
    if "mock" in prober_classes:
        del prober_classes["mock"]

    # Reset state machine
    try:
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        agentStateMachine.reset()
    except:
        pass

    print("🔄 Mock environment reset")


# Quick test function
def test_mock_setup():
    """Test that mock setup works"""
    print("\n" + "=" * 70)
    print("  TESTING MOCK PROBER SETUP")
    print("=" * 70 + "\n")

    # Setup
    mock = setup_mock_prober()

    # Try a command
    print("\n🧪 Testing a command...")
    from actions.WPTestingActions import go_to_separation

    response = go_to_separation()

    print(f"\nResponse:")
    print(f"  Status: {response.get('status')}")
    print(f"  Type: {response.get('type')}")

    if response.get('status') == 'Success':
        print("\n✅ SUCCESS! Mock prober is working correctly!")
    else:
        print(f"\n❌ FAILED: {response.get('error', {}).get('message', response.get('output'))}")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    # Run test
    test_mock_setup()
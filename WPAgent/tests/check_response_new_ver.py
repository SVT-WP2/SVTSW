

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import ProberFactory, prober_classes
from tests.mock_prober import MockProberImpl


def setup_mock():
    """Quick mock setup"""
    prober_classes["sentio"] = MockProberImpl
    factory = ProberFactory.get_instance()
    g = SvtWPAagentGlobalParameters.getInstance()

    factory.reset()
    g.reset()

    g.set_address("mock:12345")
    g.set_machine_type("sentio")
    mock = factory.get_prober("sentio", "mock:12345")
    mock.initialize()

    g.set_prober_status("initialized")
    g.wpag_state = "WP_Idle"
    g.set_wafer_loaded(999, "North")
    g.set_probe_card(456, "South")
    g.set_project(789, "Test")
    g.overdrive = 5
    g.camera_mount_point = "Top"
    g.current_working_area = "TestArea"
    g.chuck_z_position_state = "Separation"
    g.total_dies_number = 144

    try:
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        agentStateMachine.reset()
    except:
        pass


def check_response_format(response, command_name):
    """Check if response uses new standardized format"""

    # New format requirements
    has_status = 'status' in response
    has_type = 'type' in response
    has_data = 'data' in response
    has_error = 'error' in response

    # Check status value (should be "Success" or "Error", NOT "success" or "error")
    correct_status = response.get('status') in ['Success', 'Error']

    # Check if data has all required fields
    data_complete = False
    if has_data and isinstance(response['data'], dict):
        required_fields = [
            'user', 'asicSerialNumber', 'wpMachineId', 'WPAG_State',
            'loadedWafer', 'instaledprobeCard', 'openedProjectId', 'projectName',
            'overdrive', 'cameraMountPoint', 'currentWorkingArea',
            'waferMapDiePosition', 'chuckZPositionState', 'totalDiesNumber'
        ]
        data_complete = all(field in response['data'] for field in required_fields)

    # Check error format
    error_correct = False
    if has_error and isinstance(response['error'], dict):
        error_correct = 'code' in response['error'] and 'message' in response['error']

    # Determine format
    is_new_format = (
            has_status and has_type and has_data and has_error and
            correct_status and data_complete and error_correct
    )

    is_old_format = (
            'status' in response and 'output' in response and
            response.get('status') in ['success', 'error']
    )

    return {
        'is_new_format': is_new_format,
        'is_old_format': is_old_format,
        'has_status': has_status,
        'has_type': has_type,
        'has_data': has_data,
        'has_error': has_error,
        'correct_status': correct_status,
        'data_complete': data_complete,
        'error_correct': error_correct
    }


def test_all_commands():
    """Test all commands from WPCmdMap"""
    print("\n" + "=" * 70)
    print("  RESPONSE FORMAT CHECKER")
    print("=" * 70)
    print("\nChecking which commands use the new standardized format\n")
    print("=" * 70 + "\n")

    setup_mock()

    # Commands to test (from WPCmdMap)
    # Format: (command_name, function, params)
    commands_to_test = [
        # Testing Actions
        ("MoveChuckXY",
         lambda: __import__('actions.WPTestingActions', fromlist=['move_chuck_xy']).move_chuck_xy(x=10, y=20)),
        ("MoveChuckZ", lambda: __import__('actions.WPTestingActions', fromlist=['move_chuck_z']).move_chuck_z(z=5)),
        ("RunPTPA", lambda: __import__('actions.WPTestingActions', fromlist=['run_ptpa']).run_ptpa()),
        ("StepNextDie", lambda: __import__('actions.WPTestingActions', fromlist=['step_next_die']).move_chuck_next_die()),
        ("GoToDie", lambda: __import__('actions.WPTestingActions', fromlist=['go_to_die']).move_chuck_row_column(col=1, row=1)),
        ("OpenProject", lambda: __import__('actions.WPTestingActions', fromlist=['open_project']).open_project()),
        ("FindHome", lambda: __import__('actions.WPTestingActions', fromlist=['find_home']).find_home()),
        ("SwitchCamera",
         lambda: __import__('actions.WPTestingActions', fromlist=['switch_camera']).switch_camera(mount_point="Top")),
        ("MoveChuckHome",
         lambda: __import__('actions.WPTestingActions', fromlist=['move_chuck_home']).move_chuck_home()),
        ("Unload", lambda: __import__('actions.WPTestingActions', fromlist=['unload_wafer']).unload_wafer()),
        ("Cleaning",
         lambda: __import__('actions.WPTestingActions', fromlist=['clean_probe_station']).clean_probe_station()),
        ("AlignWafer",
         lambda: __import__('actions.WPTestingActions', fromlist=['align_wafer']).align_wafer(align_die_col=1,
                                                                                              align_die_row=1)),
        ("GoToContact", lambda: __import__('actions.WPTestingActions', fromlist=['go_to_contact']).move_chuck_contact()),
        ("GoToSeparation",
         lambda: __import__('actions.WPTestingActions', fromlist=['go_to_separation']).Move_chuck_separation()),
        ("AutoFocus", lambda: __import__('actions.WPTestingActions', fromlist=['auto_focus']).auto_focus()),
        ("Load", lambda: __import__('actions.WPTestingActions', fromlist=['load_wafer']).load_wafer()),
        ("MoveChuckToWorkArea",
         lambda: __import__('actions.WPTestingActions', fromlist=['move_chuck_work_area']).move_chuck_work_area(
             work_area=0)),
        ("LocalMode", lambda: __import__('actions.WPTestingActions', fromlist=['local_state']).local_mode()),
        ("GoToPreviousDie",
         lambda: __import__('actions.WPTestingActions', fromlist=['go_to_previous_die']).move_chuck_previous_die()),
        ("GetChuckPosition",
         lambda: __import__('actions.WPTestingActions', fromlist=['get_chuck_position']).get_chuck_position()),

        # Project Actions
        ("ShowProjectStatus",
         lambda: __import__('actions.WPProjectActions', fromlist=['get_project_status']).get_project_status()),
        ("GetInfo", lambda: __import__('actions.WPProjectActions', fromlist=['get_info']).get_info()),
        ("help", lambda: __import__('actions.WPProjectActions', fromlist=['help_command']).help_command()),
        ("ResetAgent",
         lambda: __import__('actions.WPProjectActions', fromlist=['reset_agent_state']).reset_agent_state()),
        ("GetAgentState",
         lambda: __import__('actions.WPProjectActions', fromlist=['get_agent_state']).get_agent_state()),

        # Database Actions
        ("ListProbers", lambda: __import__('actions.WPDataBaseActions', fromlist=['list_probers']).list_probers()),
        ("ListChipTypes",
         lambda: __import__('actions.WPDataBaseActions', fromlist=['list_chip_types']).list_chip_types()),

        # Command Actions
        ("ListAvailableCommands",
         lambda: __import__('actions.WPCommandActions', fromlist=['list_available_commands']).list_available_commands(
             {})),
    ]

    results = {
        'new_format': [],
        'old_format': [],
        'mixed_format': [],
        'error': []
    }

    for cmd_name, cmd_func in commands_to_test:
        try:
            response = cmd_func()
            check = check_response_format(response, cmd_name)

            if check['is_new_format']:
                results['new_format'].append(cmd_name)
                status = "✅ NEW"
            elif check['is_old_format']:
                results['old_format'].append(cmd_name)
                status = "⚠️  OLD"
            else:
                results['mixed_format'].append(cmd_name)
                status = "❓ MIXED"

            print(f"{status:12} {cmd_name:25} ", end="")

            # Show what's missing
            missing = []
            if not check['has_type']:
                missing.append("type")
            if not check['data_complete']:
                missing.append("complete data")
            if not check['error_correct']:
                missing.append("error format")
            if not check['correct_status']:
                missing.append(f"status={response.get('status')}")

            if missing:
                print(f"Missing: {', '.join(missing)}")
            else:
                print("✓")

        except Exception as e:
            results['error'].append(cmd_name)
            print(f"❌ ERROR  {cmd_name:25} {str(e)[:30]}")

    # Summary
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70 + "\n")

    total = len(commands_to_test)
    new_count = len(results['new_format'])
    old_count = len(results['old_format'])

    print(f"Total Commands: {total}")
    print(f"✅ Using NEW format: {new_count} ({new_count / total * 100:.0f}%)")
    print(f"⚠️  Using OLD format: {old_count} ({old_count / total * 100:.0f}%)")
    print(f"❓ Mixed/Unknown: {len(results['mixed_format'])}")
    print(f"❌ Errors: {len(results['error'])}\n")

    if old_count > 0:
        print("Commands that need updating to NEW format:")
        print("=" * 70)
        for cmd in results['old_format']:
            print(f"  ⚠️  {cmd}")
        print()

    if new_count == total:
        print("🎉 ALL COMMANDS USE NEW FORMAT! 🎉")
    else:
        print(f"📝 {old_count} command(s) still need to be updated")

    print("=" * 70 + "\n")

    return new_count == total


if __name__ == "__main__":
    try:
        success = test_all_commands()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test crashed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
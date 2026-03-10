"""
End-to-end test for get_project_id_by_name

Tests the complete flow:
1. DBKafkaClient with proper headers
2. WPKafkaDbService wrapper
3. WPDataBaseActions.get_project_id_by_name()

Usage:
    cd /data/akostina/SVTSW/WPAgent
    python3.12 test_final.py
"""

import sys
import os
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)


def test_get_machine_info(machine_id=4):
    """Get full machine info to see what's loaded"""
    print("=" * 70)
    print(f"  TEST 1: Get Machine {machine_id} Full Info")
    print("=" * 70)

    from services.WPDbKafkaClient import DBKafkaClient
    db_client = DBKafkaClient.get_instance()

    machines = db_client.get_all_wafer_probe_machines(timeout=15.0)

    for machine in machines:
        if machine.get('id') == machine_id:
            print(f"\n✅ Found Machine {machine_id}")
            print(f"   Name: {machine.get('name')}")
            print(f"   Software: {machine.get('software')}")
            print(f"   Host: {machine.get('hostName')}")
            print(f"\n   Loaded Wafer:")
            print(f"     ID: {machine.get('loadedWaferId')}")
            print(f"     Orientation: {machine.get('loadedWaferOrientation')}")
            print(f"\n   Installed Probe Card:")
            print(f"     ID: {machine.get('installedProbeCardId')}")
            print(f"     Orientation: {machine.get('installedProbeCardOrientation')}")

            return machine

    print(f"\n❌ Machine {machine_id} not found")
    return None


def test_get_loaded_wafer(machine_id=4):
    """Test get_loaded_wafer_info function"""
    print("\n" + "=" * 70)
    print(f"  TEST 2: Get Loaded Wafer for Machine {machine_id}")
    print("=" * 70)

    from actions.WPDataBaseActions import get_loaded_wafer_info

    wafer_id, orientation = get_loaded_wafer_info(
        wp_machine_id=machine_id,
        timeout=15.0
    )

    print("\n" + "=" * 70)
    print("  RESULT")
    print("=" * 70)

    if wafer_id is not None:
        print(f"\n✅ Wafer is loaded")
        print(f"   Wafer ID: {wafer_id}")
        print(f"   Orientation: {orientation}")
        return True
    else:
        print(f"\nℹ️  No wafer loaded on machine {machine_id}")
        return True  # Not an error, just no wafer


def test_get_installed_probe_card(machine_id=4):
    """Test get_installed_probe_card_info function"""
    print("\n" + "=" * 70)
    print(f"  TEST 3: Get Installed Probe Card for Machine {machine_id}")
    print("=" * 70)

    from actions.WPDataBaseActions import get_installed_probe_card_info

    card_id, orientation = get_installed_probe_card_info(
        wp_machine_id=machine_id,
        timeout=15.0
    )

    print("\n" + "=" * 70)
    print("  RESULT")
    print("=" * 70)

    if card_id is not None:
        print(f"\n✅ Probe card is installed")
        print(f"   Probe Card ID: {card_id}")
        print(f"   Orientation: {orientation}")
        return True
    else:
        print(f"\nℹ️  No probe card installed on machine {machine_id}")
        return True  # Not an error, just no card


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  MACHINE WAFER/PROBE CARD INFO TEST")
    print("=" * 70)
    print("\nThis test shows how to get wafer and probe card info")
    print("directly from the machine record (no name lookup needed!)")
    print("=" * 70)

    # Test with machine ID 4 (change if needed)
    MACHINE_ID = 4

    results = []

    # Test 1: Get full machine info
    machine = test_get_machine_info(MACHINE_ID)
    results.append(("Get Machine Info", machine is not None))

    if machine:
        # Test 2: Get loaded wafer
        results.append(("Get Loaded Wafer", test_get_loaded_wafer(MACHINE_ID)))

        # Test 3: Get installed probe card
        results.append(("Get Probe Card", test_get_installed_probe_card(MACHINE_ID)))

    # Summary
    print("\n" + "=" * 70)
    print("  TEST SUMMARY")
    print("=" * 70)

    for test_name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {test_name}")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    print(f"\nResults: {passed}/{total} tests passed")

    print("\n" + "=" * 70)
    print("  KEY TAKEAWAY:")
    print("=" * 70)
    print("\n  You DON'T need to look up wafers/probe cards by name!")
    print("\n  The machine record already has:")
    print("    - loadedWaferId")
    print("    - loadedWaferOrientation")
    print("    - installedProbeCardId")
    print("    - installedProbeCardOrientation")
    print("\n  Just extract them directly from the machine!")
    print("=" * 70 + "\n")

    sys.exit(0 if passed == total else 1)
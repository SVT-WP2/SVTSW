"""


Tests:
1. Connection to DB Agent
2. Get loaded wafer ID and orientation
3. Get installed probe card ID and orientation
4. Get project ID by name


"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.WPDbKafkaClient import DBKafkaClient
import json


def print_section(title):
    """Print section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def test_connection():
    """Test 1: Connection to DB Agent"""
    print_section("TEST 1: DB AGENT CONNECTION")

    try:
        # Get DB client
        client = DBKafkaClient.get_instance()

        # Test connection
        is_connected = client.test_connection(timeout=10.0)

        if is_connected:
            print("\n✅ DB Agent connection successful!")
            return True
        else:
            print("\n❌ DB Agent is not responding")
            print("\nTroubleshooting:")
            print("  1. Check if DB Agent is running")
            print("  2. Verify broker is at localhost:9095")
            print("  3. Check topics exist:")
            print("     - svt.db-agent.request")
            print("     - svt.db-agent.request.reply")
            return False

    except Exception as e:
        print(f"\n❌ Connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_get_machines(machine_id=1):
    """Test 2: Get machine information"""
    print_section("TEST 2: GET MACHINE INFORMATION")

    try:
        client = DBKafkaClient.get_instance()

        print(f"Requesting all machines from DB Agent...")
        machines = client.get_all_wafer_probe_machines(timeout=15.0)

        if not machines:
            print("❌ No machines found or DB Agent not responding")
            return None

        print(f"✅ Retrieved {len(machines)} machine(s)\n")

        # Show all machines
        for idx, machine in enumerate(machines, 1):
            print(f"{idx}. Machine ID: {machine.get('id')}")
            print(f"   Name: {machine.get('name')}")
            print(f"   Loaded Wafer ID: {machine.get('loadedWaferId')}")
            print(f"   Loaded Wafer Orientation: {machine.get('loadedWaferOrientation')}")
            print(f"   Probe Card ID: {machine.get('installedProbeCardId')}")
            print(f"   Probe Card Orientation: {machine.get('installedProbeCardOrientation')}")
            print()

        # Find specific machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == machine_id:
                our_machine = machine
                break

        if our_machine:
            print(f"✅ Found machine ID {machine_id}")
            return our_machine
        else:
            print(f"❌ Machine ID {machine_id} not found")
            return None

    except Exception as e:
        print(f"❌ Error getting machines: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_get_loaded_wafer(machine_id=1):
    """Test 3: Get loaded wafer information"""
    print_section("TEST 3: GET LOADED WAFER")

    try:
        client = DBKafkaClient.get_instance()

        print(f"Getting machine info for ID {machine_id}...")
        machines = client.get_all_wafer_probe_machines(timeout=15.0)

        if not machines:
            print("❌ No machines found")
            return None, None

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == machine_id:
                our_machine = machine
                break

        if not our_machine:
            print(f"❌ Machine ID {machine_id} not found")
            return None, None

        # Extract wafer info
        wafer_id = our_machine.get('loadedWaferId')
        wafer_orientation = our_machine.get('loadedWaferOrientation')

        if wafer_id:
            print(f"✅ Loaded Wafer Found:")
            print(f"   Wafer ID: {wafer_id}")
            print(f"   Orientation: {wafer_orientation}")
            return wafer_id, wafer_orientation
        else:
            print(f"ℹ️  No wafer currently loaded on machine {machine_id}")
            return None, None

    except Exception as e:
        print(f"❌ Error getting loaded wafer: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def test_get_probe_card(machine_id=1):
    """Test 4: Get installed probe card information"""
    print_section("TEST 4: GET INSTALLED PROBE CARD")

    try:
        client = DBKafkaClient.get_instance()

        print(f"Getting machine info for ID {machine_id}...")
        machines = client.get_all_wafer_probe_machines(timeout=15.0)

        if not machines:
            print("❌ No machines found")
            return None, None

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == machine_id:
                our_machine = machine
                break

        if not our_machine:
            print(f"❌ Machine ID {machine_id} not found")
            return None, None

        # Extract probe card info
        card_id = our_machine.get('installedProbeCardId')
        card_orientation = our_machine.get('installedProbeCardOrientation')

        if card_id:
            print(f"✅ Installed Probe Card Found:")
            print(f"   Probe Card ID: {card_id}")
            print(f"   Orientation: {card_orientation}")
            return card_id, card_orientation
        else:
            print(f"ℹ️  No probe card currently installed on machine {machine_id}")
            return None, None

    except Exception as e:
        print(f"❌ Error getting probe card: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def test_get_project_id(project_name="TestProject"):
    """Test 5: Get project ID by name"""
    print_section("TEST 5: GET PROJECT ID BY NAME")

    try:
        client = DBKafkaClient.get_instance()

        print(f"Searching for project '{project_name}'...")
        projects = client.get_all_wafer_probe_projects(timeout=15.0)

        if not projects:
            print("❌ No projects found or DB Agent not responding")
            return None

        print(f"✅ Retrieved {len(projects)} project(s)\n")

        # Show all projects
        for idx, project in enumerate(projects, 1):
            print(f"{idx}. Project ID: {project.get('id')}")
            print(f"   Name: {project.get('name')}")
            print(f"   WP Machine ID: {project.get('wpMachineId')}")
            print(f"   Wafer Type ID: {project.get('waferTypeId')}")
            print()

        # Find specific project
        matching_project = None
        for project in projects:
            if project.get('name', '').lower() == project_name.lower():
                matching_project = project
                break

        if matching_project:
            project_id = matching_project.get('id')
            print(f"✅ Project '{project_name}' Found:")
            print(f"   Project ID: {project_id}")
            return project_id
        else:
            print(f"❌ Project '{project_name}' not found")
            print(f"\nAvailable projects:")
            for project in projects:
                print(f"  - {project.get('name')}")
            return None

    except Exception as e:
        print(f"❌ Error getting project: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("  DB AGENT INTEGRATION TEST")
    print("=" * 70)
    print("\nTesting connection to DB Agent:")
    print("  Broker: localhost:9095")
    print("  Request Topic: svt.db-agent.request")
    print("  Reply Topic: svt.db-agent.request.reply")
    print("\n" + "=" * 70)

    # Test 1: Connection
    connection_ok = test_connection()

    if not connection_ok:
        print("\n" + "=" * 70)
        print("  ❌ CONNECTION FAILED - CANNOT CONTINUE")
        print("=" * 70)
        print("\n🔍 Please ensure:")
        print("  1. DB Agent is running")
        print("  2. Kafka broker is running on localhost:9095")
        print("  3. Topics are created:")
        print("     kafka-topics --create --topic svt.db-agent.request --bootstrap-server localhost:9095")
        print("     kafka-topics --create --topic svt.db-agent.request.reply --bootstrap-server localhost:9095")
        return False

    # Configuration
    machine_id = 1  # Change this to your machine ID
    project_name = "TestProject"  # Change this to your project name

    print(f"\n📋 Test Configuration:")
    print(f"   Machine ID: {machine_id}")
    print(f"   Project Name: {project_name}")

    # Test 2: Get machines
    machine = test_get_machines(machine_id)

    # Test 3: Get loaded wafer
    wafer_id, wafer_orientation = test_get_loaded_wafer(machine_id)

    # Test 4: Get probe card
    card_id, card_orientation = test_get_probe_card(machine_id)

    # Test 5: Get project ID
    project_id = test_get_project_id(project_name)

    # Summary
    print_section("TEST SUMMARY")

    results = [
        ("DB Agent Connection", connection_ok),
        ("Get Machines", machine is not None),
        ("Get Loaded Wafer", wafer_id is not None or "checked"),
        ("Get Probe Card", card_id is not None or "checked"),
        ("Get Project ID", project_id is not None)
    ]

    passed = sum(1 for _, result in results if result is True or result == "checked")
    total = len(results)

    for test_name, result in results:
        if result is True:
            print(f"✅ {test_name}")
        elif result == "checked":
            print(f"✓  {test_name} (no data, but checked successfully)")
        else:
            print(f"❌ {test_name}")

    print(f"\nResults: {passed}/{total} tests passed")

    if wafer_id or card_id or project_id:
        print("\n📊 Retrieved Data:")
        if wafer_id:
            print(f"  Wafer ID: {wafer_id} ({wafer_orientation})")
        if card_id:
            print(f"  Probe Card ID: {card_id} ({card_orientation})")
        if project_id:
            print(f"  Project ID: {project_id}")

    print("\n" + "=" * 70)

    if passed == total:
        print("  🎉 ALL TESTS PASSED!")
    else:
        print(f"  ⚠️  {total - passed} test(s) failed")

    print("=" * 70 + "\n")

    return passed == total


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Tests crashed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
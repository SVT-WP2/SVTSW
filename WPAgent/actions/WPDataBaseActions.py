"""
Database-related actions for WPAgent
Fixed to use module-level singleton and avoid circular imports
"""
from services.kafka_db_service import KafkaDBService

# ⚠️ Create singleton instance at module level
# This ensures only ONE instance is used across all function calls
_db_service = None


def _get_db_service():
    """
    Get or create singleton DB service

    Returns:
        KafkaDBService: Singleton instance
    """
    global _db_service
    if _db_service is None:
        print("🔄 Initializing DB service...")
        _db_service = KafkaDBService()
    return _db_service


def list_probers(timeout: float = 10.0):
    """
    Get and display all wafer probe machines from the database

    Args:
        timeout: Request timeout in seconds

    Returns:
        dict: Status result with list of probers
    """
    try:
        db_service = _get_db_service()

        print("📡 Requesting wafer probe machines from database...")

        # Get all wafer probe machines
        machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return {
                "status": "error",
                "output": "No wafer probe machines found or database agent not responding"
            }

        # Format the output
        output_lines = [f"Found {len(machines)} wafer probe machine(s):\n"]

        for idx, machine in enumerate(machines, 1):
            output_lines.append(f"\n{idx}. Machine Details:")
            output_lines.append(f"   ID: {machine.get('id', 'N/A')}")
            output_lines.append(f"   Name: {machine.get('name', 'N/A')}")
            output_lines.append(f"   Type: {machine.get('type', 'N/A')}")
            output_lines.append(f"   Address: {machine.get('address', 'N/A')}")
            output_lines.append(f"   Status: {machine.get('status', 'N/A')}")
            output_lines.append(f"   Location: {machine.get('location', 'N/A')}")

        output = "\n".join(output_lines)
        print(output)

        return {
            "status": "success",
            "output": output,
            "data": {
                "machines": machines,
                "count": len(machines)
            }
        }

    except Exception as e:
        error_msg = f"Failed to retrieve wafer probe machines: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }


def list_chip_types(timeout: float = 10.0):
    """
    Get and display all available chip types from the database

    Args:
        timeout: Request timeout in seconds

    Returns:
        dict: Status result with list of chip types
    """
    try:
        db_service = _get_db_service()

        print("📡 Requesting chip types from database...")

        chip_types = db_service.get_chip_types(timeout=timeout)

        if not chip_types:
            return {
                "status": "error",
                "output": "No chip types found or database agent not responding"
            }

        output = f"Available chip types ({len(chip_types)}):\n" + "\n".join(
            f"  - {ct}" for ct in chip_types
        )
        print(output)

        return {
            "status": "success",
            "output": output,
            "data": {"chip_types": chip_types}
        }

    except Exception as e:
        error_msg = f"Failed to retrieve chip types: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }


def list_orientations(timeout: float = 10.0):
    """
    Get and display all available wafer orientations from the database

    Args:
        timeout: Request timeout in seconds

    Returns:
        dict: Status result with list of orientations
    """
    try:
        db_service = _get_db_service()

        print("📡 Requesting wafer orientations from database...")

        orientations = db_service.get_orientations(timeout=timeout)

        if not orientations:
            return {
                "status": "error",
                "output": "No orientations found or database agent not responding"
            }

        output = f"Available wafer orientations ({len(orientations)}):\n" + "\n".join(
            f"  - {o}" for o in orientations
        )
        print(output)

        return {
            "status": "success",
            "output": output,
            "data": {"orientations": orientations}
        }

    except Exception as e:
        error_msg = f"Failed to retrieve orientations: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }


def test_db_connection(timeout: float = 5.0):
    """
    Test if database agent is reachable

    Args:
        timeout: Test timeout in seconds

    Returns:
        dict: Status result with connection test results
    """
    try:
        db_service = _get_db_service()

        print("🔍 Testing database agent connection...")

        is_connected = db_service.test_connection(timeout=timeout)

        if is_connected:
            return {
                "status": "success",
                "output": "Database agent is reachable and responding"
            }
        else:
            return {
                "status": "error",
                "output": "Database agent is not responding. Check if it's running on localhost:9095"
            }

    except Exception as e:
        error_msg = f"Failed to test database connection: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }
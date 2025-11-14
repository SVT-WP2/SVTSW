
from services.kafka_db_service import KafkaDBService

# Module-level singleton
_db_service = None


def _get_db_service():
    """Get or create singleton DB service"""
    global _db_service
    if _db_service is None:
        _db_service = KafkaDBService.get_instance()
    return _db_service


def list_probers(timeout: float = 15.0):
    """
    Get and display all wafer probe machines from the database

    Args:
        timeout: Request timeout in seconds (default: 15s)

    Returns:
        dict: Status result with list of probers
    """
    try:
        db_service = _get_db_service()

        print("\n" + "="*60)
        print("  REQUESTING WAFER PROBE MACHINES")
        print("="*60)

        machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return {
                "status": "error",
                "output": "No wafer probe machines found or database agent not responding"
            }

        # Format output
        output_lines = [f"\nFound {len(machines)} wafer probe machine(s):\n"]

        for idx, machine in enumerate(machines, 1):
            output_lines.append(f"\n{idx}. {machine.get('name', 'N/A')}")
            output_lines.append(f"   ID: {machine.get('id', 'N/A')}")
            output_lines.append(f"   Type: {machine.get('type', 'N/A')}")
            output_lines.append(f"   Address: {machine.get('address', 'N/A')}")
            output_lines.append(f"   Status: {machine.get('status', 'N/A')}")
            output_lines.append(f"   Location: {machine.get('location', 'N/A')}")

        output = "\n".join(output_lines)
        print(output)
        print("\n" + "="*60 + "\n")

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
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }


def list_chip_types(timeout: float = 15.0):
    """
    Get and display all available chip types from the database

    Args:
        timeout: Request timeout in seconds (default: 15s)

    Returns:
        dict: Status result with list of chip types
    """
    try:
        db_service = _get_db_service()

        print("\n" + "="*60)
        print("  REQUESTING CHIP TYPES")
        print("="*60)

        chip_types = db_service.get_chip_types(timeout=timeout)

        if not chip_types:
            return {
                "status": "error",
                "output": "No chip types found or database agent not responding"
            }

        output = f"\nAvailable chip types ({len(chip_types)}):\n"
        for ct in chip_types:
            output += f"  • {ct}\n"

        print(output)
        print("="*60 + "\n")

        return {
            "status": "success",
            "output": output,
            "data": {"chip_types": chip_types}
        }

    except Exception as e:
        error_msg = f"Failed to retrieve chip types: {str(e)}"
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }


def list_orientations(timeout: float = 15.0):
    """
    Get and display all available wafer orientations from the database

    Args:
        timeout: Request timeout in seconds (default: 15s)

    Returns:
        dict: Status result with list of orientations
    """
    try:
        db_service = _get_db_service()

        print("\n" + "="*60)
        print("  REQUESTING WAFER ORIENTATIONS")
        print("="*60)

        orientations = db_service.get_orientations(timeout=timeout)

        if not orientations:
            return {
                "status": "error",
                "output": "No orientations found or database agent not responding"
            }

        output = f"\nAvailable wafer orientations ({len(orientations)}):\n"
        for o in orientations:
            output += f"  • {o}\n"

        print(output)
        print("="*60 + "\n")

        return {
            "status": "success",
            "output": output,
            "data": {"orientations": orientations}
        }

    except Exception as e:
        error_msg = f"Failed to retrieve orientations: {str(e)}"
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": error_msg
        }
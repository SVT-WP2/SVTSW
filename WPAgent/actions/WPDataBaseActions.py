"""
WP Agent Database Actions
Handles communication with SVT DB Agent via Kafka using DBKafkaClient.

"""

from utilities.WPResponseBuilder import ResponseBuilder
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from services.WPDbKafkaClient import DBKafkaClient

# Module-level singleton
_db_client = None


def _get_db_client():
    """Get or create singleton DB client"""
    global _db_client
    if _db_client is None:
        _db_client = DBKafkaClient.get_instance()
    return _db_client


def get_machine_by_location(location_name: str, timeout: float = 5.0):
    """
    Get prober machine configuration by location name

    Args:
        location_name: Location name (e.g., "CERN", "MIT")
        timeout: Query timeout in seconds

    Returns:
        Machine config dict or None if not found
    """
    try:
        db_client = _get_db_client()

        # Get all machines
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return None

        # Find machine by location
        for machine in machines:
            # Check if 'location' field matches
            if machine.get('generalLocation') == location_name:
                return machine

        return None

    except Exception as e:
        print(f"Error getting machine by location: {e}")
        return None

def list_probers(timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get all wafer probe machines from database.

    Returns standardized response with ResponseBuilder.
    """
    try:
        db_client = _get_db_client()

        print("\n📋 Requesting wafer probe machines from DB...")
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return ResponseBuilder.error(
                "ListProbersReply",
                "No wafer probe machines found or database agent not responding",
                404
            )

        # Build response
        response = ResponseBuilder.success(
            "ListProbersReply",
            f"Found {len(machines)} prober(s)"
        )

        # Add probers list to data
        response["data"]["probers"] = machines
        response["data"]["count"] = len(machines)

        print(f"✓ Retrieved {len(machines)} prober(s)")

        return response

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return ResponseBuilder.error(
            "ListProbersReply",
            f"Failed to retrieve probers: {str(e)}",
            500
        )


def list_chip_types(timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get all ASIC family types from database.

    Note: You'll need to add get_chip_types() to DBKafkaClient
    """
    try:
        # For now, return placeholder
        # You'll need to add this method to DBKafkaClient
        return ResponseBuilder.success(
            "ListChipTypesReply",
            "Chip types retrieval not yet implemented"
        )

    except Exception as e:
        return ResponseBuilder.error(
            "ListChipTypesReply",
            f"Failed to retrieve chip types: {str(e)}",
            500
        )


def list_orientations(timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get all wafer orientations from database.

    Note: You'll need to add get_orientations() to DBKafkaClient
    """
    try:
        # For now, return placeholder
        # You'll need to add this method to DBKafkaClient
        return ResponseBuilder.success(
            "ListOrientationsReply",
            "Orientations retrieval not yet implemented"
        )

    except Exception as e:
        return ResponseBuilder.error(
            "ListOrientationsReply",
            f"Failed to retrieve orientations: {str(e)}",
            500
        )


def get_project_id_by_name(project_name, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get project ID by project name.

    Args:
        project_name: Name of the project
    """
    try:
        db_client = _get_db_client()

        # Get all projects
        projects = db_client.get_all_wafer_probe_projects(timeout=timeout)

        if not projects:
            print("No projects found or database agent not responding")

        # Find project by name (case-insensitive)
        matching_project = None
        for project in projects:
            if project.get('name', '').lower() == project_name.lower():
                matching_project = project
                break

        if not matching_project:
            print('No project')
            return None

        project_id = matching_project.get('id')

        return project_id

    except Exception as e:
        print(f"✗ Error: {str(e)}")


def get_loaded_wafer_from_db(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get currently loaded wafer information from database.

    Queries the WaferProbeMachine record to see what wafer is currently loaded.

    Args:
        wp_machine_id: WP Machine ID (optional, uses global if not provided)
        timeout: Request timeout in seconds

    Returns:
        Standardized response with loaded wafer info
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        # Use global if not provided
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            return ResponseBuilder.error(
                "GetLoadedWaferReply",
                "WP Machine ID not set. Initialize machine first.",
                400
            )

        db_client = _get_db_client()

        print(f"\n🔍 Getting loaded wafer for machine ID {wp_machine_id}...")

        # Get machine info (includes loaded wafer)
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return ResponseBuilder.error(
                "GetLoadedWaferReply",
                "Database agent not responding",
                500
            )

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == wp_machine_id:
                our_machine = machine
                break

        if not our_machine:
            return ResponseBuilder.error(
                "GetLoadedWaferReply",
                f"Machine ID {wp_machine_id} not found in database",
                404
            )

        # Get loaded wafer info
        loaded_wafer_id = our_machine.get('loadedWaferId')
        wafer_orientation = our_machine.get('loadedWaferOrientation')

        if not loaded_wafer_id:
            # No wafer loaded
            response = ResponseBuilder.success(
                "GetLoadedWaferReply",
                "No wafer currently loaded"
            )
            response["data"]["hasWafer"] = False
            response["data"]["waferId"] = None
            response["data"]["orientation"] = None

            print("ℹ️  No wafer loaded on this machine")

            # Clear local globals
            g.clear_wafer()

            return response

        # Wafer is loaded
        response = ResponseBuilder.success(
            "GetLoadedWaferReply",
            f"Wafer {loaded_wafer_id} loaded with orientation {wafer_orientation}"
        )

        response["data"]["hasWafer"] = True
        response["data"]["waferId"] = loaded_wafer_id
        response["data"]["orientation"] = wafer_orientation

        print(f"✓ Wafer {loaded_wafer_id} loaded ({wafer_orientation})")

        # Update local globals to match DB
        g.set_wafer_loaded(loaded_wafer_id, wafer_orientation or "Unknown")

        return response

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return ResponseBuilder.error(
            "GetLoadedWaferReply",
            f"Failed to get loaded wafer: {str(e)}",
            500
        )


def get_installed_probe_card_from_db(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get currently installed probe card information from database.

    Queries the WaferProbeMachine record to see what probe card is installed.

    Args:
        wp_machine_id: WP Machine ID (optional, uses global if not provided)
        timeout: Request timeout in seconds

    Returns:
        Standardized response with probe card info
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        # Use global if not provided
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            return ResponseBuilder.error(
                "GetInstalledProbeCardReply",
                "WP Machine ID not set. Initialize machine first.",
                400
            )

        db_client = _get_db_client()

        print(f"\n🔍 Getting installed probe card for machine ID {wp_machine_id}...")

        # Get machine info (includes probe card)
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return ResponseBuilder.error(
                "GetInstalledProbeCardReply",
                "Database agent not responding",
                500
            )

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == wp_machine_id:
                our_machine = machine
                break

        if not our_machine:
            return ResponseBuilder.error(
                "GetInstalledProbeCardReply",
                f"Machine ID {wp_machine_id} not found in database",
                404
            )

        # Get probe card info
        probe_card_id = our_machine.get('installedProbeCardId')
        probe_card_orientation = our_machine.get('installedProbeCardOrientation')

        if not probe_card_id:
            # No probe card installed
            response = ResponseBuilder.success(
                "GetInstalledProbeCardReply",
                "No probe card currently installed"
            )
            response["data"]["hasProbeCard"] = False
            response["data"]["probeCardId"] = None
            response["data"]["orientation"] = None

            print("ℹ️  No probe card installed on this machine")

            # Clear local globals
            g.clear_probe_card()

            return response

        # Probe card is installed
        response = ResponseBuilder.success(
            "GetInstalledProbeCardReply",
            f"Probe card {probe_card_id} installed with orientation {probe_card_orientation}"
        )

        response["data"]["hasProbeCard"] = True
        response["data"]["probeCardId"] = probe_card_id
        response["data"]["orientation"] = probe_card_orientation

        print(f"✓ Probe card {probe_card_id} installed ({probe_card_orientation})")

        # Update local globals to match DB
        g.set_probe_card(probe_card_id, probe_card_orientation or "Unknown")
        g.probe_card_id= probe_card_id
        g.probe_card_orientation = "West"

        return response

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return ResponseBuilder.error(
            "GetInstalledProbeCardReply",
            f"Failed to get probe card: {str(e)}",
            500
        )


def update_wp_machine_loaded_wafer(wp_machine_id=None, loaded_wafer_id=None, orientation=None, timeout: float = 15.0,
                                   user=None, waferAgentName=None):
    """
    Update loaded wafer in database.

    Updates the WaferProbeMachine record in DB with current loaded wafer.
    Also updates local globals.

    Args:
        wp_machine_id: WP Machine ID (optional, uses global if not provided)
        loaded_wafer_id: Wafer ID to load (None to unload)
        orientation: Wafer orientation
        timeout: Request timeout in seconds

    Returns:
        Standardized response
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        # Use global values if not provided
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            return ResponseBuilder.error(
                "UpdateWpMachineLoadedWaferReply",
                "WP Machine ID not set. Initialize machine first.",
                400
            )

        db_client = _get_db_client()

        # Update via DB client
        result = db_client.update_machine_loaded_wafer(
            wp_machine_id=wp_machine_id,
            wafer_id=loaded_wafer_id,
            orientation=orientation,
            timeout=timeout
        )

        if not result:
            return ResponseBuilder.error(
                "UpdateWpMachineLoadedWaferReply",
                "Failed to update database",
                500
            )

        # Update local globals
        if loaded_wafer_id is not None:
            g.set_wafer_loaded(loaded_wafer_id, orientation or "Unknown")
        else:
            g.clear_wafer()

        # Success
        return ResponseBuilder.success(
            "UpdateWpMachineLoadedWaferReply",
            f"Wafer {'loaded' if loaded_wafer_id else 'unloaded'} successfully"
        )

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return ResponseBuilder.error(
            "UpdateWpMachineLoadedWaferReply",
            f"Error updating loaded wafer: {str(e)}",
            500
        )


def update_wp_machine_installed_probe_card(wp_machine_id=None, installed_probe_card_id=None, orientation=None,
                                           timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Update installed probe card in database.

    Updates the WaferProbeMachine record in DB with current probe card.
    Also updates local globals.

    Args:
        wp_machine_id: WP Machine ID (optional, uses global if not provided)
        installed_probe_card_id: Probe Card ID to install (None to remove)
        orientation: Probe card orientation
        timeout: Request timeout in seconds

    Returns:
        Standardized response
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        # Use global values if not provided
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            return ResponseBuilder.error(
                "UpdateWpMachineInstalledProbeCardReply",
                "WP Machine ID not set. Initialize machine first.",
                400
            )

        db_client = _get_db_client()

        print(f"\n💾 Updating installed probe card in DB...")
        print(f"   Machine ID: {wp_machine_id}")
        print(f"   Probe Card ID: {installed_probe_card_id}")
        print(f"   Orientation: {orientation}")

        # Update via DB client
        result = db_client.update_machine_installed_probe_card(
            wp_machine_id=wp_machine_id,
            probe_card_id=installed_probe_card_id,
            orientation=orientation,
            timeout=timeout
        )

        if not result:
            return ResponseBuilder.error(
                "UpdateWpMachineInstalledProbeCardReply",
                "Failed to update database",
                500
            )

        # Update local globals
        if installed_probe_card_id is not None:
            g.set_probe_card(installed_probe_card_id, orientation or "Unknown")
            print(f"✓ Probe card {installed_probe_card_id} installed ({orientation})")
        else:
            g.clear_probe_card()
            print("✓ Probe card removed")

        # Success
        return ResponseBuilder.success(
            "UpdateWpMachineInstalledProbeCardReply",
            f"Probe card {'installed' if installed_probe_card_id else 'removed'} successfully"
        )

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return ResponseBuilder.error(
            "UpdateWpMachineInstalledProbeCardReply",
            f"Error updating probe card: {str(e)}",
            500
        )


def get_loaded_wafer_info(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get loaded wafer ID and orientation from machine record

    Args:
        wp_machine_id: Machine ID (uses global if not provided)
        timeout: Request timeout

    Returns:
        Tuple of (wafer_id, orientation) or (None, None) if no wafer loaded
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            print("⚠️  WP Machine ID not set")
            return (None, None)

        from services.WPDbKafkaClient import DBKafkaClient
        db_client = DBKafkaClient.get_instance()

        print(f"\n🔍 Getting loaded wafer for machine {wp_machine_id}...")

        # Get all machines
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == wp_machine_id:
                our_machine = machine
                break

        if not our_machine:
            print(f"❌ Machine {wp_machine_id} not found")
            return (None, None)

        # Extract wafer info directly from machine record
        wafer_id = our_machine.get('loadedWaferId')
        orientation = our_machine.get('loadedWaferOrientation')

        if wafer_id:
            print(f"✓ Wafer loaded: ID={wafer_id}, orientation={orientation}")
            return (wafer_id, orientation)
        else:
            print("ℹ️  No wafer loaded")
            return (None, None)

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return (None, None)


def get_installed_probe_card_info(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get installed probe card ID and orientation from machine record

    Args:
        wp_machine_id: Machine ID (uses global if not provided)
        timeout: Request timeout

    Returns:
        Tuple of (probe_card_id, orientation) or (None, None) if no card installed
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        if wp_machine_id is None:
            wp_machine_id = g.wp_machine_id

        if wp_machine_id == 0:
            print("⚠️  WP Machine ID not set")
            return (None, None)

        from services.WPDbKafkaClient import DBKafkaClient
        db_client = DBKafkaClient.get_instance()

        print(f"\n🔍 Getting installed probe card for machine {wp_machine_id}...")

        # Get all machines
        machines = db_client.get_all_wafer_probe_machines(timeout=timeout)

        # Find our machine
        our_machine = None
        for machine in machines:
            if machine.get('id') == wp_machine_id:
                our_machine = machine
                break

        if not our_machine:
            print(f"❌ Machine {wp_machine_id} not found")
            return (None, None)

        # Extract probe card info directly from machine record
        probe_card_id = our_machine.get('installedProbeCardId')
        orientation = our_machine.get('installedProbeCardOrientation')

        if probe_card_id:
            print(f"✓ Probe card installed: ID={probe_card_id}, orientation={orientation}")
            return (probe_card_id, orientation)
        else:
            print("ℹ️  No probe card installed")
            return (None, None)

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return (None, None)

"""
WP Agent Database Actions
Handles communication with SVT DB Agent via Kafka using DBKafkaClient.
"""

from utilities.WPResponseBuilder import ResponseBuilder
from typing import cast
from utilities.WPAgentTypes import LoadedWaferData, InstalledProbeCardData, ListProbersData
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from services.WPDbKafkaClient import DBKafkaClient


def _get_db_client() -> DBKafkaClient:
    """Always delegate to the singleton — avoids stale references after broker reset."""
    return DBKafkaClient.get_instance()


def _find_machine_by_id(wp_machine_id, timeout: float = 15.0):
    """Shared helper — fetch all machines and return the one matching wp_machine_id, or None."""
    machines = _get_db_client().get_all_wafer_probe_machines(timeout=timeout)
    return next((m for m in (machines or []) if m.get("id") == wp_machine_id), None)


# =============================================================================
# Machine lookup
# =============================================================================

def get_machine_by_location(location_name: str, kafka_broker=None, timeout: float = 5.0):
    """
    Get prober machine configuration by location name.
    kafka_broker is accepted but unused — broker is set at DBKafkaClient init time.
    """
    try:
        machines = _get_db_client().get_all_wafer_probe_machines(timeout=timeout)
        if not machines:
            return None
        return next((m for m in machines if m.get("generalLocation") == location_name), None)
    except Exception as e:
        print(f"Error getting machine by location: {e}")
        return None


# =============================================================================
# Prober listing
# =============================================================================

def list_probers(timeout: float = 15.0, user=None, waferAgentName=None):
    """Get all wafer probe machines from database."""
    try:
        print("\n📋 Requesting wafer probe machines from DB...")
        machines = _get_db_client().get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return ResponseBuilder.error(
                "ListProbersReply",
                "No wafer probe machines found or database agent not responding",
                404,
            )

        response = ResponseBuilder.success("ListProbersReply", f"Found {len(machines)} prober(s)")
        data = cast(ListProbersData, response["data"])
        data["probers"] = machines
        data["count"] = len(machines)
        print(f"✓ Retrieved {len(machines)} prober(s)")
        return response

    except Exception as e:
        return ResponseBuilder.error("ListProbersReply", f"Failed to retrieve probers: {str(e)}", 500)


def list_chip_types(timeout: float = 15.0, user=None, waferAgentName=None):
    """Get all ASIC family types from database. (Not yet implemented)"""
    return ResponseBuilder.success("ListChipTypesReply", "Chip types retrieval not yet implemented")


def list_orientations(timeout: float = 15.0, user=None, waferAgentName=None):
    """Get all wafer orientations from database. (Not yet implemented)"""
    return ResponseBuilder.success("ListOrientationsReply", "Orientations retrieval not yet implemented")


# =============================================================================
# Project lookup
# =============================================================================

def get_project_id_by_name(project_name: str, timeout: float = 15.0, user=None, waferAgentName=None):
    """Get project ID by project name. Returns ID int or None if not found."""
    try:
        projects = _get_db_client().get_all_wafer_probe_projects(timeout=timeout)
        if not projects:
            print("No projects found or database agent not responding")
            return None

        match = next((p for p in projects if p.get("name", "").lower() == project_name.lower()), None)
        if not match:
            print(f"No project found with name '{project_name}'")
            return None

        return match.get("id")

    except Exception as e:
        print(f"✗ Error getting project ID: {str(e)}")
        return None


# =============================================================================
# Wafer — read
# =============================================================================

def get_loaded_wafer_info(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get loaded wafer ID and orientation from machine record.
    Returns (wafer_id, orientation) or (None, None).
    """
    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        if wp_machine_id is None:
            wp_machine_id = g.wpMachineId
        if not wp_machine_id or wp_machine_id == 0:
            print("⚠️  WP Machine ID not set")
            return None, None

        machine = _find_machine_by_id(wp_machine_id, timeout)
        if not machine:
            print(f"❌ Machine {wp_machine_id} not found")
            return None, None

        wafer_id = machine.get("loadedWaferId")
        orientation = machine.get("loadedWaferOrientation")

        if wafer_id:
            print(f"✓ Wafer loaded: ID={wafer_id}, orientation={orientation}")
            return wafer_id, orientation
        print("ℹ️  No wafer loaded")
        return None, None

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return None, None


def get_loaded_wafer_from_db(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get loaded wafer as a standardized ResponseBuilder response.
    Also syncs result into global parameters.
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    if wp_machine_id is None:
        wp_machine_id = g.wpMachineId
    if not wp_machine_id or wp_machine_id == 0:
        return ResponseBuilder.error("GetLoadedWaferReply", "WP Machine ID not set. Initialize machine first.", 400)

    try:
        machine = _find_machine_by_id(wp_machine_id, timeout)
        if machine is None:
            return ResponseBuilder.error("GetLoadedWaferReply", "Database agent not responding", 500) \
                if _get_db_client().get_all_wafer_probe_machines(timeout=timeout) is not None \
                else ResponseBuilder.error("GetLoadedWaferReply", f"Machine ID {wp_machine_id} not found in database", 404)

        wafer_id = machine.get("loadedWaferId")
        orientation = machine.get("loadedWaferOrientation")

        if not wafer_id:
            g.clear_wafer()
            response = ResponseBuilder.success("GetLoadedWaferReply", "No wafer currently loaded")
            data = cast(LoadedWaferData, response["data"])
            data["hasWafer"] = False
            data["waferId"] = None
            data["orientation"] = None
            return response

        g.set_wafer_loaded(wafer_id, orientation or "Unknown")
        response = ResponseBuilder.success("GetLoadedWaferReply", f"Wafer {wafer_id} loaded with orientation {orientation}")
        data = cast(LoadedWaferData, response["data"])
        data["hasWafer"] = True
        data["waferId"] = wafer_id
        data["orientation"] = orientation
        return response

    except Exception as e:
        return ResponseBuilder.error("GetLoadedWaferReply", f"Failed to get loaded wafer: {str(e)}", 500)


# =============================================================================
# Probe card — read
# =============================================================================

def get_installed_probe_card_info(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get installed probe card ID and orientation from machine record.
    Returns (probe_card_id, orientation) or (None, None).
    """
    g = SvtWPAagentGlobalParameters.getInstance()
    try:
        if wp_machine_id is None:
            wp_machine_id = g.wpMachineId
        if not wp_machine_id or wp_machine_id == 0:
            print("⚠️  WP Machine ID not set")
            return None, None

        machine = _find_machine_by_id(wp_machine_id, timeout)
        if not machine:
            print(f"❌ Machine {wp_machine_id} not found")
            return None, None

        card_id = machine.get("installedProbeCardId")
        orientation = machine.get("installedProbeCardOrientation")

        if card_id:
            print(f"✓ Probe card installed: ID={card_id}, orientation={orientation}")
            return card_id, orientation
        print("ℹ️  No probe card installed")
        return None, None

    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return None, None


def get_installed_probe_card_from_db(wp_machine_id=None, timeout: float = 15.0, user=None, waferAgentName=None):
    """
    Get installed probe card as a standardized ResponseBuilder response.
    Also syncs result into global parameters.
    """
    g = SvtWPAagentGlobalParameters.getInstance()

    if wp_machine_id is None:
        wp_machine_id = g.wpMachineId
    if not wp_machine_id or wp_machine_id == 0:
        return ResponseBuilder.error("GetInstalledProbeCardReply", "WP Machine ID not set. Initialize machine first.", 400)

    try:
        machine = _find_machine_by_id(wp_machine_id, timeout)
        if machine is None:
            return ResponseBuilder.error("GetInstalledProbeCardReply", f"Machine ID {wp_machine_id} not found in database", 404)

        card_id = machine.get("installedProbeCardId")
        card_orientation = machine.get("installedProbeCardOrientation")

        if not card_id:
            g.clear_probe_card()
            response = ResponseBuilder.success("GetInstalledProbeCardReply", "No probe card currently installed")
            data = cast(InstalledProbeCardData, response["data"])
            data["hasProbeCard"] = False
            data["probeCardId"] = None
            data["orientation"] = None
            return response

        g.set_probe_card(card_id, card_orientation or "Unknown")
        g.probe_card_orientation = "West"  # TODO: remove when DB provides real orientation

        response = ResponseBuilder.success(
            "GetInstalledProbeCardReply",
            f"Probe card {card_id} installed with orientation {card_orientation}",
        )
        data = cast(InstalledProbeCardData, response["data"])
        data["hasProbeCard"] = True
        data["probeCardId"] = card_id
        data["orientation"] = card_orientation
        return response

    except Exception as e:
        return ResponseBuilder.error("GetInstalledProbeCardReply", f"Failed to get probe card: {str(e)}", 500)


# =============================================================================
# Wafer — write
# =============================================================================

def update_wp_machine_loaded_wafer(
    wp_machine_id=None, loaded_wafer_id=None, orientation=None,
    timeout: float = 15.0, user=None, waferAgentName=None,
):
    """Update loaded wafer in database and sync globals."""
    g = SvtWPAagentGlobalParameters.getInstance()

    if wp_machine_id is None:
        wp_machine_id = g.wpMachineId
    if not wp_machine_id or wp_machine_id == 0:
        return ResponseBuilder.error("UpdateWpMachineLoadedWaferReply", "WP Machine ID not set. Initialize machine first.", 400)

    try:
        result = _get_db_client().update_machine_loaded_wafer(
            wp_machine_id=wp_machine_id, wafer_id=loaded_wafer_id,
            orientation=orientation, timeout=timeout,
        )
        if not result:
            return ResponseBuilder.error("UpdateWpMachineLoadedWaferReply", "Failed to update database", 500)

        if loaded_wafer_id is not None:
            g.set_wafer_loaded(loaded_wafer_id, orientation or "Unknown")
        else:
            g.clear_wafer()

        return ResponseBuilder.success(
            "UpdateWpMachineLoadedWaferReply",
            f"Wafer {'loaded' if loaded_wafer_id else 'unloaded'} successfully",
        )

    except Exception as e:
        return ResponseBuilder.error("UpdateWpMachineLoadedWaferReply", f"Error updating loaded wafer: {str(e)}", 500)


# =============================================================================
# Probe card — write
# =============================================================================

def update_wp_machine_installed_probe_card(
    wp_machine_id=None, installed_probe_card_id=None, orientation=None,
    timeout: float = 15.0, user=None, waferAgentName=None,
):
    """Update installed probe card in database and sync globals."""
    g = SvtWPAagentGlobalParameters.getInstance()

    if wp_machine_id is None:
        wp_machine_id = g.wpMachineId
    if not wp_machine_id or wp_machine_id == 0:
        return ResponseBuilder.error("UpdateWpMachineInstalledProbeCardReply", "WP Machine ID not set. Initialize machine first.", 400)

    try:
        print(f"\n💾 Updating probe card — Machine: {wp_machine_id}, Card: {installed_probe_card_id}, Orientation: {orientation}")

        result = _get_db_client().update_machine_installed_probe_card(
            wp_machine_id=wp_machine_id, probe_card_id=installed_probe_card_id,
            orientation=orientation, timeout=timeout,
        )
        if not result:
            return ResponseBuilder.error("UpdateWpMachineInstalledProbeCardReply", "Failed to update database", 500)

        if installed_probe_card_id is not None:
            g.set_probe_card(installed_probe_card_id, orientation or "Unknown")
            print(f"✓ Probe card {installed_probe_card_id} installed ({orientation})")
        else:
            g.clear_probe_card()
            print("✓ Probe card removed")

        return ResponseBuilder.success(
            "UpdateWpMachineInstalledProbeCardReply",
            f"Probe card {'installed' if installed_probe_card_id else 'removed'} successfully",
        )

    except Exception as e:
        return ResponseBuilder.error("UpdateWpMachineInstalledProbeCardReply", f"Error updating probe card: {str(e)}", 500)


# =============================================================================
# ASIC lookup
# =============================================================================

def get_asic_by_id(asic_id: int) -> dict:
    """
    Get ASIC from database by ID.
    Returns dict with ASIC info.
    Raises Exception if not found.
    """
    response = _get_db_client().get_all_asic_by_id(asic_id)
    items = (response.get("data") or {}).get("items", [])

    if not items:
        raise Exception(f"ASIC with ID {asic_id} not found in database")

    asic = items[0]
    print(f"✅ Found ASIC: ID={asic.get('id')}, SN={asic.get('serialNumber')}, Family={asic.get('familyType')}, WaferID={asic.get('waferId')}")
    return asic

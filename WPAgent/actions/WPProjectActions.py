from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.factory import get_prober, ProberFactory
from WPAgentUtilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from services.kafka_db_service import KafkaDBService


def _get_user_selection_from_machines(machines):
    """
    Display available machines and prompt user to select one.

    Args:
        machines: List of machine dictionaries from database

    Returns:
        Selected machine dict or None if cancelled
    """
    print("\n" + "=" * 70)
    print("  AVAILABLE WAFER PROBE MACHINES")
    print("=" * 70)

    for idx, machine in enumerate(machines, 1):
        print(f"\n{idx}. {machine.get('name', 'N/A')}")
        print(f"   ID: {machine.get('id', 'N/A')}")
        print(f"   Type: {machine.get('type', 'N/A')}")
        print(f"   Host: {machine.get('hostName', 'N/A')}:{machine.get('connectionPort', 'N/A')}")
        print(f"   Location: {machine.get('generalLocation', 'N/A')}")

    print("\n" + "=" * 70)

    while True:
        try:
            selection = input(f"\nSelect machine (1-{len(machines)}) or 'q' to quit: ").strip()

            if selection.lower() == 'q':
                print("❌ Initialization cancelled by user")
                return None

            idx = int(selection)
            if 1 <= idx <= len(machines):
                selected = machines[idx - 1]
                print(f"\n✅ Selected: {selected.get('name')}")
                return selected
            else:
                print(f"⚠️  Please enter a number between 1 and {len(machines)}")

        except ValueError:
            print("⚠️  Invalid input. Please enter a number or 'q' to quit.")
        except KeyboardInterrupt:
            print("\n❌ Initialization cancelled by user")
            return None


def _initialize_from_database(project_name=None, force=False, timeout=15.0):
    """
    Initialize prober by retrieving available machines from database and prompting user selection.

    Args:
        project_name: Optional project name to use
        force: Force re-initialization even if already initialized
        timeout: Database query timeout in seconds

    Returns:
        dict: Status result
    """
    try:
        db_service = KafkaDBService.get_instance()

        print("\n🔍 Fetching available wafer probe machines from database...")
        machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

        if not machines:
            return {
                "status": "error",
                "output": "No wafer probe machines found in database or database agent not responding"
            }

        # Let user select a machine
        selected_machine = _get_user_selection_from_machines(machines)

        if not selected_machine:
            return {
                "status": "error",
                "output": "No machine selected - initialization cancelled"
            }

        # Extract machine parameters
        machine_type = selected_machine.get('type', '').lower()
        host_name = selected_machine.get('hostName', '')
        connection_port = selected_machine.get('connectionPort', '')
        machine_id = selected_machine.get('id', '')
        machine_name = selected_machine.get('name', '')

        if not machine_type or not host_name:
            return {
                "status": "error",
                "output": f"Missing required machine parameters (type: {machine_type}, host: {host_name})"
            }

        # Build address
        if connection_port:
            address = f"{host_name}:{connection_port}"
        else:
            address = host_name

        print(f"\n🔧 Initializing {machine_name} ({machine_type}) at {address}...")

        # Initialize using the selected machine parameters
        result = ensure_prober_initialized(
            address=address,
            machine_type=machine_type,
            project_name=project_name
        )

        if result["status"] == "success":
            # Store additional metadata in globals
            globals_ = SvtWPAagentGlobalParameters.getInstance()
            globals_.set_prober_status("initialized")

            # Store machine ID and name for reference
            if not hasattr(globals_, 'machine_id'):
                globals_.machine_id = machine_id
                globals_.machine_name = machine_name
            else:
                globals_.machine_id = machine_id
                globals_.machine_name = machine_name

            return {
                "status": "success",
                "output": f"✅ Initialized {machine_name} at {address}",
                "data": {
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "machine_type": machine_type,
                    "address": address,
                    "project_name": project_name
                }
            }
        else:
            return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Database initialization failed: {str(e)}"
        }


def _initialize_manual(address=None, machine_type=None, project_name=None, force=False):
    """
    Initialize prober with manually provided parameters (original behavior).

    Args:
        address: Prober network address
        machine_type: Type of prober machine
        project_name: Optional project name
        force: Force re-initialization

    Returns:
        dict: Status result
    """
    try:
        globals_ = SvtWPAagentGlobalParameters.getInstance()
        factory = ProberFactory.get_instance()

        # Check if already initialized and not forcing
        if factory.is_initialized() and not force:
            return {
                "status": "success",
                "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize."
            }

        # Reset if forcing re-initialization
        if force:
            factory.reset()

        # Check prober status
        if globals_.prober_status == "inuse" and not force:
            return {
                "status": "error",
                "output": "Prober is currently in use by another session. Use force=True to override."
            }

        # Ensure prober is initialized
        result = ensure_prober_initialized(address, machine_type, project_name)

        if result["status"] == "success":
            globals_.set_prober_status("initialized")
            info = globals_.get_info()
            return {
                "status": "success",
                "output": f"Initialized WP at {info.get('address')} with project '{info.get('project_name')}'"
            }
        else:
            return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


def initialise_testing_project(address=None, machine_type=None, project_name=None, with_db=False, force=False):
    """
    Legacy initialization function - redirects to svt_initialise_wp with same parameters.
    """
    return svt_initialise_wp(
        address=address,
        machine_type=machine_type,
        project_name=project_name,
        with_db=with_db,
        force=force
    )


def svt_initialise_wp(address=None, machine_type=None, project_name=None, with_db=False, force=False, db_timeout=15.0):
    """
    Initialize the WP agent with prober connection.

    Supports two modes:
    1. Manual mode (with_db=False): Uses provided address and machine_type
    2. Database mode (with_db=True): Retrieves machines from DB and prompts user selection

    Args:
        address: Prober network address (required if with_db=False)
        machine_type: Type of prober machine (required if with_db=False)
        project_name: Name of the project (optional)
        with_db: If True, retrieve machines from database and prompt user selection
        force: Force re-initialization even if already initialized
        db_timeout: Timeout for database queries (seconds)

    Returns:
        dict: Status result with initialization details

    Examples:
        # Manual initialization
        svt_initialise_wp(address="wpmit01.cern.ch:35555", machine_type="sentio")

        # Database-driven initialization
        svt_initialise_wp(with_db=True, project_name="my_project")
    """
    try:
        factory = ProberFactory.get_instance()

        # Check if already initialized
        if factory.is_initialized() and not force:
            globals_ = SvtWPAagentGlobalParameters.getInstance()
            return {
                "status": "success",
                "output": f"Already initialized at {globals_.address}. Use force=True to reinitialize.",
                "data": {
                    "already_initialized": True,
                    "current_address": globals_.address,
                    "current_machine_type": globals_.machine_type
                }
            }

        # Route to appropriate initialization method
        if with_db:
            print("\n📊 Using DATABASE-DRIVEN initialization...")
            return _initialize_from_database(
                project_name=project_name,
                force=force,
                timeout=db_timeout
            )
        else:
            print("\n🔧 Using MANUAL initialization...")

            # Validate required parameters for manual mode
            if not address or not machine_type:
                return {
                    "status": "error",
                    "output": "Manual initialization requires 'address' and 'machine_type' parameters. "
                              "Use with_db=True for database-driven initialization."
                }

            return _initialize_manual(
                address=address,
                machine_type=machine_type,
                project_name=project_name,
                force=force
            )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "output": f"Initialization failed: {str(e)}"
        }


def get_project_status():
    """
    Get current project and initialization status.

    Returns:
        dict: Status information including initialization state and machine details
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()
    factory = ProberFactory.get_instance()

    info = globals_.get_info()
    is_ready, ready_msg = check_prober_ready()

    status_info = {
        **info,
        "prober_initialized": factory.is_initialized(),
        "ready_for_commands": is_ready,
        "ready_message": ready_msg
    }

    # Add machine ID and name if available
    if hasattr(globals_, 'machine_id'):
        status_info["machine_id"] = globals_.machine_id
    if hasattr(globals_, 'machine_name'):
        status_info["machine_name"] = globals_.machine_name

    if not info["project_name"]:
        return {
            "status": "uninitialized",
            "output": "Global parameters not set. Run 'Initialize' command.",
            "data": status_info
        }

    return {
        "status": "success",
        "output": status_info,
        "data": status_info
    }
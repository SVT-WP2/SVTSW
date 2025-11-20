from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.factory import get_prober, ProberFactory
from utilities.WPHelpers import (resolve_project_parameters, ensure_prober_initialized, check_prober_ready)
from services.kafka_db_service import KafkaDBService


# Database initialization removed - now handled by initialization_service.py on producer side
# This keeps the listener non-interactive


def _initialize_manual(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                       machine_name=None, initialization_mode=None):
    """
    Initialize prober with manually provided parameters (original behavior).

    Args:
        address: Prober network address
        machine_type: Type of prober machine
        project_name: Optional project name
        force: Force re-initialization
        machine_id: Optional database machine ID (for tracking)
        machine_name: Optional database machine name (for tracking)
        initialization_mode: Optional initialization mode ("manual" or "database")

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

            # Store database metadata if provided (from producer-side selection)
            if machine_id:
                globals_.machine_id = machine_id
            if machine_name:
                globals_.machine_name = machine_name
            if initialization_mode:
                globals_.initialization_mode = initialization_mode
            else:
                # Default to manual if not specified
                globals_.initialization_mode = "manual"

            info = globals_.get_info()

            # Build output message
            if machine_name:
                output_msg = f"Initialized {machine_name} at {info.get('address')}"
            else:
                output_msg = f"Initialized WP at {info.get('address')}"

            if project_name:
                output_msg += f" with project '{project_name}'"

            return {
                "status": "success",
                "output": output_msg,
                "data": {
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "initialization_mode": initialization_mode or "manual"
                }
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


def initialise_testing_project(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                               machine_name=None, initialization_mode=None):
    """
    Legacy initialization function - redirects to svt_initialise_wp with same parameters.
    """
    return svt_initialise_wp(
        address=address,
        machine_type=machine_type,
        project_name=project_name,
        force=force,
        machine_id=machine_id,
        machine_name=machine_name,
        initialization_mode=initialization_mode
    )


def svt_initialise_wp(address=None, machine_type=None, project_name=None, force=False, machine_id=None,
                      machine_name=None, initialization_mode=None):
    """
    Initialize the WP agent with prober connection.

    This is called by the listener when it receives an Initialize command.
    All parameters should be provided (no interactive prompts here).

    For database-driven initialization, use WPInitializationService on the producer side.

    Args:
        address: Prober network address (required)
        machine_type: Type of prober machine (required)
        project_name: Name of the project (optional)
        force: Force re-initialization even if already initialized
        machine_id: Database machine ID (optional, for tracking)
        machine_name: Database machine name (optional, for tracking)
        initialization_mode: "manual" or "database" (optional, for tracking)

    Returns:
        dict: Status result with initialization details

    Examples:
        # Manual initialization
        svt_initialise_wp(address="wpmit01.cern.ch:35555", machine_type="sentio")

        # With database metadata (sent from producer-side WPInitializationService)
        svt_initialise_wp(
            address="wpmit01.cern.ch:35555",
            machine_type="sentio",
            machine_id="123",
            machine_name="SENTIO Prober 1",
            initialization_mode="database"
        )
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

        # Validate required parameters
        if not address or not machine_type:
            return {
                "status": "error",
                "output": "Initialization requires 'address' and 'machine_type' parameters. "
                          "For database-driven initialization, use WPInitializationService on the producer side."
            }

        # Route to manual initialization (the only mode for listener)
        print("\n🔧 Listener: Initializing prober...")
        return _initialize_manual(
            address=address,
            machine_type=machine_type,
            project_name=project_name,
            force=force,
            machine_id=machine_id,
            machine_name=machine_name,
            initialization_mode=initialization_mode
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
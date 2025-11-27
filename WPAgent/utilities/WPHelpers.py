from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters


def resolve_project_parameters(address=None, project_name=None, machine_type=None):
    """
    Resolve project parameters from provided args or global state.
    it only resolves parameters.

    Args:
        address: Optional prober address
        project_name: Optional project name
        machine_type: Optional machine type

    Returns:
        Tuple of (address, project_name, machine_type)
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()

    if not all([address, project_name, machine_type]):
        # Use global values as fallback
        address = address or globals_.address
        project_name = project_name or globals_.project_name
        machine_type = machine_type or globals_.machine_type

    # Update global state to ensure consistency (but don't re-initialize)
    if address:
        globals_.set_address(address)
    if project_name:
        globals_.set_project_name(project_name)
    if machine_type:
        globals_.set_machine_type(machine_type)

    return address, project_name, machine_type


def ensure_prober_initialized(address=None, machine_type=None, project_name=None):
    """
    Ensure the prober is initialized before executing commands.
    This should be called once at service startup or explicitly by Initialize command.

    Args:
        address: Optional prober address
        machine_type: Optional machine type
        project_name: Optional project name

    Returns:
        dict: Status result with 'status' and 'output' keys
    """
    from drivers.factory import ProberFactory

    factory = ProberFactory.get_instance()

    # Resolve parameters
    address, project_name, machine_type = resolve_project_parameters(
        address, project_name, machine_type
    )

    # Check if missing critical parameters
    if not address or not machine_type:
        return {
            "status": "error",
            "output": f"Missing required parameters: address={address}, machine_type={machine_type}"
        }

    # Check if already initialized with same config
    if factory.is_initialized():
        current_config = factory._current_config
        if current_config == (machine_type.lower(), address):
            return {
                "status": "success",
                "output": f"Prober already initialized at {address}"
            }

    # Initialize the prober (this will create singleton instance)
    try:
        prober = factory.get_prober(machine_type, address)
        return {
            "status": "success",
            "output": f"Prober initialized: {machine_type} at {address}"
        }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Failed to initialize prober: {str(e)}"
        }


def check_prober_ready():
    """
    Check if prober is initialized and ready for commands.

    Returns:
        tuple: (is_ready: bool, message: str)
    """
    from drivers.factory import ProberFactory

    factory = ProberFactory.get_instance()

    if not factory.is_initialized():
        return False, "Prober not initialized. Please run 'Initialize' command first."

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    if not globals_.address or not globals_.machine_type:
        return False, "Global parameters not set. Please run 'Initialize' command first."

    return True, "Prober ready"
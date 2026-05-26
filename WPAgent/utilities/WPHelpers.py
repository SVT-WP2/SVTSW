from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters


def resolve_project_parameters(address=None, projectName=None, machineType=None):
    """
    Resolve project parameters from provided args or global state.
    it only resolves parameters.

    Args:
        address: Optional prober address
        projectName: Optional project name
        machineType: Optional machine type

    Returns:
        Tuple of (address, projectName, machineType)
    """
    globals_ = SvtWPAagentGlobalParameters.getInstance()

    if not all([address, projectName, machineType]):
        # Use global values as fallback
        address = address or globals_.address
        projectName = projectName or globals_.projectName
        machineType = machineType or globals_.machineType

    # Update global state to ensure consistency (but don't re-initialize)
    if address:
        globals_.set_address(address)
    if projectName:
        globals_.set_project_name(projectName)
    if machineType:
        globals_.set_machine_type(machineType)

    return address, projectName, machineType


def ensure_prober_initialized(address=None, machineType=None, projectName=None):
    """
    Ensure the prober is initialized before executing commands.
    This should be called once at service startup or explicitly by Initialize command.

    Args:
        address: Optional prober address
        machineType: Optional machine type
        projectName: Optional project name

    Returns:
        dict: Status result with 'status' and 'output' keys
    """
    from drivers.WPFactory import ProberFactory

    factory = ProberFactory.get_instance()

    # Resolve parameters
    address, projectName, machineType = resolve_project_parameters(
        address, projectName, machineType
    )

    # Check if missing critical parameters
    if not address or not machineType:
        return {
            "status": "error",
            "output": f"Missing required parameters: address={address}, machineType={machineType}",
        }

    # Check if already initialized with same config
    if factory.is_initialized():
        current_config = factory._current_config
        if current_config == (machineType.lower(), address):
            return {
                "status": "success",
                "output": f"Prober already initialized at {address}",
            }

    # Initialize the prober (this will create singleton instance)
    try:
        prober = factory.get_prober(machineType, address)
        return {
            "status": "success",
            "output": f"Prober initialized: {machineType} at {address}",
        }
    except Exception as e:
        return {"status": "error", "output": f"Failed to initialize prober: {str(e)}"}


def check_prober_ready():
    """
    Check if prober is initialized and ready for commands.

    Returns:
        tuple: (is_ready: bool, message: str)
    """
    from drivers.WPFactory import ProberFactory

    factory = ProberFactory.get_instance()

    if not factory.is_initialized():
        return False, "Prober not initialized. Please run 'Initialize' command first."

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    if not globals_.address or not globals_.machineType:
        return (
            False,
            "Global parameters not set. Please run 'Initialize' command first.",
        )

    return True, "Prober ready"

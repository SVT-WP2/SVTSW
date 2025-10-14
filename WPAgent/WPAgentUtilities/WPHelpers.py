from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters

def resolve_project_parameters(address=None, project_name=None, machine_type=None):
    globals_ = SvtWPAagentGlobalParameters.getInstance()

    if not all([address, project_name, machine_type]):
        print("🔄 Resolving missing parameters from DB...")
        globals_.load_from_db()

        address = address or globals_.address
        project_name = project_name or globals_.project_name
        machine_type = machine_type or globals_.machine_type

    # Update global state to ensure consistency
    globals_.set_address(address)
    globals_.set_project_name(project_name)
    globals_.set_machine_type(machine_type)

    return address, project_name, machine_type

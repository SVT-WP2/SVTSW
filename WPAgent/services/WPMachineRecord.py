"""
WPMachineRecord - the DB record of the WP machine of this agent (WaferProbeMachine).

The DB is the source of truth for the connection to the machine: `hostName` and
`connectionPort` of the record are used as they are. The agent finds its record by the
machine name at start (WPAgent.listen) and reads it again while the machine is off and
right before every connect (refresh_machine), so a change of the record is used without
a restart of the agent.
"""

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

REFRESH_TIMEOUT = 5.0


def find_record(machines, name):
    """The record named `name` (case does not matter), or None."""
    wanted = str(name or "").upper()
    return next((m for m in machines if str(m.get("name", "")).upper() == wanted), None)


def machine_config(record) -> dict:
    """
    The config values of a WaferProbeMachine record: address (the host as in the DB),
    port, machineType, machineId, description.
    Raises ValueError for a record that WPAgent cannot use.
    """
    from drivers.WPFactory import prober_classes

    name = record.get("name")
    machine_type = str(record.get("software", "sentio"))
    if machine_type.lower() not in prober_classes:
        raise ValueError(
            f"WaferProbeMachine '{name}' uses the software '{machine_type}', "
            f"which WPAgent does not support ({', '.join(prober_classes)})."
        )

    host = str(record.get("hostName") or "").strip()
    port = record.get("connectionPort")
    if not host or not port:
        raise ValueError(
            f"WaferProbeMachine '{name}' needs 'hostName' and 'connectionPort' in the DB "
            f"(got hostName='{host}', connectionPort={port})."
        )

    return {
        "address": host,
        "port": port,
        "machineType": machine_type,
        "machineId": record.get("id", 0),
        "description": record.get("generalLocation", ""),
    }


def full_address(config) -> str:
    """ "host:port" of a config, as the prober drivers take it."""
    return f"{config.get('address', 'localhost')}:{config.get('port', 35555)}"


def refresh_machine(timeout=REFRESH_TIMEOUT):
    """
    Read the record of this agent's machine from the DB again and store its connection
    values (address, machine type, id) in the globals.

    Returns the record, or None when there is nothing new to use: the machine has no DB
    record (mock config), the DB agent gave no answer, or the record is gone or unusable.
    The last known values stay in that case.

    Call it only while the machine is not connected or right before a new connection:
    the prober of a live connection is found by the address in the globals.
    """
    g = SvtWPAagentGlobalParameters.getInstance()
    name = g.machine_record_name
    if not name:
        return None

    try:
        from services.WPDbKafkaClient import DBKafkaClient

        machines = DBKafkaClient.get_instance().get_all_wafer_probe_machines(timeout=timeout)
        if not machines:
            print(f"WARNING - no answer from the DB agent: the last known record of {name} stays")
            return None
        record = find_record(machines, name)
        if record is None:
            print(f"WARNING - the DB has no WaferProbeMachine named '{name}' any more: the last known record stays")
            return None
        config = machine_config(record)
    except Exception as e:
        print(f"WARNING - cannot read the DB record of {name}: {e}")
        return None

    address = full_address(config)
    old = (g.address, str(g.machineType or "").lower(), g.wpMachineId)
    new = (address, config["machineType"].lower(), config["machineId"])
    if old != new:
        try:
            from utilities.WPAgentLogger import WPAgentLogger

            WPAgentLogger().log_audit(
                "MACHINE_RECORD_CHANGED", machine=name,
                old_address=old[0], new_address=new[0], machine_type=config["machineType"], machine_id=new[2],
            )
        except Exception:
            pass

    g.set_address(address)
    g.set_machine_type(config["machineType"])
    g.set_machine_id(config["machineId"])
    return record

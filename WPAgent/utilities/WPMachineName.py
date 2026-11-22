"""
WPMachineName - compare the machine name of a request with the name of this agent.

The name is WaferProbeMachine.name in the DB (e.g. "WPMIT"). Case does not matter, and the
CLI suffix "_DEV" (ProbeConfig*_DEV.json, WPSender.py) names the same machine: dev and prod
use separate Kafka clusters, so the names cannot collide across environments.
"""

DEV_SUFFIX = "_DEV"


def normalize_machine_name(name) -> str:
    """Upper-case name without the "_DEV" suffix; "" for no name."""
    if not name:
        return ""
    normalized = str(name).strip().upper()
    if normalized.endswith(DEV_SUFFIX):
        normalized = normalized[: -len(DEV_SUFFIX)]
    return normalized


def is_same_machine(name, other) -> bool:
    """True when both names are set and name the same machine."""
    a = normalize_machine_name(name)
    return bool(a) and a == normalize_machine_name(other)

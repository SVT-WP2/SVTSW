"""
The DB record of the WP machine is the source of truth for its address: the host and the
port are used as they are, and the agent reads the record again while the machine is off
and right before every connect (Initialize, reconnect).

Run:  python3 -m pytest tests/unit/TestMachineRecord.py -q -o python_files="Test*.py"
"""

import pytest

import services.WPProberConnectionWatch as watch_module
import WPCmdMap
from drivers.WPFactory import ProberFactory, prober_classes
from services.WPMachineRecord import full_address, machine_config, refresh_machine
from services.WPProberConnectionWatch import ProberConnectionWatch
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm

MACHINE = "WPTEST"
RECORD = {
    "id": 7, "name": MACHINE, "hostName": "prober-a.example.org", "connectionPort": 35555,
    "software": "mock", "generalLocation": "CERN",
}


class _FakeDb:
    """The DB agent: gives the current record of the machine (None: no answer)."""

    def __init__(self):
        self.record = dict(RECORD)
        self.calls = 0

    def get_all_wafer_probe_machines(self, timeout=15.0):
        self.calls += 1
        return [dict(self.record)] if self.record else []


@pytest.fixture(autouse=True)
def db(monkeypatch, globals_instance):
    """An agent that was started for the DB machine RECORD; nothing is connected."""
    from services.WPDbKafkaClient import DBKafkaClient

    fake = _FakeDb()
    monkeypatch.setattr(DBKafkaClient, "_instance", fake)
    factory = ProberFactory.get_instance()
    factory.reset()
    g = globals_instance
    g.wpAgentName = MACHINE
    g.machine_record_name = MACHINE
    g.set_address("prober-a.example.org:35555")
    g.set_machine_type("mock")
    g.set_machine_id(7)
    sm.force_state(S.ServiceOn)
    yield fake
    factory.reset()
    sm.force_state(S.ServiceOn)


# --- the record ---------------------------------------------------------------------------------

@pytest.mark.parametrize("host", ["prober-a.example.org", "cern.ch", "10.0.0.7"])
def test_host_and_port_are_used_as_they_are_in_the_db(host):
    config = machine_config({**RECORD, "hostName": host, "connectionPort": 35556})
    assert (config["address"], config["port"]) == (host, 35556)
    assert full_address(config) == f"{host}:35556"


@pytest.mark.parametrize("broken", [{"hostName": ""}, {"hostName": None}, {"connectionPort": None}])
def test_record_without_host_or_port_cannot_be_used(broken):
    with pytest.raises(ValueError, match="hostName"):
        machine_config({**RECORD, **broken})


# --- refresh ------------------------------------------------------------------------------------

def test_refresh_stores_the_record_of_this_moment(db, globals_instance):
    db.record.update(hostName="prober-b.example.org", connectionPort=35556, id=8)
    assert refresh_machine()["hostName"] == "prober-b.example.org"
    assert globals_instance.address == "prober-b.example.org:35556"
    assert globals_instance.wpMachineId == 8


@pytest.mark.parametrize("change", [
    lambda db: setattr(db, "record", None),                      # no answer from the DB agent
    lambda db: db.record.update(name="OTHER"),                   # the record is gone
    lambda db: db.record.update(software="VeloxCascade"),        # WPAgent cannot use it
    lambda db: db.record.update(hostName=""),
])
def test_refresh_keeps_the_last_known_values(db, globals_instance, change):
    change(db)
    assert refresh_machine() is None
    assert globals_instance.address == "prober-a.example.org:35555"
    assert globals_instance.machineType == "mock"


def test_mock_config_has_no_record_to_read(db, globals_instance):
    globals_instance.machine_record_name = None
    assert refresh_machine() is None
    assert db.calls == 0


# --- the connection watch -----------------------------------------------------------------------

@pytest.fixture
def checked(monkeypatch):
    """The addresses of the TCP checks; the machine is off."""
    seen = []
    monkeypatch.setattr(watch_module, "is_reachable", lambda _type, address, timeout=2.0: seen.append(address) and False)
    return seen


def test_watch_follows_the_record_while_the_machine_is_off(db, checked):
    w = ProberConnectionWatch(refresh_interval=0)
    w.check_once()
    db.record["hostName"] = "prober-b.example.org"
    w.check_once()
    assert checked == ["prober-a.example.org:35555", "prober-b.example.org:35555"]


def test_watch_reads_the_record_only_every_refresh_interval(db, checked):
    w = ProberConnectionWatch()          # 30 s; the record was read at the start of the agent
    w.check_once()
    w.check_once()
    assert db.calls == 0
    assert checked == ["prober-a.example.org:35555"] * 2


def test_watch_leaves_the_record_alone_while_connected(db, globals_instance):
    ProberFactory.get_instance().get_prober("mock", "prober-a.example.org:35555")
    db.record["hostName"] = "prober-b.example.org"
    w = ProberConnectionWatch(refresh_interval=0)
    w.check_once()
    assert db.calls == 0                 # the address of a live connection does not change
    assert globals_instance.address == "prober-a.example.org:35555"


def test_watch_reconnects_to_the_address_of_this_moment(db, globals_instance):
    factory = ProberFactory.get_instance()
    factory.get_prober("mock", "prober-a.example.org:35555").disconnect()    # initialized, machine lost
    db.record["hostName"] = "prober-b.example.org"
    w = ProberConnectionWatch(failures=1)
    w.check_once()
    assert factory.get_current_config() == ("mock", "prober-b.example.org:35555")
    assert globals_instance.prober_connected is True


# --- the commands that connect ------------------------------------------------------------------

def test_initialize_uses_the_record_of_this_moment(db, globals_instance):
    db.record.update(hostName="prober-b.example.org", loadedWaferId=12, loadedWaferOrientation="East")
    res = WPCmdMap.execute_command("Initialize", {"waferAgentName": MACHINE})
    assert res["status"] == "Success", res
    assert ProberFactory.get_instance().get_current_config() == ("mock", "prober-b.example.org:35555")
    assert (globals_instance.loaded_wafer_id, globals_instance.wafer_orientation) == (12, "East")
    assert db.calls == 1                 # one read for the address and the machine state


def test_initialize_works_without_an_answer_from_the_db_agent(db, globals_instance):
    db.record = None
    res = WPCmdMap.execute_command("Initialize", {"waferAgentName": MACHINE})
    assert res["status"] == "Success", res
    assert ProberFactory.get_instance().get_current_config() == ("mock", "prober-a.example.org:35555")


def _reconnect(globals_instance):
    globals_instance.set_user("u1", "Expert")
    sm.force_state(S.OpenedProject)
    return WPCmdMap.execute_command("ReconnectProber", {"user": "u1", "waferAgentName": MACHINE})


def test_reconnect_prober_uses_the_record_of_this_moment(db, globals_instance):
    factory = ProberFactory.get_instance()
    factory.get_prober("mock", "prober-a.example.org:35555")
    db.record["hostName"] = "prober-b.example.org"
    assert _reconnect(globals_instance)["status"] == "Success"
    assert factory.get_current_config() == ("mock", "prober-b.example.org:35555")


def test_reconnect_to_a_moved_machine_that_is_off(db, globals_instance, monkeypatch):
    factory = ProberFactory.get_instance()
    factory.get_prober("mock", "prober-a.example.org:35555")
    db.record["hostName"] = "prober-b.example.org"

    class Unreachable:
        def __init__(self, address):
            raise ConnectionError("machine is off")

    monkeypatch.setitem(prober_classes, "mock", Unreachable)
    res = _reconnect(globals_instance)

    assert res["error"]["code"] == 503 and "prober-b.example.org" in res["error"]["message"]
    assert globals_instance.prober_connected is False     # the old connection is not this machine any more
    assert sm.current_state == S.OpenedProject

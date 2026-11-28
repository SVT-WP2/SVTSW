"""The connection: Initialize, Disconnect, Shutdown; reconnects; the TCP check; --mock; the shared package missing."""

import json
import socket
import subprocess
import sys

import pytest
from conftest import TIMEOUT_S, Listener, calls_by_request, tool_env, write_config

from wptool import connection as connection_module
from wptool.config import Config, MachineConfig
from wptool.connection import MOCK_MACHINE, Connection, is_reachable, resolve_machine
from wptool.engine import Engine, Request
from wptool.replies import ToolError
from wptool.state import ToolState


def ok(reply):
    assert reply.ok, reply
    return reply.data


def error_of(reply):
    assert not reply.ok, reply
    return reply.error["code"], reply.error["message"]


@pytest.fixture
def seam_engine(seam, log_file, sink):
    """An engine without --mock and with the test seam: real addresses, the simulator behind them."""
    engines = []

    def make(machine: MachineConfig | None = None) -> Engine:
        engine = Engine(Config(log=str(log_file), machine=machine), events=sink)
        engines.append(engine)
        return engine

    yield make
    for engine in engines:
        engine.connection.close()


# The TCP check


def test_is_reachable(listener, closed_port):
    assert is_reachable("127.0.0.1", listener.port) is True
    assert is_reachable("127.0.0.1", closed_port) is False
    assert is_reachable("not an address", 1) is False


def test_the_tcp_check_waits_2_s_and_sends_nothing(monkeypatch):
    seen = []

    class Fake:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def sendall(self, data):  # never called
            seen.append(("sent", data))

    def create_connection(address, timeout):
        seen.append((address, timeout))
        return Fake()

    monkeypatch.setattr(socket, "create_connection", create_connection)
    assert is_reachable("192.0.2.10", 35555) is True
    assert seen == [(("192.0.2.10", 35555), 2.0)]


def test_a_machine_that_is_not_reachable_gives_503_and_nothing_changes(seam_engine, closed_port, sink):
    engine = seam_engine()
    reply = engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": closed_port}))
    assert error_of(reply) == (503, f"The machine at 127.0.0.1:{closed_port} is not reachable")
    assert engine.state.snapshot() == {"machine": None, "proberConnected": False}
    assert not engine.connection.is_open
    assert sink.events == []


def test_a_failed_reconnect_keeps_the_old_connection(seam_engine, listener, closed_port, sink):
    engine = seam_engine()
    ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": listener.port})))
    machine, lock = engine.connection.machine, engine.connection.lock
    before = engine.state.snapshot()
    reply = engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": closed_port, "force": True}))
    assert error_of(reply)[0] == 503
    assert engine.connection.machine is machine and engine.connection.lock is lock and lock.held
    assert engine.state.snapshot() == before
    # The same machine, not reachable any more (restarted): the old connection stays too.
    listener.close()
    reply = engine.execute(Request(command="Initialize", params={"force": True, "address": "127.0.0.1", "port": listener.port}))
    assert error_of(reply)[0] == 503
    assert engine.connection.machine is machine and lock.held


# Where the machine comes from


def test_initialize_with_the_parameters(seam_engine, listener, sink):
    engine = seam_engine()
    data = ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": listener.port})))
    where = f"127.0.0.1:{listener.port}"
    assert data["message"] == f"Initialized {where}"
    assert data["machine"] == {"address": "127.0.0.1", "port": listener.port}
    assert "facts" in data
    status = {"machine": {"address": "127.0.0.1", "port": listener.port}, "proberConnected": True}
    assert engine.state.snapshot() == status
    assert sink.events == [{"event": "status", "data": status}]
    assert listener.connections(at_least=1) == 1  # the TCP check


def test_initialize_with_the_config(seam_engine, listener):
    engine = seam_engine(listener.machine)
    data = ok(engine.execute(Request(command="Initialize")))
    assert data["machine"] == {"address": "127.0.0.1", "port": listener.port}


def test_the_parameters_win_over_the_config(seam_engine, listener):
    other = Listener()
    try:
        engine = seam_engine(listener.machine)
        ok(engine.execute(Request(command="Initialize", params={"port": other.port})))
        assert engine.state.machine == {"address": "127.0.0.1", "port": other.port}
        ok(engine.execute(Request(command="Initialize", params={"address": "localhost", "port": other.port})))
        assert engine.state.machine == {"address": "localhost", "port": other.port}
    finally:
        engine.connection.close()
        other.close()


def test_without_a_machine_400_names_both(seam_engine):
    engine = seam_engine()
    code, message = error_of(engine.execute(Request(command="Initialize")))
    assert code == 400
    assert "address" in message and "port" in message and "machine.address" in message and "machine.port" in message


@pytest.mark.parametrize(
    "params, text",
    [
        ({"address": "192.0.2.10"}, "No machine port: give the parameter port, or the config key machine.port"),
        ({"port": 35555}, "No machine address: give the parameter address, or the config key machine.address"),
        ({"address": "  ", "port": 35555}, "The parameter address must not be empty"),
    ],
)
def test_a_missing_part_400_names_the_parameter_and_the_config_key(seam_engine, params, text):
    engine = seam_engine()
    assert error_of(engine.execute(Request(command="Initialize", params=params))) == (400, text)
    assert not engine.connection.is_open


@pytest.mark.parametrize("port", [0, 65536, -1, "x"])
def test_the_port_is_checked(seam_engine, port):
    engine = seam_engine()
    assert error_of(engine.execute(Request(command="Initialize", params={"address": "192.0.2.10", "port": port})))[0] == 400


def test_resolve_machine():
    config = Config(machine=MachineConfig("192.0.2.10", 35555))
    assert resolve_machine(config, None, None) == MachineConfig("192.0.2.10", 35555)
    assert resolve_machine(config, " 192.0.2.11 ", None) == MachineConfig("192.0.2.11", 35555)
    assert resolve_machine(config, None, 1) == MachineConfig("192.0.2.10", 1)
    assert resolve_machine(Config(mock=True), None, None) == MOCK_MACHINE
    assert resolve_machine(Config(mock=True, machine=MachineConfig("192.0.2.10", 35555)), "192.0.2.11", 2) == MOCK_MACHINE


# Initialize again


def test_initialize_twice_without_and_with_force(mock_engine, sink):
    sim = mock_engine.connection.simulator
    first = ok(mock_engine.execute(Request(command="Initialize")))
    assert first["message"] == "Initialized mock:0"
    machine = mock_engine.connection.machine
    again = ok(mock_engine.execute(Request(command="Initialize")))
    assert again["message"] == "Already connected to mock:0. Use force=true to connect again."
    assert again["machine"] == {"address": "mock", "port": 0}
    assert "facts" in again
    assert mock_engine.connection.machine is machine
    forced = ok(mock_engine.execute(Request(command="Initialize", params={"force": True})))
    assert forced["message"] == "Initialized mock:0"
    assert mock_engine.connection.machine is not machine
    # The same simulator: a real machine keeps its state.
    assert len(sim.links) == 2 and not sim.links[0].connected and sim.links[1].connected
    # One status event: the first connect. The reconnects change nothing that the status shows.
    assert len(sink.events) == 1


def test_a_connection_that_is_no_longer_alive_is_opened_again_without_force(mock_engine):
    ok(mock_engine.execute(Request(command="Initialize")))
    old = mock_engine.connection.machine
    mock_engine.connection.simulator.drop_connections()
    data = ok(mock_engine.execute(Request(command="Initialize")))
    assert data["message"] == "Initialized mock:0"
    assert mock_engine.connection.machine is not old
    assert ok(mock_engine.execute(Request(command="LocalMode")))


def test_initialize_another_machine_without_force_connects_to_it(seam_engine, listener):
    other = Listener()
    try:
        engine = seam_engine()
        ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": listener.port})))
        data = ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": other.port})))
        assert data["message"] == f"Initialized 127.0.0.1:{other.port}"
        assert engine.state.machine["port"] == other.port
    finally:
        engine.connection.close()
        other.close()


class Recorder:
    """A driver factory that records when a connection is opened, given back and closed."""

    def __init__(self):
        self.events = []
        self.count = 0

    def __call__(self, where):
        self.count += 1
        return RecordingDriver(self, self.count)


class RecordingDriver:
    def __init__(self, recorder, number):
        self.recorder = recorder
        self.number = number
        recorder.events.append(("open", number))

    def __getattr__(self, name):
        def method(*args):
            self.recorder.events.append((name, self.number))
            return {
                "get_current_index": "0,0,0",
                "get_dies_number": "1",
                "get_chuck_position": "In Separation",
                "get_current_working_area": "Probing",
                "get_chuck_xy": (0.0, 0.0),
                "get_chuck_z": 0.0,
                "is_alive": True,
            }.get(name)

        return method


def test_with_force_the_new_connection_is_opened_before_the_old_one_is_closed(listener, log_file):
    recorder = Recorder()
    state = ToolState()
    config = Config(log=str(log_file), machine=listener.machine)
    engine = Engine(config, state=state, connection=Connection(config, state, driver_factory=recorder))
    try:
        ok(engine.execute(Request(command="Initialize")))
        recorder.events.clear()
        ok(engine.execute(Request(command="Initialize", params={"force": True})))
        assert recorder.events[:3] == [("open", 2), ("local_mode", 1), ("disconnect", 1)]
        # Nothing reaches the old connection after its close; the new one gets the facts, then local_mode().
        assert [e for e in recorder.events[3:] if e[1] == 1] == []
        assert recorder.events[-1] == ("local_mode", 2)
    finally:
        engine.connection.close()


def test_a_failure_of_the_connect_is_500(listener, log_file):
    def broken(where):
        raise ConnectionRefusedError(f"SENTIO refused {where}")

    state = ToolState()
    config = Config(log=str(log_file), machine=listener.machine)
    engine = Engine(config, state=state, connection=Connection(config, state, driver_factory=broken))
    reply = engine.execute(Request(command="Initialize"))
    assert error_of(reply) == (500, f"Failed to connect: SENTIO refused 127.0.0.1:{listener.port}")
    assert not engine.connection.is_open and engine.connection.lock is None


def test_without_the_shared_package_initialize_says_how_to_install_it(listener, log_file, monkeypatch):
    # An import of a module that is None in sys.modules raises ImportError.
    monkeypatch.setitem(sys.modules, "svt_wp_core.drivers.WPSentioProber", None)
    engine = Engine(Config(log=str(log_file), machine=listener.machine))
    code, message = error_of(engine.execute(Request(command="Initialize")))
    assert code == 500
    assert "svt-wp-core" in message and "pip install -r requirements.txt" in message
    assert engine.connection.lock is None


def test_the_tool_imports_the_shared_package_only_to_connect_to_a_real_machine(tmp_path):
    """wptool starts without svt_wp_core (describe, the offline commands, --mock): it is imported by Initialize."""
    code = (
        "import sys, json\n"
        "from wptool.cli import main\n"
        "from wptool.config import Config\n"
        "from wptool.engine import Engine, Request\n"
        "engine = Engine(Config(log='x.log', mock=True))\n"
        "replies = [engine.execute(Request(command=c)).status for c in ('ShowStatus', 'Initialize', 'LocalMode', 'Shutdown')]\n"
        "print(json.dumps([replies, 'svt_wp_core' in sys.modules, 'sentio_prober_control' in sys.modules]))\n"
    )
    result = subprocess.run([sys.executable, "-c", code], cwd=tmp_path, capture_output=True, env=tool_env(), timeout=TIMEOUT_S)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [["Success"] * 4, False, False]


# Disconnect and Shutdown


def test_disconnect_without_a_connection(mock_engine, sink):
    assert ok(mock_engine.execute(Request(command="Disconnect"))) == {"message": "Not connected"}
    assert mock_engine.connection.simulator.calls == []
    assert sink.events == []


def test_disconnect_with_a_connection(mock_engine, sink):
    ok(mock_engine.execute(Request(command="Initialize")))
    sim = mock_engine.connection.simulator
    sim.calls.clear()
    assert ok(mock_engine.execute(Request(command="Disconnect"))) == {"message": "Disconnected from mock:0"}
    assert sim.calls == [("local_mode", ()), ("disconnect", ())]
    # The machine stays known.
    assert mock_engine.state.snapshot() == {"machine": {"address": "mock", "port": 0}, "proberConnected": False}
    assert sink.events[-1] == {"event": "status", "data": {"machine": {"address": "mock", "port": 0}, "proberConnected": False}}
    assert error_of(mock_engine.execute(Request(command="LocalMode"))) == (503, "Not connected to a machine: run Initialize first")
    assert ok(mock_engine.execute(Request(command="Disconnect"))) == {"message": "Not connected"}
    # It can connect again.
    assert ok(mock_engine.execute(Request(command="Initialize")))["message"] == "Initialized mock:0"


def test_shutdown_calls_local_mode_before_disconnect_and_sends_no_status_after_its_reply(mock_engine, sink):
    ok(mock_engine.execute(Request(command="Initialize")))
    sim = mock_engine.connection.simulator
    sim.calls.clear()
    sink.events.clear()
    assert ok(mock_engine.execute(Request(command="Shutdown"))) == {"message": "Shutting down"}
    assert sim.calls == [("local_mode", ()), ("disconnect", ())]
    assert mock_engine.stopped and not mock_engine.connection.is_open
    assert mock_engine.state.proberConnected is False
    # The decision of #408: no status event after the reply of Shutdown (the tool ends; the contract's example).
    assert sink.events == []


def test_a_failing_close_does_not_fail_shutdown(mock_engine):
    ok(mock_engine.execute(Request(command="Initialize")))
    sim = mock_engine.connection.simulator
    sim.fail_next("local_mode", RuntimeError("SENTIO is gone"))
    assert ok(mock_engine.execute(Request(command="Shutdown"))) == {"message": "Shutting down"}
    assert sim.calls[-1] == ("disconnect", ())
    assert not mock_engine.connection.is_open


def test_close_never_raises_and_releases_the_lock(seam_engine, listener):
    engine = seam_engine()
    ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": listener.port})))
    lock = engine.connection.lock
    engine.connection.machine.disconnect()  # the link is closed under the connection
    assert engine.connection.close() is True
    assert not lock.held and engine.connection.lock is None
    assert engine.connection.close() is False


def test_the_end_of_the_input_in_serve_closes_the_connection(serve_tool, log_file):
    process = serve_tool("--mock")
    assert process.read()["event"] == "ready"
    process.read()
    assert process.request({"id": "1", "command": "Initialize"})["status"] == "Success"
    process.read()  # the status event
    process.close_input()
    assert process.wait() == 0
    assert process.rest() == []
    requests = calls_by_request(log_file)
    assert requests[-1] == ("<end>", ["local_mode()", "disconnect()"])
    assert "INFO wptool.connection: Connection to mock:0 closed" in log_file.read_text(encoding="utf-8")


def test_serve_shutdown_reply_is_the_last_line(serve_tool, log_file):
    process = serve_tool("--mock")
    process.read()
    process.read()
    process.request({"id": "1", "command": "Initialize"})
    process.read()
    assert process.request({"id": "2", "command": "Shutdown"}) == {"id": "2", "status": "Success", "data": {"message": "Shutting down"}}
    assert process.wait() == 0
    assert process.rest() == []
    assert calls_by_request(log_file)[-2] == ("Shutdown", ["local_mode()", "disconnect()"])


# --mock


def test_mock_never_opens_a_tcp_connection_also_with_a_real_address_in_the_config(listener, log_file, monkeypatch, tmp_path):
    def no_tcp(*args, **kwargs):
        raise AssertionError("a TCP connection with --mock")

    monkeypatch.setattr(socket, "create_connection", no_tcp)
    engine = Engine(Config(log=str(log_file), machine=listener.machine, mock=True))
    data = ok(engine.execute(Request(command="Initialize", params={"address": "127.0.0.1", "port": listener.port})))
    assert data["machine"] == {"address": "mock", "port": 0}
    assert engine.connection.lock is None
    engine.execute(Request(command="Shutdown"))
    assert listener.connections() == 0


def test_mock_in_a_tool_process_with_a_real_address(listener, tmp_path, log_file, serve_tool):
    config = write_config(tmp_path / "real.json", log_file, listener.machine)
    process = serve_tool("--mock", config=config)
    process.read()
    process.read()
    reply = process.request({"id": "1", "command": "Initialize"})
    assert reply["data"]["machine"] == {"address": "mock", "port": 0}
    process.close_input()
    assert process.wait() == 0
    assert listener.connections() == 0


def test_one_simulator_per_tool_process():
    state = ToolState()
    connection = Connection(Config(mock=True), state)
    sim = connection.simulator
    connection.open(MOCK_MACHINE)
    sim.go_to_contact()
    connection.close()
    connection.open(MOCK_MACHINE)
    assert connection.simulator is sim
    assert connection.machine.get_chuck_position() == "In Contact"
    connection.close()


def test_require(mock_engine):
    with pytest.raises(ToolError) as e:
        mock_engine.connection.require()
    assert (e.value.code, e.value.message) == (503, "Not connected to a machine: run Initialize first")


def test_the_close_at_exit_is_the_last_guard(tmp_path):
    """A process that ends with a connection open (no mode, no Shutdown): atexit gives the machine back."""
    log = tmp_path / "exit.log"
    code = (
        "import logging\n"
        f"logging.basicConfig(filename={str(log)!r}, level=logging.DEBUG, format='%(levelname)s %(name)s: %(message)s')\n"
        "from wptool.config import Config\n"
        "from wptool.engine import Engine, Request\n"
        "engine = Engine(Config(log='x.log', mock=True))\n"
        "assert engine.execute(Request(command='Initialize')).ok\n"
    )
    result = subprocess.run([sys.executable, "-c", code], cwd=tmp_path, capture_output=True, env=tool_env(), timeout=TIMEOUT_S)
    assert result.returncode == 0, result.stderr
    lines = log.read_text(encoding="utf-8").splitlines()
    assert lines[-3:] == [
        "DEBUG wptool.machine: machine: local_mode()",
        "DEBUG wptool.machine: machine: disconnect()",
        "INFO wptool.connection: Connection to mock:0 closed",
    ]


def test_connection_module_has_no_state_of_its_own():
    # One connection per engine, one engine per mode: nothing at module level holds a connection or a simulator.
    for name, value in vars(connection_module).items():
        assert not isinstance(value, Connection), name

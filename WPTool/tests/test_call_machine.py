"""The machine part of call: connect as Initialize does, the command, then the close that gives the machine back."""

import json

from conftest import SEAM, calls_by_request, machine_calls, run_tool, write_config


def reply_of(result):
    lines = result.stdout.decode("utf-8").splitlines()
    assert len(lines) == 1, (result.stdout, result.stderr)
    return json.loads(lines[0])


def test_call_mock_move_connects_moves_and_closes(tmp_path, config_file, log_file):
    result = run_tool(["call", "--mock", "--config", str(config_file), "_Move", "x=15", "y=0"], cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    reply = reply_of(result)
    assert reply["status"] == "Success"
    assert reply["data"]["message"] == "Moved the chuck: x=15.0, y=0.0, Relative"
    facts = reply["data"]["facts"]
    # Each call starts a new simulator, in its start state (home, off-axis area, In Default).
    assert (facts["x"], facts["y"]) == (1015.0, -2000.0)
    calls = machine_calls(log_file)
    assert calls[:3] == ["get_chuck_position()", "get_current_working_area()", "move_chuck_xy(15.0, 0.0, 'Relative')"]
    # The engine gives the machine back after the request, then the close: local_mode(), disconnect().
    assert calls[-3:] == ["local_mode()", "local_mode()", "disconnect()"]
    log = log_file.read_text(encoding="utf-8")
    assert "Connected to mock:0" in log and "Connection to mock:0 closed" in log


def test_call_mock_local_mode(tmp_path, config_file, log_file):
    result = run_tool(["call", "--mock", "--config", str(config_file), "LocalMode"], cwd=tmp_path, testing=False)
    assert result.returncode == 0, result.stderr
    reply = reply_of(result)
    assert reply["data"]["message"] == "Local mode"
    assert reply["data"]["facts"]["chuckZPositionState"] == "In Default"


def test_every_mock_call_starts_a_new_simulator(tmp_path, config_file):
    for _ in range(2):
        result = run_tool(["call", "--mock", "--config", str(config_file), "_Move", "x=10"], cwd=tmp_path)
        assert reply_of(result)["data"]["facts"]["x"] == 1010.0


def test_without_a_machine_and_without_mock_the_400_of_the_connect(tmp_path, config_file, log_file):
    result = run_tool(["call", "--config", str(config_file), "LocalMode"], cwd=tmp_path)
    assert result.returncode == 1
    assert reply_of(result) == {
        "status": "Error",
        "error": {
            "code": 400,
            "message": "No machine to connect to: give machine.address and machine.port in the config, or start the tool with --mock",
        },
    }
    assert machine_calls(log_file) == []


def test_a_parameter_error_does_not_connect(tmp_path, config_file, log_file):
    result = run_tool(["call", "--mock", "--config", str(config_file), "_Move", "x=far"], cwd=tmp_path)
    assert result.returncode == 1
    assert reply_of(result)["error"]["code"] == 400
    assert machine_calls(log_file) == []
    assert "Connected to" not in log_file.read_text(encoding="utf-8")


def test_an_offline_command_gets_no_connection(tmp_path, config_file, log_file):
    result = run_tool(["call", "--mock", "--config", str(config_file), "ShowStatus"], cwd=tmp_path)
    assert result.returncode == 0
    data = reply_of(result)["data"]
    assert "facts" not in data and data["proberConnected"] is False
    assert machine_calls(log_file) == []


def test_call_connects_to_the_machine_of_the_config(tmp_path, log_file, listener):
    config = write_config(tmp_path / "machine.json", log_file, listener.machine)
    result = run_tool(["call", "--config", str(config), "_Move", "x=1"], cwd=tmp_path, env=SEAM)
    assert result.returncode == 0, result.stderr
    assert reply_of(result)["status"] == "Success"
    assert listener.connections(at_least=1) >= 1
    requests = calls_by_request(log_file)
    assert requests[0][0] == "_Move" and requests[0][1][-1] == "local_mode()"
    assert requests[-1] == ("<end>", ["local_mode()", "disconnect()"])
    assert f"Connection to 127.0.0.1:{listener.port} closed" in log_file.read_text(encoding="utf-8")


def test_call_to_a_machine_that_is_not_reachable_is_503(tmp_path, log_file, closed_port):
    from wptool.config import MachineConfig

    config = write_config(tmp_path / "machine.json", log_file, MachineConfig("127.0.0.1", closed_port))
    result = run_tool(["call", "--config", str(config), "LocalMode"], cwd=tmp_path, env=SEAM)
    assert result.returncode == 1
    assert reply_of(result)["error"] == {"code": 503, "message": f"The machine at 127.0.0.1:{closed_port} is not reachable"}
    assert machine_calls(log_file) == []


def test_call_to_a_machine_that_another_wptool_holds_is_409(tmp_path, log_file, listener, serve_tool):
    holder_config = write_config(tmp_path / "holder.json", log_file.with_name("holder.log"))
    holder = serve_tool(config=holder_config, env=SEAM)
    holder.read()
    holder.read()
    reply = holder.request({"id": "1", "command": "Initialize", "params": {"address": "127.0.0.1", "port": listener.port}})
    assert reply["status"] == "Success"
    holder.read()  # status
    pid = holder.request({"id": "p", "command": "_Pid"})["data"]["pid"]
    config = write_config(tmp_path / "machine.json", log_file, listener.machine)
    result = run_tool(["call", "--config", str(config), "_Move"], cwd=tmp_path, env=SEAM)
    assert result.returncode == 1
    assert reply_of(result)["error"] == {
        "code": 409,
        "message": f"The machine at 127.0.0.1:{listener.port} is used by another wptool (process {pid})",
    }
    assert machine_calls(log_file) == []

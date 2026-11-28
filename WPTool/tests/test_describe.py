"""describe: the command list of the tool contract, with the fields of the WP tool."""

import json
import tomllib
from pathlib import Path

from conftest import run_tool

from wptool import __version__
from wptool.modes.describe import describe_tool

COMMAND_FIELDS = ["name", "summary", "level", "changesMachine", "context", "params", "kind", "movesChuck", "long"]


def test_describe_without_the_test_commands(tmp_path):
    result = run_tool(["describe"], cwd=tmp_path, testing=False)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout.decode("utf-8"))
    assert out["tool"] == "wp-tool"
    assert out["version"] == __version__ == "0.1.0"
    assert out["contract"] == "0.1"
    assert [command["name"] for command in out["commands"]] == ["ShowStatus", "Shutdown"]
    for command in out["commands"]:
        assert list(command) == COMMAND_FIELDS
        assert command["level"] == "User"
        assert command["kind"] == "OFFLINE"
        assert command["changesMachine"] is False
        assert command["movesChuck"] is False
        assert command["long"] is False
        assert command["context"] == []
        assert command["params"] == {}
    # No config, no log file.
    assert list(tmp_path.iterdir()) == []


def test_describe_ends_its_lines_with_newline_only(tmp_path):
    result = run_tool(["describe"], cwd=tmp_path, testing=False)
    assert b"\r\n" not in result.stdout
    assert result.stdout.endswith(b"}\n")


def test_the_test_commands_and_every_field_of_a_parameter():
    commands = {command["name"]: command for command in describe_tool()["commands"]}
    assert {"_Echo", "_Fail", "_Print", "_Progress", "_Wait", "_Interrupt"} <= set(commands)
    params = commands["_Echo"]["params"]
    assert params["text"] == {"type": "string", "required": False}
    assert params["number"] == {"type": "number", "required": False, "description": "any number"}
    assert params["orientation"] == {"type": "string", "required": False, "choices": ["West", "East", "North", "South"], "ignoreCase": True}
    assert params["level"] == {"type": "integer", "required": False, "minimum": 0, "maximum": 10}
    assert params["mode"] == {"type": "string", "required": False, "default": "normal", "choices": ["normal", "fast"]}
    assert commands["_Wait"]["params"]["seconds"]["required"] is True
    assert commands["_Wait"]["long"] is True


def test_the_commands_are_sorted_by_name():
    names = [command["name"] for command in describe_tool()["commands"]]
    assert names == sorted(names)


def test_the_version_is_the_one_of_the_package():
    pyproject = tomllib.loads((Path(__file__).parent.parent / "pyproject.toml").read_text(encoding="utf-8"))
    assert pyproject["project"]["version"] == __version__

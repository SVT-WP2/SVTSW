"""The config file: two optional keys, checked by hand; a wrong config stops the tool with exit code 2."""

import json

import pytest

from wptool import cli
from wptool.config import DEFAULT_LOG, Config, ConfigError, MachineConfig, load_config, parse_config

# The example of the plan, "Config file".
PLAN_EXAMPLE = """\
machine:                    # the default of Initialize (and of the mode call): where SENTIO listens
  address: 192.0.2.10       # an example address; never commit a real one
  port: 35555
log: wptool.log
"""


def test_the_example_of_the_plan_loads(tmp_path):
    path = tmp_path / "wptool.yaml"
    path.write_text(PLAN_EXAMPLE, encoding="utf-8")
    config = load_config(path, mock=False)
    assert config.machine == MachineConfig(address="192.0.2.10", port=35555)
    assert config.machine.address == "192.0.2.10" and config.machine.port == 35555
    assert config.log == "wptool.log"
    assert config.mock is False
    assert config.path == str(path)


def test_the_same_as_json(tmp_path):
    path = tmp_path / "wptool.json"
    # A JSON file is read as JSON: tabs are fine, which YAML refuses.
    path.write_text('{\n\t"machine": {"address": "192.0.2.10", "port": 35555},\n\t"log": "tool.log"\n}', encoding="utf-8")
    config = load_config(path, mock=True)
    assert config.machine == MachineConfig("192.0.2.10", 35555)
    assert config.log == "tool.log"
    assert config.mock is True


def test_a_byte_order_mark_is_dropped(tmp_path):
    path = tmp_path / "wptool.yaml"
    path.write_bytes("﻿log: x.log\n".encode("utf-8"))
    assert load_config(path, mock=False).log == "x.log"


def test_no_config():
    assert load_config(None, mock=False) == Config(machine=None, log=DEFAULT_LOG, mock=False, path=None)
    assert load_config(None, mock=True).mock is True


@pytest.mark.parametrize("text", ["", "# only a comment\n", "machine:\nlog:\n"])
def test_defaults(tmp_path, text):
    path = tmp_path / "wptool.yaml"
    path.write_text(text, encoding="utf-8")
    config = load_config(path, mock=False)
    assert config.machine is None
    assert config.log == "wptool.log"


ERRORS = [
    # The keys of draft plans are not keys of the config (D10).
    ({"setup": {"contactHeight": 100}}, "config: unknown key 'setup'"),
    ({"alignment": {"project": "x"}}, "config: unknown key 'alignment'"),
    ({"machine": {"address": "192.0.2.10", "port": 35555, "name": "machine-1"}}, "config: unknown key 'machine.name'"),
    ({"machine": {"address": "192.0.2.10", "port": "35555"}}, "config: machine.port must be an integer from 1 to 65535"),
    ({"machine": {"address": "192.0.2.10", "port": 0}}, "config: machine.port must be an integer from 1 to 65535"),
    ({"machine": {"address": "192.0.2.10", "port": 65536}}, "config: machine.port must be an integer from 1 to 65535"),
    ({"machine": {"address": "192.0.2.10", "port": True}}, "config: machine.port must be an integer from 1 to 65535"),
    ({"machine": {"address": "192.0.2.10", "port": 35555.0}}, "config: machine.port must be an integer from 1 to 65535"),
    ({"machine": {"address": "192.0.2.10"}}, "config: machine.port is missing"),
    ({"machine": {"port": 35555}}, "config: machine.address is missing"),
    ({"machine": {"address": 19202, "port": 35555}}, "config: machine.address must be a text"),
    ({"machine": {"address": " ", "port": 35555}}, "config: machine.address must be a text"),
    ({"machine": "192.0.2.10:35555"}, "config: machine must be a map"),
    ({"log": 5}, "config: log must be the path of a file"),
    ({"log": ""}, "config: log must be the path of a file"),
    (["machine"], "config: the file must be a map"),
]


@pytest.mark.parametrize("raw, message", ERRORS)
def test_each_error_names_its_key(raw, message):
    with pytest.raises(ConfigError) as e:
        parse_config(raw)
    assert str(e.value).startswith(message)


@pytest.mark.parametrize("raw, message", ERRORS)
@pytest.mark.parametrize("mode", [["shell"], ["serve"], ["call"], ["run", "steps.yaml"]])
def test_each_error_ends_the_tool_with_exit_code_2(tmp_path, capsys, raw, message, mode):
    path = tmp_path / "wptool.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    args = [*mode, "--config", str(path)]
    if mode == ["call"]:
        args.append("ShowStatus")
    assert cli.main(args) == 2
    captured = capsys.readouterr()
    assert message in captured.err
    assert captured.out == ""


@pytest.mark.parametrize(
    "content, message",
    [
        (None, "config: cannot read"),
        ("machine: [unclosed\n", "is not valid YAML"),
        (b"log: \xff\n", "it is not UTF-8"),
    ],
)
def test_a_file_that_cannot_be_read_gives_exit_code_2(tmp_path, capsys, content, message):
    path = tmp_path / "wptool.yaml"
    if isinstance(content, bytes):
        path.write_bytes(content)
    elif content is not None:
        path.write_text(content, encoding="utf-8")
    assert cli.main(["shell", "--config", str(path)]) == 2
    assert message in capsys.readouterr().err


def test_a_log_file_that_cannot_be_opened_gives_exit_code_2(tmp_path, capsys):
    path = tmp_path / "wptool.yaml"
    path.write_text(f"log: {json.dumps(str(tmp_path / 'no-such-folder' / 'wptool.log'))}\n", encoding="utf-8")
    assert cli.main(["shell", "--config", str(path)]) == 2
    assert "config: log: cannot open" in capsys.readouterr().err


def test_the_log_goes_to_the_file_of_the_config(tmp_path, call_tool, log_file):
    result = call_tool("ShowStatus")
    assert result.returncode == 0
    text = log_file.read_text(encoding="utf-8")
    assert "command=ShowStatus" in text
    # No log file in the working directory.
    assert not (tmp_path / "wptool.log").exists()

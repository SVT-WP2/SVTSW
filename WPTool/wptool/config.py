"""The config file (`--config`): YAML or JSON, two optional keys, checked by hand (the plan, "Config file").

```yaml
machine:              # the default of Initialize (and of call): where SENTIO listens
  address: 192.0.2.10 # an example address; never commit a real one
  port: 35555
log: wptool.log
```

Nothing else: every other input is a parameter of its command (D10). A wrong config stops the tool at start with a
message that names the key, and exit code 2.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from wptool.data import DataFileError, load_data_file

DEFAULT_LOG = "wptool.log"
KEYS = ("machine", "log")
MACHINE_KEYS = ("address", "port")


class ConfigError(Exception):
    """A config that cannot be read or does not pass the check. The message starts with `config:`."""


@dataclass(frozen=True)
class MachineConfig:
    address: str
    port: int


@dataclass(frozen=True)
class Config:
    machine: MachineConfig | None = None  # None: Initialize needs address and port as parameters (or --mock)
    log: str = DEFAULT_LOG  # the log file; a relative path is relative to the working directory
    mock: bool = False  # --mock: the machine is the simulator (#408)
    path: str | None = None  # the file it came from


def load_config(path: str | Path | None, mock: bool) -> Config:
    """The checked config of the file `path`, or the defaults when there is no file. Raises `ConfigError`."""
    if path is None:
        return Config(mock=mock)
    try:
        raw = load_data_file(path)
    except DataFileError as e:
        raise ConfigError(f"config: {e}") from None
    return parse_config(raw, mock=mock, path=str(path))


def parse_config(raw: Any, mock: bool = False, path: str | None = None) -> Config:
    """Check the data of a config file. An empty file is the defaults."""
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ConfigError("config: the file must be a map with the keys machine and log")
    for key in raw:
        if key not in KEYS:
            raise ConfigError(f"config: unknown key '{key}' (the keys are machine and log; every other input is a parameter of its command)")
    machine = _machine(raw.get("machine"))
    log = raw.get("log")
    if log is None:
        log = DEFAULT_LOG
    elif not isinstance(log, str) or not log.strip():
        raise ConfigError("config: log must be the path of a file")
    return Config(machine=machine, log=log, mock=mock, path=path)


def _machine(raw: Any) -> MachineConfig | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ConfigError("config: machine must be a map with the keys address and port")
    for key in raw:
        if key not in MACHINE_KEYS:
            raise ConfigError(f"config: unknown key 'machine.{key}' (the keys of machine are address and port)")
    address = raw.get("address")
    port = raw.get("port")
    if address is None:
        raise ConfigError("config: machine.address is missing")
    if not isinstance(address, str) or not address.strip():
        raise ConfigError("config: machine.address must be a text, for example 192.0.2.10")
    if port is None:
        raise ConfigError("config: machine.port is missing")
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise ConfigError("config: machine.port must be an integer from 1 to 65535")
    return MachineConfig(address=address.strip(), port=port)

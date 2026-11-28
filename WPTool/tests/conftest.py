"""Fixtures of the tests of the WP tool. No network, no prober.

WPTOOL_TESTING=1 is set before wptool is imported, so that the test-only commands (`_Echo`, `_Fail`, `_Move`, ...)
are registered, here and in every tool process that a test starts. Every log goes to a temporary folder, and so do the
lock files (WPTOOL_TEST_LOCK_DIR, for each test; the tool processes of a test share it).
"""

import os

os.environ["WPTOOL_TESTING"] = "1"

import json
import queue
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

import wptool.commands  # noqa: F401  (every command, with the test-only ones, for every test file alone too)
from wptool.config import Config, MachineConfig
from wptool.engine import Engine
from wptool.events import MemorySink
from wptool.registry import REGISTRY, Kind, Level, command

TIMEOUT_S = 30
SEAM = {"WPTOOL_TEST_MACHINE": "sim-over-tcp"}


def tool_env(testing: bool = True, extra: dict | None = None) -> dict:
    env = dict(os.environ)
    if testing:
        env["WPTOOL_TESTING"] = "1"
    else:
        env.pop("WPTOOL_TESTING", None)
    env.update(extra or {})
    # Standard streams that are not UTF-8, on every system and every Python (3.15 is in UTF-8 mode by default; on
    # Windows a pipe has the code page): the tool must set UTF-8 itself (wptool/logs.py).
    env["PYTHONIOENCODING"] = "ascii"
    env["PYTHONUTF8"] = "0"
    return env


def run_tool(
    args: list[str], cwd: Path, stdin: bytes | None = None, testing: bool = True, env: dict | None = None
) -> subprocess.CompletedProcess:
    """`python -m wptool <args>` in its own process; stdout and stderr as bytes. `env`: more variables."""
    return subprocess.run(
        [sys.executable, "-m", "wptool", *args],
        cwd=cwd,
        input=stdin,
        capture_output=True,
        env=tool_env(testing, env),
        timeout=TIMEOUT_S,
    )


@pytest.fixture(autouse=True)
def lock_dir(tmp_path: Path, monkeypatch) -> Path:
    """The lock files of every test in its own folder: never in the folder shared by the users of the computer."""
    folder = tmp_path / "locks"
    monkeypatch.setenv("WPTOOL_TEST_LOCK_DIR", str(folder))
    return folder


@pytest.fixture
def seam(monkeypatch) -> None:
    """The test seam in this process: a real address (TCP check, lock), the simulator behind it."""
    for key, value in SEAM.items():
        monkeypatch.setenv(key, value)


class Listener:
    """A local TCP listener on a free port: the stand-in for SENTIO's port with the test seam. It sends nothing."""

    def __init__(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(32)
        self.port = self.sock.getsockname()[1]
        self.accepted = 0
        self._conns = []
        self._thread = threading.Thread(target=self._accept, daemon=True)
        self._thread.start()

    @property
    def machine(self) -> MachineConfig:
        return MachineConfig(address="127.0.0.1", port=self.port)

    def connections(self, at_least: int = 0, settle_s: float = 0.3) -> int:
        """The number of accepted connections, once the thread had time to accept them: it waits for `at_least`
        (up to TIMEOUT_S), then `settle_s` more for any later one."""
        deadline = time.monotonic() + TIMEOUT_S
        while self.accepted < at_least and time.monotonic() < deadline:
            time.sleep(0.02)
        time.sleep(settle_s)
        return self.accepted

    def _accept(self):
        while True:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            self.accepted += 1
            self._conns.append(conn)

    def close(self):
        """Stop listening: a connect to the port is refused from now on."""
        try:
            # Linux: close() alone does not wake the accept() of the thread, and the port would still listen.
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass  # Windows: a listening socket has no connection to shut down; close() is enough there
        self.sock.close()
        self._thread.join(timeout=TIMEOUT_S)
        for conn in self._conns:
            conn.close()


@pytest.fixture
def listener():
    started = Listener()
    yield started
    started.close()


@pytest.fixture
def closed_port() -> int:
    """A local port where nothing listens (bound, then closed)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


@pytest.fixture
def mock_config(log_file: Path) -> Config:
    return Config(log=str(log_file), mock=True)


@pytest.fixture
def mock_engine(mock_config, sink):
    """An engine with --mock; `mock_engine.connection.simulator` is its simulator. Closed at the end of the test."""
    engine = Engine(mock_config, events=sink)
    yield engine
    engine.connection.close()


def write_config(path: Path, log_file: Path, machine: MachineConfig | None = None) -> Path:
    """A config file with the log and, when given, the machine."""
    data = {"log": str(log_file)}
    if machine is not None:
        data["machine"] = {"address": machine.address, "port": machine.port}
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def log_lines(log_file: Path, part: str = "") -> list[str]:
    """The lines of a log file that contain `part`, without their date and time."""
    if not log_file.exists():
        return []
    lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
    return [line.split(" ", 2)[2] for line in lines if part in line and line.count(" ") >= 2]


MACHINE_MARK = "wptool.machine: machine: "
REQUEST_MARK = "INFO wptool.engine: id="


def machine_calls(log_file: Path) -> list[str]:
    """The machine calls of a tool process, from its log (DEBUG): `local_mode()`, `disconnect()`, ..."""
    return [line.split(MACHINE_MARK, 1)[1] for line in log_lines(log_file, MACHINE_MARK) if " failed: " not in line]


def calls_by_request(log_file: Path) -> list[tuple[str, list[str]]]:
    """(command, its machine calls) for each request of a tool process, from its log; the calls after the last
    request (the close at the end) as ("<end>", calls).

    The engine logs the line of a request after its finish, so the calls of a request come before its line.
    """
    out: list[tuple[str, list[str]]] = []
    pending: list[str] = []
    for line in log_lines(log_file):
        if MACHINE_MARK in line and " failed: " not in line:
            pending.append(line.split(MACHINE_MARK, 1)[1])
        elif REQUEST_MARK in line:
            command = line.split(" command=", 1)[1].split(" ", 1)[0]
            out.append((command, pending))
            pending = []
    out.append(("<end>", pending))
    return out


@pytest.fixture
def log_file(tmp_path: Path) -> Path:
    """The log of a test: in its own folder, not in the working directory of the tool processes (tmp_path)."""
    folder = tmp_path / "log"
    folder.mkdir()
    return folder / "wptool.log"


@pytest.fixture
def config(log_file: Path) -> Config:
    return Config(log=str(log_file))


@pytest.fixture
def config_file(tmp_path: Path, log_file: Path) -> Path:
    """A config file with only the log, in the temporary folder."""
    path = tmp_path / "config.yaml"
    path.write_text(f"log: {json.dumps(str(log_file))}\n", encoding="utf-8")
    return path


@pytest.fixture
def sink() -> MemorySink:
    return MemorySink()


@pytest.fixture
def temp_command():
    """Register commands for one test only: `@temp_command("_Name", **options)` over a command function."""
    names = []

    def register(name, **kwargs):
        kwargs.setdefault("summary", "Test")
        kwargs.setdefault("kind", Kind.OFFLINE)
        kwargs.setdefault("level", Level.DEVELOPER)

        def decorate(func):
            names.append(name)
            return command(name=name, **kwargs)(func)

        return decorate

    yield register
    for name in names:
        REGISTRY.pop(name, None)


@pytest.fixture
def connect_commands(temp_command):
    """`_Connect` and `_Disconnect`: change the state as Initialize and Disconnect do, without a connection (for the
    status lines and events only)."""

    @temp_command("_Connect")
    def connect(ctx):
        ctx.state.machine = {"address": "192.0.2.10", "port": 35555}
        ctx.state.proberConnected = True
        return {"message": "Connected"}

    @temp_command("_Disconnect")
    def disconnect(ctx):
        ctx.state.proberConnected = False
        return {"message": "Disconnected"}


@pytest.fixture
def call_tool(tmp_path: Path, config_file: Path):
    """`wptool call --config <tmp config> <words...>` in its own process."""

    def call(*words: str, testing: bool = True) -> subprocess.CompletedProcess:
        return run_tool(["call", "--config", str(config_file), *words], cwd=tmp_path, testing=testing)

    return call


class ServeProcess:
    """`wptool serve` in its own process, with its output read line by line as raw bytes."""

    def __init__(self, cwd: Path, config_file: Path, args: list[str] | None = None, env: dict | None = None, creationflags: int = 0):
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "wptool", "serve", "--config", str(config_file), *(args or [])],
            cwd=cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=tool_env(extra=env),
            creationflags=creationflags,
        )
        self._lines: queue.Queue = queue.Queue()
        self.stderr = bytearray()
        threading.Thread(target=self._read_stdout, daemon=True).start()
        threading.Thread(target=self._read_stderr, daemon=True).start()

    def _read_stdout(self):
        for line in iter(self.proc.stdout.readline, b""):
            self._lines.put(line)
        self._lines.put(None)

    def _read_stderr(self):
        for chunk in iter(lambda: self.proc.stderr.read1(4096), b""):
            self.stderr.extend(chunk)

    def send(self, request) -> None:
        line = request if isinstance(request, bytes) else json.dumps(request).encode("utf-8") + b"\n"
        self.proc.stdin.write(line)
        self.proc.stdin.flush()

    def read_raw(self) -> bytes | None:
        """The next line of the standard output with its end of line, or None at its end."""
        try:
            return self._lines.get(timeout=TIMEOUT_S)
        except queue.Empty:
            raise AssertionError(f"no line from serve in {TIMEOUT_S} s; stderr: {self.stderr.decode('utf-8', 'replace')}") from None

    def read(self) -> dict:
        raw = self.read_raw()
        assert raw is not None, f"serve ended; stderr: {self.stderr.decode('utf-8', 'replace')}"
        return json.loads(raw.decode("utf-8"))

    def request(self, request) -> dict:
        self.send(request)
        return self.read()

    def close_input(self) -> None:
        self.proc.stdin.close()

    def wait(self) -> int:
        return self.proc.wait(timeout=TIMEOUT_S)

    def rest(self) -> list[bytes]:
        """Every line left on the standard output, after the process ended."""
        lines = []
        while (raw := self.read_raw()) is not None:
            lines.append(raw)
        return lines

    def kill(self) -> None:
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait(timeout=TIMEOUT_S)


@pytest.fixture
def serve_tool(tmp_path: Path, config_file: Path):
    """Start `wptool serve`; every process is killed at the end of the test if it still runs.

    `start(*args, config=<file>, env={...}, creationflags=0)`: another config file, more variables.
    """
    started = []

    def start(*args: str, config: Path | None = None, env: dict | None = None, creationflags: int = 0) -> ServeProcess:
        process = ServeProcess(tmp_path, config or config_file, list(args), env=env, creationflags=creationflags)
        started.append(process)
        return process

    yield start
    for process in started:
        process.kill()

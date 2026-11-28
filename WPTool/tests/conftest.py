"""Fixtures of the tests of the WP tool. No network, no prober.

WPTOOL_TESTING=1 is set before wptool is imported, so that the test-only commands (`_Echo`, `_Fail`, ...) are
registered, here and in every tool process that a test starts. Every log goes to a temporary folder.
"""

import os

os.environ["WPTOOL_TESTING"] = "1"

import json
import queue
import subprocess
import sys
import threading
from pathlib import Path

import pytest

import wptool.commands  # noqa: F401  (every command, with the test-only ones, for every test file alone too)
from wptool.config import Config
from wptool.events import MemorySink

TIMEOUT_S = 30


def tool_env(testing: bool = True) -> dict:
    env = dict(os.environ)
    if testing:
        env["WPTOOL_TESTING"] = "1"
    else:
        env.pop("WPTOOL_TESTING", None)
    # Standard streams that are not UTF-8, on every system and every Python (3.15 is in UTF-8 mode by default; on
    # Windows a pipe has the code page): the tool must set UTF-8 itself (wptool/logs.py).
    env["PYTHONIOENCODING"] = "ascii"
    env["PYTHONUTF8"] = "0"
    return env


def run_tool(args: list[str], cwd: Path, stdin: bytes | None = None, testing: bool = True) -> subprocess.CompletedProcess:
    """`python -m wptool <args>` in its own process; stdout and stderr as bytes."""
    return subprocess.run(
        [sys.executable, "-m", "wptool", *args],
        cwd=cwd,
        input=stdin,
        capture_output=True,
        env=tool_env(testing),
        timeout=TIMEOUT_S,
    )


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
def call_tool(tmp_path: Path, config_file: Path):
    """`wptool call --config <tmp config> <words...>` in its own process."""

    def call(*words: str, testing: bool = True) -> subprocess.CompletedProcess:
        return run_tool(["call", "--config", str(config_file), *words], cwd=tmp_path, testing=testing)

    return call


class ServeProcess:
    """`wptool serve` in its own process, with its output read line by line as raw bytes."""

    def __init__(self, cwd: Path, config_file: Path, args: list[str] | None = None):
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "wptool", "serve", "--config", str(config_file), *(args or [])],
            cwd=cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=tool_env(),
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
    """Start `wptool serve`; every process is killed at the end of the test if it still runs."""
    started = []

    def start(*args: str) -> ServeProcess:
        process = ServeProcess(tmp_path, config_file, list(args))
        started.append(process)
        return process

    yield start
    for process in started:
        process.kill()

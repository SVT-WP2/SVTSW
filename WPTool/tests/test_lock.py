"""One wptool per machine on this computer (D20): the lock, also across tool processes, with the test seam and a local
TCP listener as the machine."""

import os
import re
import stat
import sys
import time

import pytest
from conftest import SEAM, write_config

from wptool import lock as lock_module
from wptool.config import Config
from wptool.connection import Connection
from wptool.engine import Engine, Request
from wptool.lock import MachineLock, lock_dir, lock_name, read_holder
from wptool.replies import ToolError
from wptool.state import ToolState

RETRY_S = 5.0


def initialize(process, request_id, port, force=False):
    params = {"address": "127.0.0.1", "port": port}
    if force:
        params["force"] = True
    return process.request({"id": request_id, "command": "Initialize", "params": params})


def start_serve(serve_tool, tmp_path, log_file, name):
    config = write_config(tmp_path / f"{name}.json", log_file.with_name(f"{name}.log"))
    process = serve_tool(config=config, env=SEAM)
    assert process.read()["event"] == "ready"
    process.read()
    return process


def initialize_until_free(process, port):
    """Initialize, again until the lock is free (the system may release it a moment after the holder ended)."""
    deadline = time.monotonic() + RETRY_S
    number = 0
    while True:
        number += 1
        reply = initialize(process, f"retry-{number}", port)
        if reply["status"] == "Success" or time.monotonic() > deadline:
            return reply
        assert reply["error"]["code"] == 409, reply
        time.sleep(0.2)


# Across tool processes


def test_the_second_wptool_gets_409_with_the_process_id_of_the_first(serve_tool, tmp_path, log_file, listener):
    first = start_serve(serve_tool, tmp_path, log_file, "first")
    second = start_serve(serve_tool, tmp_path, log_file, "second")
    assert initialize(first, "1", listener.port)["status"] == "Success"
    first.read()  # status
    reply = initialize(second, "2", listener.port)
    # The process id of the Python of the first tool (on Windows, Popen's pid of a venv is a launcher's).
    pid = first.request({"id": "p", "command": "_Pid"})["data"]["pid"]
    assert reply["error"] == {
        "code": 409,
        "message": f"The machine at 127.0.0.1:{listener.port} is used by another wptool (process {pid})",
    }
    # Nothing reached the machine for the second one: not even its TCP check (the lock comes first).
    assert listener.connections(at_least=1) == 1


def test_after_the_first_ends_the_second_gets_the_lock(serve_tool, tmp_path, log_file, listener):
    first = start_serve(serve_tool, tmp_path, log_file, "first")
    second = start_serve(serve_tool, tmp_path, log_file, "second")
    assert initialize(first, "1", listener.port)["status"] == "Success"
    first.read()
    assert first.request({"id": "2", "command": "Shutdown"})["status"] == "Success"
    assert first.wait() == 0
    assert initialize_until_free(second, listener.port)["status"] == "Success"


def test_after_the_first_is_killed_the_second_gets_the_lock(serve_tool, tmp_path, log_file, listener):
    first = start_serve(serve_tool, tmp_path, log_file, "first")
    second = start_serve(serve_tool, tmp_path, log_file, "second")
    assert initialize(first, "1", listener.port)["status"] == "Success"
    first.read()
    first.kill()
    assert initialize_until_free(second, listener.port)["status"] == "Success"


def test_after_disconnect_the_second_gets_the_lock(serve_tool, tmp_path, log_file, listener):
    first = start_serve(serve_tool, tmp_path, log_file, "first")
    second = start_serve(serve_tool, tmp_path, log_file, "second")
    assert initialize(first, "1", listener.port)["status"] == "Success"
    first.read()
    assert first.request({"id": "2", "command": "Disconnect"})["status"] == "Success"
    first.read()
    assert initialize_until_free(second, listener.port)["status"] == "Success"
    second.read()
    # Now the first one is refused.
    assert initialize(first, "3", listener.port)["error"]["code"] == 409


def test_force_on_the_machine_the_process_holds_succeeds(serve_tool, tmp_path, log_file, listener):
    process = start_serve(serve_tool, tmp_path, log_file, "one")
    assert initialize(process, "1", listener.port)["status"] == "Success"
    process.read()
    assert initialize(process, "2", listener.port, force=True)["data"]["message"] == f"Initialized 127.0.0.1:{listener.port}"


def test_a_failed_connect_leaves_no_lock_behind(serve_tool, tmp_path, log_file, closed_port):
    process = start_serve(serve_tool, tmp_path, log_file, "one")
    assert initialize(process, "1", closed_port)["error"]["code"] == 503
    # Another process (this test) can take it at once.
    MachineLock.acquire("127.0.0.1", closed_port).release()


def test_mock_takes_no_lock(serve_tool, tmp_path, log_file, lock_dir):
    config = write_config(tmp_path / "mock.json", log_file)
    process = serve_tool("--mock", config=config)
    process.read()
    process.read()
    assert process.request({"id": "1", "command": "Initialize"})["status"] == "Success"
    assert not lock_dir.exists() or list(lock_dir.iterdir()) == []


# In this process


def test_a_reconnect_to_the_same_address_keeps_its_lock(seam, listener, log_file):
    engine = Engine(Config(log=str(log_file), machine=listener.machine))
    try:
        assert engine.execute(Request(command="Initialize")).ok
        held = engine.connection.lock
        assert held.held
        assert engine.execute(Request(command="Initialize", params={"force": True})).ok
        assert engine.connection.lock is held and held.held
    finally:
        engine.connection.close()
    assert not held.held


def test_a_reconnect_to_another_address_takes_the_new_lock_first_and_releases_the_old_one_after_the_close(seam, listener, log_file):
    from conftest import Listener

    other = Listener()
    state = ToolState()
    connection = Connection(Config(log=str(log_file)), state)
    try:
        connection.open(listener.machine)
        old_lock = connection.lock
        old_machine = connection.machine
        events = []
        original_release = old_lock.release

        def release():
            # The old connection is closed before its lock is released.
            events.append(("release", old_machine._driver.connected))
            original_release()

        old_lock.release = release
        connection.open(other.machine)
        assert events == [("release", False)]
        assert connection.lock is not old_lock and connection.lock.held and not old_lock.held
    finally:
        connection.close()
        other.close()


def test_a_reconnect_to_another_address_that_fails_keeps_the_old_lock_and_releases_the_new(seam, listener, closed_port, log_file):
    from wptool.config import MachineConfig

    connection = Connection(Config(log=str(log_file)), ToolState())
    try:
        connection.open(listener.machine)
        old_lock = connection.lock
        with pytest.raises(ToolError) as e:
            connection.open(MachineConfig("127.0.0.1", closed_port))
        assert e.value.code == 503
        assert connection.lock is old_lock and old_lock.held
        # The lock of the failed address is free.
        MachineLock.acquire("127.0.0.1", closed_port).release()
    finally:
        connection.close()


def test_two_locks_on_one_machine_in_one_process():
    first = MachineLock.acquire("192.0.2.10", 35555)
    try:
        with pytest.raises(ToolError) as e:
            MachineLock.acquire("192.0.2.10", 35555)
        assert (e.value.code, e.value.message) == (409, f"The machine at 192.0.2.10:35555 is used by another wptool (process {os.getpid()})")
        # The failed open did not empty the file of the holder.
        assert read_holder(first.path) == str(os.getpid())
        # Another machine is another lock.
        MachineLock.acquire("192.0.2.10", 35556).release()
    finally:
        first.release()
    MachineLock.acquire("192.0.2.10", 35555).release()


def test_release_is_safe_twice_and_keeps_the_file():
    held = MachineLock.acquire("192.0.2.10", 35555)
    held.release()
    held.release()
    assert held.path.exists()


@pytest.mark.parametrize(
    "address, name",
    [
        ("192.0.2.10", "wptool-192.0.2.10-35555.lock"),
        ("::1", "wptool-__1-35555.lock"),
        ("fe80::1%eth0", "wptool-fe80__1_eth0-35555.lock"),
        ("Prober-1.Example", "wptool-prober-1.example-35555.lock"),
        ("a/b\\c:d e", "wptool-a_b_c_d_e-35555.lock"),
    ],
)
def test_the_file_name_of_an_address(address, name):
    assert lock_name(address, 35555) == name
    assert re.fullmatch(r"wptool-[a-z0-9._-]+-\d+\.lock", name)


def test_an_address_with_colons_gives_a_valid_file(lock_dir):
    held = MachineLock.acquire("::1", 35555)
    try:
        assert held.path == lock_dir / "wptool-__1-35555.lock"
        assert held.path.is_file()
        assert read_holder(held.path) == str(os.getpid())
    finally:
        held.release()


def test_the_process_id_is_written_from_byte_1():
    held = MachineLock.acquire("192.0.2.10", 35555)
    try:
        data = held.path.read_bytes()
    except PermissionError:
        # Windows: byte 0 is locked; the rest can be read.
        with open(held.path, "rb") as file:
            file.seek(1)
            data = b"?" + file.read()
    finally:
        held.release()
    assert data[1:] == f"{os.getpid()}\n".encode("ascii")


@pytest.mark.skipif(sys.platform == "win32", reason="the mode of a folder is a Linux matter")
def test_the_folder_is_made_for_every_user(tmp_path, monkeypatch):
    folder = tmp_path / "shared" / "wptool"
    monkeypatch.setenv("WPTOOL_TEST_LOCK_DIR", str(folder))
    held = MachineLock.acquire("192.0.2.10", 35555)
    try:
        assert stat.S_IMODE(folder.stat().st_mode) == 0o1777
        assert stat.S_IMODE(held.path.stat().st_mode) == 0o666
    finally:
        held.release()


def test_the_shared_folder_of_the_computer(monkeypatch):
    monkeypatch.delenv("WPTOOL_TEST_LOCK_DIR")
    if sys.platform == "win32":
        assert lock_dir() == lock_module.Path(os.environ["ProgramData"]) / "wptool"
    else:
        assert str(lock_dir()) == "/tmp/wptool"
    # Without WPTOOL_TESTING=1 the test folder is ignored.
    monkeypatch.setenv("WPTOOL_TEST_LOCK_DIR", "elsewhere")
    monkeypatch.setenv("WPTOOL_TESTING", "0")
    assert lock_dir().name == "wptool"


def test_a_lock_in_the_shared_folder_of_the_computer(monkeypatch):
    """The real folder works (%ProgramData%\\wptool or /tmp/wptool); the file of this test is removed after."""
    monkeypatch.delenv("WPTOOL_TEST_LOCK_DIR")
    address = f"wptool-test-{os.getpid()}-{time.monotonic_ns()}"
    held = MachineLock.acquire(address, 1)
    try:
        assert held.path.parent == lock_dir()
        with pytest.raises(ToolError):
            MachineLock.acquire(address, 1)
    finally:
        held.release()
        held.path.unlink()


def test_a_file_that_cannot_be_opened_is_500(tmp_path, monkeypatch):
    blocker = tmp_path / "not-a-folder"
    blocker.write_text("x", encoding="utf-8")
    monkeypatch.setenv("WPTOOL_TEST_LOCK_DIR", str(blocker))
    with pytest.raises(ToolError) as e:
        MachineLock.acquire("192.0.2.10", 35555)
    assert e.value.code == 500
    assert e.value.message.startswith("Failed to connect: cannot open the lock file")

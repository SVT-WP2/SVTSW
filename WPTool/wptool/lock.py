"""One `wptool` per machine on this computer (D20): a lock file per machine, with the lock of the operating system.

The lock goes away by itself when the process ends, also when it is killed. It does not see WPAgent, nor a tool on
another computer (D20).

- The file: `wptool-<address>-<port>.lock` in a folder shared by all users of the computer: `%ProgramData%\\wptool\\`
  on Windows, `/tmp/wptool/` on Linux (made with mode 0o1777). In the address, every character other than a letter, a
  digit, `.` and `-` becomes `_` (an IPv6 address has `:`), and letters are made small (host names have no case, and
  the files of Windows have none either).
- It is opened with `os.open(..., os.O_RDWR | os.O_CREAT, 0o666)`, never with "w", which would empty the file of the
  holder. It is first opened without `O_CREAT`: Linux refuses `O_CREAT` on a file of another user in a shared folder
  with the sticky bit (fs.protected_regular), even when the mode allows it. On Windows also with `O_BINARY`.
- The lock is taken without waiting: `fcntl.flock(fd, LOCK_EX | LOCK_NB)` on Linux, `msvcrt.locking(fd, LK_NBLCK, 1)`
  on byte 0 on Windows. Then the process id is written from byte 1 on, so that another process can read it while
  byte 0 is locked (Windows locks are mandatory).
- The file stays when the lock is released: removing it would let two processes lock two different files.

For the tests, with WPTOOL_TESTING=1, WPTOOL_TEST_LOCK_DIR names another folder (so that tests leave nothing in the
shared folder). Without WPTOOL_TESTING=1 it is ignored.
"""

from __future__ import annotations

import errno
import logging
import os
import re
import sys
from pathlib import Path

from wptool.replies import conflict, failed

log = logging.getLogger("wptool.lock")

WINDOWS = sys.platform == "win32"
if WINDOWS:
    import msvcrt
else:
    import fcntl

# The errors of a lock that another process holds.
HELD = {errno.EACCES, errno.EAGAIN, errno.EWOULDBLOCK, errno.EDEADLK}


def lock_dir() -> Path:
    """The folder of the lock files, shared by all users of the computer."""
    if os.environ.get("WPTOOL_TESTING") == "1" and os.environ.get("WPTOOL_TEST_LOCK_DIR"):
        return Path(os.environ["WPTOOL_TEST_LOCK_DIR"])
    if WINDOWS:
        return Path(os.environ.get("ProgramData") or r"C:\ProgramData") / "wptool"
    return Path("/tmp/wptool")


def lock_name(address: str, port: int) -> str:
    """`wptool-<address>-<port>.lock`, with every character of the address other than a letter, a digit, `.` and `-`
    made `_`."""
    return f"wptool-{re.sub(r'[^a-z0-9.-]', '_', address.lower())}-{int(port)}.lock"


def lock_path(address: str, port: int) -> Path:
    return lock_dir() / lock_name(address, port)


class MachineLock:
    """The lock of one machine, held from `acquire()` until `release()` or the end of the process."""

    def __init__(self, address: str, port: int, path: Path, fd: int):
        self.address = address
        self.port = port
        self.path = path
        self._fd: int | None = fd

    def __repr__(self) -> str:
        return f"MachineLock({self.path}, held={self.held})"

    @property
    def held(self) -> bool:
        return self._fd is not None

    def is_for(self, address: str, port: int) -> bool:
        return lock_name(self.address, self.port) == lock_name(address, port)

    @classmethod
    def acquire(cls, address: str, port: int) -> MachineLock:
        """Take the lock of the machine, without waiting.

        Raises `ToolError` 409 when another process holds it, 500 when the file cannot be opened.
        """
        folder = lock_dir()
        path = folder / lock_name(address, port)
        try:
            _make_folder(folder)
            fd = _open(path)
        except OSError as e:
            raise failed(f"Failed to connect: cannot open the lock file {path}: {e.strerror or e}") from None
        try:
            _lock(fd)
        except OSError as e:
            os.close(fd)
            if e.errno in HELD:
                holder = read_holder(path)
                raise conflict(f"The machine at {address}:{port} is used by another wptool (process {holder})") from None
            raise failed(f"Failed to connect: cannot lock the file {path}: {e.strerror or e}") from None
        try:
            _write_pid(fd)
        except OSError as e:
            # The lock holds without the process id; another process then reads "unknown".
            log.warning("Cannot write the process id into %s: %s", path, e)
        log.debug("Lock taken: %s", path)
        return cls(address, port, path, fd)

    def release(self) -> None:
        """Release the lock and close the file. Never raises; safe to call twice."""
        fd, self._fd = self._fd, None
        if fd is None:
            return
        try:
            _unlock(fd)
        except OSError as e:
            log.warning("Cannot release the lock %s: %s", self.path, e)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
        log.debug("Lock released: %s", self.path)


def read_holder(path: Path) -> str:
    """The process id that the holder wrote from byte 1 on, or "unknown"."""
    try:
        with open(path, "rb") as file:
            file.seek(1)
            data = file.read(32)
    except OSError:
        return "unknown"
    text = data.split(b"\n")[0].strip(b"\0 \r\t").decode("ascii", "replace")
    return text if text.isdigit() else "unknown"


def _make_folder(folder: Path) -> None:
    if folder.is_dir():
        return
    folder.mkdir(parents=True, exist_ok=True)
    if not WINDOWS:
        try:
            # Every user may make a lock file, and only remove their own (the sticky bit, as /tmp).
            os.chmod(folder, 0o1777)
        except OSError as e:
            log.warning("Cannot open the folder %s to every user: %s", folder, e)


def _open(path: Path) -> int:
    # O_BINARY on Windows: os.open is in text mode there by default, and would write "\n" as "\r\n".
    binary = getattr(os, "O_BINARY", 0)
    try:
        return os.open(path, os.O_RDWR | binary)
    except FileNotFoundError:
        fd = os.open(path, os.O_RDWR | os.O_CREAT | binary, 0o666)
        if not WINDOWS:
            try:
                # The umask took the write right of the others away: give it back, so that another user can lock it.
                os.fchmod(fd, 0o666)
            except OSError:
                pass
        return fd


def _lock(fd: int) -> None:
    if WINDOWS:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)


def _unlock(fd: int) -> None:
    if WINDOWS:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_UN)


def _write_pid(fd: int) -> None:
    data = f"{os.getpid()}\n".encode("ascii")
    os.lseek(fd, 1, os.SEEK_SET)
    os.write(fd, data)
    os.ftruncate(fd, 1 + len(data))

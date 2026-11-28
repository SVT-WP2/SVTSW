"""The connection to the machine: the only state of the tool (D10), with the lock that goes with it (D20).

One `Connection` per tool process (each mode makes one engine, and the engine makes one connection).

- `open(machine)`: the lock (not with --mock), the TCP check (2 s, sends nothing; 503), the driver (the shared
  `SentioProberImpl("<address>:<port>")`, or a link to the simulator with --mock), wrapped in the driver layer. A
  connection that is open already is closed after the new one is open, so that a failed reconnect keeps it
  (`WPAgent/drivers/WPFactory.py` lines 164-176). The lock follows: a reconnect to the address it holds keeps it; a
  reconnect to another address takes the new lock first and releases the old one after the old connection is
  closed; a failed open releases a lock that it took for it.
- `close()`: `local_mode()`, then `disconnect()` (the order of `WPProberConnectionWatch.py` lines 147-153), then the
  lock is released. It never raises: an error is logged.
- `give_back()`: after every request (the engine's `on_finish`), `local_mode()` when the request touched the machine
  and the connection is still open (D16). A connection that the request closed was given back by `close()`.
- `atexit` closes a connection that is still open when the process ends: the last guard behind the modes' `finally`.

The test seam: with WPTOOL_TESTING=1 and WPTOOL_TEST_MACHINE=sim-over-tcp, `open()` works as for a real machine (the
lock, the TCP check, the address in the state) but wraps the simulator instead of `SentioProberImpl`. Without
WPTOOL_TESTING=1 the variable is ignored.
"""

from __future__ import annotations

import atexit
import logging
import os
import socket
from typing import Any, Callable

from wptool.config import Config, MachineConfig
from wptool.driver import Machine
from wptool.lock import MachineLock
from wptool.replies import ToolError, bad_request, failed, unavailable
from wptool.simulator import SimulatedProber
from wptool.state import ToolState

log = logging.getLogger("wptool.connection")

MOCK_MACHINE = MachineConfig(address="mock", port=0)
TCP_CHECK_TIMEOUT_S = 2.0
NOT_CONNECTED = "Not connected to a machine: run Initialize first"
INSTALL_TEXT = (
    "The shared package svt-wp-core with its extra sentio is not installed ({error}): "
    "in WPTool/, run pip install -r requirements.txt (it installs ../Shared/svt-wp-core[sentio] by its path)"
)


def where(machine: MachineConfig) -> str:
    return f"{machine.address}:{machine.port}"


def is_reachable(address: str, port: int, timeout: float = TCP_CHECK_TIMEOUT_S) -> bool:
    """A TCP connect that sends nothing (`WPProberConnectionWatch.py` lines 160-169)."""
    try:
        with socket.create_connection((address, port), timeout=timeout):
            return True
    except (OSError, ValueError, OverflowError):
        return False


def simulated_over_tcp() -> bool:
    """The test seam: a real address, the simulator behind it."""
    return os.environ.get("WPTOOL_TESTING") == "1" and os.environ.get("WPTOOL_TEST_MACHINE") == "sim-over-tcp"


def sentio_driver(address: str) -> Any:
    """The shared SENTIO driver, connected to "<address>:<port>". It is imported only here (D18)."""
    try:
        from svt_wp_core.drivers.WPSentioProber import SentioProberImpl
    except ImportError as e:
        raise failed(INSTALL_TEXT.format(error=e)) from None
    return SentioProberImpl(address)


def resolve_machine(config: Config, address: str | None, port: int | None) -> MachineConfig:
    """The machine of Initialize: each of address and port from the parameter, else from the config `machine`.

    With --mock it is the simulator, and address and port are not needed. Raises `ToolError` 400.
    """
    if config.mock:
        return MOCK_MACHINE
    if address is not None:
        address = address.strip()
        if not address:
            raise bad_request("The parameter address must not be empty")
    if address is None and config.machine is not None:
        address = config.machine.address
    if port is None and config.machine is not None:
        port = config.machine.port
    if address is None and port is None:
        raise bad_request(
            "No machine address and port: give the parameters address and port, or the config keys machine.address "
            "and machine.port (or start the tool with --mock)"
        )
    if address is None:
        raise bad_request("No machine address: give the parameter address, or the config key machine.address")
    if port is None:
        raise bad_request("No machine port: give the parameter port, or the config key machine.port")
    return MachineConfig(address=address, port=port)


class Connection:
    def __init__(self, config: Config, state: ToolState, driver_factory: Callable[[str], Any] = sentio_driver):
        self.config = config
        self.state = state
        self._driver_factory = driver_factory
        self._machine: Machine | None = None
        self._target: MachineConfig | None = None
        self._lock: MachineLock | None = None
        self._simulator: SimulatedProber | None = None

    def __repr__(self) -> str:
        return f"Connection({self.where or 'not connected'})"

    @property
    def simulator(self) -> SimulatedProber:
        """The simulator of this tool process: made at the first use, then the same for every connection."""
        if self._simulator is None:
            self._simulator = SimulatedProber()
        return self._simulator

    @property
    def is_open(self) -> bool:
        return self._machine is not None

    @property
    def machine(self) -> Machine | None:
        """The driver layer of the open connection, or None."""
        return self._machine

    @property
    def target(self) -> MachineConfig | None:
        """The machine of the open connection, or None."""
        return self._target if self._machine is not None else None

    @property
    def where(self) -> str | None:
        return self._machine.where if self._machine is not None else None

    @property
    def lock(self) -> MachineLock | None:
        return self._lock

    def require(self) -> Machine:
        """The driver layer, or 503 without a connection."""
        if self._machine is None:
            raise unavailable(NOT_CONNECTED)
        return self._machine

    def open(self, target: MachineConfig) -> Machine:
        """Connect to `target` (the simulator with --mock). Raises `ToolError`: 409 locked, 503 not reachable,
        500 a failed connect. On a failure nothing changes: an open connection stays as it was."""
        mock = self.config.mock
        if mock:
            target = MOCK_MACHINE
        text = where(target)
        new_lock: MachineLock | None = None
        if not mock and not (self._lock is not None and self._lock.held and self._lock.is_for(target.address, target.port)):
            new_lock = MachineLock.acquire(target.address, target.port)
        try:
            if not mock and not is_reachable(target.address, target.port):
                raise unavailable(f"The machine at {text} is not reachable")
            driver = self._new_driver(text, simulated=mock or simulated_over_tcp())
        except BaseException:
            if new_lock is not None:
                new_lock.release()
            raise
        machine = Machine(driver, text)
        old_machine, old_lock = self._machine, self._lock
        self._machine, self._target = machine, target
        if new_lock is not None:
            self._lock = new_lock
        if old_machine is not None:
            # The new connection is open: now the old one is given back and closed.
            self._give_back_and_disconnect(old_machine)
            log.info("Connection to %s closed", old_machine.where)
        else:
            atexit.register(self.close)
        if old_lock is not None and old_lock is not self._lock:
            old_lock.release()
        self.state.machine = {"address": target.address, "port": target.port}
        self.state.proberConnected = True
        log.info("Connected to %s", text)
        return machine

    def _new_driver(self, text: str, simulated: bool) -> Any:
        if simulated:
            return self.simulator.link()
        try:
            return self._driver_factory(text)
        except ToolError:
            raise
        except Exception as e:
            log.warning("Failed to connect to %s", text, exc_info=True)
            raise failed(f"Failed to connect: {str(e) or type(e).__name__}") from None

    def close(self) -> bool:
        """`local_mode()`, then `disconnect()`, then the lock is released. Never raises. True when there was a
        connection. The machine stays known in the state; `proberConnected` becomes false."""
        machine, lock = self._machine, self._lock
        if machine is None:
            return False
        try:
            self._give_back_and_disconnect(machine)
        finally:
            self._machine = None
            self._target = None
            self._lock = None
            if lock is not None:
                lock.release()
            self.state.proberConnected = False
            atexit.unregister(self.close)
            log.info("Connection to %s closed", machine.where)
        return True

    def start_request(self) -> None:
        """The start of a request: nothing touched the machine yet."""
        if self._machine is not None:
            self._machine.touched = False

    def give_back(self) -> None:
        """The end of a request: `local_mode()` as its last call when it touched the open connection (D16).

        An error of `local_mode()` is logged by the driver layer, not raised."""
        machine = self._machine
        if machine is None or not machine.touched:
            return
        try:
            machine.local_mode()
        except Exception:
            pass
        finally:
            machine.touched = False

    @staticmethod
    def _give_back_and_disconnect(machine: Machine) -> None:
        # The driver layer logs every error. disconnect() runs also when local_mode() is cut off (a signal).
        try:
            try:
                machine.local_mode()
            except Exception:
                pass
        finally:
            try:
                machine.disconnect()
            except Exception:
                pass

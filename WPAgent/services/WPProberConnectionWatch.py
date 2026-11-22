"""
ProberConnectionWatch - the global watcher of the connection to the WP machine.

WPAgent runs all the time; the WP machine is switched on only when it is needed. A daemon
thread checks the connection every few seconds and keeps the global status
(SvtWPAagentGlobalParameters.prober_connected: None until the first check, then True / False):

- Connected: a cheap, read-only probe (prober.is_alive()). After FAILURES_BEFORE_ERROR
  consecutive failures the connection is lost: one immediate reconnect, else the status is
  False and an agent in a session goes to the Error state (the session is lost).
- Not connected: a quick TCP check of the machine address, then a connect. The first connect
  runs the full initialization; a later one forgets the old session (as ReconnectProber does).

Every status change goes to the audit log and to the connection listeners (the Kafka listener
publishes it as an event). While the status is False, a command that needs the prober gets an
error: ProberFactory.get_current_prober() raises ProberNotConnectedError.

The check is skipped while a command is executing (the prober connection is in use).
"""

import socket
import threading

from utilities.WPAgentLogger import WPAgentLogger, Severity

PROBE_INTERVAL        = 5.0
FAILURES_BEFORE_ERROR = 3
TCP_CHECK_TIMEOUT     = 2.0

_status_lock = threading.Lock()
_listeners = []


def is_prober_connected():
    """True / False, or None before the first check."""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    return SvtWPAagentGlobalParameters.getInstance().prober_connected


def not_connected_message() -> str:
    """The error text for a command that needs the prober while the machine is off."""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    name = SvtWPAagentGlobalParameters.getInstance().wpAgentName or "The WP machine"
    return f"{name} is not connected. Switch the machine on: the agent connects to it by itself."


def set_prober_connected(connected: bool, reason: str = ""):
    """Store the status. On a change, write the audit log and call the listeners."""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    g = SvtWPAagentGlobalParameters.getInstance()
    with _status_lock:
        if g.prober_connected is connected:
            return
        g.prober_connected = connected

    WPAgentLogger().log_audit(
        "PROBER_CONNECTED" if connected else "PROBER_DISCONNECTED",
        severity=Severity.INFO if connected else Severity.WARNING,
        address=g.address,
        reason=reason,
    )
    for listener in list(_listeners):
        try:
            listener(connected)
        except Exception as e:
            print(f"WARNING - connection listener failed: {e}")


def add_connection_listener(listener):
    """listener(connected: bool) is called on every status change."""
    _listeners.append(listener)


def remove_connection_listener(listener):
    if listener in _listeners:
        _listeners.remove(listener)


def is_reachable(machine_type, address, timeout=TCP_CHECK_TIMEOUT) -> bool:
    """Quick TCP check of "host:port" that sends nothing. A mock prober is always reachable."""
    if str(machine_type).lower() == "mock":
        return True
    host, _, port = str(address).rpartition(":")
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except (OSError, ValueError):
        return False


class ProberConnectionWatch:
    def __init__(self, is_busy=None, interval=PROBE_INTERVAL, failures=FAILURES_BEFORE_ERROR,
                 auto_reconnect=True, initialize=None):
        """initialize() runs the first, full initialization and returns True on success."""
        self.is_busy  = is_busy or (lambda: False)
        self.auto_reconnect = auto_reconnect
        self.initialize = initialize
        self.interval = interval
        self.failures = failures
        self._failed  = 0
        self.running  = False
        self._stop    = threading.Event()
        self._thread  = None

    def check_once(self):
        """One check cycle. Returns True when the Error state was entered."""
        from drivers.WPFactory import ProberFactory

        if self.is_busy():
            return False
        factory = ProberFactory.get_instance()
        if factory.is_initialized() and is_prober_connected() is not False:
            return self._probe(factory)

        self._failed = 0
        connected = self.auto_reconnect and self._connect(factory)
        set_prober_connected(bool(connected), "connected" if connected else "machine not reachable")
        return False

    def _probe(self, factory):
        try:
            alive = bool(factory.get_prober(*factory.get_current_config()).is_alive())
        except Exception:
            alive = False

        if alive:
            self._failed = 0
            set_prober_connected(True, "prober answers")
            return False

        self._failed += 1
        if self._failed < self.failures:
            return False
        self._failed = 0
        return self._lost(factory)

    def _lost(self, factory):
        """The prober stopped answering: one immediate reconnect, else Error for a session."""
        from stateMachine.WpAgentStateMachine import WPAgentState
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

        state = agentStateMachine.current_state
        if self.auto_reconnect and self._connect(factory):
            set_prober_connected(True, "reconnected")
            return False

        set_prober_connected(False, "prober not answering")
        if state in (WPAgentState.ServiceOn, WPAgentState.Error):
            return False
        agentStateMachine.enter_error_state(
            "Lost connection to the WP machine. The agent connects again when the machine is back."
        )
        return True

    def _connect(self, factory):
        """Connect to the machine stored in the globals. Returns True on success."""
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
        from stateMachine.WpAgentStateMachine import WPAgentState
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

        g = SvtWPAagentGlobalParameters.getInstance()
        if not g.address or not g.machineType or not is_reachable(g.machineType, g.address):
            return False

        if not factory.is_initialized():
            return bool(self.initialize and self.initialize())

        if agentStateMachine.current_state == WPAgentState.ServiceOn:
            # No session to forget: a new connection is enough.
            try:
                factory.reconnect(g.machineType, g.address)
            except Exception:
                return False
            set_prober_connected(True, "reconnected")
            return True

        from actions.WPProjectActions import reconnect_session

        ok, _message, _status = reconnect_session(requested_by="ProberConnectionWatch", event="AUTO_RECONNECT")
        return ok

    def _loop(self):
        while True:
            try:
                self.check_once()
            except Exception as e:
                print(f"WARNING - prober connection check failed: {e}")
            if self._stop.wait(self.interval):
                return

    def start(self):
        self.running = True
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1.0)

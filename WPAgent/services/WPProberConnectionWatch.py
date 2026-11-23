"""
ProberConnectionWatch - the global watcher of the connection to the WP machine.

WPAgent runs all the time; the WP machine is switched on only when it is needed. A daemon
thread checks the machine every few seconds and keeps the global status
(SvtWPAagentGlobalParameters.prober_connected: None until the first check, then True / False):

- Not initialized (the agent has no connection to the machine yet): a quick TCP check of
  the machine address that sends nothing. The watch never initializes the machine: that is
  the Initialize command (actions/WPProjectActions.initialize_machine).
- Initialized: a cheap, read-only probe (prober.is_alive()). After FAILURES_BEFORE_ERROR
  consecutive failures the connection is lost: one immediate reconnect, else the status is
  False and an agent in a session goes to the Error state (the session is lost).
- Initialized, connection lost: the TCP check, then a new connection that forgets the old
  session (as ReconnectProber does).

While the machine is not connected, the watch reads its DB record again every
RECORD_REFRESH_INTERVAL seconds and right before a reconnect (services/WPMachineRecord.py),
so it follows a change of the address in the DB.

Every change of the status (connected, initialized) goes to the connection listeners (the
Kafka listener publishes it as an event), a change of `connected` also to the audit log.
A command that needs the prober gets an error while the machine is off or not initialized:
ProberFactory.get_current_prober() raises ProberNotConnectedError.

The check is skipped while a command is executing (the prober connection is in use).
"""

import socket
import threading
import time

from utilities.WPAgentLogger import WPAgentLogger, Severity

PROBE_INTERVAL        = 5.0
FAILURES_BEFORE_ERROR = 3
TCP_CHECK_TIMEOUT     = 2.0
RECORD_REFRESH_INTERVAL = 30.0

_status_lock = threading.Lock()
_listeners = []


def is_prober_connected():
    """True / False, or None before the first check."""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    return SvtWPAagentGlobalParameters.getInstance().prober_connected


def is_prober_initialized() -> bool:
    """True when the agent has set up its connection to the prober (the Initialize command)."""
    from drivers.WPFactory import ProberFactory

    return ProberFactory.get_instance().is_initialized()


def _machine_label() -> str:
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    return SvtWPAagentGlobalParameters.getInstance().wpAgentName or "The WP machine"


def not_connected_message() -> str:
    """The error text for a command that needs the prober while the machine is off."""
    if is_prober_initialized():
        return f"{_machine_label()} is not connected. Switch the machine on: the agent connects to it again by itself."
    return f"{_machine_label()} is not connected. Switch the machine on, then send Initialize."


def not_initialized_message() -> str:
    """The error text for a command that needs the prober before the Initialize command."""
    return f"{_machine_label()} is not initialized. Send Initialize first."


def set_prober_connected(connected: bool, reason: str = ""):
    """
    Store the status. The listeners are called when `connected` or `initialized` changed;
    a change of `connected` also goes to the audit log.

    The watch thread and the command threads both call this. The listeners run under the
    status lock and get the stored pair, so the changes go out in the order in which they
    were stored, and the last event is the current status.
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    g = SvtWPAagentGlobalParameters.getInstance()
    with _status_lock:
        status = (connected, is_prober_initialized())
        connection_changed = g.prober_connected is not connected
        if not connection_changed and g.prober_status_published == status:
            return
        g.prober_connected = connected
        g.prober_status_published = status

        if connection_changed:
            WPAgentLogger().log_audit(
                "PROBER_CONNECTED" if connected else "PROBER_DISCONNECTED",
                severity=Severity.INFO if connected else Severity.WARNING,
                address=g.address,
                reason=reason,
            )
        for listener in list(_listeners):
            try:
                listener(*status)
            except Exception as e:
                print(f"WARNING - connection listener failed: {e}")


def add_connection_listener(listener):
    """
    listener(connected: bool, initialized: bool) is called on every change of the status,
    in the order of the changes. It runs under the status lock: it must be quick and must
    not call set_prober_connected.
    """
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
                 auto_reconnect=True, refresh_interval=RECORD_REFRESH_INTERVAL):
        self.is_busy  = is_busy or (lambda: False)
        self.auto_reconnect = auto_reconnect
        self.interval = interval
        self.failures = failures
        self.refresh_interval = refresh_interval
        self._failed  = 0
        self._refreshed_at = time.monotonic()  # the record was read at the start of the agent
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

        # No connection to the machine: follow its DB record and look whether it is on.
        self._failed = 0
        initialized = factory.is_initialized()
        self._refresh_machine_if_due()
        connected = self._is_machine_reachable()
        if factory.is_initialized() != initialized:
            return False  # Initialize ran during this check and has set the status itself
        if connected and initialized:
            # The agent had a connection and lost it: open a new one.
            connected = self.auto_reconnect and self._reconnect(factory)
        set_prober_connected(bool(connected), "machine reachable" if connected else "machine not reachable")
        return False

    def _refresh_machine_if_due(self):
        """While the machine is not connected, read its DB record again every refresh_interval."""
        if time.monotonic() - self._refreshed_at < self.refresh_interval:
            return
        self._refreshed_at = time.monotonic()
        from services.WPMachineRecord import refresh_machine

        refresh_machine()

    @staticmethod
    def _is_machine_reachable():
        """True when the machine stored in the globals answers the TCP check."""
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        g = SvtWPAagentGlobalParameters.getInstance()
        return bool(g.address and g.machineType and is_reachable(g.machineType, g.address))

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
        if self.auto_reconnect and self._is_machine_reachable() and self._reconnect(factory):
            set_prober_connected(True, "reconnected")
            return False

        set_prober_connected(False, "prober not answering")
        if state in (WPAgentState.ServiceOn, WPAgentState.Error):
            return False
        agentStateMachine.enter_error_state(
            "Lost connection to the WP machine. The agent connects again when the machine is back."
        )
        return True

    def _reconnect(self, factory):
        """
        Open a new connection for an agent that was initialized and lost the machine.
        The DB record of the machine is read again first. Returns True on success.
        """
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
        from stateMachine.WpAgentStateMachine import WPAgentState
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

        if agentStateMachine.current_state == WPAgentState.ServiceOn:
            # No session to forget: a new connection is enough.
            from services.WPMachineRecord import refresh_machine

            refresh_machine()
            self._refreshed_at = time.monotonic()
            g = SvtWPAagentGlobalParameters.getInstance()
            try:
                factory.reconnect(g.machineType, g.address)
            except Exception:
                return False
            set_prober_connected(True, "reconnected")
            return True

        from actions.WPProjectActions import reconnect_session

        ok, _message, _status = reconnect_session(requested_by="ProberConnectionWatch", event="AUTO_RECONNECT")
        self._refreshed_at = time.monotonic()
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

"""
ProberConnectionWatch - detects that the prober machine is no longer reachable.

A daemon thread probes the prober every few seconds with a cheap, read-only call
(prober.is_alive()). After FAILURES_BEFORE_ERROR consecutive failures the agent state
machine is put into the Error state and an [AUDIT] line is written. Bring the agent back
with ReconnectProber (works from Error) once the machine is up again.

The probe is skipped while a command is executing (the prober connection is in use) and
whenever there is nothing to lose: no prober initialized, agent in ServiceOn or already in Error.
"""

import threading

from utilities.WPAgentLogger import WPAgentLogger, Severity

PROBE_INTERVAL      = 5.0
FAILURES_BEFORE_ERROR = 3


class ProberConnectionWatch:
    def __init__(self, is_busy=None, interval=PROBE_INTERVAL, failures=FAILURES_BEFORE_ERROR):
        self.is_busy  = is_busy or (lambda: False)
        self.interval = interval
        self.failures = failures
        self._failed  = 0
        self.running  = False
        self._stop    = threading.Event()
        self._thread  = None

    def check_once(self):
        """One probe cycle. Returns True when the Error state was entered."""
        from drivers.WPFactory import ProberFactory
        from stateMachine.WpAgentStateMachine import WPAgentState
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

        if agentStateMachine.current_state in (WPAgentState.ServiceOn, WPAgentState.Error):
            self._failed = 0
            return False
        factory = ProberFactory.get_instance()
        if not factory.is_initialized() or self.is_busy():
            return False

        try:
            alive = bool(factory.get_prober(*factory.get_current_config()).is_alive())
        except Exception:
            alive = False

        if alive:
            self._failed = 0
            return False

        self._failed += 1
        if self._failed < self.failures:
            return False

        self._failed = 0
        state = agentStateMachine.get_state_name()
        msg = "Lost connection to the prober machine. Run ReconnectProber once it is back."
        agentStateMachine.enter_error_state(msg)
        logger = WPAgentLogger()
        logger.log_audit("CONNECTION_LOST", severity=Severity.ERROR, state=state, reason="prober not answering")
        return True

    def _loop(self):
        while not self._stop.wait(self.interval):
            try:
                self.check_once()
            except Exception as e:
                print(f"WARNING - prober connection check failed: {e}")

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

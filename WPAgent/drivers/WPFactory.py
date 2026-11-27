import threading

from drivers.WPSentioProber import SentioProberImpl
from drivers.WPMockProber import MockProberImpl

prober_classes = {"sentio": SentioProberImpl, "mock": MockProberImpl}

# Seconds that the final close (the agent stops) waits for a connect of another thread
# to end. After that it closes the connection without the lock: the connect sees that the
# agent stops and closes its own connection (ProberFactory._keep).
CLOSE_LOCK_WAIT = 5.0


class ProberNotConnectedError(RuntimeError):
    """
    A command needs the prober, but the agent has no connection to the WP machine:
    the machine is off, or the agent was not initialized yet (the Initialize command).
    """


STOPPED_MESSAGE = "The agent is stopping: it opens no new connection to the WP machine."


def _disconnect(prober):
    """Close the connection of a prober that the factory lets go. Never raises."""
    disconnect = getattr(prober, "disconnect", None)
    if not callable(disconnect):
        return
    try:
        disconnect()
    except Exception as e:
        print(f"WARNING - could not close the connection to the prober: {e}")


class ProberFactory:
    """
    Singleton factory that maintains a single prober instance per configuration.

    The prober holds the one TCP connection of the agent to the WP machine. The factory
    closes the connection of every prober that it lets go: close(), a reconnect, a new
    configuration.

    The connection watch and the command threads both change the connection. `lock`
    makes each change one step: get_prober, reconnect and close take it, and so do the
    operations that decide on the connection and then change it (the Initialize command,
    a reconnect, the reconnect of the connection watch). It is reentrant: such an
    operation calls get_prober, reconnect or close while it holds the lock.
    """

    _instance = None
    _prober = None
    _initialized = False
    _current_config = None
    # The agent stops (close(final=True)): no new connection after that.
    _stopped = False
    lock = threading.RLock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _open(self, machineType: str, address: str):
        """Open a new connection to the prober. Refused when the agent stops."""
        try:
            prober_class = prober_classes[machineType.lower()]
        except KeyError:
            raise ValueError(f"Unsupported machine type: {machineType}")
        if self._stopped:
            raise ProberNotConnectedError(STOPPED_MESSAGE)
        return prober_class(address)  # raises when the machine is unreachable

    def _keep(self, prober, config):
        """Make `prober` the current one and close the connection of the one it replaces."""
        old, self._prober = self._prober, prober
        self._current_config = config
        self._initialized = True
        _disconnect(old)
        if self._stopped:
            # The agent stopped while this connection was opening (close(final=True)
            # may have run without the lock): close this one too.
            self._prober, self._current_config, self._initialized = None, None, False
            _disconnect(prober)
            raise ProberNotConnectedError(STOPPED_MESSAGE)

    def peek_prober(self):
        """The prober of the current connection, or None. No checks, no new connection."""
        return self._prober

    def get_prober(self, machineType: str, address: str):
        """
        Get or create a prober instance. Returns the same instance if config matches.

        Args:
            machineType: Type of prober machine (e.g., 'sentio')
            address: Network address of the prober

        Returns:
            Configured prober instance
        """
        config = (machineType.lower(), address)

        with self.lock:
            # Return existing prober if configuration matches and it's initialized
            if (
                self._initialized
                and self._current_config == config
                and self._prober is not None
            ):
                return self._prober

            # Create new prober instance; the connection of the one it replaces is closed
            prober = self._open(machineType, address)
            self._keep(prober, config)
            print(f"✅ Prober initialized: {machineType} at {address}")
            return prober

    def is_initialized(self):
        """Check if prober is initialized"""
        return self._initialized and self._prober is not None

    def get_current_config(self):
        """
        Get the current prober configuration.

        Returns:
            tuple: (machine_type, address) or None if not initialized
        """
        return self._current_config

    def get_current_prober(self):
        """
        Get the currently initialized prober without creating a new one.

        This is used by command functions after the Initialize command.
        No parameters needed since the prober was already initialized.

        Returns:
            The current prober instance

        Raises:
            ProberNotConnectedError: the machine is off, or the agent is not initialized.
                Both are normal cases: the command gets an error reply, the agent
                state does not change (see WPCmdMap.execute_command).

        Example:
            >>> factory = ProberFactory.get_instance()
            >>> prober = factory.get_current_prober()
            >>> prober.move_chuck_center()
        """
        from services.WPProberConnectionWatch import (
            is_prober_connected, not_connected_message, not_initialized_message,
        )

        if is_prober_connected() is False:
            raise ProberNotConnectedError(not_connected_message())

        if not self._initialized or self._prober is None:
            raise ProberNotConnectedError(not_initialized_message())

        return self._prober

    def reconnect(self, machineType: str, address: str):
        """
        Open a NEW connection to the prober and replace the current one.

        The current prober is kept if the new connection cannot be opened, so a
        failed reconnect (machine still booting) does not lose the old setup.
        The old connection is closed once the new one is open.
        """
        with self.lock:
            prober = self._open(machineType, address)
            self._keep(prober, (machineType.lower(), address))
            print(f"🔌 Prober reconnected: {machineType} at {address}")
            return prober

    def close(self, final=False):
        """
        Close the TCP connection to the prober and forget the prober: the agent is not
        initialized afterwards (the Initialize command connects again).

        final=True: the agent stops. Every later connect is refused, so that a command
        or the connection watch that is still running cannot open a connection again.
        The stop waits at most CLOSE_LOCK_WAIT seconds for a connect of another thread.
        """
        if final:
            self._stopped = True
        locked = self.lock.acquire(timeout=CLOSE_LOCK_WAIT if final else -1)
        try:
            prober, self._prober = self._prober, None
            self._initialized = False
            self._current_config = None
        finally:
            if locked:
                self.lock.release()
        _disconnect(prober)

    def reset(self):
        """Back to a new factory (tests): close the connection and allow connects again."""
        self.close()
        self._stopped = False
        print("🔄 Prober factory reset")


# Convenience function to maintain backward compatibility
def get_prober(machineType: str, address: str):
    """
    Get a prober instance. Now uses singleton factory.

    Args:
        machineType: Type of prober machine
        address: Network address of the prober

    Returns:
        Configured prober instance (singleton)
    """
    factory = ProberFactory.get_instance()
    return factory.get_prober(machineType, address)


def get_current_prober():
    factory = ProberFactory.get_instance()
    return factory.get_current_prober()

from drivers.WPSentioProber import SentioProberImpl
from drivers.WPMockProber import MockProberImpl

prober_classes = {"sentio": SentioProberImpl, "mock": MockProberImpl}


class ProberFactory:
    """Singleton factory that maintains a single prober instance per configuration"""

    _instance = None
    _prober = None
    _initialized = False
    _current_config = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

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

        # Return existing prober if configuration matches and it's initialized
        if (
            self._initialized
            and self._current_config == config
            and self._prober is not None
        ):
            return self._prober

        # Create new prober instance
        try:
            prober_class = prober_classes[machineType.lower()]
            self._prober = prober_class(address)
            self._current_config = config
            self._initialized = True
            print(f"✅ Prober initialized: {machineType} at {address}")
            return self._prober
        except KeyError:
            raise ValueError(f"Unsupported machine type: {machineType}")

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

        This is used by command functions after auto-initialization.
        No parameters needed since the prober was already initialized.

        Returns:
            The current prober instance

        Raises:
            RuntimeError: If no prober is currently initialized

        Example:
            >>> factory = ProberFactory.get_instance()
            >>> prober = factory.get_current_prober()
            >>> prober.move_chuck_center()
        """
        if not self._initialized or self._prober is None:
            raise RuntimeError(
                "No prober is currently initialized. "
                "Please start the listener with a config: python3.12 main.py listen <CONFIG_NAME>"
            )

        return self._prober

    def reset(self):
        """Reset the factory (useful for testing or reconnection)"""
        self._prober = None
        self._initialized = False
        self._current_config = None
        print("🔄 Prober factory reset")

    def reconnect(self, max_wait: float = 30.0, poll_interval: float = 2.0) -> bool:
        """
        Re-establish connection to the prober using stored config.
        Waits for Sentio to report Ready before returning so the
        retry command doesn't fire before Sentio is fully initialized.

        Args:
            max_wait: Max seconds to wait for Sentio to become Ready.
            poll_interval: Seconds between status polls.

        Returns:
            True if reconnection succeeded and prober is Ready, False otherwise.
        """
        import time

        if not self._current_config:
            print("❌ Cannot reconnect — no previous config stored")
            return False

        machine_type, address = self._current_config
        print(f"🔄 Attempting to reconnect to {machine_type} at {address}...")

        try:
            self._prober = None
            self._initialized = False

            prober_class = prober_classes[machine_type]
            self._prober = prober_class(address)
            self._initialized = True
            print(f"✅ TCP connection established to {machine_type} at {address}")
        except Exception as e:
            print(f"❌ Reconnection failed: {str(e)}")
            self._prober = None
            self._initialized = False
            return False

        # Poll until Sentio reports Ready (it may still be initializing)
        start = time.time()
        while time.time() - start < max_wait:
            try:
                status = self._prober.get_machine_status()
                if status == "Ready":
                    print(f"✅ Sentio is Ready — reconnect successful")
                    return True
                print(f"   ⏳ Sentio status: {status} — waiting...")
            except Exception:
                print(f"   ⏳ Sentio not responding yet — waiting...")
            time.sleep(poll_interval)

        print(f"❌ Sentio did not become Ready within {max_wait}s")
        self._prober = None
        self._initialized = False
        return False

    @staticmethod
    def is_connection_error(exception: Exception) -> bool:
        """
        Check if an exception indicates a lost connection to the prober
        rather than a logic or command error.
        """
        msg = str(exception).lower()
        return any(kw in msg for kw in [
            "connection", "socket", "timeout", "refused",
            "reset", "broken pipe", "eof", "disconnected", "tcpip"
        ])


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

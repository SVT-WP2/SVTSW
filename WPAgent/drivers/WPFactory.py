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
                "Please start the listener with a config: python3.12 main.py listen --config=configs/ProbeConfigCERN.json"
            )

        return self._prober

    def reset(self):
        """Reset the factory (useful for testing or reconnection)"""
        self._prober = None
        self._initialized = False
        self._current_config = None
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

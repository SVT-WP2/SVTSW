from drivers.sentio_prober import SentioProberImpl

# Add any other machine used for WP testing
prober_classes = {
    "sentio": SentioProberImpl
}


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

    def get_prober(self, machine_type: str, address: str):
        """
        Get or create a prober instance. Returns the same instance if config matches.

        Args:
            machine_type: Type of prober machine (e.g., 'sentio')
            address: Network address of the prober

        Returns:
            Configured prober instance
        """
        config = (machine_type.lower(), address)

        # Return existing prober if configuration matches and it's initialized
        if self._initialized and self._current_config == config and self._prober is not None:
            return self._prober

        # Create new prober instance
        try:
            prober_class = prober_classes[machine_type.lower()]
            self._prober = prober_class(address)
            self._current_config = config
            self._initialized = True
            print(f"✅ Prober initialized: {machine_type} at {address}")
            return self._prober
        except KeyError:
            raise ValueError(f"Unsupported machine type: {machine_type}")

    def is_initialized(self):
        """Check if prober is initialized"""
        return self._initialized and self._prober is not None

    def reset(self):
        """Reset the factory (useful for testing or reconnection)"""
        self._prober = None
        self._initialized = False
        self._current_config = None
        print("🔄 Prober factory reset")



def get_prober(machine_type: str, address: str):
    """
    Get a prober instance. Now uses singleton factory.

    Args:
        machine_type: Type of prober machine
        address: Network address of the prober

    Returns:
        Configured prober instance (singleton)
    """
    factory = ProberFactory.get_instance()
    return factory.get_prober(machine_type, address)
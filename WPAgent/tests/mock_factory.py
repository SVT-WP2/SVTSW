# ============================================================================
# MOCK FACTORY - Inject Mock Prober for Testing
# ============================================================================

"""
Modified factory that returns MockProber instead of real prober.
Use this for testing without hardware.
"""

from tests.mock_prober import MockProber

# Store singleton instance
_mock_prober_instance = None


def get_prober(machine_type, address):
    """
    Get prober instance - returns MockProber for testing.

    Args:
        machine_type: Type of machine (ignored in mock)
        address: Address (used to identify mock)

    Returns:
        MockProber: Mock prober instance
    """
    global _mock_prober_instance

    if _mock_prober_instance is None:
        print(f"🔧 Creating MockProber for {address}")
        _mock_prober_instance = MockProber(address)
        _mock_prober_instance.initialize()

    return _mock_prober_instance


def reset_mock():
    """Reset the mock prober instance (useful between tests)."""
    global _mock_prober_instance
    _mock_prober_instance = None
    print("🔄 Mock prober reset")
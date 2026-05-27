"""Shared pytest fixtures for WPAgent tests."""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _clear_globals():
    """
    Hard-reset the globals singleton and the validator singleton.

    Clears userLogged on the LIVE instance first so any stale
    references (e.g. inside WPCommandValidator.self.g) see clean
    state, then nulls the singleton pointer so the next getInstance()
    call creates a completely fresh object.
    """
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
    import utilities.WPValidator as _wv

    inst = SvtWPAagentGlobalParameters._instance
    if inst is not None:
        inst.userLogged = None
        inst.userLoggedHierarchy = None
        inst.wpAgentName = None

    SvtWPAagentGlobalParameters._instance = None
    _wv._validator_instance = None


@pytest.fixture(autouse=True)
def reset_globals():
    _clear_globals()
    yield
    _clear_globals()


@pytest.fixture
def globals_instance():
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    return SvtWPAagentGlobalParameters.getInstance()


@pytest.fixture
def logged_in_user(globals_instance):
    globals_instance.wpAgentName = "TestAgent"
    globals_instance.userLogged = "test_user"
    globals_instance.userLoggedHierarchy = "Developer"
    return globals_instance


@pytest.fixture
def mock_prober():
    from drivers.WPMockProber import MockProberImpl

    return MockProberImpl()


@pytest.fixture
def prober():
    """Hardware prober fixture - skipped automatically when no real prober is available."""
    pytest.skip("Requires a live SENTIO prober connection (hardware not present)")


@pytest.fixture
def project_path():
    """Hardware test fixture - skipped automatically when no real prober is available."""
    pytest.skip("Requires a live SENTIO prober connection (hardware not present)")

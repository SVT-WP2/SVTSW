"""Shared pytest fixtures for WPAgent tests."""

import sys
import os
import pytest
from unittest.mock import MagicMock

# ── Stub the SENTIO hardware SDK ───────────────────────────────────────────────
# sentio_prober_control is a hardware SDK whose installed version may be
# incomplete (e.g. missing ChuckXYReference in 25.2.1).  We stub the whole
# package here at MODULE LEVEL — before pytest collects any test files — so
# that the import chain WPLoginActions → WPTestingActions → WPFactory →
# WPSentioProber → sentio_prober_control is short-circuited cleanly.
# MagicMock auto-creates any attribute (ChuckXYReference, SentioProber, …)
# on first access, so no ImportError is raised.
_sentio_stub = MagicMock()
for _mod_name in [
    "sentio_prober_control",
    "sentio_prober_control.Sentio",
    "sentio_prober_control.Sentio.Enumerations",
    "sentio_prober_control.Sentio.ProberSentio",
    "sentio_prober_control.Sentio.Response",
    "sentio_prober_control.Communication",
    "sentio_prober_control.Sentio.CommandGroups",
]:
    sys.modules.setdefault(_mod_name, _sentio_stub)

# ── Stub confluent_kafka (Kafka client library not installed in test env) ──────
_kafka_stub = MagicMock()
for _mod_name in [
    "confluent_kafka",
    "confluent_kafka.admin",
]:
    sys.modules.setdefault(_mod_name, _kafka_stub)

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

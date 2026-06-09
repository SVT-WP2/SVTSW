"""
Tests for utilities/WPHelpers.py

Covers: resolve_project_parameters (param resolution + globals update)
and check_prober_ready (factory state checks).
ensure_prober_initialized is not tested here because it reaches out
to the real ProberFactory / network — that belongs in integration tests.
"""

import pytest
from utilities.WPHelpers import resolve_project_parameters, check_prober_ready

# ──────────────────────────────────────────────────────────────
# resolve_project_parameters
# ──────────────────────────────────────────────────────────────


class TestResolveProjectParameters:

    def test_explicit_params_are_returned_as_is(self, globals_instance):
        address, project, machine = resolve_project_parameters(
            address="192.168.1.5", projectName="MyProject", machineType="sentio"
        )
        assert address == "192.168.1.5"
        assert project == "MyProject"
        assert machine == "sentio"

    def test_explicit_params_update_globals(self, globals_instance):
        resolve_project_parameters(
            address="10.0.0.1", projectName="ProjA", machineType="mock"
        )
        assert globals_instance.address == "10.0.0.1"
        assert globals_instance.projectName == "ProjA"
        assert globals_instance.machineType == "mock"

    def test_falls_back_to_globals_when_args_are_none(self, globals_instance):
        globals_instance.set_address("172.16.0.1")
        globals_instance.set_project_name("GlobalProject")
        globals_instance.set_machine_type("sentio")

        address, project, machine = resolve_project_parameters()
        assert address == "172.16.0.1"
        assert project == "GlobalProject"
        assert machine == "sentio"

    def test_partial_override_uses_globals_for_missing(self, globals_instance):
        globals_instance.set_address("172.16.0.1")
        globals_instance.set_machine_type("sentio")

        address, project, machine = resolve_project_parameters(
            projectName="OverriddenProject"
        )
        assert address == "172.16.0.1"
        assert project == "OverriddenProject"
        assert machine == "sentio"

    def test_all_none_returns_none_tuple(self, globals_instance):
        # Globals are also empty (reset by conftest)
        address, project, machine = resolve_project_parameters()
        assert address is None
        assert project is None
        assert machine is None


# ──────────────────────────────────────────────────────────────
# check_prober_ready
# ──────────────────────────────────────────────────────────────


class TestCheckProberReady:

    def test_not_ready_when_factory_not_initialized(self, globals_instance):
        """With a clean state the factory reports not-ready.

        drivers.WPFactory is pre-stubbed in the root conftest.py so this test
        runs without the Sentio hardware SDK or real probe-station hardware.
        The stub returns is_initialized=False, which is the state we test here.
        """
        is_ready, message = check_prober_ready()
        assert is_ready is False
        assert "not initialized" in message.lower() or "initialize" in message.lower()
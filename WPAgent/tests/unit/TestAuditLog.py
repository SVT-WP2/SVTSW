"""
Audit lines in the log: who logged in / out / took over / reset the agent, and the
logged-in user on every command line.

Users from configs/WPUserHierarchy.json:  Developer user1, user2 | Expert user3, user4 | User user5, user6

Run:  python3 -m pytest tests/unit/TestAuditLog.py -q
"""

import logging

import pytest
from unittest.mock import patch

from utilities.WPAgentLogger import WPAgentLogger, Severity


@pytest.fixture(autouse=True)
def _clean_state(caplog):
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
    from stateMachine.WpAgentStateMachine import WPAgentState

    agentStateMachine.reset()
    agentStateMachine.force_state(WPAgentState.ServiceOn)
    caplog.set_level(logging.INFO, logger="WPAgent")
    yield
    agentStateMachine.reset()
    agentStateMachine.force_state(WPAgentState.ServiceOn)


@pytest.fixture
def mock_prober():
    from drivers.WPMockProber import MockProberImpl

    prober = MockProberImpl("mock:35555")
    with patch("actions.WPLoginActions.get_current_prober", return_value=prober):
        yield prober


def _audit_lines(caplog):
    return [r.getMessage() for r in caplog.records if r.getMessage().startswith("[AUDIT]")]


def _login(user):
    import actions.WPLoginActions as la
    return la.UserLogIn(user=user, waferAgentName="T")


def _logout(user):
    import actions.WPLoginActions as la
    return la.UserLogOut(user=user, waferAgentName="T")


@pytest.fixture(autouse=True)
def _agent_name(globals_instance):
    globals_instance.wpAgentName = "T"


class TestAuditLines:
    def test_login_names_user_hierarchy_and_state(self, caplog, mock_prober):
        assert _login("user3")["status"] == "Success"
        assert _audit_lines(caplog) == ["[AUDIT] LOGIN user=user3 hierarchy=Expert state=UserLogged"]

    def test_developer_login_state(self, caplog, mock_prober):
        _login("user1")
        assert _audit_lines(caplog) == ["[AUDIT] LOGIN user=user1 hierarchy=Developer state=UsedByDeveloper"]

    def test_unknown_user_refused_as_warning(self, caplog, mock_prober):
        _login("nobody")
        lines = _audit_lines(caplog)
        assert lines == ["[AUDIT] LOGIN_REFUSED user=nobody reason=user not recognized"]
        assert [r.levelno for r in caplog.records if r.getMessage().startswith("[AUDIT]")] == [logging.WARNING]

    def test_second_user_refused_names_current_user(self, caplog, mock_prober):
        _login("user3")
        caplog.clear()
        _login("user5")
        assert _audit_lines(caplog) == [
            "[AUDIT] LOGIN_REFUSED user=user5 hierarchy=User reason=another user is logged in current_user=user3"
        ]

    def test_developer_takeover_names_both(self, caplog, mock_prober):
        _login("user3")
        caplog.clear()
        _login("user1")
        assert _audit_lines(caplog) == [
            "[AUDIT] TAKEOVER user=user1 hierarchy=Developer from_user=user3 from_hierarchy=Expert"
        ]

    def test_second_developer_refused(self, caplog, mock_prober):
        _login("user1")
        caplog.clear()
        _login("user2")
        assert _audit_lines(caplog) == [
            "[AUDIT] LOGIN_REFUSED user=user2 hierarchy=Developer "
            "reason=a developer is already logged in current_user=user1"
        ]

    def test_logout_names_user(self, caplog, mock_prober):
        _login("user3")
        caplog.clear()
        _logout("user3")
        assert _audit_lines(caplog) == ["[AUDIT] LOGOUT user=user3 hierarchy=Expert"]

    def test_logout_refused_when_nobody_logged_in(self, caplog, mock_prober):
        _logout("user3")
        assert _audit_lines(caplog) == ["[AUDIT] LOGOUT_REFUSED user=user3 reason=nobody is logged in"]

    def test_logout_refused_for_other_user(self, caplog, mock_prober):
        _login("user3")
        caplog.clear()
        _logout("user5")
        assert _audit_lines(caplog) == [
            "[AUDIT] LOGOUT_REFUSED user=user5 reason=another user is logged in current_user=user3"
        ]

    def test_reset_names_the_user_that_was_logged_out(self, caplog, mock_prober):
        import actions.WPProjectActions as pa
        _login("user3")
        caplog.clear()
        pa.reset_agent(user="user4", waferAgentName="T")
        assert _audit_lines(caplog) == [
            "[AUDIT] RESET user=user3 hierarchy=Expert requested_by=user4 "
            "from_state=UserLogged to_state=ServiceOn"
        ]

    def test_reset_with_nobody_logged_in(self, caplog):
        import actions.WPProjectActions as pa
        pa.reset_agent(user="user4", waferAgentName="T")
        assert _audit_lines(caplog) == [
            "[AUDIT] RESET user=- requested_by=user4 from_state=ServiceOn to_state=ServiceOn"
        ]


class TestUserOnEveryCommandLine:
    def test_command_line_has_logged_in_user_and_hierarchy(self, caplog, globals_instance):
        globals_instance.set_user("user3", "Expert")
        WPAgentLogger().log_command("did something", Severity.INFO, "MoveChuckCenter", {"user": "user3"})
        line = [r.getMessage() for r in caplog.records if r.getMessage().startswith("MoveChuckCenter")][-1]
        assert "| user=user3 (Expert) |" in line

    def test_command_line_without_login_shows_dash(self, caplog, globals_instance):
        globals_instance.set_user(None, None)
        WPAgentLogger().log_command("did something", Severity.INFO, "GetInfo")
        line = [r.getMessage() for r in caplog.records if r.getMessage().startswith("GetInfo")][-1]
        assert "| user=- " in line + " " or line.endswith("user=-")

    def test_user_survives_a_broken_globals_lookup(self, caplog):
        with patch(
            "globals.WPAagentGlobalParameters.SvtWPAagentGlobalParameters.getInstance",
            side_effect=RuntimeError("boom"),
        ):
            WPAgentLogger().log_command("still logs", Severity.INFO, "GetInfo")
        assert any("GetInfo - still logs" in r.getMessage() for r in caplog.records)

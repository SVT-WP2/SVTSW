"""
tests/test_login_actions.py

Unit tests for actions/WPLoginActions.py
Covers: UserLogIn, UserLogOut — all branches.

Users from configs/WPUserHierarchy.json:
    Developer : user1, user2
    Expert    : user3, user4
    User      : user5, user6

Response schema (from WPResponseBuilder):
    {"status": "Success"|"Error", "type": str,
     "data": {...}, "error": {"code": int, "message": str}}
"""

import pytest
from unittest.mock import patch

# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_state_machine():
    """Reset the singleton state machine before and after every test."""
    from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
    from stateMachine.WpAgentStateMachine import WPAgentState

    agentStateMachine.reset()  # clears g.userLogged
    agentStateMachine.force_state(WPAgentState.ServiceOn)
    yield
    agentStateMachine.reset()
    agentStateMachine.force_state(WPAgentState.ServiceOn)


@pytest.fixture
def mock_prober():
    """
    Return a real MockProberImpl and patch get_current_prober at the use-site
    inside WPLoginActions.  The root conftest stubs drivers.WPFactory with a
    MagicMock, so we must patch the already-imported name inside the module.
    """
    from drivers.WPMockProber import MockProberImpl

    prober = MockProberImpl("mock:35555")
    with patch("actions.WPLoginActions.get_current_prober", return_value=prober):
        yield prober


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────


def _status(r):
    return r["status"].lower()


def _msg(r):
    """Error message from ResponseBuilder.error(). Empty string for success."""
    return r.get("error", {}).get("message", "")


# ─────────────────────────────────────────────────────────────
# UserLogIn
# ─────────────────────────────────────────────────────────────


class TestUserLogIn:

    def test_unknown_user_is_rejected(self, mock_prober):
        from actions.WPLoginActions import UserLogIn

        result = UserLogIn(user="ghost_user", waferAgentName="MOCK")
        assert _status(result) == "error"
        assert "not recognized" in _msg(result)

    def test_valid_user_logs_in_successfully(self, mock_prober):
        from actions.WPLoginActions import UserLogIn
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        result = UserLogIn(user="user5", waferAgentName="MOCK")
        assert _status(result) == "success"
        assert SvtWPAagentGlobalParameters.getInstance().userLogged == "user5"

    def test_developer_login_sets_developer_state(self, mock_prober):
        from actions.WPLoginActions import UserLogIn
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState

        result = UserLogIn(user="user1", waferAgentName="MOCK")
        assert _status(result) == "success"
        assert agentStateMachine.get_state() == WPAgentState.UsedByDeveloper

    def test_normal_user_login_sets_userlogged_state(self, mock_prober):
        from actions.WPLoginActions import UserLogIn
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState

        result = UserLogIn(user="user5", waferAgentName="MOCK")
        assert _status(result) == "success"
        assert agentStateMachine.get_state() == WPAgentState.UserLogged

    def test_same_user_login_again_returns_success(self, mock_prober):
        from actions.WPLoginActions import UserLogIn

        UserLogIn(user="user5", waferAgentName="MOCK")
        result = UserLogIn(user="user5", waferAgentName="MOCK")
        # ResponseBuilder.success does not carry the message text — just check status
        assert _status(result) == "success"

    def test_second_user_cannot_take_control(self, mock_prober):
        from actions.WPLoginActions import UserLogIn

        UserLogIn(user="user5", waferAgentName="MOCK")
        result = UserLogIn(user="user6", waferAgentName="MOCK")
        assert _status(result) == "error"
        assert "user5" in _msg(result)

    def test_developer_takes_control_from_normal_user(self, mock_prober):
        from actions.WPLoginActions import UserLogIn
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        UserLogIn(user="user5", waferAgentName="MOCK")
        result = UserLogIn(user="user1", waferAgentName="MOCK")
        assert _status(result) == "success"
        assert SvtWPAagentGlobalParameters.getInstance().userLogged == "user1"

    def test_developer_cannot_take_control_from_another_developer(self, mock_prober):
        from actions.WPLoginActions import UserLogIn

        UserLogIn(user="user1", waferAgentName="MOCK")
        result = UserLogIn(user="user2", waferAgentName="MOCK")
        assert _status(result) == "error"
        # message contains the currently-logged-in developer's name or the word "Developer"
        msg = _msg(result)
        assert "Developer" in msg or "user1" in msg


# ─────────────────────────────────────────────────────────────
# UserLogOut
# ─────────────────────────────────────────────────────────────


class TestUserLogOut:

    def test_logout_when_nobody_logged_in_returns_error(self, mock_prober):
        from actions.WPLoginActions import UserLogOut

        result = UserLogOut(user="user5")
        assert _status(result) == "error"
        assert "No user" in _msg(result)

    def test_logout_wrong_user_returns_error(self, mock_prober):
        from actions.WPLoginActions import UserLogIn, UserLogOut

        UserLogIn(user="user5", waferAgentName="MOCK")
        result = UserLogOut(user="user6")
        assert _status(result) == "error"
        assert "user5" in _msg(result)

    def test_logout_correct_user_succeeds(self, mock_prober):
        from actions.WPLoginActions import UserLogIn, UserLogOut
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        UserLogIn(user="user5", waferAgentName="MOCK")
        result = UserLogOut(user="user5")
        assert _status(result) == "success"
        assert SvtWPAagentGlobalParameters.getInstance().userLogged is None

    def test_logout_resets_state_machine(self, mock_prober):
        from actions.WPLoginActions import UserLogIn, UserLogOut
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState

        UserLogIn(user="user5", waferAgentName="MOCK")
        UserLogOut(user="user5")
        assert agentStateMachine.get_state() == WPAgentState.ServiceOn

    def test_developer_logout_removes_developer_state(self, mock_prober):
        from actions.WPLoginActions import UserLogIn, UserLogOut
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState

        UserLogIn(user="user1", waferAgentName="MOCK")
        assert agentStateMachine.get_state() == WPAgentState.UsedByDeveloper
        UserLogOut(user="user1")
        assert agentStateMachine.get_state() == WPAgentState.ServiceOn

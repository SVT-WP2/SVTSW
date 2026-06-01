"""
Unit tests for auto-derived reply type via context variable.

What we verify
--------------
1. get_reply_type() inside @validate_command returns the correct string
   derived from the function name (snake_case → PascalCaseReply).

2. get_reply_type() inside @validate_command_with_name() returns the
   explicitly provided name (used when function name doesn't match command).

3. The context variable is isolated — one call does not leak into the next.

4. Every real action function returns a response whose "type" field exactly
   matches the expected reply type (end-to-end contract check).

5. Concurrent / nested calls each see their own reply type (context safety).
"""

import pytest
from unittest.mock import patch, MagicMock


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_validator_that_passes():
    """Return a mock validator that always passes validation."""
    v = MagicMock()
    v.validate_command.return_value = None   # None = no error
    return v


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_validator():
    """Patch get_validator so tests don't need a real WPCommandValidator."""
    mock_v = _make_validator_that_passes()
    with patch("utilities.WPValidationDecorator.get_validator", return_value=mock_v):
        yield mock_v


# ── 1. Basic derivation ───────────────────────────────────────────────────────

class TestReplyTypeDerivation:

    def test_single_word_function(self):
        from utilities.WPValidationDecorator import validate_command, get_reply_type
        from utilities.WPResponseBuilder import ResponseBuilder

        @validate_command
        def initialize(user=None, waferAgentName=None):
            return get_reply_type()

        result = initialize(user="u", waferAgentName="a")
        assert result == "InitializeReply"

    def test_two_word_function(self):
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        @validate_command
        def load_wafer(user=None, waferAgentName=None):
            return get_reply_type()

        assert load_wafer(user="u", waferAgentName="a") == "LoadWaferReply"

    def test_three_word_function(self):
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        @validate_command
        def move_chuck_contact(user=None, waferAgentName=None):
            return get_reply_type()

        assert move_chuck_contact(user="u", waferAgentName="a") == "MoveChuckContactReply"

    def test_four_word_function(self):
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        @validate_command
        def move_chuck_next_die(user=None, waferAgentName=None):
            return get_reply_type()

        assert move_chuck_next_die(user="u", waferAgentName="a") == "MoveChuckNextDieReply"

    def test_explicit_name_overrides_function_name(self):
        """validate_command_with_name uses the given name, not the function name."""
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type

        @validate_command_with_name("Initialize")
        def svt_initialise_wp(user=None, waferAgentName=None):
            return get_reply_type()

        assert svt_initialise_wp(user="u", waferAgentName="a") == "InitializeReply"

    def test_explicit_name_userlogin(self):
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type

        @validate_command_with_name("UserLogIn")
        def UserLogIn(user=None, waferAgentName=None):
            return get_reply_type()

        assert UserLogIn(user="u", waferAgentName="a") == "UserLogInReply"

    def test_explicit_name_userlogout(self):
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type

        @validate_command_with_name("UserLogOut")
        def UserLogOut(user=None, waferAgentName=None):
            return get_reply_type()

        assert UserLogOut(user="u", waferAgentName="a") == "UserLogOutReply"


# ── 2. Context isolation ───────────────────────────────────────────────────────

class TestContextIsolation:

    def test_reply_type_cleared_after_call(self):
        """get_reply_type() outside a decorated call returns empty string."""
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        @validate_command
        def load_wafer(user=None, waferAgentName=None):
            return get_reply_type()

        load_wafer(user="u", waferAgentName="a")
        assert get_reply_type() == ""   # context reset by finally block

    def test_two_sequential_calls_dont_bleed(self):
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        captured = []

        @validate_command
        def load_wafer(user=None, waferAgentName=None):
            captured.append(get_reply_type())

        @validate_command
        def unload_wafer(user=None, waferAgentName=None):
            captured.append(get_reply_type())

        load_wafer(user="u", waferAgentName="a")
        unload_wafer(user="u", waferAgentName="a")
        assert captured == ["LoadWaferReply", "UnloadWaferReply"]

    def test_reply_type_not_visible_outside_call(self):
        from utilities.WPValidationDecorator import get_reply_type
        assert get_reply_type() == ""

    def test_context_safe_across_threads(self):
        """Each thread sees its own reply type (contextvars are thread-local)."""
        import threading
        from utilities.WPValidationDecorator import validate_command, get_reply_type

        results = {}

        @validate_command
        def load_wafer(user=None, waferAgentName=None):
            import time; time.sleep(0.02)  # let other thread start
            results["load"] = get_reply_type()

        @validate_command
        def unload_wafer(user=None, waferAgentName=None):
            import time; time.sleep(0.01)
            results["unload"] = get_reply_type()

        t1 = threading.Thread(target=load_wafer,   kwargs={"user": "u", "waferAgentName": "a"})
        t2 = threading.Thread(target=unload_wafer, kwargs={"user": "u", "waferAgentName": "a"})
        t1.start(); t2.start()
        t1.join();  t2.join()

        assert results["load"]   == "LoadWaferReply"
        assert results["unload"] == "UnloadWaferReply"


# ── 3. Validation short-circuit ───────────────────────────────────────────────

class TestValidationShortCircuit:

    def test_validation_error_returns_before_function_body(self, reset_validator):
        """If validation fails, get_reply_type() is never called inside."""
        from utilities.WPValidationDecorator import validate_command, get_reply_type
        from utilities.WPResponseBuilder import ResponseBuilder

        reset_validator.validate_command.return_value = ResponseBuilder.error(
            "LoadWaferReply", "Not logged in", 401
        )

        entered = []

        @validate_command
        def load_wafer(user=None, waferAgentName=None):
            entered.append(True)
            return get_reply_type()

        result = load_wafer(user="u", waferAgentName="a")
        assert entered == []                        # body never ran
        assert result["status"] == "Error"
        assert get_reply_type() == ""               # context still clean


# ── 4. End-to-end: real action functions use reply in their response ───────────

class TestRealActionResponseTypes:
    """
    Verify that real decorated action functions return responses whose
    'type' field matches the expected reply type string.

    These tests patch the prober and globals so no hardware is needed.
    """

    @pytest.fixture(autouse=True)
    def developer_state(self, globals_instance):
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState
        globals_instance.set_user("dev", "Developer")
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)
        yield
        agentStateMachine.force_state(WPAgentState.ServiceOn)

    @pytest.fixture
    def prober(self):
        from drivers.WPMockProber import MockProberImpl
        mp = MockProberImpl("mock:35555")
        with patch("actions.WPTestingActions._ensure_initialized", return_value=None), \
             patch("actions.WPTestingActions.get_current_prober", return_value=mp):
            yield mp

    def test_move_chuck_contact_type(self, prober):
        from actions.WPTestingActions import move_chuck_contact
        result = move_chuck_contact(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "MoveChuckContactReply"

    def test_move_chuck_separation_type(self, prober):
        from actions.WPTestingActions import move_chuck_separation
        result = move_chuck_separation(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "MoveChuckSeparationReply"

    def test_move_chuck_next_die_type(self, prober):
        from actions.WPTestingActions import move_chuck_next_die
        result = move_chuck_next_die(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "MoveChuckNextDieReply"

    def test_move_chuck_home_type(self, prober):
        from actions.WPTestingActions import move_chuck_home
        result = move_chuck_home(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "MoveChuckHomeReply"

    def test_get_chuck_position_type(self, prober):
        from actions.WPTestingActions import get_chuck_position
        result = get_chuck_position(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "GetChuckPositionReply"

    def test_switch_camera_type(self, prober):
        from actions.WPTestingActions import switch_camera
        result = switch_camera(mountPoint="OffAxisCamera",
                               user="dev", waferAgentName="TestAgent")
        assert result["type"] == "SwitchCameraReply"

    def test_run_ptpa_type(self, prober):
        from actions.WPTestingActions import run_ptpa
        result = run_ptpa(user="dev", waferAgentName="TestAgent")
        assert result["type"] == "RunPTPAReply"

    def test_run_sequencer_type(self, tmp_path):
        """RunSequencer reply type is derived from run_sequencer function name."""
        import json
        seq_file = tmp_path / "seq.json"
        seq_file.write_text(json.dumps([]))   # empty sequence = instant success
        from actions.WPSequencerActions import run_sequencer
        result = run_sequencer(str(seq_file), user="dev", waferAgentName="TestAgent")
        assert result["type"] == "RunSequencerReply"


# ── 5. validate_command_with_name runs full validation ────────────────────────

class TestValidateCommandWithNameRunsValidation:
    """
    Verify that @validate_command_with_name is NOT a shortcut that skips checks.
    It must run exactly the same validation pipeline as @validate_command,
    just with an explicit command name instead of a derived one.
    """

    def test_rejects_when_user_not_logged_in(self, globals_instance):
        """UserLogIn is a bypass command so it skips the login check.
        Use a non-bypass command name to prove validation fires."""
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
        from stateMachine.WpAgentStateMachine import WPAgentState
        from utilities.WPValidator import get_validator, _validator_instance
        import utilities.WPValidator as wv

        # Reset real validator
        wv._validator_instance = None
        agentStateMachine.force_state(WPAgentState.UserLogged)
        globals_instance.userLogged = None  # no user logged in

        @validate_command_with_name("LoadWafer")
        def my_load_wafer(user=None, waferAgentName=None):
            return get_reply_type()

        with patch("utilities.WPValidationDecorator.get_validator", side_effect=get_validator):
            result = my_load_wafer(user=None, waferAgentName="TestAgent")

        assert result["status"] == "Error"
        assert result["type"] == "LoadWaferReply"   # reply type still correct in error

        agentStateMachine.force_state(WPAgentState.ServiceOn)
        wv._validator_instance = None

    def test_bypass_command_skips_login_check(self, globals_instance):
        """UserLogIn is in BYPASS_COMMANDS so it passes even with no user logged in."""
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type
        from utilities.WPValidator import get_validator
        import utilities.WPValidator as wv

        wv._validator_instance = None
        globals_instance.userLogged = None

        @validate_command_with_name("UserLogIn")
        def my_login(user=None, waferAgentName=None):
            return get_reply_type()

        with patch("utilities.WPValidationDecorator.get_validator", side_effect=get_validator):
            result = my_login(user=None, waferAgentName="TestAgent")

        # bypass command — validation passes, function body runs
        assert result == "UserLogInReply"
        wv._validator_instance = None

    def test_reply_type_correct_in_validation_error_response(self):
        """When validation fails, the error dict must still carry the right type."""
        from utilities.WPValidationDecorator import validate_command_with_name, get_reply_type
        from utilities.WPResponseBuilder import ResponseBuilder

        @validate_command_with_name("OpenProject")
        def my_open_project(user=None, waferAgentName=None):
            return get_reply_type()

        # Force validator to return an error
        reset_validator = _make_validator_that_passes()
        reset_validator.validate_command.return_value = ResponseBuilder.error(
            "OpenProjectReply", "Not logged in", 401
        )

        with patch("utilities.WPValidationDecorator.get_validator",
                   return_value=reset_validator):
            result = my_open_project(user=None, waferAgentName="a")

        assert result["status"] == "Error"
        assert result["type"] == "OpenProjectReply"

    def test_same_validator_called_as_validate_command(self):
        """The validator receives the explicit command name, not the function name."""
        from utilities.WPValidationDecorator import validate_command_with_name

        mock_v = _make_validator_that_passes()

        @validate_command_with_name("RunPTPA")
        def run_ptpa(user=None, waferAgentName=None):
            return "body ran"

        with patch("utilities.WPValidationDecorator.get_validator", return_value=mock_v):
            run_ptpa(user="u", waferAgentName="a")

        call_kwargs = mock_v.validate_command.call_args
        assert call_kwargs.kwargs["command"] == "RunPTPA"      # explicit name used
        assert call_kwargs.kwargs["reply_type"] == "RunPTPAReply"

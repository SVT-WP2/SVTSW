"""The engine: the path of every request of every mode."""

import logging

import pytest

from wptool.engine import Engine, Request, resolve, validate
from wptool.notintool import NOT_IN_TOOL, STEP_2
from wptool.registry import REGISTRY, Kind, Level, Param, command
from wptool.replies import Reply, ToolError


@pytest.fixture
def engine(config, sink):
    return Engine(config, events=sink)


@pytest.fixture
def temp_command():
    """Register commands for one test only."""
    names = []

    def register(name, **kwargs):
        kwargs.setdefault("summary", "Test")
        kwargs.setdefault("kind", Kind.OFFLINE)
        kwargs.setdefault("level", Level.DEVELOPER)

        def decorate(func):
            names.append(name)
            return command(name=name, **kwargs)(func)

        return decorate

    yield register
    for name in names:
        REGISTRY.pop(name, None)


def error_of(reply: Reply) -> tuple[int, str]:
    assert reply.status == "Error", reply
    return reply.error["code"], reply.error["message"]


# 1. Not a command of the tool


def test_unknown_command(engine):
    assert error_of(engine.execute(Request(command="Nope"))) == (404, "Unknown command: Nope")


def test_dropped_command_has_its_text(engine):
    reply = engine.execute(Request(command="UserLogIn"))
    assert error_of(reply) == (404, "UserLogIn is not a command of the WP tool: users belong to the agent (phase 2).")


@pytest.mark.parametrize("name", sorted(NOT_IN_TOOL))
def test_every_dropped_command(engine, name):
    code, message = error_of(engine.execute(Request(command=name)))
    assert code == 404
    assert message == f"{name} is not a command of the WP tool: {NOT_IN_TOOL[name]}"


@pytest.mark.parametrize("name", STEP_2)
def test_every_step_2_command(engine, name):
    reply = engine.execute(Request(command=name, params={"any": 1}))
    assert error_of(reply) == (404, f"{name} is not in the WP tool yet: use WPAgent (step 2 of the WP tool plan).")


def test_the_lists_of_the_plan():
    # The plan, "Commands": 52 commands wait for step 2, 11 are dropped.
    assert len(STEP_2) == len(set(STEP_2)) == 52
    assert len(NOT_IN_TOOL) == 11


def test_no_name_is_both_registered_and_in_a_list():
    assert not set(REGISTRY) & set(STEP_2)
    assert not set(REGISTRY) & set(NOT_IN_TOOL)
    assert not set(STEP_2) & set(NOT_IN_TOOL)


def test_resolve_and_validate_need_no_engine():
    assert resolve("ShowStatus").name == "ShowStatus"
    with pytest.raises(ToolError) as e:
        validate(Request(command="Sleep", params={"seconds": 1}))
    assert e.value.code == 404


# 2. user and waferAgentName (D13), and the context (D10)


def test_user_and_wafer_agent_name_are_ignored(engine):
    reply = engine.execute(Request(command="_Echo", params={"text": "a", "user": "someone", "waferAgentName": "machine-1"}))
    assert reply.ok
    assert reply.data["params"] == {"text": "a", "mode": "normal"}
    assert engine.execute(Request(command="ShowStatus", params={"user": "someone", "waferAgentName": "machine-1"})).ok


def test_a_context_is_ignored_and_logged(engine, caplog):
    caplog.set_level(logging.DEBUG, logger="wptool.engine")
    with_context = engine.execute(Request(id="7", command="_Echo", params={"count": 1}, context={"wafer": {"id": 5}}))
    without = engine.execute(Request(id="7", command="_Echo", params={"count": 1}))
    assert with_context == without
    assert any(r.levelno == logging.DEBUG and "context" in r.getMessage() and '"wafer"' in r.getMessage() for r in caplog.records)


# 3. Parameters


def test_a_parameter_error_is_400(engine):
    reply = engine.execute(Request(command="_Echo", params={"number": "far"}))
    assert error_of(reply) == (400, "Invalid type for 'number': expected number")


# 5. Run


def test_an_exception_gives_500_and_the_traceback_in_the_log(engine, caplog):
    caplog.set_level(logging.ERROR, logger="wptool.engine")
    reply = engine.execute(Request(id="x", command="_Fail"))
    assert reply.id == "x"
    assert error_of(reply) == (500, "_Fail failed: failed on purpose")
    records = [r for r in caplog.records if r.exc_info]
    assert records and records[0].exc_info[0] is RuntimeError
    assert "Traceback" in caplog.text


@pytest.mark.parametrize("code", [400, 404, 409, 500, 503])
def test_a_tool_error_keeps_its_code(engine, code):
    assert error_of(engine.execute(Request(command="_Fail", params={"code": code}))) == (code, f"Refused on purpose with {code}")


def test_keyboard_interrupt_goes_up_to_the_mode(engine):
    # Catch Exception, never BaseException: Ctrl+C and the signals of #408 end the tool.
    with pytest.raises(KeyboardInterrupt):
        engine.execute(Request(command="_Interrupt"))


def test_an_exception_without_text_names_its_type(engine, temp_command):
    @temp_command("_Bare")
    def bare(ctx):
        raise ValueError

    assert error_of(engine.execute(Request(command="_Bare"))) == (500, "_Bare failed: ValueError")


def test_data_that_is_not_a_dict_is_500(engine, temp_command):
    @temp_command("_NotADict")
    def not_a_dict(ctx):
        return "done"

    code, message = error_of(engine.execute(Request(command="_NotADict")))
    assert code == 500
    assert "not a dict" in message


@pytest.mark.parametrize("data", [{"x": float("nan")}, {"x": object()}])
def test_data_that_is_not_json_is_500(engine, temp_command, data):
    @temp_command("_NotJson")
    def not_json(ctx):
        return data

    code, message = error_of(engine.execute(Request(command="_NotJson")))
    assert code == 500
    assert "not JSON" in message


# 4. and 6. The hooks


class Recorder(Engine):
    def __init__(self, *args, refuse=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.calls = []
        self.refuse = refuse

    def _check_connection(self, spec, ctx):
        self.calls.append(("connection", spec.name))
        if self.refuse == "connection":
            raise ToolError(503, "Not connected")

    def _check_machine(self, spec, ctx):
        self.calls.append(("machine", spec.name))
        if self.refuse == "machine":
            raise ToolError(409, "Not in separation")

    def on_finish(self, request, reply):
        self.calls.append(("finish", reply.status))


def test_the_checks_run_in_order_before_the_command(config, sink):
    engine = Recorder(config, events=sink)
    assert engine.execute(Request(command="_Echo")).ok
    assert engine.calls == [("connection", "_Echo"), ("machine", "_Echo"), ("finish", "Success")]


@pytest.mark.parametrize("refuse, code, calls", [("connection", 503, ["connection"]), ("machine", 409, ["connection", "machine"])])
def test_a_check_that_refuses_stops_the_request(config, sink, refuse, code, calls):
    engine = Recorder(config, events=sink, refuse=refuse)
    reply = engine.execute(Request(command="_Progress"))
    assert reply.error["code"] == code
    assert [name for name, _ in engine.calls] == [*calls, "finish"]
    # The command did not run: it sends progress events.
    assert sink.events == []


def test_on_finish_runs_after_every_request(config, sink):
    engine = Recorder(config, events=sink)
    engine.execute(Request(command="_Fail"))
    engine.execute(Request(command="Nope"))
    engine.execute(Request(command="_Echo", params={"x": 1}))
    assert [call for call in engine.calls if call[0] == "finish"] == [("finish", "Error")] * 3


def test_a_failing_finish_makes_a_success_500(config, sink):
    class FailingFinish(Engine):
        def on_finish(self, request, reply):
            raise RuntimeError("local mode failed")

    engine = FailingFinish(config, events=sink)
    assert error_of(engine.execute(Request(command="ShowStatus"))) == (500, "ShowStatus failed: local mode failed")
    # An Error reply keeps its own error.
    assert error_of(engine.execute(Request(command="_Fail", params={"code": 409})))[0] == 409


# 7. and 8. The reply and the events


def test_progress_events_carry_the_id_and_come_before_the_reply(engine, sink):
    order = []
    reply = engine.execute(Request(id="p1", command="_Progress"), on_reply=lambda r: order.append(("reply", len(sink.events))))
    assert reply.ok
    assert sink.events == [
        {"id": "p1", "event": "progress", "data": {"step": 1, "of": 2}},
        {"id": "p1", "event": "progress", "data": {"step": 2, "of": 2}},
    ]
    assert order == [("reply", 2)]


def test_progress_without_an_id(engine, sink):
    engine.execute(Request(command="_Progress"))
    assert sink.events[0] == {"event": "progress", "data": {"step": 1, "of": 2}}


def test_status_event_only_when_the_state_changed_and_after_the_reply(engine, sink, temp_command):
    @temp_command("_Connect")
    def connect(ctx):
        ctx.state.machine = {"address": "192.0.2.10", "port": 35555}
        ctx.state.proberConnected = True
        return {"message": "Connected"}

    seen = []

    def on_reply(reply):
        seen.append(("reply", list(sink.events)))

    engine.execute(Request(command="ShowStatus"), on_reply=on_reply)
    assert sink.events == []
    engine.execute(Request(command="_Connect"), on_reply=on_reply)
    status = {"event": "status", "data": {"machine": {"address": "192.0.2.10", "port": 35555}, "proberConnected": True}}
    assert sink.events == [status]
    # The status event was not there yet when the reply was written.
    assert seen[1] == ("reply", [])
    engine.execute(Request(command="_Connect"))
    engine.execute(Request(command="ShowStatus"))
    assert sink.events == [status]


def test_a_failed_request_that_changed_the_state_also_gets_a_status_event(engine, sink, temp_command):
    @temp_command("_DropConnection")
    def drop(ctx):
        ctx.state.proberConnected = True
        raise ToolError(503, "The machine went away")

    assert not engine.execute(Request(command="_DropConnection")).ok
    assert sink.events == [{"event": "status", "data": {"machine": None, "proberConnected": True}}]


def test_reply_fields_of_the_tool_contract():
    assert Reply.success(None, {"message": "m"}).to_dict() == {"status": "Success", "data": {"message": "m"}}
    assert Reply.success("1", {"message": "m"}).to_dict() == {"id": "1", "status": "Success", "data": {"message": "m"}}
    assert Reply.failure("2", 400, "bad").to_dict() == {"id": "2", "status": "Error", "error": {"code": 400, "message": "bad"}}
    assert list(Reply.failure("2", 400, "bad").to_dict()) == ["id", "status", "error"]
    assert Reply.success(None, {"message": "µ ✅"}).to_json() == '{"status": "Success", "data": {"message": "µ ✅"}}'


def test_tool_error_codes_are_those_of_d15():
    with pytest.raises(ValueError):
        ToolError(401, "the host's code")


# 9. The log line


def test_one_log_line_per_request(engine, caplog):
    caplog.set_level(logging.INFO, logger="wptool.engine")
    engine.execute(Request(id="9", command="_Echo", params={"count": "2", "user": "someone"}))
    engine.execute(Request(command="_Fail", params={"code": 409}))
    lines = [r.getMessage() for r in caplog.records if r.name == "wptool.engine" and r.levelno == logging.INFO]
    assert len(lines) == 2
    assert lines[0].startswith('id=9 command=_Echo params={"count": "2"} status=Success code=- duration_ms=')
    assert lines[1].startswith('id=None command=_Fail params={"code": 409} status=Error code=409 duration_ms=')


# Shutdown


def test_shutdown_runs_the_shutdown_path_once(config, sink):
    class Counting(Engine):
        count = 0

        def on_shutdown(self):
            self.count += 1

    engine = Counting(config, events=sink)
    reply = engine.execute(Request(command="Shutdown"))
    assert reply.data == {"message": "Shutting down"}
    assert engine.stopped and engine.count == 1
    engine.shutdown()
    assert engine.count == 1


# The registry


def test_registering_a_name_twice_is_an_error():
    with pytest.raises(ValueError, match="twice"):
        @command(name="ShowStatus", summary="", kind=Kind.OFFLINE, level=Level.USER)
        def again(ctx):
            return {}


def test_the_function_takes_the_parameters_of_the_schema():
    with pytest.raises(ValueError, match="the function takes"):
        @command(name="_Mismatch", summary="", kind=Kind.OFFLINE, level=Level.USER, params={"x": Param("number")})
        def mismatch(ctx, y):
            return {}
    assert "_Mismatch" not in REGISTRY


def test_an_offline_command_does_not_change_the_machine():
    with pytest.raises(ValueError, match="offline"):
        @command(name="_Offline", summary="", kind=Kind.OFFLINE, level=Level.USER, changes_machine=True)
        def offline(ctx):
            return {}


def test_a_default_passes_its_own_check():
    with pytest.raises(ValueError, match="default"):
        @command(name="_BadDefault", summary="", kind=Kind.OFFLINE, level=Level.USER, params={"m": Param("string", default="x", choices=["a"])})
        def bad_default(ctx, m):
            return {}


def test_machine_commands_change_the_machine_and_need_a_connection_by_default(temp_command):
    @temp_command("_Move", kind=Kind.MACHINE, moves_chuck=True)
    def move(ctx):
        return {}

    @temp_command("_Query", kind=Kind.MACHINE, changes_machine=False)
    def query(ctx):
        return {}

    assert REGISTRY["_Move"].changes_machine and REGISTRY["_Move"].needs_connection and REGISTRY["_Move"].moves_chuck
    assert not REGISTRY["_Query"].changes_machine and REGISTRY["_Query"].needs_connection
    assert not REGISTRY["ShowStatus"].changes_machine and not REGISTRY["ShowStatus"].needs_connection

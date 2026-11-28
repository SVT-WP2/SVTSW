"""The check and conversion of the parameters (the engine, step 3): the same in every mode."""

import pytest

from wptool.params import check_params, check_value, drop_ignored
from wptool.registry import REGISTRY, CommandSpec, Kind, Level, Param
from wptool.replies import BAD_REQUEST, ToolError

ACCEPTED = [
    # type, value, result
    ("number", 1, 1.0),
    ("number", -2.5, -2.5),
    ("number", "2.5", 2.5),
    ("number", "-3", -3.0),
    ("number", " 7 ", 7.0),
    ("number", "1e3", 1000.0),
    ("integer", 3, 3),
    ("integer", -3, -3),
    ("integer", 3.0, 3),
    ("integer", "3", 3),
    ("integer", "-4", -4),
    # The text of the float 3.0: accepted as the float is (JSON and YAML give 3.0).
    ("integer", "3.0", 3),
    ("boolean", True, True),
    ("boolean", False, False),
    # In WPAgent bool("false") is True.
    ("boolean", "false", False),
    ("boolean", "False", False),
    ("boolean", "TRUE", True),
    ("boolean", "1", True),
    ("boolean", "0", False),
    ("boolean", "yes", True),
    ("boolean", "No", False),
    ("string", "abc", "abc"),
    ("string", "", ""),
    ("string", 5, "5"),
    ("string", 2.5, "2.5"),
    ("object", {"a": 1}, {"a": 1}),
    ("object", {}, {}),
    ("object", '{"a": [1, 2]}', {"a": [1, 2]}),
]

REFUSED = [
    # type, value
    ("number", True),
    ("number", False),
    ("number", "nan"),
    ("number", "NaN"),
    ("number", "inf"),
    ("number", "-Infinity"),
    ("number", float("nan")),
    ("number", float("inf")),
    ("number", 10**400),
    ("number", "far"),
    ("number", ""),
    ("number", [1]),
    ("number", {"x": 1}),
    ("integer", True),
    ("integer", 3.5),
    ("integer", "3.5"),
    ("integer", "three"),
    ("integer", "nan"),
    ("integer", float("inf")),
    ("integer", [3]),
    ("boolean", "maybe"),
    ("boolean", "on"),
    ("boolean", ""),
    ("boolean", 1),
    ("boolean", 0),
    ("boolean", 1.0),
    ("string", True),
    ("string", ["a"]),
    ("string", {"a": 1}),
    ("object", "[1, 2]"),
    ("object", "not json"),
    ("object", [1]),
    ("object", 5),
    ("object", True),
]


@pytest.mark.parametrize("type_name, value, result", ACCEPTED)
def test_accepted(type_name, value, result):
    converted = check_value("v", Param(type_name), value)
    assert converted == result
    assert type(converted) is type(result)


@pytest.mark.parametrize("type_name, value", REFUSED)
def test_refused(type_name, value):
    with pytest.raises(ToolError) as e:
        check_value("v", Param(type_name), value)
    assert e.value.code == BAD_REQUEST
    assert e.value.message == f"Invalid type for 'v': expected {type_name}"


def test_number_is_always_a_float():
    # So that 100 (JSON) and "100" (the shell) give the same reply.
    assert repr(check_value("x", Param("number"), 100)) == repr(check_value("x", Param("number"), "100")) == "100.0"


ORIENTATION = Param("string", choices=["West", "East", "North", "South"], ignore_case=True)


@pytest.mark.parametrize("value", ["west", "WEST", "West", "wEsT"])
def test_choice_in_any_case_gives_the_form_of_the_list(value):
    assert check_value("orientation", ORIENTATION, value) == "West"


def test_choice_that_is_not_allowed():
    with pytest.raises(ToolError) as e:
        check_value("orientation", ORIENTATION, "up")
    assert e.value.code == BAD_REQUEST
    assert e.value.message == "Invalid value for 'orientation': up (allowed: West, East, North, South)"


def test_choice_without_ignore_case_is_exact():
    param = Param("string", choices=["Zero", "Relative", "Center"])
    assert check_value("position", param, "Relative") == "Relative"
    with pytest.raises(ToolError) as e:
        check_value("position", param, "relative")
    assert "allowed: Zero, Relative, Center" in e.value.message


def test_choice_of_numbers_after_the_conversion():
    param = Param("integer", choices=[1, 2])
    assert check_value("n", param, "2") == 2
    with pytest.raises(ToolError):
        check_value("n", param, 3)


@pytest.mark.parametrize("value, result", [(0, 0.0), ("10", 10.0), (5.5, 5.5)])
def test_limits_keep_their_ends(value, result):
    assert check_value("z", Param("number", minimum=0, maximum=10), value) == result


def test_below_the_minimum():
    with pytest.raises(ToolError) as e:
        check_value("z", Param("number", minimum=0, maximum=10), "-0.5")
    assert e.value.code == BAD_REQUEST
    assert e.value.message == "Invalid value for 'z': -0.5 is below the minimum 0"


def test_above_the_maximum():
    with pytest.raises(ToolError) as e:
        check_value("count", Param("integer", minimum=0, maximum=10), 11)
    assert e.value.message == "Invalid value for 'count': 11 is above the maximum 10"


SPEC = CommandSpec(
    name="Example",
    summary="",
    kind=Kind.OFFLINE,
    level=Level.USER,
    func=lambda ctx, **params: {},
    params={
        "x": Param("number", required=True),
        "mode": Param("string", default="normal", choices=["normal", "fast"]),
        "label": Param("string"),
    },
    changes_machine=False,
    moves_chuck=False,
    long=False,
    needs_connection=False,
)


def test_every_parameter_of_the_schema_is_passed():
    assert check_params(SPEC, {"x": "1"}) == {"x": 1.0, "mode": "normal", "label": None}


def test_null_for_an_optional_parameter_gives_its_default():
    # As WPAgent's validator does (WPAgent/utilities/WPValidator.py lines 297-298).
    assert check_params(SPEC, {"x": 1, "mode": None, "label": None}) == {"x": 1.0, "mode": "normal", "label": None}


def test_a_given_value_wins_over_the_default():
    assert check_params(SPEC, {"x": 1, "mode": "fast"})["mode"] == "fast"


def test_unknown_key():
    with pytest.raises(ToolError) as e:
        check_params(SPEC, {"x": 1, "y": 2})
    assert e.value.code == BAD_REQUEST
    assert e.value.message == "Unknown parameter 'y' for Example"


@pytest.mark.parametrize("params", [{}, {"x": None}, {"mode": "fast"}])
def test_missing_required(params):
    with pytest.raises(ToolError) as e:
        check_params(SPEC, params)
    assert e.value.code == BAD_REQUEST
    assert e.value.message == "Missing required parameter 'x' for Example"


def test_the_ignored_keys():
    assert drop_ignored({"user": "someone", "waferAgentName": "machine-1", "x": 1}) == {"x": 1}


def test_check_params_does_not_change_its_input():
    params = {"x": "1"}
    check_params(SPEC, params)
    assert params == {"x": "1"}


def test_the_test_command_echo_uses_the_same_check():
    assert check_params(REGISTRY["_Echo"], {"orientation": "south", "count": "2"})["orientation"] == "South"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"type": "float"},
        {"type": "string", "ignore_case": True},
        {"type": "number", "choices": []},
        {"type": "string", "minimum": 1},
        {"type": "number", "minimum": 2, "maximum": 1},
        {"type": "number", "required": True, "default": 1},
    ],
)
def test_a_wrong_param_is_an_error_at_import_time(kwargs):
    with pytest.raises(ValueError):
        Param(**kwargs)

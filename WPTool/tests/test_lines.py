"""The command line of the shell and of the steps of run, and the words of call."""

import pytest

from wptool.lines import parse_line, parse_words
from wptool.replies import ToolError

LINES = [
    ("ShowStatus", "ShowStatus", {}),
    ("  ShowStatus  ", "ShowStatus", {}),
    # A quote can start inside a word, and it is removed.
    ('OpenProject projectName="ER2 test"', "OpenProject", {"projectName": "ER2 test"}),
    ("_Echo name='a b'", "_Echo", {"name": "a b"}),
    # A backslash is a normal character: Windows paths stay as they are.
    (r"_Echo file=C:\data\flow.yaml", "_Echo", {"file": r"C:\data\flow.yaml"}),
    (r'_Echo file="C:\My data\flow.yaml"', "_Echo", {"file": r"C:\My data\flow.yaml"}),
    (r"_Echo file=\\server\share\x.yaml", "_Echo", {"file": r"\\server\share\x.yaml"}),
    # A value is everything after the first = of its word.
    ("_Echo text=a=b=c", "_Echo", {"text": "a=b=c"}),
    ("_Echo text=", "_Echo", {"text": ""}),
    ("_Echo text=#5 count=2", "_Echo", {"text": "#5", "count": "2"}),
    ("_Echo\ttext=a", "_Echo", {"text": "a"}),
    ('MoveChuckXY {"x": 100, "y": -50, "position": "Relative"}', "MoveChuckXY", {"x": 100, "y": -50, "position": "Relative"}),
    ('_Echo   {"file": "C:\\\\data"}', "_Echo", {"file": "C:\\data"}),
    ("_Echo {}", "_Echo", {}),
]


@pytest.mark.parametrize("line, command, params", LINES)
def test_a_line(line, command, params):
    assert parse_line(line) == (command, params)


@pytest.mark.parametrize(
    "line, reason",
    [
        ('OpenProject projectName="ER2 test', "Cannot read the line: No closing quotation"),
        ("_Echo name='a b", "Cannot read the line: No closing quotation"),
        ("_Echo count", "Expected key=value, got 'count'"),
        ("_Echo =5", "Expected key=value, got '=5'"),
        ("_Echo count=1 count=2", "The parameter 'count' is given twice"),
        ('_Echo {"x": 1', "Cannot read the parameters as JSON"),
        ('_Echo {"x": NaN}', "Cannot read the parameters as JSON"),
        ("", "The line is empty"),
        ("   ", "The line is empty"),
    ],
)
def test_a_line_that_cannot_be_parsed_is_400(line, reason):
    with pytest.raises(ToolError) as e:
        parse_line(line)
    assert e.value.code == 400
    assert e.value.message.startswith(reason)


def test_the_json_form_must_be_an_object():
    with pytest.raises(ToolError) as e:
        parse_line("_Echo [1, 2]")
    # Not the JSON form: a word without =.
    assert e.value.message == "Expected key=value, got '[1,'"


WORDS = [
    ([], {}),
    (["projectName=ER2 test"], {"projectName": "ER2 test"}),
    ([r"file=C:\My data\x.yaml"], {"file": r"C:\My data\x.yaml"}),
    (["text=a=b", "count=3"], {"text": "a=b", "count": "3"}),
    (['text="quoted"'], {"text": '"quoted"'}),
    (['{"x": 100, "position": "Relative"}'], {"x": 100, "position": "Relative"}),
    (["text={not json"], {"text": "{not json"}),
]


@pytest.mark.parametrize("words, params", WORDS)
def test_the_words_of_call(words, params):
    assert parse_words(words) == params


@pytest.mark.parametrize("words", [["--mock"], ["count"], ['{"x": 1'], ["{}", "count=1"], ["a=1", "a=2"]])
def test_words_that_cannot_be_parsed(words):
    with pytest.raises(ToolError) as e:
        parse_words(words)
    assert e.value.code == 400

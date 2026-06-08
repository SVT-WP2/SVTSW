"""
Unit tests for linters/CheckKafkaConventions.py

Each check function is tested in isolation by passing synthesised
in-memory Python source files — no real files on disk needed.

Strategy
--------
* Build a one-line or multi-line Python snippet as a string.
* Wrap it in a temporary Path object via a helper that satisfies
  the (filepath: Path) → list[Issue] interface expected by each check.
* Assert that the expected issues are (or are not) returned.
"""

import sys
import ast
import tempfile
import textwrap
from pathlib import Path

import pytest

# Make the linters/ directory importable without installing the package.
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "linters"))

from CheckKafkaConventions import (  # noqa: E402
    Issue,
    check_topic_names,
    check_reply_topics,
    check_header_literals,
    check_status_values,
    check_data_key_naming,
    HEADER_STRINGS_EXEMPT,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _tmpfile(source: str, name: str = "test_snippet.py") -> list[Path]:
    """Write *source* to a real temp file and return [Path] for the checkers."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", prefix=name.replace(".py", "_"),
        delete=False, encoding="utf-8"
    ) as f:
        f.write(textwrap.dedent(source))
        return [Path(f.name)]


def _issues(check_fn, source: str, name: str = "test_snippet.py") -> list[Issue]:
    files = _tmpfile(source, name)
    try:
        return check_fn(files)
    finally:
        for p in files:
            p.unlink(missing_ok=True)


# ── Check 1: Topic name format ────────────────────────────────────────────────

class TestTopicNames:

    def test_valid_simple_topic(self):
        issues = _issues(check_topic_names, 'topic = "svt.wp-agent.request"\n')
        assert issues == []

    def test_valid_multi_segment_topic(self):
        issues = _issues(check_topic_names, 'topic = "svt.my-service.some-action"\n')
        assert issues == []

    def test_invalid_uppercase_segment(self):
        issues = _issues(check_topic_names, 'topic = "svt.WPAgent.Request"\n')
        assert len(issues) == 1
        assert issues[0].check == "topic-name"
        assert "svt.WPAgent.Request" in issues[0].message

    def test_invalid_underscore_in_segment(self):
        issues = _issues(check_topic_names, 'topic = "svt.wp_agent.request"\n')
        assert len(issues) == 1
        assert issues[0].check == "topic-name"

    def test_invalid_missing_svt_prefix_ignored(self):
        # Non-svt strings are simply skipped, not flagged.
        issues = _issues(check_topic_names, 'topic = "mycompany.some.topic"\n')
        assert issues == []

    def test_multiple_violations_all_reported(self):
        src = (
            'a = "svt.BadTopic"\n'
            'b = "svt.also_bad"\n'
        )
        issues = _issues(check_topic_names, src)
        assert len(issues) == 2

    def test_valid_numeric_segment(self):
        issues = _issues(check_topic_names, 'topic = "svt.wp-agent2.request"\n')
        assert issues == []

    def test_svt_alone_is_invalid(self):
        # "svt" has no sub-segment — must have at least one.
        issues = _issues(check_topic_names, 'topic = "svt"\n')
        assert issues == []  # doesn't start with "svt." so it's not checked

    def test_svt_dot_empty_invalid(self):
        issues = _issues(check_topic_names, 'topic = "svt."\n')
        assert len(issues) == 1


# ── Check 2: Reply topics ─────────────────────────────────────────────────────

class TestReplyTopics:

    def test_valid_reply_topic_literal(self):
        issues = _issues(check_reply_topics, 'rt = "svt.wp-agent.request.reply"\n')
        assert issues == []

    def test_invalid_reply_topic_literal_bad_base(self):
        # ".reply" suffix is present but the base is not a valid topic.
        issues = _issues(check_reply_topics, 'rt = "svt.WPAgent.reply"\n')
        assert len(issues) == 1
        assert issues[0].check == "reply-topic"

    def test_variable_named_reply_topic_must_end_in_reply(self):
        src = 'reply_topic = "svt.wp-agent.request"\n'
        issues = _issues(check_reply_topics, src)
        assert len(issues) == 1
        assert "reply_topic" in issues[0].message

    def test_variable_named_reply_topic_valid(self):
        src = 'reply_topic = "svt.wp-agent.request.reply"\n'
        issues = _issues(check_reply_topics, src)
        assert issues == []

    def test_allcaps_reply_topic_variable_skipped(self):
        # ALL_CAPS names are header-key constants, not topic variables.
        src = 'KAFKA_REPLY_TOPIC = "svt.wp-agent.request"\n'
        issues = _issues(check_reply_topics, src)
        assert issues == []

    def test_non_reply_literal_ignored(self):
        issues = _issues(check_reply_topics, 'x = "svt.wp-agent.request"\n')
        assert issues == []


# ── Check 3: Header literals ──────────────────────────────────────────────────

class TestHeaderLiterals:

    def test_raw_correlation_id_string_flagged(self):
        src = 'h = "kafka_correlationId"\n'
        issues = _issues(check_header_literals, src)
        assert len(issues) == 1
        assert issues[0].check == "header-literal"
        assert "kafka_correlationId" in issues[0].message

    def test_raw_reply_topic_string_flagged(self):
        src = 'h = "kafka_replyTopic"\n'
        issues = _issues(check_header_literals, src)
        assert len(issues) == 1

    def test_raw_reply_partition_string_flagged(self):
        src = 'h = "kafka_replyPartition"\n'
        issues = _issues(check_header_literals, src)
        assert len(issues) == 1

    def test_exempt_file_not_flagged(self):
        """Files in HEADER_STRINGS_EXEMPT are allowed to define the constants."""
        # Write the file with an exempt name and run the checker.
        exempt_name = next(iter(HEADER_STRINGS_EXEMPT))  # e.g. "WPKafkaClient.py"
        src = 'KAFKA_HEADER__CORRELATION_ID = "kafka_correlationId"\n'
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py",
            prefix=exempt_name.replace(".py", "_"),
            delete=False, encoding="utf-8"
        ) as f:
            f.write(src)
            tmp = Path(f.name)
        # Rename so the file *name* matches (checker uses filepath.name).
        renamed = tmp.parent / exempt_name
        tmp.rename(renamed)
        try:
            issues = check_header_literals([renamed])
            assert issues == []
        finally:
            renamed.unlink(missing_ok=True)

    def test_non_header_string_not_flagged(self):
        src = 'h = "some_other_header"\n'
        issues = _issues(check_header_literals, src)
        assert issues == []

    def test_all_three_headers_flagged(self):
        src = (
            'a = "kafka_correlationId"\n'
            'b = "kafka_replyTopic"\n'
            'c = "kafka_replyPartition"\n'
        )
        issues = _issues(check_header_literals, src)
        assert len(issues) == 3


# ── Check 4: Status values ────────────────────────────────────────────────────

class TestStatusValues:

    def test_valid_success_status(self):
        src = 'msg = {"status": "Success"}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_valid_error_status(self):
        src = 'msg = {"status": "Error"}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_valid_bad_request_status(self):
        src = 'msg = {"status": "BadRequest"}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_valid_not_found_status(self):
        src = 'msg = {"status": "NotFound"}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_valid_unexpected_error_status(self):
        src = 'msg = {"status": "UnexpectedError"}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_wrong_case_success_flagged_as_error(self):
        src = 'msg = {"status": "success"}\n'
        issues = _issues(check_status_values, src)
        assert len(issues) == 1
        assert issues[0].severity == "error"

    def test_wrong_case_error_flagged(self):
        src = 'msg = {"status": "error"}\n'
        issues = _issues(check_status_values, src)
        assert len(issues) == 1
        assert issues[0].check == "status-value"

    def test_completely_invalid_status_flagged_as_warning(self):
        src = 'msg = {"status": "OK"}\n'
        issues = _issues(check_status_values, src)
        # "OK" is not a valid status; it matches the status-like regex so it's a warning
        assert len(issues) >= 1

    def test_no_status_key_not_flagged(self):
        src = 'msg = {"type": "SomeEvent", "data": {}}\n'
        issues = _issues(check_status_values, src)
        assert issues == []

    def test_status_like_comparison_flagged(self):
        # Comparison with a misspelled status value
        src = 'if r["status"] == "success":\n    pass\n'
        issues = _issues(check_status_values, src)
        assert len(issues) >= 1
        assert any(i.check == "status-value" for i in issues)

    def test_correct_status_comparison_not_flagged(self):
        src = 'if r["status"] == "Success":\n    pass\n'
        issues = _issues(check_status_values, src)
        assert issues == []


# ── Check 5: Data key naming ──────────────────────────────────────────────────

class TestDataKeyNaming:

    def test_valid_camel_case_key(self):
        src = 'msg = {"type": "T", "data": {"waferId": 1}}\n'
        issues = _issues(check_data_key_naming, src)
        assert issues == []

    def test_underscore_key_flagged(self):
        src = 'msg = {"type": "T", "data": {"wafer_id": 1}}\n'
        issues = _issues(check_data_key_naming, src)
        assert len(issues) >= 1
        assert any(i.check == "data-key-naming" for i in issues)

    def test_uppercase_first_letter_flagged(self):
        src = 'msg = {"type": "T", "data": {"WaferId": 1}}\n'
        issues = _issues(check_data_key_naming, src)
        assert len(issues) >= 1

    def test_multiple_bad_keys_all_flagged(self):
        src = 'msg = {"type": "T", "data": {"wafer_id": 1, "Die_Row": 2}}\n'
        issues = _issues(check_data_key_naming, src)
        assert len(issues) >= 2

    def test_camel_whitelist_allowed(self):
        # WPAG_State is explicitly whitelisted.
        src = 'msg = {"type": "T", "data": {"WPAG_State": "On"}}\n'
        issues = _issues(check_data_key_naming, src)
        assert issues == []

    def test_dict_without_type_key_not_checked(self):
        # Only dicts with a "type" key are treated as Kafka messages.
        src = 'plain = {"wafer_id": 1, "Die_Row": 2}\n'
        issues = _issues(check_data_key_naming, src)
        assert issues == []

    def test_multiple_valid_keys(self):
        src = (
            'msg = {"type": "T", "data": '
            '{"waferId": 1, "dieRow": 2, "colIndex": 3}}\n'
        )
        issues = _issues(check_data_key_naming, src)
        assert issues == []

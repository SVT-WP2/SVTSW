"""
Centralised error helpers for the SVT Test Agent.

This module defines canonical status constants and helper functions for
building normalized error envelopes, mapping exceptions and DB-agent
payloads into those statuses, and classifying DB-related errors.

Location: svt_test_agent/utilities/errors.py
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

# Canonical statuses for error replies
TEST_FAIL       = "TestFail"
TEST_AGENTFAIL  = "TestAgentFail"
DB_AGENTFAIL    = "DBAgentFail"
DB_FAIL         = "DBFail"
KAFKA_FAIL      = "KafkaFail"

JsonDict = Dict[str, Any]

logger = logging.getLogger("Errors")
# Inherit root level by default; allow explicit DEBUG via env toggle
logger.setLevel(logging.DEBUG if os.getenv("SVT_ERR_DEBUG") else logging.NOTSET)


def _base(
    cmd_type: str,
    status: str,
    message: str,
    request_id: Optional[str],
    *,
    place_request_id_in_data: bool = False,
) -> JsonDict:
    """
    Build a normalized error envelope:

    {
      "type": "<Cmd>Reply",
      "status": "<status>",                # e.g., TestFail / TestAgentFail / DBAgentFail / DBFail / KafkaFail
      "statusDetails": { "error": "<message>" },
      "requestId": "<id>"                  # (top-level by default)
    }

    If place_request_id_in_data=True, 'requestId' goes inside statusDetails instead.
    """
    logger.debug(
        "_base enter: cmd_type=%s status=%s message=%r request_id=%r place_in_data=%s",
        cmd_type,
        status,
        message,
        request_id,
        place_request_id_in_data,
    )

    reply: JsonDict = {
        "type": f"{cmd_type}Reply",
        "status": status,
        "statusDetails": {"error": str(message)},
    }

    rid = None if request_id is None else str(request_id)

    if place_request_id_in_data:
        if rid is not None:
            reply["statusDetails"]["requestId"] = rid
    else:
        if rid is not None:
            reply["requestId"] = rid

    out = {"out": reply}
    logger.debug("_base exit -> keys=%s", list(reply.keys()))
    return out


# ---- Public, friendly constructors ----

def test_fail(
    cmd_type: str,
    request_id: Optional[str],
    message: str,
    *,
    in_data: bool = False,
) -> JsonDict:
    logger.debug("test_fail(%s, req_id=%r, msg=%r, in_data=%s)", cmd_type, request_id, message, in_data)
    return _base(cmd_type, TEST_FAIL, message, request_id, place_request_id_in_data=in_data)


def agent_fail(
    cmd_type: str,
    request_id: Optional[str],
    message: str,
    *,
    in_data: bool = False,
) -> JsonDict:
    logger.debug("agent_fail(%s, req_id=%r, msg=%r, in_data=%s)", cmd_type, request_id, message, in_data)
    return _base(cmd_type, TEST_AGENTFAIL, message, request_id, place_request_id_in_data=in_data)


def db_agent_fail(
    cmd_type: str,
    request_id: Optional[str],
    message: str,
    *,
    in_data: bool = False,
) -> JsonDict:
    logger.debug("db_agent_fail(%s, req_id=%r, msg=%r, in_data=%s)", cmd_type, request_id, message, in_data)
    return _base(cmd_type, DB_AGENTFAIL, message, request_id, place_request_id_in_data=in_data)


def db_fail(
    cmd_type: str,
    request_id: Optional[str],
    message: str,
    *,
    in_data: bool = False,
) -> JsonDict:
    logger.debug("db_fail(%s, req_id=%r, msg=%r, in_data=%s)", cmd_type, request_id, message, in_data)
    return _base(cmd_type, DB_FAIL, message, request_id, place_request_id_in_data=in_data)


def kafka_fail(
    cmd_type: str,
    request_id: Optional[str],
    message: str,
    *,
    in_data: bool = False,
) -> JsonDict:
    logger.debug("kafka_fail(%s, req_id=%r, msg=%r, in_data=%s)", cmd_type, request_id, message, in_data)
    return _base(cmd_type, KAFKA_FAIL, message, request_id, place_request_id_in_data=in_data)


# ---- Helpers for mapping exceptions / DB replies to statuses ----

def from_exception(
    cmd_type: str,
    request_id: Optional[str],
    exc: BaseException,
    *,
    in_data: bool = False,
) -> JsonDict:
    """
    Coarse mapping of exceptions to statuses.
    - “Kafka” substrings → KafkaFail
    - timeouts / ‘timeout’ → DBAgentFail (agent didn't reply)
    - otherwise → TestAgentFail
    """
    msg = str(exc)
    low = msg.lower()
    logger.debug("from_exception(%s, req_id=%r, exc=%r)", cmd_type, request_id, msg)

    if "kafka" in low:
        out = kafka_fail(cmd_type, request_id, msg, in_data=in_data)
        logger.debug("from_exception -> KafkaFail")
        return out
    if "timeout" in low:
        out = db_agent_fail(cmd_type, request_id, msg, in_data=in_data)
        logger.debug("from_exception -> DBAgentFail (timeout)")
        return out
    out = agent_fail(cmd_type, request_id, msg, in_data=in_data)
    logger.debug("from_exception -> TestAgentFail (default)")
    return out


def from_db_payload(
    cmd_type: str,
    request_id: Optional[str],
    db_reply: JsonDict,
    *,
    in_data: bool = False,
) -> Tuple[bool, JsonDict]:
    """
    Normalize a DB-agent response into (ok, error_reply_or_empty).

    If it looks successful (common shapes: {"status":"Success"} or {"testStatus":"TestSuccess"}),
    returns (True, {}).

    Otherwise, returns (False, <normalized error envelope>) picking the best status bucket:
      - if KafkaException in error → KafkaFail
      - if explicit "DBFail" / "DBAgentFail" / "DBQueryFail" → DBFail/DBAgentFail
      - else → TestFail (generic)
    """
    logger.debug(
        "from_db_payload enter: cmd=%s req_id=%r keys=%s",
        cmd_type,
        request_id,
        list((db_reply or {}).keys()),
    )
    status = (db_reply.get("status") or db_reply.get("testStatus") or "").strip()
    if status.lower() in {"success", "testsuccess", "ok"}:
        logger.debug("from_db_payload -> success (status=%r)", status)
        return True, {}

    # Pull error text
    err = db_reply.get("error")
    if isinstance(err, dict):
        err = err.get("message") or err.get("error") or err
    if not err:
        data = db_reply.get("data") or {}
        derr = data.get("error")
        if isinstance(derr, dict):
            err = derr.get("message") or derr.get("error") or derr
        elif derr:
            err = derr
    message = str(err or db_reply)
    logger.debug("from_db_payload extracted error=%r status=%r", message, status)

    low = message.lower()
    if "kafkaexception" in low or "kafka" in low:
        logger.debug("from_db_payload -> KafkaFail")
        return False, kafka_fail(cmd_type, request_id, message, in_data=in_data)

    # Map common DB agent codes (if present)
    code = status  # many DB agents echo their status as the “code”
    code_low = code.lower()
    if "dbagentfail" in code_low:
        logger.debug("from_db_payload -> DBAgentFail (code)")
        return False, db_agent_fail(cmd_type, request_id, message, in_data=in_data)
    if "dbfail" in code_low:
        logger.debug("from_db_payload -> DBFail (code)")
        return False, db_fail(cmd_type, request_id, message, in_data=in_data)
    if "dbqueryfail" in code_low:
        logger.debug("from_db_payload -> DBFail (query)")
        return False, db_fail(cmd_type, request_id, message, in_data=in_data)

    if "timeout" in low:
        logger.debug("from_db_payload -> DBAgentFail (timeout text)")
        return False, db_agent_fail(cmd_type, request_id, message, in_data=in_data)

    logger.debug("from_db_payload -> TestFail (fallback)")
    return False, test_fail(cmd_type, request_id, message, in_data=in_data)


def error_reply(
    cmd_base: str,
    status: str,
    message: str,
    request_id: Optional[str],
) -> JsonDict:
    """
    Build the centralized error payload:

    {
      "type": "<CmdBase>Reply",
      "Status": "<one of the above>",
      "statusDetails": { "error": "<message>", "requestId": "<id>" }
    }
    """
    logger.debug(
        "error_reply(%s, status=%s, msg=%r, req_id=%r)",
        cmd_base,
        status,
        message,
        request_id,
    )
    out = {
        "type": f"{cmd_base}Reply",
        "Status": status,
        "statusDetails": {
            "error": str(message),
            "requestId": str(request_id) if request_id is not None else "unknown",
        },
    }
    logger.debug("error_reply -> keys=%s", list(out.keys()))
    return out


def classify_db_error(err_txt: str) -> str:
    """
    Heuristic classifier for DB-related failures → Status.
    """
    low = (err_txt or "").lower()
    logger.debug("classify_db_error(%r)", err_txt)
    if "kafka" in low:
        logger.debug("classify_db_error -> KafkaFail")
        return KAFKA_FAIL
    if "agent" in low or "unavailable" in low or "timeout" in low:
        logger.debug("classify_db_error -> DBAgentFail")
        return DB_AGENTFAIL
    logger.debug("classify_db_error -> DBFail")
    return DB_FAIL


def status_from_exception(ex: BaseException) -> str:
    """
    Exceptions thrown inside the test agent are agent-side unless we detect otherwise.
    """
    msg = (str(ex) or "").lower()
    logger.debug("status_from_exception(%r)", msg)
    if "kafka" in msg:
        logger.debug("status_from_exception -> KafkaFail")
        return KAFKA_FAIL
    if "db" in msg or "database" in msg or "psql" in msg:
        logger.debug("status_from_exception -> DBFail")
        return DB_FAIL
    logger.debug("status_from_exception -> TestAgentFail")
    return TEST_AGENTFAIL
from __future__ import annotations

"""
Database-agent client utilities for the SVT Test Agent.

This module provides:
  - Kafka plumbing for request/response calls to the DB Agent.
  - Correlation-id based matching of replies (key + headers).
  - Normalisation helpers for chip/test IDs and basic latency tracking.
  - High-level helpers for:
      * resolve_chip_type  (chipId -> asicId -> familyType -> chipName)
      * get_chip_name      (chipId -> chipName via resolve_chip_type)
      * get_all_tests      (chip ids -> registry + DB-backed mapping)
      * save_test_to_db    (Create<Chip>Test wrapper)
      * fetch_from_db      (backwards-compatible façade over the above)

Location: svt_test_agent/db_client.py
"""

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from confluent_kafka import Consumer, KafkaException, Producer, TopicPartition

from svt_test_agent.utilities.util_config import get_cfg, build_kafka_config
from svt_test_agent.test_system_client import TestSystemClient

logger = logging.getLogger("DBClient")
logger.setLevel(logging.NOTSET)

JsonDict = Dict[str, Any]

# ------------------------------------------------------------------------------
# Kafka plumbing
# ------------------------------------------------------------------------------


def _resolve_topics(
    request_topic: Optional[str],
    reply_topic: Optional[str],
) -> Tuple[str, str]:
    logger.debug(
        "_resolve_topics(request_topic=%r, reply_topic=%r) enter",
        request_topic,
        reply_topic,
    )
    cfg = get_cfg()
    req = request_topic or getattr(cfg, "DB_REQUEST_TOPIC", None)
    rep = reply_topic or getattr(cfg, "DB_REPLY_TOPIC", None)
    logger.info("DB topics (resolved): request=%s reply=%s", req, rep)
    if not req or not rep:
        logger.error(
            "Missing DB topics in config. DB_REQUEST_TOPIC=%r DB_REPLY_TOPIC=%r",
            req,
            rep,
        )
        raise RuntimeError(
            "config must define DB_REQUEST_TOPIC and DB_REPLY_TOPIC",
        )
    logger.debug("_resolve_topics -> (%r, %r)", req, rep)
    return req, rep


def _kafka_conf() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    logger.debug("_kafka_conf() enter")
    kc = build_kafka_config()
    prod, cons = dict(kc["producer"]), dict(kc["consumer"])
    logger.debug(
        "_kafka_conf -> producer_keys=%s consumer_keys=%s",
        list(prod.keys()),
        list(cons.keys()),
    )
    return prod, cons


_PROD_BASE, _CONS_BASE = _kafka_conf()


def _producer() -> Producer:
    logger.debug(
        "_producer() create Producer bootstrap=%r",
        _PROD_BASE.get("bootstrap.servers"),
    )
    return Producer(_PROD_BASE)


def _consumer() -> Consumer:
    # Unique group id avoids stale offsets & group races for RPC-style flows.
    c = dict(_CONS_BASE)
    c["group.id"] = f"SVT-TestAgent-DBClient-{uuid.uuid4().hex[:8]}"
    c["auto.offset.reset"] = "latest"
    c["enable.auto.commit"] = False
    logger.debug(
        "_consumer() bootstrap=%s group=%s auto.offset.reset=%s",
        _CONS_BASE.get("bootstrap.servers"),
        c["group.id"],
        c["auto.offset.reset"],
    )
    return Consumer(c)


def _wait_for_assignment(
    cons: Consumer,
    topic: str,
    max_wait_s: float = 3.0,
) -> None:
    """Poll until partitions are assigned or timeout; log diagnostic state."""
    logger.debug(
        "_wait_for_assignment(topic=%r, max_wait_s=%.1f) enter",
        topic,
        max_wait_s,
    )
    deadline = time.time() + max_wait_s
    while time.time() < deadline:
        cons.poll(0.1)  # service rebalance callbacks
        asn = cons.assignment()
        if asn:
            logger.debug("_wait_for_assignment: ASSIGNED %s", asn)
            return
        time.sleep(0.05)

    md = cons.list_topics(topic, timeout=3.0)
    tmeta = md.topics.get(topic)
    parts = [] if tmeta is None else list(tmeta.partitions.keys())
    logger.warning(
        "_wait_for_assignment: NO ASSIGNMENT (subscription=%s assignment=%s "
        "topic_exists=%s partitions=%s)",
        cons.subscription(),
        cons.assignment(),
        tmeta is not None,
        parts,
    )


def _assign_tail(cons: Consumer, topic: str, backfill: int = 20) -> List[int]:
    """
    Start reading a little before the current high-watermark to avoid
    subscribe/fetch races. Returns the partitions we assigned.
    """
    logger.debug("_assign_tail(topic=%r, backfill=%d) enter", topic, backfill)
    md = cons.list_topics(topic, timeout=3.0)
    tmeta = md.topics.get(topic)
    parts = list((tmeta or {}).partitions.keys()) or [0]
    tps: List[TopicPartition] = []
    for p in parts:
        low, high = cons.get_watermark_offsets(
            TopicPartition(topic, p),
            timeout=3.0,
        )
        start = max(low, high - max(1, backfill))
        tps.append(TopicPartition(topic, p, start))
    cons.assign(tps)
    logger.debug(
        "_assign_tail assigned -> %s",
        [(tp.partition, tp.offset) for tp in tps],
    )
    return parts


# ------------------------------------------------------------------------------
# Helpers / normalisers
# ------------------------------------------------------------------------------

COMMAND_WIRE_MAP: Dict[str, str] = {
    "GetAllTests": "ResolveChipName",
    "GetChipName": "ResolveChipName",
}

_CORR_HEADER_CANDIDATES = (
    "correlationId",
    "correlation-id",
    "CorrelationId",
    "Correlation-ID",
    "corrId",
    "correlation_id",
)


def _wire_type(logical: str) -> str:
    wire = COMMAND_WIRE_MAP.get(logical, logical)
    logger.debug("_wire_type(%r) -> %r", logical, wire)
    return wire


def _b2s(x: Any) -> Optional[str]:
    if x is None:
        return None
    if isinstance(x, (bytes, bytearray)):
        try:
            return x.decode("utf-8", "replace")
        except Exception:
            return str(x)
    return str(x)


def _hdr_corr(msg) -> Optional[str]:
    try:
        hdrs = dict(msg.headers() or [])
    except Exception:
        logger.debug("_hdr_corr: no headers on message")
        return None
    for k in _CORR_HEADER_CANDIDATES:
        if k in hdrs:
            val = _b2s(hdrs[k])
            logger.debug("_hdr_corr found %r=%r", k, val)
            return val
    return None


def _normalize_ids(ids: Any) -> List[int]:
    """
    Convert scalars / nested lists into List[int], ignoring '', 'unknown', None
    and non-numeric entries.
    """
    logger.debug("_normalize_ids(%r) enter", ids)
    out: List[int] = []
    if ids is None:
        logger.debug("_normalize_ids -> [] (input None)")
        return out

    def push(x: Any) -> None:
        if x is None:
            return
        s = str(x).strip()
        if not s or s.lower() in {"na", "none", "unknown"}:
            return
        try:
            out.append(int(s))
        except Exception:
            logger.debug("_normalize_ids: skipped non-int %r", x)

    if isinstance(ids, (list, tuple)):
        for v in ids:
            if isinstance(v, (list, tuple)):
                for vv in v:
                    push(vv)
            else:
                push(v)
    else:
        push(ids)

    logger.debug("_normalize_ids -> %r", out)
    return out


def _latency_ms(t0: float) -> float:
    return round((time.time() - t0) * 1000.0, 1)


# ------------------------------------------------------------------------------
# Generic request/response (key OR header correlation + tail backfill)
# ------------------------------------------------------------------------------


def send_db_request(
    msg_type: str,
    data: Optional[JsonDict],
    *,
    request_id: Optional[str] = None,
    timeout_s: float = 10.0,
    retries: int = 0,
    backoff_s: float = 0.5,
    request_topic: Optional[str] = None,
    reply_topic: Optional[str] = None,
    tail_backfill: int = 20,
) -> JsonDict:
    """
    Send a message to the DB Agent and wait for a reply with a matching
    correlation id (Kafka key OR correlation header).

    A small tail backfill is used when assigning the consumer to reduce
    races between subscribe and fetch.
    """
    wire = _wire_type(msg_type)
    req_topic, rep_topic = _resolve_topics(request_topic, reply_topic)
    logger.debug(
        "send_db_request enter: wire=%s req_topic=%s rep_topic=%s "
        "timeout=%.1fs retries=%d backfill=%d request_id=%r",
        wire,
        req_topic,
        rep_topic,
        timeout_s,
        retries,
        tail_backfill,
        request_id,
    )

    attempt = 0
    last_error: Optional[JsonDict] = None

    while attempt <= retries:
        attempt += 1
        t_attempt = time.time()

        corr_id = (
            f"{request_id}_{uuid.uuid4().hex}"
            if request_id
            else uuid.uuid4().hex
        )
        corr_key = corr_id.encode("utf-8")
        logger.debug("Attempt %d/%d corr_id=%s", attempt, retries + 1, corr_id)

        prod = _producer()
        cons = _consumer()

        headers = [
            ("correlationId", corr_key),
            ("replyTopic", rep_topic.encode("utf-8")),
            ("cmdType", wire.encode("utf-8")),
        ]
        req_payload: JsonDict = {"type": wire, "data": data or {}}
        logger.debug(
            "send_db_request payload keys=%s headers=%s",
            list(req_payload.keys()),
            [h[0] for h in headers],
        )

        try:
            # Subscribe first; wait for assignment; tail backfill.
            cons.subscribe([rep_topic])
            _wait_for_assignment(cons, rep_topic, 3.0)
            parts = _assign_tail(cons, rep_topic, backfill=tail_backfill)
            logger.debug("Consumer assigned partitions=%s", parts)

            # Produce request.
            prod.produce(
                req_topic,
                key=corr_key,
                value=json.dumps(req_payload).encode("utf-8"),
                headers=headers,
            )
            prod.flush(1.0)
            logger.info(
                "->  %s → %s (attempt %d/%d) key=%s",
                wire,
                req_topic,
                attempt,
                retries + 1,
                corr_id,
            )

            # Track a small sample of seen keys for timeout diagnostics.
            seen_debug: List[Tuple[Optional[str], Optional[str]]] = []
            deadline = time.time() + timeout_s

            while time.time() < deadline:
                msg = cons.poll(0.5)
                if msg is None:
                    continue
                if msg.error():
                    logger.debug(
                        "poll: got error=%r (ignored)",
                        msg.error(),
                    )
                    continue

                key_s = _b2s(msg.key())
                hdr_s = _hdr_corr(msg)

                if len(seen_debug) < 6:
                    seen_debug.append((key_s, hdr_s))

                logger.debug(
                    "DBClient saw p=%s off=%s key=%r hdrCorr=%r",
                    msg.partition(),
                    msg.offset(),
                    key_s,
                    hdr_s,
                )

                if key_s == corr_id or hdr_s == corr_id:
                    try:
                        payload = json.loads(msg.value().decode("utf-8"))
                        logger.debug(
                            "Matched corr_id; decoded JSON keys=%s",
                            list((payload or {}).keys()),
                        )
                    except Exception:
                        logger.debug(
                            "Matched correlation but payload not JSON; skip",
                        )
                        continue
                    logger.debug(
                        "send_db_request success in %.1fms (attempt %d)",
                        _latency_ms(t_attempt),
                        attempt,
                    )
                    return payload

            last_error = {
                "status": "Fail",
                "type": f"{wire}Reply",
                "error": {
                    "message": (
                        f"DB-Agent reply timeout after {timeout_s}s "
                        f"(corr={corr_id}); saw={seen_debug}"
                    ),
                },
                "requestId": request_id or "",
            }
            logger.warning(
                "send_db_request timeout: %s",
                last_error["error"]["message"],
            )

        except KafkaException as ke:
            last_error = {
                "status": "Fail",
                "type": f"{wire}Reply",
                "error": {"message": f"KafkaException: {ke}"},
                "requestId": request_id or "",
            }
            logger.exception("send_db_request KafkaException")
        except Exception as e:
            last_error = {
                "status": "Fail",
                "type": f"{wire}Reply",
                "error": {"message": str(e)},
                "requestId": request_id or "",
            }
            logger.exception("send_db_request unexpected exception")
        finally:
            try:
                cons.close()
                logger.debug("consumer.close() OK")
            except Exception:
                logger.exception(
                    "consumer.close() failed (ignored)",
                )

        if attempt <= retries:
            logger.debug(
                "Retrying in %.1fs (attempt %d/%d)",
                backoff_s,
                attempt,
                retries + 1,
            )
            time.sleep(backoff_s)

    logger.debug("send_db_request returning last_error=%s", last_error)
    return last_error or {
        "status": "Fail",
        "type": f"{_wire_type(msg_type)}Reply",
        "error": {"message": "Unknown failure"},
        "requestId": request_id or "",
    }


# ------------------------------------------------------------------------------
# Command helpers
# ------------------------------------------------------------------------------


def resolve_chip_type(
    *,
    chip_ids: Optional[List[Any]] = None,
    request_id: Optional[str] = None,
    timeout_s: float = 8.0,
    request_topic: Optional[str] = None,
    reply_topic: Optional[str] = None,
) -> JsonDict:
    """
    Resolve chip 'familyType' via DB Agent, then map it to a chipName.

    For each chipId:
      1) GetAllChip(filter.ids=[chipId])      -> take 'asicId'
      2) GetAllAsics(filter.ids=[asicId])     -> take 'familyType'
      3) Map: AncMPW1 -> NVG, AncMPW2 -> SLDO
    """
    logger.debug(
        "resolve_chip_type(chip_ids=%r, request_id=%r)",
        chip_ids,
        request_id,
    )
    rid = str(request_id or uuid.uuid4().hex[:8])
    t0 = time.time()

    ids = _normalize_ids(chip_ids)
    if not ids:
        logger.debug("resolve_chip_type: no ids -> empty Success")
        return {
            "status": "Success",
            "type": "ResolveChipTypeReply",
            "requestId": rid,
            "data": {"items": []},
            "latency_ms": _latency_ms(t0),
        }

    def _map_family_to_chipname(family: str) -> Optional[str]:
        f = (family or "").strip().lower()
        if f == "ancmpw1":
            return "NVG"
        if f == "ancmpw2":
            return "SLDO"
        return None

    items: List[Dict[str, Any]] = []
    per_chip_errors: List[Dict[str, Any]] = []

    for cid in ids:
        try:
            # ---- Step 1: GetAllChip
            chip_req = {"filter": {"ids": [int(cid)]}}
            logger.debug(
                "resolve_chip_type: GetAllChip for chipId=%s payload=%s",
                cid,
                chip_req,
            )
            chip_resp = send_db_request(
                "GetAllChip",
                chip_req,
                request_id=rid,
                timeout_s=timeout_s,
                request_topic=request_topic,
                reply_topic=reply_topic,
            )

            if str(chip_resp.get("status", "")).lower() != "success":
                msg = (
                    (chip_resp.get("error") or {}).get("message")
                    if isinstance(chip_resp.get("error"), dict)
                    else chip_resp.get("error")
                )
                err = f"GetAllChip failed for chipId={cid}: {msg}"
                logger.warning(err)
                per_chip_errors.append(
                    {
                        "chipId": cid,
                        "step": "GetAllChip",
                        "error": str(msg or "unknown"),
                    }
                )
                continue

            chip_items = ((chip_resp.get("data") or {}).get("items") or [])
            if not chip_items or not isinstance(chip_items[0], dict):
                err = f"GetAllChip returned no items for chipId={cid}"
                logger.warning(err)
                per_chip_errors.append(
                    {
                        "chipId": cid,
                        "step": "GetAllChip",
                        "error": "no items",
                    }
                )
                continue

            asic_id = chip_items[0].get("asicId")
            try:
                asic_id = int(asic_id)
            except Exception:
                asic_id = None

            if asic_id is None:
                err = (
                    f"GetAllChip missing/invalid asicId for chipId={cid}"
                )
                logger.warning(err)
                per_chip_errors.append(
                    {
                        "chipId": cid,
                        "step": "GetAllChip",
                        "error": "missing asicId",
                    }
                )
                continue

            # ---- Step 2: GetAllAsics
            asic_req = {
                "pager": {"limit": 0, "offset": 0},
                "filter": {
                    "waferId": 0,          # harmless defaults
                    "familyType": "string",
                    "quality": "string",
                    "ids": [asic_id],
                },
            }
            logger.debug(
                "resolve_chip_type: GetAllAsics for asicId=%s payload=%s",
                asic_id,
                asic_req,
            )
            asic_resp = send_db_request(
                "GetAllAsics",
                asic_req,
                request_id=rid,
                timeout_s=timeout_s,
                request_topic=request_topic,
                reply_topic=reply_topic,
            )

            if str(asic_resp.get("status", "")).lower() != "success":
                msg = (
                    (asic_resp.get("error") or {}).get("message")
                    if isinstance(asic_resp.get("error"), dict)
                    else asic_resp.get("error")
                )
                err = (
                    f"GetAllAsics failed for chipId={cid}, asicId={asic_id}: {msg}"
                )
                logger.warning(err)
                per_chip_errors.append(
                    {
                        "chipId": cid,
                        "asicId": asic_id,
                        "step": "GetAllAsics",
                        "error": str(msg or "unknown"),
                    }
                )
                continue

            asic_items = ((asic_resp.get("data") or {}).get("items") or [])
            if not asic_items or not isinstance(asic_items[0], dict):
                err = (
                    f"GetAllAsics returned no items for asicId={asic_id}"
                )
                logger.warning(err)
                per_chip_errors.append(
                    {
                        "chipId": cid,
                        "asicId": asic_id,
                        "step": "GetAllAsics",
                        "error": "no items",
                    }
                )
                continue

            family_type = (asic_items[0].get("familyType") or "").strip()
            chip_name = _map_family_to_chipname(family_type)

            items.append(
                {
                    "chipId": int(cid),
                    "asicId": int(asic_id),
                    "familyType": family_type,
                    "chipName": chip_name or "",
                }
            )

        except Exception as e:
            logger.exception(
                "resolve_chip_type: unexpected error for chipId=%s",
                cid,
            )
            per_chip_errors.append(
                {"chipId": cid, "step": "exception", "error": str(e)},
            )

    status = "Success" if items else "Fail"
    out: JsonDict = {
        "status": status,
        "type": "ResolveChipTypeReply",
        "requestId": rid,
        "data": {"items": items},
        "latency_ms": _latency_ms(t0),
    }
    if per_chip_errors:
        out["errors"] = per_chip_errors
    logger.debug(
        "resolve_chip_type -> %s items=%d errors=%d in %.1fms",
        status,
        len(items),
        len(per_chip_errors),
        out["latency_ms"],
    )
    return out


def get_chip_name(
    *,
    chip_ids: Optional[List[Any]] = None,
    request_id: Optional[str] = None,
    timeout_s: float = 6.0,
    request_topic: Optional[str] = None,
    reply_topic: Optional[str] = None,
) -> JsonDict:
    """
    Lightweight wrapper around resolve_chip_type that returns a
    ResolveChipName-style payload.
    """
    logger.debug("get_chip_name(chip_ids=%r, request_id=%r)", chip_ids, request_id)
    ids = _normalize_ids(chip_ids)
    if not ids:
        logger.debug("get_chip_name: no ids -> empty Success")
        return {
            "status": "Success",
            "type": "ResolveChipNameReply",
            "data": {"items": []},
            "requestId": request_id or "",
        }

    logger.debug("get_chip_name sending ids=%r", ids)
    # Reuse resolve_chip_type, then adjust the type field.
    resp = resolve_chip_type(
        chip_ids=ids,
        request_id=request_id,
        timeout_s=timeout_s,
        request_topic=request_topic,
        reply_topic=reply_topic,
    )
    resp["type"] = "ResolveChipNameReply"
    return resp


def get_all_tests(
    *,
    chip_ids: Optional[List[Any]] = None,
    request_id: Optional[str] = None,
    timeout_s: float = 6.0,
    request_topic: Optional[str] = None,
    reply_topic: Optional[str] = None,
) -> JsonDict:
    logger.debug("get_all_tests(chip_ids=%r, request_id=%r)", chip_ids, request_id)
    rid = str(request_id or "unknown")
    t0 = time.time()

    try:
        ids = _normalize_ids(chip_ids)
        if not ids:
            # Short-circuit: enumerate all chips from registry.
            from svt_test_agent.registries.test_registry import (
                CHIP_TEST_DEFINITIONS,
            )

            ts = TestSystemClient()
            all_blocks: List[Dict[str, Any]] = []
            for chip_name in (CHIP_TEST_DEFINITIONS or {}).keys():
                entry = ts.get_all_tests(chip_name)
                all_blocks.append(
                    {
                        "chipName": entry["chipName"],
                        "tests": entry["tests"],
                    }
                )
            out = {
                "type": "GetAllTestsReply",
                "testStatus": "TestSuccess",
                "requestId": rid,
                "data": all_blocks,
                "latency_ms": _latency_ms(t0),
                "agentStatus": "TestAgentSuccess",
            }
            logger.debug(
                "get_all_tests (no ids) -> %d chips in %.1fms",
                len(all_blocks),
                out["latency_ms"],
            )
            return out

        # Ask DB once with the whole list.
        resp = send_db_request(
            "GetAllTests",
            {"filter": {"ids": ids}},
            request_id=rid,
            timeout_s=timeout_s,
            request_topic=request_topic,
            reply_topic=reply_topic,
        )

        if str(resp.get("status", "")).lower() == "success":
            items = ((resp.get("data") or {}).get("items") or [])
            id_to_name: Dict[int, str] = {}
            for it in items:
                if not isinstance(it, dict):
                    continue
                try:
                    cid = int(it.get("id"))
                except Exception:
                    continue
                chipname = (
                    it.get("chipname")
                    or it.get("chipName")
                    or ""
                ).strip()
                if chipname:
                    id_to_name[cid] = chipname
            logger.debug(
                "get_all_tests resolved ids -> names: %r",
                id_to_name,
            )

            ts = TestSystemClient()
            results: List[Dict[str, Any]] = []
            for cid in ids:
                name = id_to_name.get(cid)
                if not name:
                    logger.debug(
                        "get_all_tests: id %r not resolved; skipping",
                        cid,
                    )
                    continue
                entry = ts.get_all_tests(name)
                results.append(
                    {
                        "chipId": cid,
                        "chipName": entry["chipName"],
                        "tests": entry["tests"],
                    }
                )

            if results:
                out = {
                    "type": "GetAllTestsReply",
                    "testStatus": "TestSuccess",
                    "requestId": rid,
                    "data": results,
                    "latency_ms": _latency_ms(t0),
                    "agentStatus": "TestAgentSuccess",
                }
                logger.debug(
                    "get_all_tests -> %d results in %.1fms",
                    len(results),
                    out["latency_ms"],
                )
                return out

            logger.warning(
                "get_all_tests: DB Success but no chip ids resolved",
            )
            return {
                "type": "GetAllTestsReply",
                "testStatus": "DBAgentFail",
                "requestId": rid,
                "testError": "no chip ids resolved",
                "latency_ms": _latency_ms(t0),
                "agentStatus": "TestAgentSuccess",
            }

        # Non-success from DB Agent.
        err_container = (
            resp.get("data") if isinstance(resp.get("data"), dict) else {}
        )
        err_msg = (
            (err_container.get("error") if isinstance(err_container, dict) else None)
            or resp.get("error")
            or "DB agent failed"
        )
        err_str = (
            err_msg.get("message") if isinstance(err_msg, dict) else str(err_msg)
        )
        logger.warning("get_all_tests: DBAgentFail %s", err_str)
        return {
            "type": "GetAllTestsReply",
            "testStatus": "DBAgentFail",
            "requestId": rid,
            "testError": err_str,
            "latency_ms": _latency_ms(t0),
            "agentStatus": "TestAgentSuccess",
        }

    except Exception as e:
        logger.exception("get_all_tests exception")
        return {
            "type": "GetAllTestsReply",
            "requestId": rid,
            "agentStatus": "TestAgentFail",
            "agentError": str(e),
        }


# ------------------------------------------------------------------------------
# Single entry point kept for back-compat
# ------------------------------------------------------------------------------


def save_test_to_db(
    *,
    chip_name: str,
    test_name: str,
    test_id: int = 0,
    test_values: Dict[str, Any],
    asic_id: int = 0,
    test_setup_id: int = 0,
    config_id: int = 0,
    request_id: Optional[str] = None,
    timeout_s: float = 10.0,
    request_topic: Optional[str] = None,
    reply_topic: Optional[str] = None,
) -> JsonDict:
    logger.debug(
        "save_test_to_db(chip=%r, test=%r, ids: test=%r asic=%r setup=%r cfg=%r, req_id=%r)",
        chip_name,
        test_name,
        test_id,
        asic_id,
        test_setup_id,
        config_id,
        request_id,
    )
    chip = (chip_name or "").strip()
    if not chip:
        logger.warning("save_test_to_db: missing chip_name")
        return {
            "status": "Fail",
            "type": "CreateTestReply",
            "error": {"message": "chip_name is required"},
            "requestId": request_id or "",
        }

    msg_type = f"Create{chip}Test"
    payload: JsonDict = {
        "testId": test_id,
        "create": {
            "name": test_name,
            "asicId": int(asic_id),
            "testSetupId": int(test_setup_id),
            "configId": int(config_id),
            "testValues": dict(test_values or {}),
        },
    }
    logger.debug(
        "save_test_to_db sending: type=%s payload_keys=%s",
        msg_type,
        list(payload.keys()),
    )

    reply = send_db_request(
        msg_type,
        payload,
        request_id=request_id,
        timeout_s=timeout_s,
        request_topic=request_topic,
        reply_topic=reply_topic,
    )
    if reply.get("status") == "Success":
        logger.info(
            "DB saving successful: chip=%s, test=%s",
            chip,
            test_name,
        )
    else:
        logger.debug("save_test_to_db non-success reply: %r", reply)
    return reply


def fetch_from_db(*args, **kwargs) -> JsonDict:
    """
    Backwards compatible façade.

    Legacy positional form:
        fetch_from_db(req_id, "GetAllTests", [chip_id], 6.0, True, data=...)

    Keyword form:
        fetch_from_db(chip_ids=[...], request_id="...", timeout_s=6.0, ...)
        -> defaults to GetAllTests semantics.
    """
    logger.debug(
        "fetch_from_db args=%r kwargs_keys=%s",
        args,
        list(kwargs.keys()),
    )

    # Legacy positional signature.
    if len(args) >= 2 and isinstance(args[1], str):
        req_id: Optional[str] = args[0]
        msg_type: str = args[1]
        chip_ids = args[2] if len(args) >= 3 else None
        timeout_s: float = args[3] if len(args) >= 4 else 6.0
        use_kafka: bool = args[4] if len(args) >= 5 else True
        request_topic = kwargs.get("request_topic")
        reply_topic = kwargs.get("reply_topic")
        raw_data = kwargs.get("data")

        logger.debug(
            "fetch_from_db legacy: msg_type=%s use_kafka=%s chip_ids=%r timeout=%.1f",
            msg_type,
            use_kafka,
            chip_ids,
            timeout_s,
        )

        if msg_type == "GetAllTests":
            if not use_kafka:
                from svt_test_agent.registries.test_registry import (
                    CHIP_TEST_DEFINITIONS,
                )

                ts = TestSystemClient()
                blocks: List[Dict[str, Any]] = []
                for chip_name in (CHIP_TEST_DEFINITIONS or {}).keys():
                    entry = ts.get_all_tests(chip_name)
                    blocks.append(
                        {
                            "chipName": entry["chipName"],
                            "tests": entry["tests"],
                        }
                    )
                out = {
                    "type": "GetAllTestsReply",
                    "testStatus": "TestSuccess",
                    "requestId": (
                        str(req_id) if req_id is not None else "stub"
                    ),
                    "data": blocks,
                    "latency_ms": 0.0,
                    "agentStatus": "TestAgentSuccess",
                }
                logger.debug(
                    "fetch_from_db local GetAllTests -> %d chips",
                    len(blocks),
                )
                return out

            ids_param = (
                chip_ids
                if isinstance(chip_ids, list)
                else [chip_ids]
                if chip_ids is not None
                else None
            )
            return get_all_tests(
                chip_ids=ids_param,
                request_id=str(req_id) if req_id is not None else None,
                timeout_s=timeout_s,
                request_topic=request_topic,
                reply_topic=reply_topic,
            )

        if msg_type == "GetChipName":
            if not use_kafka:
                ids = _normalize_ids(chip_ids)
                items = (
                    [{"id": i, "chipname": "SLDO"} for i in ids]
                    if ids
                    else []
                )
                out = {
                    "status": "Success",
                    "type": "ResolveChipNameReply",
                    "data": {"items": items},
                    "requestId": str(req_id) if req_id else "stub",
                }
                logger.debug(
                    "fetch_from_db local GetChipName -> %r",
                    items,
                )
                return out

            ids = (
                chip_ids
                if isinstance(chip_ids, list)
                else [chip_ids]
                if chip_ids is not None
                else None
            )
            return get_chip_name(
                chip_ids=ids,
                request_id=str(req_id) if req_id else None,
                timeout_s=timeout_s,
                request_topic=request_topic,
                reply_topic=reply_topic,
            )

        # Generic pass-through for other commands.
        if not use_kafka:
            logger.debug(
                "fetch_from_db local stub for %s (not implemented)",
                msg_type,
            )
            return {
                "type": f"{msg_type}Reply",
                "requestId": (
                    str(req_id) if req_id is not None else "stub"
                ),
                "status": "Fail",
                "error": {
                    "message": (
                        "Local stub not implemented for this command"
                    ),
                },
            }

        if raw_data is not None:
            logger.debug(
                "fetch_from_db passthrough %s with raw_data keys=%s",
                msg_type,
                list((raw_data or {}).keys()),
            )
            return send_db_request(
                msg_type,
                raw_data,
                request_id=str(req_id) if req_id is not None else None,
                timeout_s=timeout_s,
                request_topic=request_topic,
                reply_topic=reply_topic,
            )

        wire = _wire_type(msg_type)
        filt_ids = _normalize_ids(chip_ids)
        if chip_ids is None:
            filter_body: Dict[str, Any] = {}
        elif len(filt_ids) <= 1:
            filter_body = {"chipId": (filt_ids[0] if filt_ids else None)}
        else:
            filter_body = {"ids": filt_ids}
        logger.debug(
            "fetch_from_db %s -> filter_body=%r",
            wire,
            filter_body,
        )

        return send_db_request(
            msg_type,
            {"filter": filter_body},
            request_id=str(req_id) if req_id is not None else None,
            timeout_s=timeout_s,
            request_topic=request_topic,
            reply_topic=reply_topic,
        )

    # New keyword-style: default to GetAllTests semantics.
    logger.debug("fetch_from_db keyword route -> get_all_tests")
    return get_all_tests(
        chip_ids=kwargs.get("chip_ids") or kwargs.get("chipIds"),
        request_id=kwargs.get("request_id"),
        timeout_s=kwargs.get("timeout_s", 6.0),
        request_topic=kwargs.get("request_topic"),
        reply_topic=kwargs.get("reply_topic"),
    )
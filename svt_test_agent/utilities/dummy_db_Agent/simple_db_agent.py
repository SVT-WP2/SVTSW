"""
Fake DB agent demo for the SVT Test Agent.

This script simulates the behaviour of a DB agent by consuming requests
from the DB request topic, generating canned responses for a small set
of request types, and publishing replies on the DB reply topic. It is
intended for development and integration testing of the Test Agent
without relying on a real database backend.

Location: svt_test_agent/utilities/dummy_db_Agent/simple_db_agent.py
"""

#!/usr/bin/env python3
from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any, Dict, List, Optional

from confluent_kafka import Consumer, Producer

# --- project config & shared Kafka builder ---
import svt_test_agent.configs.config as cfg
from svt_test_agent.utilities.util_config import build_kafka_config

log = logging.getLogger("FakeDBAgentDemo")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

REQUEST_TOPIC: str = getattr(cfg, "DB_REQUEST_TOPIC")
REPLY_TOPIC: str = getattr(cfg, "DB_REPLY_TOPIC")

KCONF = build_kafka_config()
PROD_CONF = dict(KCONF["producer"])
CONS_CONF = {
    **KCONF["consumer"],
    "group.id": "svt-fake-dbagent-demo",
    "auto.offset.reset": "earliest",
}

JsonDict = Dict[str, Any]


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _error_reply(req: JsonDict, status: str, message: str) -> JsonDict:
    """
    Build an error envelope in the requested format for the new APIs:
      {
        "status": status,               # e.g. DBQueryFail / DBFail / DBAgentFail
        "type": "<RequestType>Reply",
        "data": {},
        "error": {"message": "<err>"}
      }
    """
    t = (req.get("type") or "").strip()
    reply_type = f"{t}Reply" if t else "Reply"
    out: JsonDict = {
        "status": status,
        "type": reply_type,
        "data": {},
        "error": {"message": message},
    }
    rid = req.get("requestId") or req.get("reqId") or req.get("id")
    if rid:
        out["requestId"] = rid
    cid = req.get("corrId")
    if cid:
        out["corrId"] = cid
    return out


def _ids_from_request(req: JsonDict) -> List[int]:
    """Extract id(s) from filter, accepting either scalars or lists."""
    data = req.get("data") or {}
    filt = (data.get("filter") or {})

    raw: List[Any] = []

    def _extend(name: str):
        if name in filt:
            v = filt.get(name)
            if isinstance(v, (list, tuple)):
                raw.extend(v)
            else:
                raw.append(v)

    # accept any of these keys, scalar or list
    _extend("chipId")
    _extend("ids")
    _extend("Chipids")  # legacy

    norm: List[int] = []
    for v in raw:
        try:
            if v is None:
                continue
            norm.append(int(v))
        except Exception:
            # ignore non-numeric entries
            continue
    return norm


def _reply_envelope(req: JsonDict, status: str, payload: Dict[str, Any]) -> JsonDict:
    t = (req.get("type") or "").strip()
    reply_type = f"{t}Reply" if t else "Reply"
    out: JsonDict = {"status": status, "type": reply_type, "data": payload}

    rid = req.get("requestId") or req.get("reqId") or req.get("id")
    if rid:
        out["requestId"] = rid
    cid = req.get("corrId")
    if cid:
        out["corrId"] = cid
    return out


def _progress(
    prod: Producer,
    request_id: Optional[str],
    msg: str,
    step: int,
    *,
    key: Optional[bytes] = None,
    headers: Optional[List[tuple[str, str]]] = None,
) -> None:
    """Emit lightweight progress messages (use same key + correlation headers)."""
    payload = {
        "type": "Progress",
        "requestId": request_id,
        "status": "InFlight",
        "message": msg,
        "step": step,
    }
    prod.produce(
        REPLY_TOPIC,
        key=key,
        value=json.dumps(payload).encode("utf-8"),
        headers=headers,
    )
    prod.flush(0.1)


# -----------------------------------------------------------------------------
# Core behavior
# -----------------------------------------------------------------------------
def _handle_request(
    req: JsonDict,
    *,
    simulate_slow: bool,
    simulate_down: bool,
) -> Optional[JsonDict]:
    if simulate_down:
        return None

    req_type = (req.get("type") or "").strip()
    ids = _ids_from_request(req)

    if simulate_slow:
        # (actual sleeps/progress are done by the caller via _progress)
        pass

    # ------------------------------
    # 1) New: GetAllSLDOTests
    # ------------------------------
    if req_type == "GetAllSLDOTests":
        try:
            # Success case you provided
            # If any requested id == 12, return that one; otherwise error
            if not ids:
                # Empty filter -> empty items is fine
                return _reply_envelope(req, "Success", {"items": []})

            out_items: List[Dict[str, Any]] = []
            for tid in ids:
                if tid == 12:
                    out_items.append(
                        {
                            "id": 12,
                            "name": "PowerRampUp",
                            "asicId": 0,
                            "testSetupId": 0,
                            "configId": 0,
                            "testValues": {},
                        }
                    )
                if tid == 13:
                    out_items.append(
                        {
                            "id": 13,
                            "name": "PSRR",
                            "asicId": 0,
                            "testSetupId": 0,
                            "configId": 0,
                            "testValues": {},
                        }
                    )
            if out_items:
                return _reply_envelope(req, "Success", {"items": out_items})

            # No matches → your requested error format
            return _error_reply(req, "DBQueryFail", f"test id(s) not found: {ids}")
        except Exception as e:
            # Unexpected mock failure -> DBFail
            return _error_reply(req, "DBFail", f"unexpected error: {e}")

    # ------------------------------
    # 2) New: GetAllSLDOTestConfigurations
    # ------------------------------
    if req_type == "GetAllSLDOTestConfigurations":
        try:
            if not ids:
                return _reply_envelope(req, "Success", {"items": []})

            out_items: List[Dict[str, Any]] = []
            for cid in ids:
                if cid == 0:
                    out_items.append(
                        {
                            "id": 0,
                            "name": "config1",
                            "mode": 0,
                            "loadCapacitance(nF)": 10,
                            "loadCurrent(mA)": 40,
                            "temperature(C)": 25,
                        }
                    )
            if out_items:
                return _reply_envelope(req, "Success", {"items": out_items})

            return _error_reply(req, "DBQueryFail", f"config id(s) not found: {ids}")
        except Exception as e:
            return _error_reply(req, "DBFail", f"unexpected error: {e}")

    # ------------------------------
    # 3): CreateSLDOTest (dummy save)
    # ------------------------------
    if req_type == "CreateSLDOTest":
        try:
            # Best-effort parse for a nicer log (not required for the dummy reply)
            create = ((req.get("data") or {}).get("create") or {})
            test_name = create.get("name")
            chip = "SLDO"  # fixed here because this handler is specifically CreateSLDOTest
            log.info("DB saving successful: chip=%s, test=%s", chip, test_name)

            # Return the exact minimal dummy you requested (no 'data' block).
            out = {
                "status": "Success",
                "type": "CreateSLDOTestReply",
            }
            rid = req.get("requestId") or req.get("reqId") or req.get("id")
            if rid:
                out["requestId"] = rid
            cid = req.get("corrId")
            if cid:
                out["corrId"] = cid
            return out

        except Exception as e:
            return _error_reply(req, "DBFail", f"unexpected error: {e}")

    # ------------------------------
    # 4) New: GetAllChip (dummy reply)
    # ------------------------------
    if req_type == "GetAllChip":
        if not ids:
            return _reply_envelope(req, "Success", {"items": []})

        out_items: List[Dict[str, Any]] = []
        for cid in ids:
            out_items.append(
                {
                    "id": cid,
                    "serialNumber": f"CHIP-{cid}",
                    "asicId": cid + 100,        # dummy asicId
                    "generalLocation": "dummy",
                }
            )
        return _reply_envelope(req, "Success", {"items": out_items})

    # ------------------------------
    # 5) New: GetAllAsics (dummy reply, always AncMPW2 → SLDO)
    # ------------------------------
    if req_type == "GetAllAsics":
        if not ids:
            return _reply_envelope(req, "Success", {"items": []})

        out_items: List[Dict[str, Any]] = []
        for aid in ids:
            out_items.append(
                {
                    "id": aid,
                    "serialNumber": f"ASIC-{aid}",
                    "familyType": "AncMPW2",     # hard-coded → SLDO
                    "waferMapPosition": "X1Y1",
                    "quality": "A",
                }
            )
        return _reply_envelope(req, "Success", {"items": out_items})

    # ------------------------------
    # Default: unrecognized type → DBAgentFail in your new shape
    # ------------------------------
    return _error_reply(req, "DBAgentFail", f"Unsupported request type: {req_type}")


# -----------------------------------------------------------------------------
# Main loop
# -----------------------------------------------------------------------------
def main(argv: List[str] | None = None) -> int:
    """
    Usage(Only for developers):
        python -m TestAgent.utilities.dummyDBAgent.fake_dbagent_demo [--slow] [--down]
    """
    argv = list(argv or sys.argv[1:])
    simulate_slow = "--slow" in argv
    simulate_down = "--down" in argv

    prod = Producer(PROD_CONF)
    cons = Consumer(CONS_CONF)
    cons.subscribe([REQUEST_TOPIC])

    log.info(
        "Fake DB Agent demo up. Request=%s Reply=%s Kafka=%s slow=%s down=%s",
        REQUEST_TOPIC,
        REPLY_TOPIC,
        CONS_CONF.get("bootstrap.servers"),
        simulate_slow,
        simulate_down,
    )

    try:
        while True:
            msg = cons.poll(0.5)
            if msg is None:
                continue
            if msg.error():
                log.warning("Consumer error: %s", msg.error())
                continue

            req_key: Optional[bytes] = msg.key()  # <-- request record key (bytes or None)
            hdr_pairs = msg.headers() or []
            hdrs = dict(hdr_pairs)

            # Ensure we carry a correlationId header (fall back to requestId from body)
            corr = hdrs.get("correlationId")
            try:
                req = json.loads(msg.value().decode("utf-8"))
            except Exception:
                log.error("Invalid JSON on request topic")
                continue

            if not corr:
                corr = str(req.get("requestId") or "")
                if corr:
                    hdr_pairs.append(("correlationId", corr))

            log.info("→ request: %s", req)

            # Progress (keep the same key and headers)
            if simulate_slow:
                rid = req.get("requestId") or corr
                _progress(
                    prod,
                    rid,
                    "DB lookup queued...",
                    1,
                    key=req_key,
                    headers=hdr_pairs,
                )
                time.sleep(0.5)
                _progress(
                    prod,
                    rid,
                    "DB lookup running...",
                    2,
                    key=req_key,
                    headers=hdr_pairs,
                )
                time.sleep(0.5)

            reply = _handle_request(
                req,
                simulate_slow=simulate_slow,
                simulate_down=simulate_down,
            )
            if reply is None:
                log.warning(
                    "Simulating DB down: not replying (client should timeout)."
                )
                continue

            # Produce reply using the SAME key and headers (so consumers can partition+correlate)
            prod.produce(
                REPLY_TOPIC,
                key=req_key,  # <-- echo request key
                value=json.dumps(reply).encode("utf-8"),
                headers=hdr_pairs,  # <-- include correlationId
            )
            prod.flush(0.25)
            log.info("← reply: %s", reply)
    finally:
        try:
            cons.close()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
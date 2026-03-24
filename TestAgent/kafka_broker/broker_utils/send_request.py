"""
Send a single test message to the SVT Test Agent Kafka broker.

This script:
  - loads a JSON payload from file,
  - normalises chipId/testId and builds a requestId,
  - sends the message to REQUEST_TOPIC via Kafka,.

Location: kafka_broker/broker_utils/send_request.py
"""

from __future__ import annotations

import importlib.util
import json
import logging
import os
import sys
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, Optional, Tuple

from confluent_kafka import Producer

logger = logging.getLogger(__name__)


# =============================================================================
# MessageBuilder: build requestId + finalise payload
# =============================================================================
class MessageBuilder:
    """
    Build a requestId and attach it to the payload.

    Current format:
        <chipId>_<testId>

    chipId:
      - digits      -> 'C' + 4-digit zero-pad (12 -> C0012)
      - 'C'+digits  -> kept as 'C####'
      - otherwise   -> used as-is, or 'C0000' if empty

    testId:
      - digits      -> 'T' + 7-digit zero-pad (1 -> T0000001)
      - 'T'+digits  -> kept as 'T#######'
      - otherwise   -> used as-is, or 'T0000000' if empty
    """

    _CHIPID_KEYS = {"chipId", "chip_id", "CHIPID", "ChipId"}

    def __init__(
        self,
        timestamp_fmt: str = "%Y%m%d-%H%M%S",
        use_epoch_ms: bool = False,
        config_module: Optional[ModuleType] = None,
    ) -> None:
        self.timestamp_fmt = timestamp_fmt
        self.use_epoch_ms = use_epoch_ms
        self.cfg = config_module

    def build(self, payload: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
        """
        Return a shallow-copied payload with an added 'requestId' field
        and the requestId string itself.
        """
        payload = dict(payload or {})

        # Agent and timestamp kept for future usage if you change the format.
        _agent_id = self._resolve_agent_id(payload)
        chip_id = self._resolve_chip_id(payload)
        test_id = self._resolve_test_id(payload)
        _ts = self._timestamp()

        request_id = f"{chip_id}_{test_id}"
        payload["requestId"] = request_id
        return payload, request_id

    # ---------- resolve parts ----------

    def _resolve_agent_id(self, payload: Dict[str, Any]) -> str:
        cand = payload.get("agentId") or payload.get("TestAgentId")
        if not cand and self.cfg is not None:
            cand = getattr(self.cfg, "TEST_AGENT_ID", None)
        if not cand:
            cand = os.getenv("TEST_AGENT_ID", "TA001")
        s = str(cand).strip()
        return s if s else "TA001"

    def _resolve_chip_id(self, payload: Dict[str, Any]) -> str:
        data = payload.get("data") or {}
        params = data.get("params") or {}
        filt = data.get("filter") or {}

        candidates: list[Any] = [
            filt.get("chipId"),
            data.get("chipId"),
            params.get("chipId"),
        ]
        candidates += self._collect_chip_ids(payload)

        val = self._first_nonempty(candidates)
        return self._normalize_chip_id(val)

    def _resolve_test_id(self, payload: Dict[str, Any]) -> str:
        data = payload.get("data") or {}

        candidates: list[Any] = [
            data.get("testId"),
            payload.get("testId"),
            payload.get("id"),
        ]
        val = self._first_nonempty(candidates)
        return self._normalize_test_id(val)

    # ---------- normalisation ----------

    def _normalize_chip_id(self, value: Any) -> str:
        s = "" if value is None else str(value).strip()
        if s.isdigit():
            return f"C{int(s):04d}"
        if len(s) >= 2 and s[0] in ("C", "c") and s[1:].isdigit():
            return f"C{s[1:]}"
        return s or "C0000"

    def _normalize_test_id(self, value: Any) -> str:
        s = "" if value is None else str(value).strip()
        if s.isdigit():
            return f"T{int(s):07d}"
        if len(s) >= 2 and s[0] in ("T", "t") and s[1:].isdigit():
            return f"T{s[1:]}"
        return s or "T0000000"

    # ---------- helpers ----------

    def _timestamp(self) -> str:
        if self.use_epoch_ms:
            return str(int(time.time() * 1000))
        return time.strftime(self.timestamp_fmt, time.gmtime())

    def _collect_chip_ids(self, obj: Any) -> list[Any]:
        """
        Recursively scan nested mappings/sequences for keys that look like chipId.
        """
        out: list[Any] = []

        if isinstance(obj, Mapping):
            for key, value in obj.items():
                if str(key) in self._CHIPID_KEYS:
                    out.append(value)
                out.extend(self._collect_chip_ids(value))
        elif isinstance(obj, Sequence) and not isinstance(obj, (str, bytes, bytearray)):
            for item in obj:
                out.extend(self._collect_chip_ids(item))
        return out

    @staticmethod
    def _first_nonempty(values: Sequence[Any], default: Optional[Any] = None) -> Any:
        """
        Flatten nested sequences and return the first non-empty string-like value.
        """
        flat: list[Any] = []

        def _push(v: Any) -> None:
            if v is None:
                return
            if isinstance(v, Sequence) and not isinstance(v, (str, bytes, bytearray)):
                for t in v:
                    _push(t)
            else:
                flat.append(v)

        for v in values:
            _push(v)

        for v in flat:
            s = str(v).strip()
            if s:
                return s
        return default


# =============================================================================
# Kafka send-only client
# =============================================================================
class KafkaSender:
    """
    Thin wrapper around confluent-kafka Producer for one-shot sends.
    """

    def __init__(self, producer_conf: Dict[str, Any]) -> None:
        self._producer = Producer(dict(producer_conf or {}))

    def send(
        self,
        topic: str,
        payload: Dict[str, Any],
        key: str,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        headers: Dict[str, str] = {
            "cmdType": str(payload.get("command", "")),
            "correlationId": key,
        }
        if extra_headers:
            headers.update(
                {str(k): ("" if v is None else str(v)) for k, v in extra_headers.items()}
            )

        header_tuples = [(k, v) for k, v in headers.items()]

        self._producer.produce(
            topic,
            key=key,
            value=json.dumps(payload),
            headers=header_tuples,
            callback=self._delivery_report,
        )
        self._producer.flush()

    @staticmethod
    def _delivery_report(err, msg) -> None:
        if err:
            logger.error("Delivery failed: %s", err)
        else:
            logger.info(
                "Message delivered to %s [%s] @ offset %s",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )


# =============================================================================
# Config loading + Kafka config resolution
# =============================================================================
def load_config(path: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location("svt_test_agent_config", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load config module from: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _build_kafka_config(config_module: ModuleType, cfg_path: Path) -> Dict[str, Any]:
    """
    Determine Kafka producer configuration:

    1) If config_module.KAFKA_CONFIG['producer'] is present, use it.
    2) Otherwise, if svt_test_agent.utilities.util_config.build_kafka_config
       is importable, use that and take the 'producer' section.
    3) Otherwise, fall back to a minimal config based on env/defaults.
    """
    kc = getattr(config_module, "KAFKA_CONFIG", None)
    if isinstance(kc, Mapping):
        prod = kc.get("producer")
        if isinstance(prod, Mapping):
            return dict(prod)

    try:
        from svt_test_agent.utilities.util_config import build_kafka_config

        full_cfg = build_kafka_config()
        prod = full_cfg.get("producer", {})
        return dict(prod)
    except ImportError:
        bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9095")
        return {
            "bootstrap.servers": bootstrap,
        }


# =============================================================================
# Orchestrator + CLI
# =============================================================================
def send_request(
    json_file: str,
    config_module: ModuleType,
    use_epoch_ms: bool = False,
) -> str:
    """
    Build a requestId, send the message, and log the send.

    Returns the requestId that was used.
    """
    if not hasattr(config_module, "REQUEST_TOPIC"):
        raise RuntimeError("Config module must define REQUEST_TOPIC")

    request_topic = config_module.REQUEST_TOPIC

    payload = json.loads(Path(json_file).read_text())

    builder = MessageBuilder(use_epoch_ms=use_epoch_ms, config_module=config_module)
    final_payload, request_id = builder.build(payload)

    kafka_cfg = _build_kafka_config(config_module, Path(config_module.__file__).resolve())
    sender = KafkaSender(kafka_cfg)

    sender.send(
        topic=request_topic,
        payload=final_payload,
        key=request_id,
        extra_headers=None,
    )

    logger.info("Sent message to topic '%s' with requestId=%s", request_topic, request_id)
    return request_id


def main(argv: Optional[Sequence[str]] = None) -> int:
    """
    Usage(Only for developers):
        send-dummy-message <message.json> [--config <config.py>] [--epoch-ms]

    Config resolution order:
        1) --config argument
        2) $SVT_TEST_AGENT_CONFIG or $TESTAGENT_CONFIG
        3) ./config.py
        4) ./configs/config.py
        5) <repo_root>/svt_test_agent/configs/config.py
    """
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        prog="send-dummy-message",
        description="Send a test message to the SVT Test Agent Kafka broker.",
    )
    parser.add_argument("message_file", help="Path to JSON message payload")
    parser.add_argument(
        "--config",
        dest="config_path",
        default=os.getenv("SVT_TEST_AGENT_CONFIG") or os.getenv("TESTAGENT_CONFIG"),
        help=(
            "Path to SVT Test Agent config .py "
            "(defaults to $SVT_TEST_AGENT_CONFIG / $TESTAGENT_CONFIG or a local config.py)"
        ),
    )
    parser.add_argument(
        "--epoch-ms",
        action="store_true",
        help="Use epoch milliseconds in the internal timestamp segment (reserved for future use).",
    )
    args = parser.parse_args(argv)

    cfg_path_str = args.config_path

    if cfg_path_str:
        cfg_path = Path(cfg_path_str).expanduser().resolve()
    else:
        this_file = Path(__file__).resolve()
        # broker_utils -> kafka_broker -> REPO ROOT
        repo_root = this_file.parents[2]

        candidates = [
            # 1) config in current working directory
            Path.cwd() / "config.py",
            Path.cwd() / "configs" / "config.py",
            # 2) canonical in-repo config
            repo_root / "svt_test_agent" / "configs" / "config.py",
        ]

        cfg_path = None
        for c in candidates:
            if c.exists():
                cfg_path = c
                break

    if not cfg_path or not cfg_path.exists():
        print(
            "Error: config not provided, no env var set, and no config.py found in "
            "expected locations.",
            file=sys.stderr,
        )
        return 2

    cfg_mod = load_config(cfg_path)

    request_id = send_request(
        json_file=args.message_file,
        config_module=cfg_mod,
        use_epoch_ms=args.epoch_ms,
    )

    logger.info("Done. requestId=%s", request_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
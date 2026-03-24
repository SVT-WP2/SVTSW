"""
SVT TestAgent: Generic Kafka router that dispatches 'command' to registered handlers,
streams replies or single replies to Kafka, and stays free of validation logic.

- Handlers are resolved from registry (DEFAULT_COMMAND_HANDLERS + chip overrides).
- Streaming replies are detected via `type` suffix "*StreamReply" and sent to STATUS_TOPIC.
- Non-stream replies go to REPLY_TOPIC.
- Flexible request-id detection: one of requestId / Unique_id / id.
- Local mode: no Kafka, logs replies to console and writes per-request logs and JSON.

Location: svt_test_agent/test_agent.py
"""

from __future__ import annotations

from datetime import datetime
import argparse
import importlib.util
import json
import logging
import os
import signal
import sys
import threading
import time
import types
import inspect
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Callable
from dataclasses import dataclass

from svt_test_agent.base_command_handler import MetaHelper 

from svt_test_agent.utilities.util_config import (
    build_kafka_config,
    get_backend_config,
    persist_kafka_port_if_env_set,
)
from svt_test_agent.utilities import errors as err
from confluent_kafka import Consumer, Producer, KafkaError
from svt_test_agent.registries.command_registry import (
    DEFAULT_COMMAND_HANDLERS,
    CHIP_COMMAND_OVERRIDES,
)

# --------------------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------------------
logger = logging.getLogger("TestAgent")
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    )

# --------------------------------------------------------------------------------------
# Types & helpers
# --------------------------------------------------------------------------------------
JsonDict = Dict[str, Any]
KafkaCfg = Dict[str, Dict[str, Any]]
TopicsCfg = Dict[str, str]

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover - older Python
    ZoneInfo = None  # Python<3.9 fallback; if so, you'll get system local time

LONDON_TZ = ZoneInfo("Europe/London") if ZoneInfo else None

MASTER_LOG_DIR = os.getenv("SVT_LOG_DIR", str(Path("./master_log").resolve()))
MASTER_OUT_DIR = os.getenv("SVT_OUT_DIR", str(Path("./master_output").resolve()))

# No DEFAULT_TOPICS here; topics must come from config in Kafka mode.
KAFKA_CONFIG = build_kafka_config()
backend_conf = get_backend_config()  # currently not used, but kept for future backend checks

REQUEST_ID_KEYS = ("requestId", "Unique_id", "id")


@dataclass(frozen=True)
class HandlerContext:
    request_id: str
    command_type: str
    chip_name: str
    envelope: Dict[str, Any]


# ---------------------------- Logging Filters -----------------------------------------
class OnlyDebug(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno == logging.DEBUG


class NoDebug(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno != logging.DEBUG


# ---------------------------- Small utilities -----------------------------------------
def _normalize_run_command(cmd: str) -> str:
    logger.debug("Normalize run command: raw=%r", cmd)
    if not isinstance(cmd, str):
        logger.debug("Command is not a string → return empty")
        return ""
    cmd = cmd.strip()
    if not cmd or not cmd.lower().startswith("runtest:"):
        logger.debug("Command unchanged (not a RunTest:* alias): %r", cmd)
        return cmd

    base, _, variant = cmd.partition(":")
    variant = (variant or "").strip().lower()
    logger.debug("RunTest variant=%r", variant)

    if variant in ("new", "predef"):
        return "RunTest"
    if variant == "loop":
        return "RunLoopTest"
    if variant == "plan":
        return "RunTestPlan"
    if variant == "sequence":
        return "RunSequenceTest"

    logger.debug("Unknown variant → passthrough: %r", cmd)
    return cmd


def _normalize_chip_id(raw) -> str:
    logger.debug("Normalize chipId: raw=%r", raw)
    try:
        s = str(raw).strip()
        if s.startswith("C") and s[1:].isdigit():
            logger.debug("chipId already normalized: %s", s)
            return s
        if s.isdigit():
            norm = f"C{int(s):04d}"
            logger.debug("chipId normalized (digits→C####): %s", norm)
            return norm
    except Exception:
        logger.exception("chipId normalization failed; using C0000")
    return "C0000"


def _normalize_test_id(raw) -> str:
    logger.debug("Normalize testId: raw=%r", raw)
    try:
        s = str(raw).strip()
        if s.startswith("T") and s[1:].isdigit():
            logger.debug("testId already normalized: %s", s)
            return s
        if s.isdigit():
            norm = f"T{int(s):07d}"
            logger.debug("testId normalized (digits→T#######): %s", norm)
            return norm
    except Exception:
        logger.exception("testId normalization failed; using T0000000")
    return "T0000000"


def _sanitize_filename(s: str) -> str:
    # keep alnum, dash, underscore, dot; replace the rest with '-'
    return "".join(
        c if (c.isalnum() or c in "-_.") else "-" for c in str(s)
    )


def _strip_mode_prefix(req_id: str) -> str:
    for p in ("LOCAL-", "OFFLINE-", "KAFKA-"):
        if req_id.startswith(p):
            return req_id[len(p) :]
    return req_id


def _derive_local_request_id(message: JsonDict) -> str:
    logger.debug(
        "Deriving local requestId from message keys=%s",
        list(message.keys()),
    )
    # timestamp uses underscores so it's filename-safe
    now_str = datetime.now().strftime("%Y-%m-%d-%H_%M_%S")
    data = message.get("data") or {}
    chip_raw = data.get("chipId", message.get("chipId"))
    test_raw = data.get("testId", message.get("testId"))
    chip_norm = _normalize_chip_id(chip_raw)
    test_norm = _normalize_test_id(test_raw)
    req = f"LOCAL-{now_str}_{chip_norm}_{test_norm}"
    logger.debug("Derived local requestId=%s", req)
    return req


def _ensure_dir(path: str) -> None:
    logger.debug("Ensuring directory exists: %s", path)
    os.makedirs(path, exist_ok=True)


def _cmd_folder_name(cmd_type: str) -> str:
    logger.debug("Mapping command type to folder: %s", cmd_type)
    m = {
        "RunTest": "RunTest",
        "RunLoopTest": "RunLoopTest",
        "RunSequenceTest": "RunSequenceTest",
        "RunTestPlan": "RunSequenceTest",  # group plans with sequences
    }
    folder = m.get(cmd_type, cmd_type or "Unknown")
    logger.debug("Folder resolved: %s", folder)
    return folder


def _extract_request_id(message: JsonDict, default: str = "unknown") -> str:
    logger.debug(
        "Extracting requestId from keys=%s (fallback=%s)",
        list(message.keys()),
        default,
    )
    for k in REQUEST_ID_KEYS:
        if k in message:
            try:
                rid = str(message[k])
                logger.debug("Found requestId via key %s: %s", k, rid)
                return rid
            except Exception:
                logger.exception(
                    "Failed casting requestId under key %s",
                    k,
                )
    logger.debug("requestId not found; using default=%s", default)
    return default


def _extract_chip_name(data: JsonDict) -> str:
    logger.debug(
        "Extract chipName from data keys=%s",
        list((data or {}).keys()),
    )
    try:
        params = data.get("params") or {}
        chip = str(params.get("chipName") or "")
        logger.debug("chipName resolved=%r", chip)
        return chip
    except Exception:
        logger.exception("chipName extraction failed")
        return ""


def _is_stream_reply(reply: JsonDict) -> bool:
    t = reply.get("type")
    is_stream = isinstance(t, str) and t.endswith("StreamReply")
    logger.debug("Reply type=%r → is_stream=%s", t, is_stream)
    return is_stream


def _list_missing(envelope: JsonDict, paths: list[str]) -> list[str]:
    logger.debug(
        "Checking required paths on envelope; paths=%s",
        paths,
    )
    cur = envelope
    missing = []
    for path in paths:
        cur = envelope
        ok = True
        for part in path.split("."):
            if not isinstance(cur, dict) or part not in cur:
                ok = False
                break
            cur = cur[part]
        if not ok:
            missing.append(f"missing: {path}")
    logger.debug("Missing paths: %s", missing)
    return missing


def _load_config_module(path: str):
    logger.debug("Loading config module from: %s", path)
    abspath = os.path.abspath(path)
    spec = importlib.util.spec_from_file_location("custom_config", abspath)
    if spec is None or spec.loader is None:
        logger.error(
            "Cannot load config module (no spec/loader) from: %s",
            path,
        )
        raise RuntimeError(f"Cannot load config module from: {path}")
    config = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(config)  # type: ignore[union-attr]
    logger.debug("Config module loaded ok: attrs=%s", dir(config))
    return config


# --------------------------------------------------------------------------------------
# Centralized per-request logging setup
# --------------------------------------------------------------------------------------
def _ensure_quiet_console() -> None:
    """
    Force any console StreamHandler to INFO+ and filter out DEBUG.
    Keeps CLI output clean while file handlers can capture DEBUG.
    """
    root = logging.getLogger()
    for h in list(root.handlers):
        if isinstance(h, logging.StreamHandler) and not isinstance(
            h,
            logging.FileHandler,
        ):
            h.setLevel(logging.INFO)
            if not any(isinstance(f, NoDebug) for f in h.filters):
                h.addFilter(NoDebug())


def setup_request_logging(
    *,
    mode_label: str,  # "LOCAL" | "OFFLINE" | "KAFKA"
    cmd_type: str,  # e.g. "RunTest" (affects folder)
    req_id: str,  # effective requestId
    enable_debug: bool,  # True when --db is used
    create_info: bool,  # create INFO log file?
    create_debug: bool,  # create DEBUG log file?
    master_log_dir: str = MASTER_LOG_DIR,
) -> Tuple[
    Optional[logging.Handler],
    Optional[logging.Handler],
    dict,
    Callable[[], None],
]:
    """
    Create per-request file logging under the command folder with exact naming:
      debug: master_log/<cmd_type>/debug/<MODE>-<ts>_<C####_T#######>.log
      info : master_log/<cmd_type>/info/<requestId>.log

    Returns (info_handler_or_None, debug_handler_or_None, paths_dict, teardown_fn)

    - Console remains INFO+ (no DEBUG on CLI).
    - Root level is bumped to DEBUG only if a DEBUG file is attached.
    - A first DEBUG message is emitted when the debug file is active to ensure it's never empty.

    paths_dict:
        {
          "info_log_path":  "... or None",
          "debug_log_path": "... or None",
          "out_dir":        ".../master_output/<cmd_type>",
        }

    teardown_fn() removes and closes any handlers we created here.
    """
    cmd_dir = _cmd_folder_name(cmd_type)
    log_base = os.path.join(master_log_dir, cmd_dir)
    log_info_dir = os.path.join(log_base, "info")
    log_debug_dir = os.path.join(log_base, "debug")

    if create_info:
        _ensure_dir(log_info_dir)
    if create_debug:
        _ensure_dir(log_debug_dir)

    ts = datetime.now().strftime("%Y-%m-%d-%H_%M_%S")
    req_tail = _sanitize_filename(_strip_mode_prefix(req_id))

    info_log_path = (
        os.path.join(log_info_dir, f"{req_id}.log") if create_info else None
    )
    debug_log_path = (
        os.path.join(
            log_debug_dir,
            f"{mode_label}-{ts}_{req_tail}.log",
        )
        if create_debug
        else None
    )

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    )
    root = logging.getLogger()

    fh_info: Optional[logging.Handler] = None
    fh_debug: Optional[logging.Handler] = None

    if create_info:
        fh_info = logging.FileHandler(
            info_log_path,
            mode="w",
            encoding="utf-8",
        )
        fh_info.setLevel(logging.INFO)
        fh_info.setFormatter(fmt)
        fh_info.addFilter(NoDebug())
        root.addHandler(fh_info)

    if create_debug and enable_debug:
        # Allow DEBUG to reach file handler, but keep console at INFO+
        root.setLevel(logging.DEBUG)
        _ensure_quiet_console()

        fh_debug = logging.FileHandler(
            debug_log_path,
            mode="w",
            encoding="utf-8",
        )
        fh_debug.setLevel(logging.DEBUG)
        fh_debug.setFormatter(fmt)
        fh_debug.addFilter(OnlyDebug())
        root.addHandler(fh_debug)

        # Ensure the debug file is never empty
        logger.debug("Debug file active: %s", debug_log_path)

    paths = {
        "info_log_path": info_log_path,
        "debug_log_path": debug_log_path,
        "out_dir": os.path.join(MASTER_OUT_DIR, cmd_dir),
    }
    _ensure_dir(paths["out_dir"])

    def teardown() -> None:
        # Remove and close any handlers we created
        try:
            if fh_debug:
                root.removeHandler(fh_debug)
                fh_debug.close()
        finally:
            if fh_info:
                root.removeHandler(fh_info)
                fh_info.close()

    return fh_info, fh_debug, paths, teardown


# --------------------------------------------------------------------------------------
# Agent
# --------------------------------------------------------------------------------------
class TestAgent:
    def __init__(
        self,
        topics_cfg: TopicsCfg,
        kafka_cfg: KafkaCfg,
        *,
        local_mode: bool = False,
        offline_mode: bool = False,
        kafka_msg: Optional[JsonDict] = None,
        poll_timeout: float = 0.5,
        enable_debug: bool = False,
    ):
        logger.debug(
            "TestAgent.__init__(local_mode=%s, offline_mode=%s, poll_timeout=%.3f)",
            local_mode,
            offline_mode,
            poll_timeout,
        )
        self.local_mode = local_mode
        self.offline_mode = offline_mode
        self.kafka_msg = kafka_msg
        self.poll_timeout = poll_timeout
        self.enable_debug = enable_debug

        self.REQUEST_TOPIC = topics_cfg["REQUEST_TOPIC"]
        self.REPLY_TOPIC = topics_cfg["REPLY_TOPIC"]
        self.STATUS_TOPIC = topics_cfg["STATUS_TOPIC"]
        self.KAFKA_CONFIG = kafka_cfg

        logger.debug(
            "Topics: request=%s reply=%s status=%s",
            self.REQUEST_TOPIC,
            self.REPLY_TOPIC,
            self.STATUS_TOPIC,
        )
        logger.debug(
            "Kafka config keys: %s",
            list(self.KAFKA_CONFIG.keys()),
        )

        self.consumer: Optional[Consumer] = None
        self.producer: Optional[Producer] = None

        self._jobs: Dict[str, threading.Thread] = {}
        self._jobs_lock = threading.Lock()
        self._running = True
        self._local_responses: list[JsonDict] = []
        self._last_final_response: Optional[JsonDict] = None
        self._per_req_debug_handlers: Dict[
            str,
            Tuple[logging.Handler, Callable[[], None]],
        ] = {}

        if threading.current_thread() is threading.main_thread():
            logger.debug(
                "Registering signal handlers (SIGINT, SIGTERM)",
            )
            signal.signal(signal.SIGINT, self._handle_signal)
            signal.signal(signal.SIGTERM, self._handle_signal)

        if not (self.local_mode or self.offline_mode):
            self._init_kafka()
        else:
            root = logging.getLogger()
            root.setLevel(logging.DEBUG)

            has_console = False
            for h in root.handlers:
                if isinstance(h, logging.StreamHandler) and not isinstance(
                    h,
                    logging.FileHandler,
                ):
                    h.setLevel(logging.INFO)
                    h.addFilter(NoDebug())
                    has_console = True
            if not has_console:
                ch = logging.StreamHandler(sys.stdout)
                ch.setLevel(logging.INFO)
                ch.addFilter(NoDebug())
                ch.setFormatter(
                    logging.Formatter(
                        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
                    )
                )
                root.addHandler(ch)

            mode = "OFFLINE" if self.offline_mode else "LOCAL"
            logger.info(
                "Running in %s MODE (Kafka disabled). Logging to: %s",
                mode,
                MASTER_LOG_DIR,
            )
            logger.debug(
                "Debug/Info split-file logging will be configured in start().",
            )

    def _init_kafka(self) -> None:
        logger.info("Initializing Kafka TestAgent...")
        logger.debug(
            "Kafka consumer config: %s",
            self.KAFKA_CONFIG.get("consumer"),
        )
        logger.debug(
            "Kafka producer config: %s",
            self.KAFKA_CONFIG.get("producer"),
        )
        try:
            self.consumer = Consumer(self.KAFKA_CONFIG["consumer"])
            logger.info("Kafka Consumer created.")
            self.producer = Producer(self.KAFKA_CONFIG["producer"])
            logger.info("Kafka Producer created.")
            self._verify_kafka_broker()
            self.consumer.subscribe([self.REQUEST_TOPIC])
            logger.info("Subscribed to topic: %s", self.REQUEST_TOPIC)
        except SystemExit:
            logger.debug(
                "SystemExit raised during _init_kafka; re-raising.",
            )
            raise
        except Exception:
            logger.exception("Failed to initialize Kafka client(s)")
            raise SystemExit(4)

    def _verify_kafka_broker(self) -> None:
        logger.debug("Verifying Kafka broker and topics")
        assert self.consumer is not None, "Consumer not initialized"
        cfg_bootstrap = self.KAFKA_CONFIG["consumer"].get(
            "bootstrap.servers",
            "unknown",
        )

        try:
            md = self.consumer.list_topics(timeout=3.0)
            logger.debug(
                "Broker metadata fetched. brokers=%d topics=%d",
                len(md.brokers or {}),
                len(md.topics or {}),
            )
        except Exception:
            logger.error(
                "Kafka broker unreachable at bootstrap.servers=%s. "
                "Check that Kafka is running and the port is correct.",
                cfg_bootstrap,
            )
            self._force_close()
            os._exit(4)

        if not md.brokers:
            logger.error(
                "Kafka metadata empty at %s. Broker may be down or wrong port.",
                cfg_bootstrap,
            )
            self._force_close()
            os._exit(4)

        wanted = [self.REQUEST_TOPIC, self.REPLY_TOPIC, self.STATUS_TOPIC]
        missing = [t for t in wanted if t not in md.topics]
        if missing:
            logger.error(
                "Kafka topics missing on broker: %s. Please create them or fix config.py.",
                ", ".join(missing),
            )
            self._force_close()
            os._exit(3)

        logger.info(
            "Kafka broker verified at %s, all topics present.",
            cfg_bootstrap,
        )

    def _force_close(self) -> None:
        logger.debug("Force-closing Kafka client handles")
        try:
            if self.consumer is not None:
                self.consumer.close()
                self.consumer = None
                logger.debug("Consumer closed")
        except Exception:
            logger.exception("Error closing consumer (ignored)")
        try:
            if self.producer is not None:
                self.producer.flush(0)
                self.producer = None
                logger.debug("Producer flushed & cleared")
        except Exception:
            logger.exception("Error flushing producer (ignored)")

    def _handle_signal(self, signum, frame) -> None:  # type: ignore[override]
        logger.info(
            "Received signal %s → stopping agent loop...",
            signum,
        )
        self._running = False

    def start(self) -> None:
        logger.debug(
            "Agent.start() begin; local=%s offline=%s",
            self.local_mode,
            self.offline_mode,
        )
        if self.local_mode or self.offline_mode:
            mode_exp = "offline" if self.offline_mode else "locally"
            mode_word = "Offline" if self.offline_mode else "Local"
            ts = datetime.now().strftime("%Y-%m-%d-%H_%M_%S")
            mode_label = mode_word.upper()
            logger.info("Processing message %s...", mode_exp)

            cmd_type = _normalize_run_command(
                (self.kafka_msg or {}).get("command", "").strip(),
            )
            cmd_dir = _cmd_folder_name(cmd_type)
            logger.debug(
                "%s start: cmd_type=%s cmd_dir=%s",
                mode_word,
                cmd_type,
                cmd_dir,
            )

            req_id = _extract_request_id(self.kafka_msg or {}, default="")
            if not req_id:
                try:
                    req_id = _derive_local_request_id(self.kafka_msg or {})
                    (self.kafka_msg or {})["requestId"] = req_id
                except Exception:
                    prefix = "OFFLINE" if self.offline_mode else "LOCAL"
                    req_id = f"{prefix}{int(time.time())}_C0000_T0000000"
                    (self.kafka_msg or {})["requestId"] = req_id
            logger.debug(
                "Effective %s requestId=%s",
                mode_word,
                req_id,
            )

            # Per-request logging setup (Local/Offline).
            fh_info, fh_debug, paths, teardown = setup_request_logging(
                mode_label=mode_label,
                cmd_type=cmd_type,
                req_id=req_id,
                enable_debug=self.enable_debug,
                create_info=True,
                create_debug=self.enable_debug,
            )
            try:
                logger.debug(
                    "Dispatching %s message to _process_command",
                    mode_word,
                )
                self._process_command(self.kafka_msg or {})

                # Save output JSON
                out_path = os.path.join(
                    paths["out_dir"],
                    f"{req_id}.json",
                )
                try:
                    out = {
                        "requestId": req_id,
                        "commandDetails": {
                            "command": (self.kafka_msg or {}).get(
                                "command",
                            ),
                            "data": (self.kafka_msg or {}).get("data"),
                        },
                        "responses": self._last_final_response,
                    }
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(
                            out,
                            f,
                            ensure_ascii=False,
                            indent=2,
                        )
                    mode = "OFFLINE" if self.offline_mode else "LOCAL"
                    logger.info(
                        "%s OUTPUT JSON saved to: %s",
                        mode,
                        out_path,
                    )
                except Exception:
                    logger.exception(
                        "Failed to write local/offline output JSON",
                    )
            finally:
                teardown()
            return

        else:
            logger.info(
                "TestAgent started (request topic: %s)",
                self.REQUEST_TOPIC,
            )
            idle_logged = False

            try:
                while self._running:
                    try:
                        msg = (
                            self.consumer.poll(timeout=self.poll_timeout)
                            if self.consumer
                            else None
                        )
                        logger.debug(
                            "Polled Kafka: msg=%s",
                            "none" if msg is None else "present",
                        )
                    except Exception:
                        logger.exception("Kafka poll failed")
                        time.sleep(self.poll_timeout)
                        continue

                    if msg is None:
                        if not idle_logged and not self._jobs:
                            logger.info(
                                "TestAgent idling, listening for commands...",
                            )
                            idle_logged = True
                        continue

                    idle_logged = False

                    if msg.error():
                        err_obj = msg.error()
                        logger.error("Kafka error: %s", err_obj)
                        try:
                            code = err_obj.code()
                            unknown_topic = (
                                getattr(
                                    KafkaError,
                                    "UNKNOWN_TOPIC_OR_PART",
                                    None,
                                )
                                == code
                                or "Unknown topic or partition" in str(
                                    err_obj,
                                )
                            )
                        except Exception:
                            unknown_topic = (
                                "Unknown topic or partition"
                                in str(err_obj)
                            )

                        if unknown_topic:
                            logger.error(
                                "Stopping TestAgent: configured topic(s) are unknown to the broker.",
                            )
                            self._running = False
                            break

                        continue

                    try:
                        payload = msg.value()
                        logger.debug(
                            "Received Kafka payload bytes=%s",
                            len(payload) if payload else None,
                        )
                        if payload is None:
                            logger.warning("Received empty Kafka message")
                            continue

                        command = json.loads(payload.decode("utf-8"))
                        logger.debug(
                            "Decoded command keys=%s",
                            list(command.keys()),
                        )
                        self._process_command(command)

                    except json.JSONDecodeError as e:
                        logger.error("Invalid JSON in message: %s", e)
                        reply = err.agent_fail(
                            "AgentError",
                            "unknown",
                            f"Invalid JSON: {e}",
                        )
                        reply["agentStatus"] = "TestAgentFail"
                        self._send_response(reply)
                    except Exception:
                        logger.exception(
                            "Unexpected error decoding/processing message",
                        )

            finally:
                self._shutdown()

    def _shutdown(self) -> None:
        logger.debug("Agent._shutdown() enter; local=%s", self.local_mode)
        if self.local_mode:
            logger.info("Agent shut down (local mode).")
            return

        try:
            if self.consumer is not None:
                logger.info("Closing Kafka consumer ...")
                self.consumer.close()
            if self.producer is not None:
                logger.info("Flushing Kafka producer ...")
                self.producer.flush(timeout=10)
        except Exception:
            logger.exception("Error during shutdown")
        finally:
            logger.info("Agent shut down cleanly.")

    def _process_command(self, command: JsonDict) -> None:
        logger.debug(
            "Process command: keys=%s",
            list((command or {}).keys()),
        )
        start_ts = time.time()
        raw_cmd = (command.get("command") or "").strip()
        cmd_type = _normalize_run_command(raw_cmd)
        data = (command.get("data") or {}).copy()
        req_id = _extract_request_id(command, default="unknown")
        logger.debug(
            "cmd_type=%r req_id=%r data_keys=%s",
            cmd_type,
            req_id,
            list(data.keys()),
        )

        if not cmd_type:
            logger.error("Missing 'command' field in message")
            reply = err.agent_fail(
                "AgentError",
                req_id,
                "Missing 'command' field",
            )
            reply["agentStatus"] = "TestAgentFail"
            self._send_response(reply)
            return

        # Busy pre-check for RunTest/Loop/Plan/Sequence.
        try:
            from svt_test_agent import cmd_handler as ch

            if cmd_type in {
                "RunTest",
                "RunLoopTest",
                "RunTestPlan",
                "RunSequenceTest",
            }:
                is_busy = getattr(ch, "is_system_busy", None)
                logger.debug(
                    "Busy pre-check callable=%s",
                    callable(is_busy),
                )
                if callable(is_busy) and is_busy():
                    error_msg = (
                        "Another test is already running. "
                        "Use 'RunTest: Sequence/Loop' or wait until it finishes."
                    )
                    logger.warning(error_msg)
                    reply = err.test_fail(cmd_type, req_id, error_msg)
                    reply["agentStatus"] = "TestAgentSuccess"
                    self._send_response(reply)
                    return
        except Exception:
            logger.exception("Busy pre-check failed (continuing).")

        chip_name = _extract_chip_name(data)
        ctx = HandlerContext(
            request_id=req_id,
            command_type=cmd_type,
            chip_name=chip_name,
            envelope=command,
        )
        logger.debug("HandlerContext: %s", ctx)

        data["_meta"] = {
            "request_id": req_id,
            "command_type": cmd_type,
            "chipName": chip_name,
            "localMode": self.local_mode,
            "offlineMode": self.offline_mode,
        }
        data["_envelope"] = command

        params = data.setdefault("params", {})
        if isinstance(params, dict) and "_request_id" not in params:
            params["_request_id"] = req_id
            logger.debug("Injected _request_id into params")

        logger.info(
            "Processing command=%s requestId=%s chip=%s",
            cmd_type,
            req_id,
            chip_name or "not resolved",
        )

        # Per-request logging setup (Kafka mode).
        per_req_debug_handler: Optional[logging.Handler] = None
        teardown: Optional[Callable[[], None]] = None
        if not (self.local_mode or self.offline_mode):
            create_info = False
            create_debug = self.enable_debug
            if create_debug:
                try:
                    _, per_req_debug_handler, paths, teardown = (
                        setup_request_logging(
                            mode_label="KAFKA",
                            cmd_type=cmd_type,
                            req_id=req_id,
                            enable_debug=True,
                            create_info=False,
                            create_debug=True,
                        )
                    )
                    logger.info(
                        "DEBUG logging (per-request) → %s",
                        paths["debug_log_path"],
                    )
                except Exception:
                    logger.exception(
                        "Failed to attach per-request debug handler",
                    )

        try:
            handler = self._resolve_handler(cmd_type, chip_name)
            logger.debug(
                "Resolved handler=%s for cmd=%s chip=%s",
                getattr(handler, "__name__", None),
                cmd_type,
                chip_name,
            )
            if handler is None:
                logger.error("Unknown command type: %s", cmd_type)
                reply = err.agent_fail(
                    cmd_type or "Unknown",
                    req_id,
                    f"Unknown command type: {cmd_type}",
                )
                reply["agentStatus"] = "TestAgentFail"
                self._send_response(reply)
                return

            try:
                sig = inspect.signature(handler)
                logger.debug("Handler signature: %s", sig)
                if len(sig.parameters) >= 2:
                    result = handler(data, ctx)
                else:
                    result = handler(data)
            except Exception:
                logger.debug(
                    "Handler invoked without signature introspection",
                )
                result = handler(data)

            # Streaming generator case.
            if isinstance(result, types.GeneratorType):
                logger.debug("Handler returned generator (streaming)")
                if self.local_mode or self.offline_mode:
                    try:
                        for reply in result:
                            reply = reply.get("out")
                            logger.debug(
                                "Local stream next reply keys=%s",
                                list((reply or {}).keys()),
                            )
                            self._send_response(reply)
                    except Exception as e:
                        logger.exception(
                            "Streaming (local) failed for %s",
                            req_id,
                        )
                        fail = err.agent_fail(
                            "StreamError",
                            req_id,
                            str(e),
                        )
                        fail["agentStatus"] = "TestAgentFail"
                        self._send_response(fail)
                    return
                else:
                    # Kafka streaming: keep the handler alive until the stream ends;
                    # tear down logging in worker on completion.
                    if per_req_debug_handler and teardown:
                        self._per_req_debug_handlers[req_id] = (
                            per_req_debug_handler,
                            teardown,
                        )
                        per_req_debug_handler = None
                        teardown = None
                    self._start_streaming_job(req_id, result)
                    return

            # Non-stream: finalise and respond.
            latency_ms = round((time.time() - start_ts) * 1000, 1)
            logger.debug(
                "Non-stream handler result received; assembling response (latency_ms=%s)",
                latency_ms,
            )
            result = (result or {})
            result = result.get("out") if isinstance(result, dict) else result
            resp_obj = {
                **(result or {}),
                "requestId": req_id,
                "latency_ms": latency_ms,
                "agentStatus": "TestAgentSuccess",
            }
            logger.debug(
                "Final response keys=%s",
                list(resp_obj.keys()),
            )
            self._send_response(resp_obj)

        except Exception as e:
            logger.exception("Handler error")
            reply = err.from_exception(
                cmd_type or "Unknown",
                req_id,
                e,
            )
            reply["agentStatus"] = "TestAgentFail"
            self._send_response(reply)
        finally:
            # For non-streaming Kafka requests, tear down here if we created a debug handler.
            if teardown:
                try:
                    teardown()
                except Exception:
                    logger.exception(
                        "Failed to teardown per-request debug handler",
                    )

    def _resolve_handler(self, cmd_type: str, chip_name: str):
        logger.debug(
            "Resolve handler for cmd_type=%s chip_name=%s",
            cmd_type,
            chip_name,
        )
        chip_commands = CHIP_COMMAND_OVERRIDES.get(chip_name, {}) or {}
        handlers = {**DEFAULT_COMMAND_HANDLERS, **chip_commands}
        handler = handlers.get(cmd_type)
        logger.debug(
            "Handler found=%s",
            getattr(handler, "__name__", None),
        )
        return handler

    def _start_streaming_job(self, req_id: str, gen):
        logger.debug("Starting streaming job for req_id=%s", req_id)

        def worker():
            logger.debug(
                "Streaming worker thread enter for %s",
                req_id,
            )
            try:
                for reply in gen:
                    reply = reply.get("out")
                    logger.debug(
                        "Streaming next reply keys=%s",
                        list((reply or {}).keys()),
                    )
                    resp_obj = {
                        **(reply or {}),
                        "requestId": req_id,
                        "agentStatus": "TestAgentSuccess",
                    }
                    self._send_response(resp_obj)
            except Exception as e:
                logger.exception(
                    "Streaming job failed for %s",
                    req_id,
                )
                fail = err.agent_fail("StreamError", req_id, str(e))
                fail["agentStatus"] = "TestAgentFail"
                self._send_response(fail)
            finally:
                with self._jobs_lock:
                    self._jobs.pop(req_id, None)
                # Clean up the per-request debug handler now that streaming is done (Kafka).
                try:
                    t = self._per_req_debug_handlers.pop(req_id, None)
                    if t:
                        _, teardown = t
                        if callable(teardown):
                            teardown()
                except Exception:
                    logger.exception(
                        "Failed to remove per-request debug handler for %s",
                        req_id,
                    )
                logger.debug(
                    "Streaming job finished for request id: %s",
                    req_id,
                )

        t = threading.Thread(
            target=worker,
            name=f"job-{req_id}",
            daemon=True,
        )
        with self._jobs_lock:
            self._jobs[req_id] = t
        t.start()
        logger.debug(
            "Started streaming job thread for %s",
            req_id,
        )
        return t

    def _delivery_report(self, err_, msg) -> None:
        if err_:
            logger.error("Delivery failed: %s", err_)
        else:
            logger.info(
                "Delivered message to %s [%s] @ offset %s",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def _send_response(self, response: JsonDict) -> None:
        logger.debug(
            "Send response path enter; local=%s offline=%s keys=%s",
            self.local_mode,
            self.offline_mode,
            list((response or {}).keys()),
        )
        if self.local_mode or self.offline_mode:
            mode = "OFFLINE" if self.offline_mode else "LOCAL"
            if _is_stream_reply(response):
                logger.debug(
                    "%s RESPONSE (stream): %s",
                    mode,
                    json.dumps(response, indent=2),
                )
            else:
                logger.info(
                    "%s RESPONSE: %s",
                    mode,
                    json.dumps(response, indent=2),
                )
                try:
                    self._last_final_response = dict(response)
                    logger.debug(
                        "Snapshot final response for JSON output",
                    )
                except Exception:
                    logger.exception(
                        "Failed to snapshot final response for JSON output",
                    )
            return

        if response.get("agentStatus") == "TestAgentFail":
            topic = self.REPLY_TOPIC
        else:
            topic = (
                self.STATUS_TOPIC
                if _is_stream_reply(response)
                else self.REPLY_TOPIC
            )
        logger.debug(
            "Publishing to topic=%s key=%s",
            topic,
            response.get("requestId"),
        )

        pub = dict(response)

        try:
            assert self.producer is not None, "Producer not initialized"
            self.producer.produce(
                topic,
                key=str(pub.get("requestId", "")),
                value=json.dumps(pub),
                callback=self._delivery_report,
            )
            self.producer.poll(0.1)
            logger.debug("Produce queued; poll(0.1) called")
        except Exception:
            logger.exception("Error producing Kafka message")


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------
def main() -> None:

    parser = argparse.ArgumentParser(description="Run the SVT TestAgent.")
    parser.add_argument(
        "--local",
        action="store_true",
        help="Run without Kafka; process local JSON (--json).",
    )
    parser.add_argument(
        "--json",
        type=str,
        help="Path to JSON file with test command (only with --local or --offline).",
    )
    parser.add_argument(
        "config_file",
        nargs="?",
        help="Path to config.py file (Kafka mode only).",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Run in offline validation mode (no DB/emulator); requires --json.",
    )
    parser.add_argument(
        "--db",
        action="store_true",
        help="Enable DEBUG logging to file (per-request).",
    )

    args = parser.parse_args()
    logger.debug("Parsed args: %s", args)

    try:
        persist_kafka_port_if_env_set()
        logger.debug("persist_kafka_port_if_env_set() done")
    except Exception:
        logger.exception(
            "Failed persisting KAFKA_LOCAL_PORT (continuing).",
        )

    if args.local and args.offline:
        logger.error("--local and --offline cannot be used together.")
        sys.exit(1)

    if args.local:
        logger.debug("Entering --local code path")
        if not args.json:
            logger.error("In --local mode you must provide --json <file>")
            sys.exit(1)
        with open(args.json) as f:
            kafka_msg = json.load(f)
        logger.debug(
            "Loaded local JSON; keys=%s",
            list(kafka_msg.keys()),
        )

        try:
            derived_id = _derive_local_request_id(kafka_msg)
            kafka_msg["requestId"] = derived_id
        except Exception:
            kafka_msg["requestId"] = (
                f"LOCAL{int(time.time())}_C0000_T0000000"
            )
        logger.debug("Local requestId=%s", kafka_msg["requestId"])

        topics_cfg: TopicsCfg = {
            "REQUEST_TOPIC": "unused.local",
            "REPLY_TOPIC": "unused.local",
            "STATUS_TOPIC": "unused.local",
        }
        kafka_cfg: KafkaCfg = {"consumer": {}, "producer": {}}
        agent = TestAgent(
            topics_cfg,
            kafka_cfg,
            local_mode=True,
            kafka_msg=kafka_msg,
            enable_debug=args.db,
        )
        agent.start()
        return

    if args.offline:
        logger.debug("Entering --offline code path")
        if not args.json:
            logger.error("In --offline mode you must provide --json <file>")
            sys.exit(1)
        with open(args.json) as f:
            kafka_msg = json.load(f)
        logger.debug(
            "Loaded offline JSON; keys=%s",
            list(kafka_msg.keys()),
        )

        try:
            derived_id = _derive_local_request_id(kafka_msg)
            kafka_msg["requestId"] = derived_id
        except Exception:
            kafka_msg["requestId"] = (
                f"LOCAL{int(time.time())}_C0000_T0000000"
            )
        logger.debug("Offline requestId=%s", kafka_msg["requestId"])

        topics_cfg = {
            "REQUEST_TOPIC": "unused.offline",
            "REPLY_TOPIC": "unused.offline",
            "STATUS_TOPIC": "unused.offline",
        }
        kafka_cfg = {"consumer": {}, "producer": {}}
        agent = TestAgent(
            topics_cfg,
            kafka_cfg,
            local_mode=False,
            offline_mode=True,
            kafka_msg=kafka_msg,
            enable_debug=args.db,
        )
        agent.start()
        return

    # Kafka mode
    logger.debug("Entering Kafka mode code path")
    if not args.config_file:
        logger.error(
            "Kafka mode requires a config file path "
            "(e.g., 'python -m svt_test_agent.test_agent config.py').",
        )
        sys.exit(2)

    cfg = _load_config_module(args.config_file)

    required = ("REQUEST_TOPIC", "REPLY_TOPIC", "STATUS_TOPIC")
    missing = [name for name in required if not hasattr(cfg, name)]
    if missing:
        logger.error(
            "Config %s is missing required topics: %s",
            args.config_file,
            ", ".join(missing),
        )
        sys.exit(2)

    topics_cfg = {
        "REQUEST_TOPIC": cfg.REQUEST_TOPIC,
        "REPLY_TOPIC": cfg.REPLY_TOPIC,
        "STATUS_TOPIC": cfg.STATUS_TOPIC,
    }
    logger.debug("Topics from config: %s", topics_cfg)

    kafka_cfg: Optional[KafkaCfg] = getattr(cfg, "KAFKA_CONFIG", None)
    if not kafka_cfg:
        kafka_cfg = build_kafka_config()
        logger.debug(
            "Built Kafka config via util_config (config module had no KAFKA_CONFIG)",
        )
    else:
        logger.debug("Using Kafka config from config module")

    agent = TestAgent(
        topics_cfg,
        kafka_cfg,
        local_mode=False,
        enable_debug=args.db,
    )
    agent.start()


if __name__ == "__main__":
    main()
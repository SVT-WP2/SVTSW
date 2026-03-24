"""
Configuration and Kafka utility helpers for the SVT Test Agent.

This module centralises:
  - Kafka port persistence and lookup (env/file/default).
  - Lightweight broker health checks.
  - Resolution and loading of the config module in different contexts
    (env, CWD, packaged default, or an internal fallback).
  - Construction of effective Kafka client configuration from a
    template.
  - Selection of backend configuration (emulator vs real backend).

Location: svt_test_agent/utilities/util_config.py
"""

from __future__ import annotations

import importlib.util
import json
import logging
import os
import socket
import sys
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("UtilConfig")
# Inherit root level unless explicitly overridden
logger.setLevel(logging.NOTSET)


# -------------------------------
# Port file (single source of truth)
# -------------------------------
def port_file_path() -> Path:
    p = os.getenv("SVT_PORT_FILE")
    path = Path(p).expanduser() if p else (Path.home() / ".svt" / "kafka_port.json")
    logger.debug("port_file_path -> %s (SVT_PORT_FILE=%r)", path, p)
    return path


def persist_kafka_port(port: str) -> None:
    f = port_file_path()
    try:
        logger.debug("persist_kafka_port(%r) -> file=%s", port, f)
        f.parent.mkdir(parents=True, exist_ok=True)
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps({"port": str(port)}))
        tmp.replace(f)
        logger.info("Persisted Kafka port=%s to %s", port, f)
    except Exception as e:
        logger.exception("persist_kafka_port failed (non-fatal): %s", e)


def read_kafka_port(default: str = "9095") -> str:
    env = os.getenv("KAFKA_LOCAL_PORT")
    if env and env.strip():
        logger.debug("read_kafka_port: using env KAFKA_LOCAL_PORT=%r", env)
        return env.strip()

    f = port_file_path()
    try:
        if f.exists():
            data = json.loads(f.read_text())
            port = str(data.get("port", default)).strip()
            out = port or default
            logger.debug("read_kafka_port: read %r from %s -> %s", data, f, out)
            return out
        else:
            logger.debug(
                "read_kafka_port: file %s does not exist; using default %s",
                f,
                default,
            )
    except Exception as e:
        logger.exception(
            "read_kafka_port: error reading %s (using default %s): %s",
            f,
            default,
            e,
        )
    return default


def persist_kafka_port_if_env_set() -> None:
    env = os.getenv("KAFKA_LOCAL_PORT")
    if env and env.strip():
        logger.debug(
            "persist_kafka_port_if_env_set: persisting env KAFKA_LOCAL_PORT=%r",
            env,
        )
        persist_kafka_port(env.strip())
    else:
        logger.debug(
            "persist_kafka_port_if_env_set: env KAFKA_LOCAL_PORT not set"
        )


# -------------------------------
# Kafka health check
# -------------------------------
def _check_kafka_up(
    host: str = "localhost",
    port: int | str = 9095,
    timeout: float = 1.0,
) -> bool:
    """
    Lightweight TCP check to see if something is listening on host:port.
    Intended for "is broker up" checks before starting agents.
    """
    try:
        port = int(port)
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# -------------------------------
# Config module resolution
# -------------------------------
_cfg_module: Optional[Any] = None


def _load_cfg_from_path(path: str):
    abspath = os.path.abspath(path)
    logger.debug("_load_cfg_from_path(%s)", abspath)
    spec = importlib.util.spec_from_file_location("custom_config", abspath)
    if spec is None or spec.loader is None:
        logger.error("Cannot load config module from: %s", path)
        raise RuntimeError(f"Cannot load config module from: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules["custom_config"] = mod
    logger.info("Loaded config module from path: %s", abspath)
    return mod


def get_cfg():
    global _cfg_module
    if _cfg_module is not None:
        logger.debug("get_cfg: returning cached module %r", _cfg_module)
        return _cfg_module

    # 1) If something already registered itself as "custom_config", use that
    mod = sys.modules.get("custom_config")
    if mod:
        logger.info("get_cfg: using already-loaded 'custom_config' from sys.modules")
        _cfg_module = mod
        return _cfg_module

    # 2) Explicit env override
    env_path = os.environ.get("SVT_CONFIG_PATH")
    if env_path and Path(env_path).exists():
        logger.info("get_cfg: loading from SVT_CONFIG_PATH=%s", env_path)
        _cfg_module = _load_cfg_from_path(env_path)
        return _cfg_module
    elif env_path:
        logger.warning(
            "get_cfg: SVT_CONFIG_PATH set but file missing: %s",
            env_path,
        )


    # 3) Canonical in-package config: <package_root>/configs/config.py
    pkg_root = Path(__file__).resolve().parents[1]
    pkg_cfg_path = pkg_root / "configs" / "config.py"
    if pkg_cfg_path.exists():
        logger.info("get_cfg: loading in-package configs/config.py: %s", pkg_cfg_path)
        _cfg_module = _load_cfg_from_path(str(pkg_cfg_path))
        return _cfg_module

    # 5) Optional packaged svt_test_agent.config shim (if you ever add one)
    try:
        from svt_test_agent import config as pkg_cfg  # type: ignore[import]

        logger.info("get_cfg: using packaged svt_test_agent.config")
        _cfg_module = pkg_cfg
        return _cfg_module
    except Exception as e:
        logger.debug("get_cfg: packaged svt_test_agent.config not available: %s", e)

    # 6) Final fallback – internal defaults
    class _Defaults:
        KAFKA_CONFIG_TEMPLATE = {
            "consumer": {
                "bootstrap.servers": "localhost:9095",
                "group.id": "svt_test_agent-default",
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
            },
            "producer": {
                "bootstrap.servers": "localhost:9095",
                "acks": "all",
                "linger.ms": 5,
                "batch.num.messages": 1000,
                "retries": 5,
            },
        }
        BACKEND = {"class": "EmulatorBackend", "kwargs": {}}
        REAL_BACKEND = {"class": "RealBackend", "kwargs": {}}

    logger.warning("get_cfg: falling back to _Defaults configuration")
    _cfg_module = _Defaults()
    return _cfg_module


# -------------------------------
# Build effective Kafka config
# -------------------------------
def build_kafka_config() -> Dict[str, Dict[str, Any]]:
    cfg = get_cfg()
    template = getattr(cfg, "KAFKA_CONFIG_TEMPLATE", None)
    if not isinstance(template, dict):
        logger.debug(
            "build_kafka_config: KAFKA_CONFIG_TEMPLATE not dict; re-reading via get_cfg()"
        )
        template = get_cfg().KAFKA_CONFIG_TEMPLATE

    conf = json.loads(json.dumps(template))  # deep copy
    port = read_kafka_port("9095")
    logger.debug("build_kafka_config: base_port=%s", port)

    conf.setdefault("consumer", {})
    conf.setdefault("producer", {})
    conf["consumer"]["bootstrap.servers"] = f"localhost:{port}"
    conf["producer"]["bootstrap.servers"] = f"localhost:{port}"

    logger.info(
        "Kafka config: consumer.bootstrap=%s producer.bootstrap=%s",
        conf["consumer"]["bootstrap.servers"],
        conf["producer"]["bootstrap.servers"],
    )
    logger.debug(
        "build_kafka_config: consumer_keys=%s producer_keys=%s",
        list(conf["consumer"].keys()),
        list(conf["producer"].keys()),
    )
    return conf


def get_backend_config(override: Optional[str] = None) -> Dict[str, Any]:
    cfg = get_cfg()
    BACKEND = getattr(cfg, "BACKEND", {"class": "EmulatorBackend", "kwargs": {}})
    REAL_BACKEND = getattr(cfg, "REAL_BACKEND", {"class": "RealBackend", "kwargs": {}})

    desired = (override or os.getenv("BACKEND_CLASS") or BACKEND.get("class", "")).strip()
    logger.debug(
        "get_backend_config(override=%r, env=%r) desired=%r",
        override,
        os.getenv("BACKEND_CLASS"),
        desired,
    )

    if desired == REAL_BACKEND.get("class"):
        logger.info("Backend config: using REAL_BACKEND %r", REAL_BACKEND)
        return REAL_BACKEND
    if desired == BACKEND.get("class"):
        logger.info("Backend config: using BACKEND %r", BACKEND)
        return BACKEND

    out = {"class": desired, "kwargs": {}}
    logger.info("Backend config: custom class requested -> %r", out)
    return out
"""
SVT Test Agent development startup utilities.

This module provides helper functions to start and stop the local Kafka
broker via Docker Compose, resolve and persist the effective Kafka port,
create required topics using the topic creation utility, run the Test
Agent in normal, local, or offline mode, and manage the Dummy DB agent
used during development and testing.

Location: svt_test_agent/dev/startup.py
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import logging

from kafka_broker.broker_utils import topic_creation
from svt_test_agent.utilities.util_config import (
    port_file_path,
    read_kafka_port,
    persist_kafka_port_if_env_set,
    _check_kafka_up,
)

logger = logging.getLogger(__name__)

PKG_DEV_DIR = Path(__file__).resolve().parent          # .../svt_test_agent/dev
REPO_ROOT = PKG_DEV_DIR.parents[1]                     # repository root

DOCKER_COMPOSE = REPO_ROOT / "kafka_broker" / "docker" / "docker-compose.yml"
DUMMYDB_PID_FILE = Path.home() / "svt" / "dummydb-agent.pid"


def _resolve_port_and_persist() -> Tuple[str, dict]:
    """
    Resolve the Kafka port for development and ensure it is exported so that
    child processes can discover it.

    Priority:
        1. Environment override (handled by persist_kafka_port_if_env_set)
        2. Port file recorded by previous runs
        3. Default port 9095

    Returns:
        A tuple of (port_as_string, copy_of_environment_dict).
    """
    persist_kafka_port_if_env_set()

    port = read_kafka_port("9095")

    os.environ["KAFKA_LOCAL_PORT"] = str(port)
    os.environ["SVT_PORT_FILE"] = str(port_file_path())
    return str(port), os.environ.copy()


def _wait_and_create_topics(cfg_path: Path, retries: int = 12, delay_s: float = 5.0) -> None:
    """
    Run the topic creation utility, retrying until it succeeds or retries are
    exhausted. Intended to be used after the Kafka broker has been started.
    """
    for i in range(retries):
        try:
            saved_argv = sys.argv[:]
            sys.argv = ["topic_creation", str(cfg_path)]
            topic_creation.main()
            logger.info("Topics created (attempt %d).", i + 1)
            return
        except Exception as exc:
            if i == retries - 1:
                logger.error(
                    "Failed to create topics after %d attempts: %s",
                    retries,
                    exc,
                )
                raise
            logger.warning(
                "Topic creation failed (attempt %d/%d), retrying in %.1f s: %s",
                i + 1,
                retries,
                delay_s,
                exc,
            )
            time.sleep(delay_s)
        finally:
            sys.argv = saved_argv


def _default_cfg_path() -> Optional[Path]:
    """
    Resolve the configuration file path for development.

    Resolution order:
        1. Path from $SVT_CONFIG_PATH
        2. Canonical in-repo config: <repo_root>/svt_test_agent/configs/config.py
    """
    # 1. Explicit override via environment variable
    env_p = os.environ.get("SVT_CONFIG_PATH")
    if env_p:
        p = Path(env_p).expanduser()
        if p.exists():
            return p

    # 2. Canonical config location
    default_cfg = REPO_ROOT / "svt_test_agent" / "configs" / "config.py"
    if default_cfg.exists():
        return default_cfg

    return None

def _has_positional(argv: list[str]) -> bool:
    """
    Check if any positional (non-flag) argument exists in argv[1:].
    """
    return any(a and not a.startswith("-") for a in argv[1:])


def _maybe_enable_debug_flag() -> None:
    """
    Enable debug logging for the Test Agent when SVT_DEBUG is set to a
    truthy value and '--debug' is not already present in sys.argv.
    """
    val = os.environ.get("SVT_DEBUG", "").strip().lower()
    if val in ("1", "true", "yes", "on", "debug"):
        if "--debug" not in sys.argv:
            sys.argv.insert(1, "--debug")


def bootstrap() -> None:
    """
    Default startup entry.

    If Kafka is required and no explicit config path is given, append a
    discovered config path, enable debug logging if requested, and then
    dispatch to svt_test_agent.test_agent.main().
    """
    if not _has_positional(sys.argv):
        cfg = _default_cfg_path()
        if cfg:
            sys.argv.append(str(cfg))

    _maybe_enable_debug_flag()
    from svt_test_agent.test_agent import main as real_main

    real_main()


def run_agent() -> None:
    """
    Start the Test Agent after resolving and exporting the Kafka port. If
    a config.py is present in the current working directory it is passed
    as a positional argument to the agent.
    """
    port, env = _resolve_port_and_persist()
    os.environ.update(env)

    cfg_path = Path.cwd() / "config.py"
    from svt_test_agent.test_agent import main as agent_main

    logger.info("Running agent on port %s...", port)
    sys.argv = ["run-testAgent"] + ([str(cfg_path)] if cfg_path.exists() else [])
    _maybe_enable_debug_flag()
    agent_main()


def start() -> None:
    """
    Start the Kafka broker using the development docker-compose file and
    create the required topics once the broker is available.
    """
    port, env = _resolve_port_and_persist()

    if not DOCKER_COMPOSE.exists():
        logger.error("Docker compose file not found: %s", DOCKER_COMPOSE)
        sys.exit(1)

    logger.info("Starting Kafka on port %s using %s...", port, DOCKER_COMPOSE)
    try:
        subprocess.run(
            ["docker", "compose", "-f", str(DOCKER_COMPOSE), "up", "-d"],
            check=True,
            env=env,
        )
    except subprocess.CalledProcessError as exc:
        stderr_text = ""
        if hasattr(exc, "stderr") and exc.stderr:
            try:
                stderr_text = exc.stderr.decode("utf-8", errors="ignore")
            except Exception:
                stderr_text = str(exc.stderr)

        if "Cannot connect to the Docker daemon" in stderr_text:
            logger.error(
                "Docker is not running. Start Docker Desktop or the Docker daemon "
                "and try again."
            )
        else:
            logger.error(
                "Failed to start Kafka via docker compose. Check Docker logs. "
                "Error: %s",
                exc,
            )
        sys.exit(1)
    except FileNotFoundError:
        logger.error("'docker' command not found. Install Docker and retry.")
        sys.exit(1)

    cfg_path = (
        Path.cwd() / "config.py"
        if (Path.cwd() / "config.py").exists()
        else (_default_cfg_path() or Path.cwd() / "config.py")
    )
    logger.info("Using config file %s for topic creation.", cfg_path)
    _wait_and_create_topics(cfg_path)
    logger.info("Broker and topics are ready.")


def stop() -> None:
    """
    Stop the Kafka broker using the development docker-compose file and
    remove any associated volumes.
    """
    if not DOCKER_COMPOSE.exists():
        logger.error("Docker compose file not found: %s", DOCKER_COMPOSE)
        sys.exit(1)

    logger.info("Stopping Kafka...")
    subprocess.run(
        ["docker", "compose", "-f", str(DOCKER_COMPOSE), "down", "-v"],
        check=True,
    )
    logger.info("Kafka stopped.")


def dummydb_start() -> None:
    """
    Start the Dummy DB Agent as a background process. This requires that
    the Kafka broker is already running on the resolved port.
    """
    port, env = _resolve_port_and_persist()

    if not _check_kafka_up("localhost", port):
        logger.error(
            "Kafka does not appear to be running on localhost:%s. "
            "Start the broker first with start-broker, then run DummyDB-Start.",
            port,
        )
        sys.exit(1)

    if DUMMYDB_PID_FILE.exists():
        try:
            existing_pid = int(DUMMYDB_PID_FILE.read_text().strip())
        except ValueError:
            existing_pid = None

        if existing_pid:
            logger.error(
                "Dummy DB agent appears to be already running with PID %s. "
                "Remove %s if this is not the case.",
                existing_pid,
                DUMMYDB_PID_FILE,
            )
            sys.exit(1)

    cmd = [sys.executable, "-m", "svt_test_agent.utilities.dummy_db_Agent.simple_db_agent"]
    logger.info("Starting Dummy DB agent with command: %s", " ".join(cmd))
    proc = subprocess.Popen(cmd, env=env)

    DUMMYDB_PID_FILE.parent.mkdir(parents=True, exist_ok=True)
    DUMMYDB_PID_FILE.write_text(str(proc.pid))
    logger.info("Dummy DB agent started with PID %s.", proc.pid)


def dummydb_stop() -> None:
    """
    Stop the Dummy DB Agent by reading its PID from the PID file and
    sending SIGTERM to the recorded process.
    """
    if not DUMMYDB_PID_FILE.exists():
        logger.warning(
            "Dummy DB agent PID file %s not found. The agent may not be running "
            "or may not have been started via dummydb_start().",
            DUMMYDB_PID_FILE,
        )
        return

    try:
        pid = int(DUMMYDB_PID_FILE.read_text().strip())
    except ValueError:
        logger.warning(
            "PID file %s is corrupt. Removing it.",
            DUMMYDB_PID_FILE,
        )
        DUMMYDB_PID_FILE.unlink(missing_ok=True)
        return

    logger.info("Stopping Dummy DB agent with PID %s...", pid)
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        logger.warning("Process with PID %s not found; it may already be stopped.", pid)
    except PermissionError:
        logger.error(
            "Permission denied when trying to stop process %s. "
            "Terminate it manually or adjust permissions.",
            pid,
        )

    DUMMYDB_PID_FILE.unlink(missing_ok=True)
    logger.info("Dummy DB agent stop requested and PID file removed.")
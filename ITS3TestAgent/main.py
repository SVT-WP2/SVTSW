#!/usr/bin/env python3
"""ITS3 TestAgent entrypoint.

    python3 main.py listen                     # Kafka command agent (UI control)
    python3 main.py run L1W04_S4 --dry-run     # one-shot run

``python3 its3_test_agent.py L1W04_S4`` keeps working exactly as before — the
listener is an extra front-end on the same runner, not a replacement.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from its3_test_agent import run_cli, setup_logging

AGENT_DIR      = Path(__file__).resolve().parent
DEFAULT_CONFIG = "its3_test_agent_config.json"

log = logging.getLogger("its3")


def _resolve(config: str) -> Path:
    path = Path(config).expanduser()
    return path if path.is_absolute() else AGENT_DIR / path


def cmd_listen(args: argparse.Namespace) -> int:
    # Imported lazily so `main.py run` stays usable if the service extras
    # (pydantic) are missing from an older venv.
    from service.listener import ITS3Listener
    from service.run_manager import RunManager

    setup_logging(args.log_file)

    # The broker is read from the config the listener boots with.  A StartRun
    # may name a different config for the run itself, but the Kafka link is
    # fixed for the lifetime of the listener.
    config_path = _resolve(args.config)
    if not config_path.is_file():
        log.error("Config not found: %s", config_path)
        return 2
    cfg = json.loads(config_path.read_text())

    mgr = RunManager(AGENT_DIR, default_config=args.config)
    listener = ITS3Listener(
        mgr,
        bootstrap_servers=cfg.get("kafka_broker", "localhost:9095"),
        ip_family=cfg.get("kafka_ip_family", "v4"),
        group_id=args.group_id,
    )
    listener.run()
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    return run_cli(args.wafer, args.config, args.log_file, args.dry_run)


def main() -> int:
    parser = argparse.ArgumentParser(description="ITS3 TestAgent")
    sub = parser.add_subparsers(dest="command", required=True)

    p_listen = sub.add_parser("listen",
                              help="Run as a Kafka command agent (UI control)")
    p_listen.add_argument("--config", default=DEFAULT_CONFIG,
                          help=f"Config providing the Kafka broker and the "
                               f"default for StartRun (default: {DEFAULT_CONFIG})")
    p_listen.add_argument("--log-file", default=None,
                          help="Also write log output to this file")
    p_listen.add_argument("--group-id", default="its3-test-agent",
                          help="Kafka consumer group id (default: its3-test-agent)")
    p_listen.set_defaults(func=cmd_listen)

    p_run = sub.add_parser("run", help="One-shot run from the command line")
    p_run.add_argument("wafer", help="Wafer name, e.g. L1W04_S4")
    p_run.add_argument("--config", default=DEFAULT_CONFIG,
                       help=f"JSON config file (default: {DEFAULT_CONFIG})")
    p_run.add_argument("--log-file", default=None,
                       help="Also write log output to this file")
    p_run.add_argument("--dry-run", action="store_true",
                       help="Print commands without executing them")
    p_run.set_defaults(func=cmd_run)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

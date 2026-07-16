#!/usr/bin/env python3
"""
ITS3 TestAgent runner.

Reads a simple JSON config + CSV run list, then:
  1. Sources the mosaix .venv and runs Initialization commands once.
  2. Loops over each chip in the CSV (TEST=yes) and runs the Sequence
     commands, substituting {chip_name} automatically.
  3. Between chips, sends WPAgent Kafka commands to move the prober.

Usage:
    python3 its3_test_agent.py L1W04_S4                        # run with wafer name
    python3 its3_test_agent.py L1W04_S4 --dry-run              # print, don't execute
    python3 its3_test_agent.py L1W04_S4 --config my_config.json
    python3 its3_test_agent.py L1W04_S4 --log-file run.log     # also log to file
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import subprocess
import sys
import threading
from pathlib import Path
import time
import uuid

from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer, TopicPartition
from confluent_kafka.admin import AdminClient
from tqdm import tqdm

from run_state import ChipResult, ChipState, RunState, RunStatus

log = logging.getLogger("its3")

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def setup_logging(log_file: str | None = None) -> None:
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    # Use tqdm.write so log lines appear above the progress bar
    class TqdmHandler(logging.StreamHandler):
        def emit(self, record):
            try:
                msg = self.format(record)
                tqdm.write(msg, file=self.stream)
            except Exception:
                self.handleError(record)

    handlers: list[logging.Handler] = [TqdmHandler(sys.stderr)]
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    logging.basicConfig(level=logging.INFO, format=fmt, datefmt=datefmt, handlers=handlers)


def iter_loggable_cmd_output(text: str):
    clean = ANSI_ESCAPE_RE.sub("", text)
    for part in re.split(r"\r+", clean):
        for line in part.splitlines():
            if line.lstrip().startswith("LIVE"):
                continue
            yield line


# ---------------------------------------------------------------------------
# CSV run-list helpers
# ---------------------------------------------------------------------------

def load_run_list(csv_path: str) -> list[dict]:
    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for row in reader:
            rows.append({
                "die":  row["DIE"].strip(),
                "wp":   row["WP[col,row]"].strip(),
                "test": row["TEST"].strip().lower() in ("yes", "1", "true"),
            })
    return rows


def build_chip_name(die: str, wafer: str) -> str:
    return f"{die}_{wafer}"


# ---------------------------------------------------------------------------
# WPAgent Kafka client  (thin wrapper — talks to the running WPAgent listener)
# ---------------------------------------------------------------------------

class WPAgentClient:
    """Sends commands to the WPAgent Kafka listener.

    The WPAgent listener must already be running (``python main.py listen``).
    """

    REQUEST_TOPIC = "svt.wp-agent.request"
    REPLY_TOPIC   = "svt.wp-agent.request.reply"
    HEARTBEAT_TOPIC = "svt.wp-agent.heartbeat"
    HEARTBEAT_TIMEOUT = 6.0  # seconds — same as WPAgent uses
    CORRELATION_HEADER = "kafka_correlationId"
    REPLY_TOPIC_HEADER = "kafka_replyTopic"
    REPLY_PARTITION_HEADER = "kafka_replyPartition"

    def __init__(self, bootstrap_servers: str = "localhost:9095", ip_family: str = "v4",
                 user: str = "user1", agent_name: str = "CERN"):
        self.bootstrap_servers = bootstrap_servers
        self.ip_family = ip_family
        self.user = user
        self.agent_name = agent_name

        # --- verify broker is reachable ---
        log.info("Connecting to Kafka broker %s ...", bootstrap_servers)
        admin = AdminClient({"bootstrap.servers": self.bootstrap_servers, "broker.address.family": self.ip_family})
        try:
            md = admin.list_topics(timeout=5)
            topics = sorted(t for t in md.topics if "svt" in t or "wp-agent" in t)
            log.info("Kafka broker OK  (%d topics, %d SVT-related)", len(md.topics), len(topics))
            for t in topics:
                log.info("  topic: %s", t)
        except Exception as exc:
            raise ConnectionError(
                f"Cannot reach Kafka broker at {bootstrap_servers}: {exc}\n"
                "Make sure Kafka is running or check kafka_broker in the config."
            ) from exc

        self.producer = KafkaProducer({"bootstrap.servers": self.bootstrap_servers, "broker.address.family": self.ip_family})

        self.consumer = KafkaConsumer({
            "bootstrap.servers": self.bootstrap_servers,
            "broker.address.family": self.ip_family,
            "group.id": f"its3-runner-{uuid.uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            "session.timeout.ms": 60 * 1000,
            "max.poll.interval.ms": 1 * 60 * 60 * 1000,  # 1 hour
        })
        # manual assign — no consumer-group rebalance, so the partition is
        # available immediately and we can position deterministically
        reply_tp = TopicPartition(self.REPLY_TOPIC, 0)
        self.consumer.assign([reply_tp])
        # start at the end: only replies produced after we're ready, no history replay
        self.consumer.poll(0.1)  # let the assignment take effect
        _low, high = self.consumer.get_watermark_offsets(reply_tp, timeout=5.0)
        self.consumer.seek(TopicPartition(self.REPLY_TOPIC, 0, high))

        log.info("WPAgent Kafka client ready")

    # ------------------------------------------------------------------
    def send(self, command: str, params: dict | None = None, timeout: float = 30.0) -> dict:
        correlation_id = str(uuid.uuid4())
        # inject user + waferAgentName into every command
        data = {"user": self.user, "waferAgentName": self.agent_name}
        if params:
            data.update(params)
        payload = json.dumps({"type": command, "data": data}).encode()
        headers = [
            (self.CORRELATION_HEADER, correlation_id.encode()),
            (self.REPLY_TOPIC_HEADER, self.REPLY_TOPIC.encode()),
            (self.REPLY_PARTITION_HEADER, b"0"),
        ]
        self.producer.produce(self.REQUEST_TOPIC, value=payload, headers=headers)
        self.producer.flush(timeout=5)
        log.info("  -> WPAgent  %s  %s", command, params or "")
        return self._wait_reply(correlation_id, timeout)

    def _wait_reply(self, correlation_id: str, timeout: float) -> dict:
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = self.consumer.poll(0.5)
            if msg is None or msg.error():
                continue
            hdrs = {k: v for k, v in (msg.headers() or []) if k}
            cid = hdrs.get(self.CORRELATION_HEADER, b"").decode(errors="ignore")
            if cid != correlation_id:
                continue
            reply = json.loads(msg.value())
            status = reply.get("status", "unknown")
            log.info("  <- WPAgent  %s  status=%s", reply.get("type", "?"), status)
            return reply
        log.warning("  <- WPAgent  TIMEOUT after %.0fs", timeout)
        return {"status": "timeout", "output": f"No reply within {timeout}s"}

    # ------------------------------------------------------------------
    # High-level helpers used by the runner
    # ------------------------------------------------------------------

    def user_login(self) -> dict:
        return self.send("UserLogIn")

    def user_logout(self) -> dict:
        return self.send("UserLogOut")

    def open_project(self, project_name: str) -> dict:
        return self.send("OpenProject", {"projectName": project_name})

    def auto_focus(self) -> dict:
        return self.send("AutoFocus", timeout=90.0)

    def reset_agent(self) -> dict:
        return self.send("ResetAgent")

    def run_ptpa(self) -> dict:
        return self.send("RunPTPA", timeout=600.0)
    
    def disable_ptpa(self) -> dict:
        return self.send("SetPTPA", {"enable": False})
    
    def enable_ptpa(self) -> dict:
        return self.send("SetPTPA", {"enable": True})
    
    def set_ptpa(self, enabled: bool, project_name: str) -> dict:
        return self.send("SetPTPA", {"enable": True} if enabled else {"enable": False})

    def init_probing(self) -> dict:
        return self.send("InitProbing", timeout=600.0)
    
    def find_home(self) -> dict:
        return self.send("FindHome", timeout=90.0)

    def move_chuck_wide(self) -> dict:
        return self.send("MoveChuckWide")
    
    def move_chuck_center(self) -> dict:
        return self.send("MoveChuckCenter", timeout=90.0)

    def move_chuck_off_axis(self) -> dict:
        return self.send("MoveChuckOffAxis")

    def move_chuck_contact(self) -> dict:
        return self.send("MoveChuckContact")

    def move_chuck_home(self) -> dict:
        return self.send("MoveChuckHome")
    
    def move_chuck_bottom_left(self) -> dict:
        return self.send("MoveChuckBottomLeft")
    
    def move_chuck_bottom_right(self) -> dict:
        return self.send("MoveChuckBottomRight")
    
    def move_chuck_top_left(self) -> dict:
        return self.send("MoveChuckTopLeft")
    
    def move_chuck_top_right(self) -> dict:
        return self.send("MoveChuckTopRight")

    def go_to_separation(self, timeout: float = 30.0) -> dict:
        return self.send("MoveChuckSeparation", timeout=timeout)
    
    def move_chuck_xy(self, x: int, y: int, position: str = "Relative") -> dict:
        return self.send("MoveChuckXY", {"x": x, "y": y, "position": position})

    def go_to_die(self, col: int, row: int) -> dict:
        return self.send("MoveChuckRowColumn", {"col": col, "row": row})

    def is_listener_alive(self, timeout: float = 2.0) -> tuple[bool, float]:
        """Check if the WPAgent listener is alive via the heartbeat topic.

        Mirrors WPAgent/services/WPListenerHeartbeat.is_listener_alive().
        Returns (is_alive, age_seconds).  age=inf if no heartbeat found.
        """
        hb_consumer = KafkaConsumer({
            "bootstrap.servers": self.bootstrap_servers,
            "broker.address.family": self.ip_family,
            "group.id": f"its3-hb-{uuid.uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        })
        # manual assign at offset -2 (OFFSET_BEGINNING): read the last retained
        # beats (topic retains ~60s) with no consumer-group rebalance delay
        hb_consumer.assign([TopicPartition(self.HEARTBEAT_TOPIC, 0, -2)])

        start = time.time()
        now = time.time()
        last_ts = None

        while time.time() - start < timeout:
            msg = hb_consumer.poll(0.1)
            if msg is None or msg.error():
                continue
            try:
                heartbeat = json.loads(msg.value().decode("utf-8"))
                ts = heartbeat.get("timestamp")
                if ts and (now - ts) < self.HEARTBEAT_TIMEOUT:
                    hb_consumer.close()
                    log.info("WPAgent listener alive  (heartbeat age %.1fs)", now - ts)
                    return True, now - ts
                if ts and (last_ts is None or ts > last_ts):
                    last_ts = ts
            except Exception:
                continue

        hb_consumer.close()
        if last_ts is not None:
            age = now - last_ts
            log.warning("WPAgent listener appears DOWN  (last heartbeat %.1fs ago)", age)
            return False, age
        else:
            log.warning("WPAgent listener: no heartbeat found on topic %s", self.HEARTBEAT_TOPIC)
            return False, float("inf")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

class ITS3Runner:
    def __init__(self, config: dict, config_dir: Path,
                 wafer: str, dry_run: bool = False,
                 status: RunStatus | None = None,
                 cancel: threading.Event | None = None,
                 progress_bar: bool = True):
        self.cfg = config
        self.config_dir = config_dir
        self.dry_run = dry_run

        # Optional service-layer hooks.  When run from the CLI both are None
        # and the runner behaves exactly as before.
        self.status = status
        self.cancel = cancel
        self.progress_bar = progress_bar

        self.mosaix_root = Path(config["mosaix_root"])
        self.build_dir   = config.get("build_dir", "build")
        self.wafer       = wafer

        # resolve run_list path relative to config file location
        rl = config.get("run_list", "run_list.csv")
        rl_path = Path(rl)
        if not rl_path.is_absolute():
            rl_path = config_dir / rl_path
        self.run_list_path = rl_path

        # substitution values available in every command template
        self.template_vars = {
            "setup_config":  config.get("setup_config", ""),
            "power_profile": config.get("power_profile", ""),
            "output":        config.get("output", ""),
            "wafer":         self.wafer,
            "build_dir":     self.build_dir,
        }

        # environment captured from `source setup.sh load` (populated once)
        self._env: dict[str, str] | None = None

        # WPAgent Kafka client (lazy init)
        self._wp: WPAgentClient | None = None

        # track which project type is currently loaded ("BAM" or "SEG")
        self._current_project_type: str | None = None

    # ------------------------------------------------------------------
    # Status / cancellation hooks (no-ops when run from the CLI)
    # ------------------------------------------------------------------

    def _cancelled(self) -> bool:
        return self.cancel is not None and self.cancel.is_set()

    def _set_state(self, state: RunState, error: str | None = None) -> None:
        if self.status is not None:
            self.status.set_state(state, error)

    def _start_chip(self, chip_name: str) -> None:
        if self.status is not None:
            self.status.start_chip(chip_name)

    def _finish_chip(self, chip_name: str, state: ChipState,
                     error: str | None = None) -> None:
        if self.status is not None:
            self.status.finish_chip(chip_name, state, error)

    def _terminate_on_cancel(self, proc: subprocess.Popen) -> None:
        """Watchdog: kill the running command as soon as a stop is requested.

        Without this a stop would only take effect between chips, which can be
        many minutes for a full sequence.
        """
        while proc.poll() is None:
            if self.cancel.wait(0.5):
                log.warning("Stop requested — terminating running command ...")
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    log.warning("Command did not exit in 10s — killing it")
                    proc.kill()
                return

    # ------------------------------------------------------------------

    def _wp_agent(self) -> WPAgentClient:
        if self._wp is not None:
            return self._wp
        broker = self.cfg.get("kafka_broker", "localhost:9095")
        ip_family = self.cfg.get("kafka_ip_family", "v4")
        user = self.cfg.get("wp_user", "user1")
        agent_name = self.cfg.get("wp_agent_name", "CERN")
        self._wp = WPAgentClient(
            bootstrap_servers=broker, ip_family=ip_family,
            user=user, agent_name=agent_name,
        )
        return self._wp

    # ------------------------------------------------------------------

    def _wp_initialize(self) -> bool:
        """Establish Kafka link and run the full WPAgent init sequence:
        UserLogIn -> OpenProject -> InitProbing
        """
        wp = self._wp_agent()          # connects + checks broker (always, even dry-run)

        # --- heartbeat check ---
        alive, age = wp.is_listener_alive(timeout=2.0)
        if not alive:
            if age == float("inf"):
                log.error("No WPAgent listener detected! Is 'python main.py listen' running?")
            else:
                log.error("WPAgent listener appears down (last heartbeat %.1fs ago)", age)
            return False

        # --- 1. UserLogIn (safe, always runs) ---
        resp = wp.user_login()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("UserLogIn failed: %s", resp)
            return False

        resp=wp.reset_agent()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("ResetAgent failed: %s", resp)
            return False

        resp = wp.user_login()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("UserLogIn failed: %s", resp)
            return False
        
        if self.dry_run:
            return True
        
        if self.cfg.get("thinned_layer", False):
            log.info("Thinned layer mode enabled, skipping BAM project, no init probing, and starting in SEG project if configured...")
            project = self.cfg.get("wp_project_seg", "")
            if project:
                resp = wp.open_project(project)
                if resp.get("status", "").lower() not in ("success", "ok"):
                    log.error("OpenProject failed: %s", resp)
                    return False
                self._current_project_type = "SEG"
                resp=wp.move_chuck_off_axis()
                if resp.get("status", "").lower() not in ("success", "ok"):
                    log.error("MoveChuckOffAxis failed: %s", resp)
                    return False
                return True
            else:
                log.info("wp_project_seg not set — skipping OpenProject")
                return True

        # --- 2. OpenProject (start with BAM project, BAMs come first) ---
        project = self.cfg.get("wp_project_bam", "")
        if project:
            resp = wp.open_project(project)
            if resp.get("status", "").lower() not in ("success", "ok"):
                log.error("OpenProject failed: %s", resp)
                return False
            self._current_project_type = "BAM"
        else:
            log.info("wp_project_bam not set — skipping OpenProject")

        # --- 3. InitProbing ---
        resp = wp.init_probing()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("InitProbing failed: %s", resp)
            return False

        return True

    # ------------------------------------------------------------------

    def _source_setup(self) -> dict[str, str]:
        if self._env is not None:
            return self._env

        setup_script = self.mosaix_root / "setup.sh"
        log.info("Sourcing %s load ...", setup_script)


        t0 = time.time()
        result = subprocess.run(
            f"source {setup_script} load && env -0",
            shell=True, executable="/bin/bash",
            cwd=str(self.mosaix_root),
            capture_output=True,
        )
        log.info("setup.sh finished in %.1fs (exit %d)", time.time() - t0, result.returncode)
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(f"source setup.sh failed (exit {result.returncode}):\n{stderr}")

        env: dict[str, str] = {}
        for chunk in result.stdout.split(b"\0"):
            if not chunk or b"=" not in chunk:
                continue
            key, val = chunk.split(b"=", 1)
            env[key.decode("utf-8", errors="replace")] = val.decode("utf-8", errors="replace")

        self._env = env
        log.info("Environment captured")
        return self._env

    # ------------------------------------------------------------------

    def _run_cmd(self, cmd: str, label: str = "") -> int:
        if label:
            log.info("[%s]  $ %s", label, cmd)
        else:
            log.info("  $ %s", cmd)

        show_output = self.cfg.get("show_cmd_output", True)
        log_output = self.cfg.get("log_cmd_output", True)

        # write cmd output to log file only (skip terminal handler to avoid duplicates)
        file_handlers = [h for h in logging.root.handlers
                         if isinstance(h, logging.FileHandler)]

        env = self._source_setup()
        proc = subprocess.Popen(
            cmd, shell=True, executable="/bin/bash",
            cwd=str(self.mosaix_root), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        if self.cancel is not None:
            threading.Thread(target=self._terminate_on_cancel, args=(proc,),
                             daemon=True).start()
        for line in proc.stdout:
            text = line.decode("utf-8", errors="replace").rstrip("\n")
            if show_output:
                tqdm.write(text, file=sys.stderr)
            if log_output:
                for clean_line in iter_loggable_cmd_output(text):
                    for fh in file_handlers:
                        fh.stream.write(clean_line + "\n")
                        fh.stream.flush()
        proc.wait()
        if proc.returncode != 0:
            log.error("Command exited with code %d", proc.returncode)
        return proc.returncode

    # ------------------------------------------------------------------

    def _wp_move_to_die(self, wp_coord: str, chip_type: str) -> bool:
        """Full per-chip sequence:
        MoveChuckSeparation -> MoveChuckOffAxis -> MoveChuckRowColumn ->
        RunPTPA (optional) -> MoveChuckWide -> MoveChuckContact
        """
        try:
            coords = json.loads(wp_coord)
            col, row = int(coords[0]), int(coords[1])
        except Exception:
            log.error("Cannot parse WP coordinate: %s", wp_coord)
            return False

        if self.dry_run:
            log.info("  -> WPAgent  MoveChuckSeparation (DUMMY)")
            return True

        wp = self._wp_agent()

        resp = wp.go_to_separation()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckSeparation: %s", resp.get("output", resp))

        resp = wp.move_chuck_off_axis()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckOffAxis: %s", resp.get("output", resp))

        resp = wp.go_to_die(col, row)
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("MoveChuckRowColumn failed: %s", resp.get("output", resp))
            return False

        ptpa_key = f"run_ptpa_{chip_type.lower()}"
        if self.cfg.get(ptpa_key, False):
            if self.cfg.get("re_enable_ptpa", False):
                resp = wp.disable_ptpa()
                if resp.get("status", "").lower() not in ("success", "ok"):
                    log.warning("DisablePTPA failed: %s", resp)
                resp = wp.enable_ptpa()
                if resp.get("status", "").lower() not in ("success", "ok"):
                    log.warning("EnablePTPA failed: %s", resp)
            resp = wp.run_ptpa()
            if resp.get("status", "").lower() not in ("success", "ok"):
                log.error("RunPTPA failed: %s", resp.get("output", resp))
                if self.cfg.get("reset_on_ptpa_failure", False):
                    log.warning("RunPTPA failed, issuing ResetAgent and continuing with next chip...")
                    resp=wp.reset_agent()
                    resp=wp.user_login()  # need to log in again after reset
                    if resp.get("status", "").lower() not in ("success", "ok"):
                        log.error("UserLogIn failed: %s", resp)
                        return False
                return False

        resp = wp.move_chuck_wide()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckWide: %s", resp.get("output", resp))

        # resp = wp.move_chuck_xy(x=15,y=15, position="Relative")
        # if resp.get("status", "").lower() not in ("success", "ok"):
        #     log.warning("MoveChuckXY to contact position failed: %s", resp.get("output", resp))

        resp = wp.move_chuck_bottom_left()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckBottomLeft failed: %s", resp.get("output", resp))

        resp = wp.move_chuck_contact()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("MoveChuckContact failed: %s", resp.get("output", resp))
            return False

        return True
    
    def _change_wp_project(self, chip_type: str, new_project: str) -> bool:
        log.info("Preparing to switch WP project: %s -> %s (%s)",
                             self._current_project_type, chip_type, new_project)
        wp = self._wp_agent()
        resp = wp.go_to_separation()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckSeparation: %s", resp.get("output", resp))
        resp = wp.move_chuck_off_axis()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckOffAxis: %s", resp.get("output", resp))
        log.info("Switching WP project: %s -> %s (%s)",
                    self._current_project_type, chip_type, new_project)
        resp = wp.open_project(new_project)
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.error("OpenProject failed for %s: %s", chip_type, resp)
            return False
        resp = wp.move_chuck_center()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("MoveChuckCenter failed: %s", resp.get("output", resp))
        resp = wp.auto_focus()
        if resp.get("status", "").lower() not in ("success", "ok"):
            log.warning("AutoFocus failed: %s", resp.get("output", resp))
        resp = wp.find_home()
        if resp.get("status", "").lower() not in ("success", "ok"):
           log.error("FindHome failed after switching to %s project: %s", chip_type, resp)
           return False
        return True
        
    def _remove_daq_status_file(self) -> None:
        daq_status_path = self.cfg.get("daq_status_file", "")
        if daq_status_path:
            daq_status_path_obj = self.mosaix_root / daq_status_path
            try:
                os.remove(daq_status_path_obj)
                log.info("Removed DAQ status file: %s", daq_status_path_obj)
            except FileNotFoundError:
                log.info("DAQ status file not found (already removed?): %s", daq_status_path_obj)
                pass
            except Exception as exc:
                log.warning("Failed to remove DAQ status file %s: %s", daq_status_path_obj, exc)


    # ------------------------------------------------------------------

    def run_initialization(self) -> bool:
        log.info("=" * 60)
        log.info("INITIALIZATION")
        log.info("=" * 60)

        # 1. Establish Kafka + WPAgent
        log.info("--- WPAgent connection ---")
        if not self._wp_initialize():
            return False

        # 2. Run mosaix init commands (set_daq etc.)
        log.info("--- Mosaix setup commands ---")
        for cmd_template in self.cfg.get("Initialization", []):
            cmd = cmd_template.format(**self.template_vars)
            rc = self._run_cmd(cmd, label="init")
            if rc != 0:
                log.error("Initialization failed (exit %d), aborting.", rc)
                return False
        return True
    
    def run_set_daq(self) -> bool:
        for cmd_template in self.cfg.get("Initialization", []):
            if "set_daq" not in cmd_template.lower():
                continue
            cmd = cmd_template.format(**self.template_vars)
            rc = self._run_cmd(cmd, label="set_daq")
            if rc != 0:
                log.error("SetDAQ command failed (exit %d), aborting.", rc)
                return False
        return True

    # ------------------------------------------------------------------

    def run_sequence(self) -> None:
        chips = load_run_list(str(self.run_list_path))
        seq_templates = self.cfg.get("Sequence", [])

        total = sum(1 for c in chips if c["test"])
        done = 0

        log.info("=" * 60)
        log.info("SEQUENCE  (%d chips to test, wafer=%s)", total, self.wafer)
        log.info("=" * 60)

        # build list of chips to test (for progress bar)
        test_chips = [c for c in chips if c["test"]]
        skip_chips = [c for c in chips if not c["test"]]
        for chip in skip_chips:
            log.info("SKIP %s  (TEST=no)", build_chip_name(chip["die"], self.wafer))

        # register the full run list (tested + skipped) in the status snapshot
        if self.status is not None:
            self.status.set_chips([
                ChipResult(
                    die=chip["die"],
                    chip_name=build_chip_name(chip["die"], self.wafer),
                    wp=chip["wp"],
                    state=ChipState.PENDING if chip["test"] else ChipState.SKIP,
                )
                for chip in chips
            ])

        pbar = tqdm(test_chips, desc="Chips", unit="chip",
                    bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
                    file=sys.stderr, disable=not self.progress_bar)

        for chip in pbar:
            # time.sleep(0.5)  # small delay to make sure logs appear in order with progress bar
            if self._cancelled():
                log.warning("Stop requested — aborting the chip loop")
                break

            chip_name = build_chip_name(chip["die"], self.wafer)
            pbar.set_postfix_str(chip_name)
            done += 1
            self._start_chip(chip_name)

            log.info("-" * 60)
            log.info("CHIP %d/%d: %s   WP=%s", done, total, chip_name, chip["wp"])
            log.info("-" * 60)

            # --- switch WP project if chip type changed (BAM <-> SEG) ---
            chip_type = "SEG" if chip["die"].startswith("SEG") else "BAM"
            if chip_type != self._current_project_type:
                project_key = f"wp_project_{chip_type.lower()}"
                new_project = self.cfg.get(project_key, "")
                if new_project and not self.dry_run:
                    if not self._change_wp_project(chip_type, new_project):
                        log.error("Failed to switch to %s project, retrying...", chip_type)
                        time.sleep(0.5)  # small delay before retrying
                        resp=self._wp_initialize()
                        if not resp:
                            log.error("WPAgent re-initialization failed after project switch failure, skipping chip")
                            self._finish_chip(chip_name, ChipState.FAIL,
                                              "WPAgent re-initialization failed after project switch failure")
                            continue
                        resp = self._change_wp_project(chip_type, new_project)
                        if not resp:
                            log.error("Failed to switch to %s project on retry, skipping chip", chip_type)
                            self._finish_chip(chip_name, ChipState.FAIL,
                                              f"Failed to switch to {chip_type} project")
                            continue
                self._current_project_type = chip_type

            # --- move prober to die ---
            chip_type = "SEG" if chip["die"].startswith("SEG") else "BAM"
            if not self._wp_move_to_die(chip["wp"], chip_type):
                log.error("Failed to move to die %s, skipping chip", chip_name)
                self._finish_chip(chip_name, ChipState.FAIL, "Failed to move to die")
                continue

            log.info("Running set_daq before test sequence commands...")
            if not self.run_set_daq():  # ensure DAQ is set for each chip (in case it gets reset midnight)
                log.error("Failed to set DAQ for %s, skipping chip", chip_name)
                self._finish_chip(chip_name, ChipState.FAIL, "set_daq failed")
                continue

            # --- run sequence commands ---
            failed_steps = 0
            tvars = {**self.template_vars, "chip_name": chip_name, "die": chip["die"]}
            for cmd_template in seq_templates:
                if self._cancelled():
                    log.warning("Stop requested — skipping remaining steps for %s", chip_name)
                    break
                if self.cfg.get("remove_daq_status_file", False):
                    self._remove_daq_status_file()
                cmd = cmd_template.format(**tvars)
                rc = self._run_cmd(cmd, label=chip_name)
                if rc != 0:
                    # log.error("Sequence step failed for %s, skipping remaining steps", chip_name)
                    # break
                    failed_steps += 1
                    log.error("Sequence step failed for %s, continuing anyway...", chip_name)

            if self._cancelled():
                self._finish_chip(chip_name, ChipState.FAIL,
                                  "Run stopped before this chip completed")
            elif failed_steps:
                self._finish_chip(chip_name, ChipState.FAIL,
                                  f"{failed_steps} sequence step(s) failed")
            else:
                self._finish_chip(chip_name, ChipState.PASS)

        pbar.close()
        log.info("Done. %d/%d chips processed.", done, total)

    # ------------------------------------------------------------------

    def run(self) -> int:
        self._set_state(RunState.INITIALIZING)
        if not self.run_initialization():
            self._set_state(RunState.FAILED, "Initialization failed")
            return 1
        try:
            self._set_state(RunState.RUNNING)
            self.run_sequence()
        finally:
            if self._cancelled():
                self._set_state(RunState.STOPPING)
            log.info("=" * 60)
            log.info("CLEANUP")
            log.info("=" * 60)
            wp = self._wp_agent()

            # --- park the prober ---
            resp = wp.go_to_separation(timeout=600.0)
            if resp.get("status", "").lower() not in ("success", "ok"):
                log.warning("MoveChuckSeparation: %s", resp)
            resp = wp.move_chuck_off_axis()
            if resp.get("status", "").lower() not in ("success", "ok"):
                log.warning("MoveChuckOffAxis: %s", resp)
            resp = wp.move_chuck_home()
            if resp.get("status", "").lower() not in ("success", "ok"):
                log.warning("MoveChuckHome: %s", resp)

            # --- logout last ---
            resp = wp.user_logout()
            status = resp.get("status", "").lower()
            if status in ("success", "ok"):
                log.info("UserLogOut OK")
            else:
                log.warning("UserLogOut: %s", resp)
        self._set_state(RunState.DONE)
        return 0

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def run_cli(wafer: str, config: str = "its3_test_agent_config.json",
            log_file: str | None = None, dry_run: bool = False) -> int:
    """One-shot run.  Shared by this script's CLI and ``main.py run``."""
    setup_logging(log_file)

    config_path = Path(config).expanduser().resolve()
    if not config_path.exists():
        log.error("Config not found: %s", config_path)
        return 2

    with open(config_path) as f:
        cfg = json.load(f)

    runner = ITS3Runner(cfg, config_dir=config_path.parent,
                        wafer=wafer, dry_run=dry_run)
    return runner.run()


def main() -> int:
    parser = argparse.ArgumentParser(description="ITS3 TestInterface runner")
    parser.add_argument("wafer", help="Wafer name, e.g. L1W04_S4")
    parser.add_argument("--config", default="its3_test_agent_config.json",
                        help="JSON config file (default: its3_test_agent_config.json)")
    parser.add_argument("--log-file", default=None,
                        help="Also write log output to this file")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print commands without executing them")
    args = parser.parse_args()

    return run_cli(args.wafer, args.config, args.log_file, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())

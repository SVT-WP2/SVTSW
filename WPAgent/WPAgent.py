"""
Wafer Prober Agent - one agent per WP machine

When starting with: python main.py --config=configs/ProbeConfigCERN.json listen
(or, in a container, with the env vars SVT_WP_AGENT_MACHINE_NAME + SVT_WP_AGENT_KAFKA_BROKER):
- Reads the machine name and the Kafka broker
- Gets the machine (address, port, type, id) from its record in the DB; stops when it cannot
- Starts the listener and the connection watch, which only reports whether the machine is on.
  The agent connects to the machine when it gets the Initialize command, never by itself.
- Runs only the requests whose waferAgentName names this machine
"""

from WPKafkaClient import KafkaClient
from services.WPHeartbeat import ListenerHealthCheck, read_local_health
import json
import os
import sys
import time
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder

# Kafka broker that identifies the DEV environment.
# Any config using this broker gets "_DEV" appended to its agent name,
# so listeners and senders automatically resolve e.g. "WPMIT_DEV".
_DEV_BROKER = "pcmitpx01:9096"


def _effective_agent_name(config: dict) -> str:
    """
    Return the agent name that this config should advertise / respond to.
    Appends '_DEV' when the config's kafka_broker is the DEV broker.
    """
    name = config.get("name", "")
    if config.get("kafka_broker", "") == _DEV_BROKER:
        return f"{name}_DEV"
    return name


# Set by compose for the service of one WP machine (Environment/<Env>/docker-compose-svtsw-<env>.yml)
ENV_MACHINE_NAME = "SVT_WP_AGENT_MACHINE_NAME"
ENV_KAFKA_BROKER = "SVT_WP_AGENT_KAFKA_BROKER"

# The DB agent can start after this agent: wait for its answer
DB_LOOKUP_WAIT = 60.0
DB_LOOKUP_RETRY = 5.0


class WaferProberAgent:
    def __init__(self, config=None):
        self.config = config  # Path to config file, set via --config=
        self.kafka = None  # Initialize later with config
        self.health_check = None  # Initialize later with config
        self.wp_agent_name = None

    def send(
            self,
            command,
            data=None,
            repeat=1,
            delay=0,
            check_health=True,
            wait_for_reply=True,
            timeout=30.0,
    ):
        """
        Send a command via Kafka and wait for response.
        """
        if isinstance(data, str):
            raw = data.strip("'")
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                # Windows CMD strips double quotes from args, leaving unquoted keys.
                # YAML is a superset of JSON and handles unquoted keys/values.
                import yaml
                data = yaml.safe_load(raw)
        if not data or "waferAgentName" not in data:
            return ResponseBuilder.error(f"{command}Reply", "'waferAgentName' is required in data", 400)
        wafer_agent_name = data["waferAgentName"]
        # sender side: scan all ProbeConfig files and match by 'name' field,
        # so ProbeConfigLocalMOCK.json with name="MOCK" is found correctly.
        config = self._find_config_by_agent_name(wafer_agent_name)
        kafka_broker = config.get("kafka_broker")

        # Ensure Kafka is initialized
        if self.kafka is None:
            self.kafka = KafkaClient(bootstrap_servers=kafka_broker)

        # Check listener health before sending
        if check_health and self.health_check:
            is_alive, age = self.health_check.is_listener_alive(timeout=2.0)

            if not is_alive:
                if age == float("inf"):
                    print("⚠️  WARNING: No listener detected!")
                    print("   The listener is not running or not sending heartbeats.")
                else:
                    print("⚠️  WARNING: Listener appears to be down!")
                    print(
                        f"   Last heartbeat was {age:.1f}s ago (timeout: {self.health_check.HEARTBEAT_TIMEOUT}s)"
                    )

                print(f"\n❌ The command '{command}' may not execute.")
                print("   Options:")
                print("   1. Start the listener: python main.py listen <CONFIG_NAME>")
                print("   2. Send anyway (may timeout): Continue")
                print("   3. Cancel: Ctrl+C")

                response = input("\n   Continue sending? (yes/no): ").strip().lower()

                if response not in ["yes", "y"]:
                    print("❌ Command cancelled")
                    return {
                        "status": "Error",
                        "output": "Command cancelled by user",
                    }

                print("📤 Sending command anyway...")

        # Send command
        response = self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=wait_for_reply,
            timeout=timeout,
        )
        return response

    def send_async(self, command, data=None, repeat=1, delay=0):
        """Send command without waiting for reply"""
        # Ensure Kafka is initialized
        if self.kafka is None:
            self.kafka = KafkaClient()

        print(f"📤 Sending '{command}' (async - no reply expected)")
        return self.kafka.send(
            command=command, data=data, repeat=repeat, delay=delay, wait_for_reply=False
        )

    def _load_probe_config(self, config_path):
        """
        Load probe station config directly from a JSON file.

        Args:
            config_path: Path to config file (e.g., "configs/ProbeConfigCERN.json")

        Returns:
            dict: Config with name, machineId, address, port, machineType, kafka_broker
        """
        if not os.path.exists(config_path):
            raise FileNotFoundError(
                f"Config file not found: {config_path}"
            )

        with open(config_path, "r") as f:
            config = json.load(f)

        return config

    def _find_config_by_agent_name(self, agent_name):
        """
        Scan all configs/ProbeConfig*.json files and return the one
        whose 'name' field matches agent_name (waferAgentName).
        If multiple match, the last one found wins (Local* variants override generic ones).
        Raises FileNotFoundError if none match.
        """
        import glob
        matches = []
        # Sort so generic ProbeConfig{Name}.json comes first,
        # longer/more specific names (e.g. ProbeConfigLocal*) come last and win.
        for path in sorted(glob.glob("configs/ProbeConfig*.json"), key=len):
            try:
                with open(path, "r") as f:
                    cfg = json.load(f)
                if _effective_agent_name(cfg).upper() == agent_name.upper():
                    matches.append((path, cfg))
            except Exception:
                continue

        if not matches:
            raise FileNotFoundError(
                f"No config file found with name='{agent_name}' in configs/ProbeConfig*.json"
            )

        if len(matches) > 1:
            paths = [p for p, _ in matches]
            print(f"⚠️  Multiple configs found for '{agent_name}': {paths} — using {paths[-1]}")

        return matches[-1][1]

    def _load_start_config(self):
        """The machine name and Kafka broker: the --config file, else the env vars from compose."""
        if self.config:
            return self._load_probe_config(self.config)

        name = os.environ.get(ENV_MACHINE_NAME, "").strip()
        broker = os.environ.get(ENV_KAFKA_BROKER, "").strip()
        if not name or not broker:
            raise KeyError(f"Give --config=<file>, or set both {ENV_MACHINE_NAME} and {ENV_KAFKA_BROKER}.")
        return {"name": name, "kafka_broker": broker}

    @staticmethod
    def _is_mock_config(file_config):
        """A mock config ("machineType": "mock") has no record in the DB."""
        return str(file_config.get("machineType", "")).lower() == "mock"

    def _load_probe_config_with_db(self, file_config):
        """
        Complete the start config (name + kafka_broker) with the machine from the DB.

        A mock config ("machineType": "mock") keeps its own values and needs no DB.
        Raises when the DB agent does not answer or has no machine with this name:
        a wrong config must stop the agent, not connect it to a wrong address.

        Returns:
            dict: Config with name, machineId, address, port, machineType, kafka_broker
        """
        config_name = file_config.get("name")
        kafka_broker = file_config.get("kafka_broker")
        if not config_name or not kafka_broker:
            raise KeyError("The config needs both 'name' and 'kafka_broker'.")

        print(f"🔍 Loading configuration for '{config_name}' (Kafka broker {kafka_broker})...")

        if self._is_mock_config(file_config):
            print("   ✅ Mock prober: values from the config file, no DB lookup")
            return file_config

        db_config = self._find_machine_in_db(config_name, kafka_broker)
        print("   ✅ Loaded machine info from database")
        db_config["kafka_broker"] = kafka_broker
        db_config["name"] = config_name
        return db_config

    def _find_machine_in_db(self, agent_name, kafka_broker, wait=DB_LOOKUP_WAIT):
        """
        Get the WaferProbeMachine named agent_name from the DB agent, as config values
        (the host and the port exactly as they are in the record).
        Retries for `wait` seconds while the DB agent gives no machines.
        """
        from services.WPDbKafkaClient import DBKafkaClient
        from services.WPMachineRecord import find_record, machine_config

        if DBKafkaClient._instance is None:
            DBKafkaClient.get_instance(bootstrap_servers=kafka_broker)

        deadline = time.monotonic() + wait
        while True:
            machines = DBKafkaClient.get_instance().get_all_wafer_probe_machines(timeout=5.0)
            if machines:
                break
            if time.monotonic() >= deadline:
                raise TimeoutError(
                    f"The DB agent gave no wafer probe machines within {wait:.0f} s "
                    "(no answer, or the list is empty)."
                )
            print(f"   ⏳ No answer from the DB agent yet, next try in {DB_LOOKUP_RETRY:.0f} s...")
            time.sleep(DB_LOOKUP_RETRY)

        machine_data = find_record(machines, agent_name)
        if not machine_data:
            known = ", ".join(sorted(str(m.get("name")) for m in machines))
            raise LookupError(f"The DB has no WaferProbeMachine named '{agent_name}'. Known: {known}.")

        return machine_config(machine_data)

    def listen(self):
        """
        Start the listener of one WP machine. The start does not touch the machine: the
        connection watch only reports whether it is on, and the agent connects to it when
        it gets the Initialize command.
        Usage: python main.py --config=configs/ProbeConfigCERN_DEV.json listen
               (or set SVT_WP_AGENT_MACHINE_NAME and SVT_WP_AGENT_KAFKA_BROKER, then: python main.py listen)
        """
        from services.WPMachineRecord import full_address
        from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

        sep = '=' * 70
        print(f"\n{sep}")
        print(f"  Starting WP Agent: {self.config or f'{ENV_MACHINE_NAME} / {ENV_KAFKA_BROKER}'}")
        print(f"{sep}\n")

        try:
            start_config = self._load_start_config()
            config = self._load_probe_config_with_db(start_config)
            agent_name = _effective_agent_name(config)
            self.wp_agent_name = agent_name
            address = full_address(config)
            kafka_broker = config["kafka_broker"]

            print(f"\n📋 Loaded config for '{agent_name}':")
            print(f"   Machine ID: {config.get('machineId')}")
            print(f"   Address: {address}")
            print(f"   Type: {config.get('machineType', 'sentio')}")
            if "description" in config:
                print(f"   Description: {config['description']}")
            print(f"   Kafka Broker: {kafka_broker}\n")

            g = SvtWPAagentGlobalParameters.getInstance()
            g.wpAgentName = agent_name
            # The machine of the connection watch and of the Initialize command. Its DB record
            # is read again while the machine is off and before every connect.
            g.set_address(address)
            g.set_machine_type(config.get("machineType", "sentio"))
            g.set_machine_id(config.get("machineId", 0))
            g.machine_record_name = None if self._is_mock_config(start_config) else config["name"]
            # Every reply reports the state of the state machine, also before the first command
            g.wpag_state = agentStateMachine.get_state_name()

            self.health_check = ListenerHealthCheck(bootstrap_servers=kafka_broker, agent_name=agent_name)
            self.kafka = KafkaClient(bootstrap_servers=kafka_broker, agent_name=agent_name)

            from services.WPDbKafkaClient import DBKafkaClient
            if DBKafkaClient._instance:
                try:
                    DBKafkaClient._instance.close()
                except Exception:
                    pass
                DBKafkaClient._instance = None
            DBKafkaClient.get_instance(bootstrap_servers=kafka_broker)

        except (FileNotFoundError, KeyError, LookupError, TimeoutError, ValueError) as e:
            print(f"❌ Error loading config: {e}")
            print("\n💡 Usage: python main.py --config=configs/ProbeConfigCERN_DEV.json listen,")
            print(f"   or set {ENV_MACHINE_NAME} and {ENV_KAFKA_BROKER}, then: python main.py listen")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

        # Start the Kafka listener and the connection watch. No connection to the machine yet:
        # that is the Initialize command.
        print(f"{'=' * 70}")
        print(f"  Starting Kafka Listener for {agent_name}")
        print(f"{'=' * 70}\n")
        self.kafka.listen()

    def check_local_health(self, max_age=ListenerHealthCheck.HEARTBEAT_TIMEOUT):
        """
        Docker HEALTHCHECK: exit 1 when the listener in this container had no heartbeat
        confirmed by Kafka in the last max_age seconds. A WP machine that is off is a
        normal case: its connection status is printed, it does not make the check fail.
        """
        heartbeat = read_local_health() or {}
        # confirmedAt: when Kafka's confirmation of the heartbeat reached the listener
        confirmed_at = heartbeat.get("confirmedAt") or heartbeat.get("timestamp")
        age = time.time() - confirmed_at if confirmed_at else None
        if age is None or age > max_age:
            print(
                "❌ Listener is DOWN ("
                + ("no heartbeat" if age is None else f"last confirmed heartbeat {age:.1f}s ago")
                + ")"
            )
            sys.exit(1)

        connection = {True: "connected", False: "NOT connected"}.get(heartbeat.get("proberConnected"), "not checked yet")
        initialized = "initialized" if heartbeat.get("proberInitialized") else "not initialized"
        print(
            f"✅ Listener of {heartbeat.get('waferAgentName')} is alive (heartbeat confirmed {age:.1f}s ago); "
            f"WP machine {connection}, {initialized}"
        )
        sys.exit(0)

    def check_listener_health(self):
        """Check over Kafka that the listener of the machine of --config (or the env vars) is alive"""
        if self.health_check is None:
            try:
                config = self._load_start_config()
            except (FileNotFoundError, KeyError) as e:
                print(f"❌ {e}")
                return False
            self.health_check = ListenerHealthCheck(
                bootstrap_servers=config.get("kafka_broker"), agent_name=_effective_agent_name(config)
            )

        print("🔍 Checking listener health...")
        is_alive, age = self.health_check.is_listener_alive(timeout=2.0)

        if is_alive:
            print(f"✅ Listener is ALIVE (heartbeat age: {age:.1f}s)")
            print(f"   Heartbeat topic: {self.health_check.HEARTBEAT_TOPIC}")
        else:
            if age == float("inf"):
                print("❌ Listener is DOWN (no heartbeat found)")
            else:
                print(f"❌ Listener is DOWN (last heartbeat: {age:.1f}s ago)")
            print("\n💡 To start the listener, run:")
            print("   python main.py listen <CONFIG_NAME>")

        return is_alive

    def wait_for_listener(self, max_wait=30.0):
        """Wait until listener comes online"""
        if self.health_check is None:
            self.health_check = ListenerHealthCheck()
        return self.health_check.wait_for_listener(max_wait=max_wait)

    def send_force(self, command, data=None, repeat=1, delay=0, timeout=30.0):
        """Force send a command without checking listener health"""
        if self.kafka is None:
            self.kafka = KafkaClient()

        print(f"WARNING: Sending '{command}' WITHOUT health check (forced)")
        return self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=True,
            timeout=timeout,
        )

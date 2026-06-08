"""
Wafer Prober Agent - With Auto-Initialization on Listen

When starting with: python main.py listen configs/ProbeConfigCERN.json
- Loads config directly from the specified JSON file
- Auto-initializes prober connection
- Sets all global parameters
- Ready to receive commands immediately
"""

from WPKafkaClient import KafkaClient
from services.WPHeartbeat import ListenerHealthCheck
import json
import os
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from utilities.WPResponseBuilder import ResponseBuilder


class WaferProberAgent:
    def __init__(self):
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
        if not data or "waferAgentName" not in data:
            return ResponseBuilder.error(f"{command}Reply", "'waferAgentName' is required in data", 400)
        wafer_agent_name = data["waferAgentName"]
        config_path = f"configs/ProbeConfig{wafer_agent_name}.json"
        # sender side: file config only — no DB query needed, avoids consumer group conflict
        config = self._load_probe_config(config_path)
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

        if "name" not in config:
            raise KeyError(
                f"Config file '{config_path}' is missing required 'name' field."
            )

        return config

    def _load_probe_config_with_db(self, config_path, kafka_broker=None):
        """
        Load probe station config from file, then enrich with DB data if available.

        Args:
            config_path: Path to config JSON file (e.g., "configs/ProbeConfigCERN.json")
            kafka_broker: Override kafka_broker (optional)

        Returns:
            dict: Config with name, machineId, address, port, machineType, kafka_broker
        """
        file_config = self._load_probe_config(config_path)
        config_name = file_config["name"]

        print(f"🔍 Loading configuration for '{config_name}' from {config_path}...")

        # Get kafka_broker from file config
        if file_config.get("kafka_broker"):
            kafka_broker = file_config["kafka_broker"]
            print(f"   ✅ Using kafka_broker from config file: {kafka_broker}")

        # Try to enrich with DB data — match by machineId, not location name
        machine_id = file_config.get("machineId")
        db_config = self._load_from_database(
            machine_id, kafka_broker=kafka_broker, timeout=5.0
        )

        if db_config:
            print("   ✅ Loaded machine info from database")
            if kafka_broker:
                db_config["kafka_broker"] = kafka_broker
            db_config["name"] = config_name
            return db_config

        print("   ✅ Loaded from config file")
        return file_config

    def _load_from_database(self, machine_id, kafka_broker=None, timeout=5.0):
        """
        Enrich config with DB data using machineId from the config file.
        Matches by ID — not by location name — so there's no ambiguity
        when multiple machines share the same generalLocation.

        NOTE: kafka_broker is NOT included in the result — always comes from config file.

        Returns:
            Config dict or None if not found/error
        """
        if not machine_id or machine_id == 0:
            return None

        try:
            from actions.WPDataBaseActions import _find_machine_by_id
            from services.WPDbKafkaClient import DBKafkaClient

            if kafka_broker and DBKafkaClient._instance is None:
                DBKafkaClient.get_instance(bootstrap_servers=kafka_broker)

            machine_data = _find_machine_by_id(machine_id, timeout=timeout)

            if not machine_data:
                return None

            machine_name = machine_data.get("name", "").lower()
            host_name = machine_data.get("hostName", "localhost")

            if machine_name and host_name and host_name != "localhost":
                full_address = f"{machine_name}01.{host_name}"
            else:
                full_address = host_name

            config = {
                "address": full_address,
                "port": machine_data.get("connectionPort", 35555),
                "machineType": machine_data.get("software", "sentio"),
                "machineId": machine_data.get("id", 0),
                "description": machine_data.get("generalLocation", ""),
            }

            return config

        except Exception:
            # Silently fail - will fallback to config file
            return None

    def _auto_initialize_prober(self, config_name, config):
        """
        Auto-initialize prober connection when listener starts

        Args:
            config_name: Name of the config (e.g., "CERN", "MOCK")
            config: Config dict from JSON
        """
        try:
            print("\n🔌 Auto-initializing prober connection...")

            from actions.WPProjectActions import svt_initialise_wp

            port = config.get("port", 35555)
            address_host = config.get("address", "localhost")
            full_address = f"{address_host}:{port}"

            g = SvtWPAagentGlobalParameters.getInstance()

            init_params = {
                "address": full_address,
                "machine_type": config.get("machineType", "sentio"),
                "machine_id": config.get("machineId", 0),
                "machine_name": config.get("description", config_name),
                "initialization_mode": "config",
                "force": True,
            }

            if "projectName" in config:
                init_params["projectName"] = config["projectName"]

            print(f"   Address: {full_address}")
            print(f"   Type: {init_params['machine_type']}")
            print(f"   Machine ID: {init_params['machine_id']}")

            g.set_machine_id(init_params["machine_id"])

            result = svt_initialise_wp(**init_params)

            if result.get("status", "") == "Success":
                msg = result.get("data", {}).get("message", "Initialized successfully")
                print(f"✅ {msg}")
                return True
            else:
                print("❌ Initialization failed:")
                error_obj = result.get("error", {})
                error_msg = error_obj.get("message", "Unknown error")
                error_code = error_obj.get("code", "N/A")
                print(f"   Error code: {error_code}")
                print(f"   Error message: {error_msg}")
                print("\n   Full result:")
                import json

                print(json.dumps(result, indent=2))
                return False

        except Exception as e:
            print(f"❌ Auto-initialization error: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    def listen(self, config_path=None):
        """
        Start the listener service with optional auto-initialization.
        Usage: python main.py listen configs/ProbeConfigCERN.json
        """
        if config_path:
            sep = '=' * 70
            print(f"\n{sep}")
            print(f"  Starting WP Agent: {config_path}")
            print(f"{sep}\n")

            try:
                config = self._load_probe_config_with_db(config_path)
                agent_name = config["name"]
                self.wp_agent_name = agent_name

                print(f"\n📋 Loaded config for '{agent_name}':")
                print(f"   Machine ID: {config.get('machineId')}")
                print(f"   Address: {config.get('address')}:{config.get('port', 35555)}")
                print(f"   Type: {config.get('machineType', 'sentio')}")
                if "description" in config:
                    print(f"   Description: {config['description']}")

                kafka_broker = config.get("kafka_broker")
                if kafka_broker:
                    print(f"   Kafka Broker: {kafka_broker}")
                print()

                # Set wpAgentName in global parameters
                try:
                    g = SvtWPAagentGlobalParameters.getInstance()
                    g.wpAgentName = agent_name
                    print(f"✓ Set wpAgentName: {agent_name}\n")
                except Exception as e:
                    print(f"⚠️  Warning: Could not set wpAgentName: {e}\n")

                # Initialize all Kafka clients with correct broker
                if kafka_broker:
                    print("🔌 Initializing health check...")
                    print(f"   Broker: {kafka_broker}")
                    self.health_check = ListenerHealthCheck(bootstrap_servers=kafka_broker)
                    print("   ✅ Health check initialized\n")

                    print("🔌 Initializing WP Kafka Client...")
                    print(f"   Broker: {kafka_broker}")
                    self.kafka = KafkaClient(bootstrap_servers=kafka_broker)
                    print("   ✅ WP Kafka client initialized\n")

                    from services.WPDbKafkaClient import DBKafkaClient
                    if DBKafkaClient._instance:
                        try:
                            DBKafkaClient._instance.close()
                        except Exception:
                            pass
                        DBKafkaClient._instance = None

                    print("🔌 Initializing DB Kafka Client...")
                    print(f"   Broker: {kafka_broker}")
                    DBKafkaClient.get_instance(bootstrap_servers=kafka_broker)
                    print("   ✅ DB Kafka client initialized\n")
                else:
                    print("⚠️  No kafka_broker in config, using defaults")
                    self.health_check = ListenerHealthCheck(bootstrap_servers=kafka_broker)
                    self.kafka = KafkaClient(bootstrap_servers=kafka_broker)

                init_success = self._auto_initialize_prober(agent_name, config)
                if not init_success:
                    print("\n⚠️  Warning: Auto-initialization failed")
                    print("   Continuing to start listener anyway...\n")

            except (FileNotFoundError, KeyError) as e:
                print(f"❌ Error loading config: {e}")
                print("\n💡 Usage: python main.py listen configs/ProbeConfigCERN.json")
                return
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                import traceback
                traceback.print_exc()
                return
        else:
            sep = '=' * 70
            print(f"\n{sep}")
            print("  Starting WP Agent (no auto-config)")
            print(f"{sep}\n")
            print("💡 Tip: Start with a config for auto-initialization:")
            print("   python main.py listen configs/ProbeConfigCERN.json\n")

            if self.kafka is None:
                self.kafka = KafkaClient()
            if self.health_check is None:
                self.health_check = ListenerHealthCheck()

        # Start Kafka listener
        print(f"{'=' * 70}")
        print("  Starting Kafka Listener")
        print(f"{'=' * 70}\n")
        self.kafka.listen()

    def check_listener_health(self):
        """Check if the listener is alive and responding"""
        if self.health_check is None:
            self.health_check = ListenerHealthCheck()

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

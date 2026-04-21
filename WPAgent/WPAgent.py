"""
Wafer Prober Agent - With Auto-Initialization on Listen

When starting with: python main.py listen CERN
- Loads config from WPProbesConfigs.json
- Auto-initializes prober connection
- Sets all global parameters
- Ready to receive commands immediately
"""

from WPKafkaClient import KafkaClient
from services.WPListenerHeartbeat import ListenerHealthCheck
import json
import os
from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters


class WaferProberAgent:
    def __init__(self):
        self.kafka = None  # Initialize later with config
        self.health_check = None  # Initialize later with config
        self.wp_agent_name = None

    def send(self, command, data=None, repeat=1, delay=0, check_health=True, wait_for_reply=True, timeout=30.0):
        """
        Send a command via Kafka and wait for response.
        """
        wafer_agent_name = data["waferAgentName"]
        config = self._load_probe_config_with_db(wafer_agent_name)
        kafka_broker = config.get('kafka_broker')

        # Ensure Kafka is initialized
        if self.kafka is None:
            print(f"⚠️  Kafka not initialized, using defaults")
            self.kafka = KafkaClient(bootstrap_servers=kafka_broker)

        # Check listener health before sending
        if check_health and self.health_check:
            is_alive, age = self.health_check.is_listener_alive(timeout=2.0)

            if not is_alive:
                if age == float('inf'):
                    print(f"⚠️  WARNING: No listener detected!")
                    print(f"   The listener is not running or not sending heartbeats.")
                else:
                    print(f"⚠️  WARNING: Listener appears to be down!")
                    print(f"   Last heartbeat was {age:.1f}s ago (timeout: {self.health_check.HEARTBEAT_TIMEOUT}s)")

                print(f"\n❌ The command '{command}' may not execute.")
                print(f"   Options:")
                print(f"   1. Start the listener: python main.py listen <CONFIG_NAME>")
                print(f"   2. Send anyway (may timeout): Continue")
                print(f"   3. Cancel: Ctrl+C")

                response = input(f"\n   Continue sending? (yes/no): ").strip().lower()

                if response not in ['yes', 'y']:
                    print("❌ Command cancelled")
                    return {
                        "status": "cancelled",
                        "output": "Command cancelled by user"
                    }

                print("📤 Sending command anyway...")

        # Send command
        response = self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=wait_for_reply,
            timeout=timeout
        )
        return response

    def send_async(self, command, data=None, repeat=1, delay=0):
        """Send command without waiting for reply"""
        # Ensure Kafka is initialized
        if self.kafka is None:
            self.kafka = KafkaClient()

        print(f"📤 Sending '{command}' (async - no reply expected)")
        return self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=False
        )

    def _load_probe_config(self, config_name):
        """
        Load probe station config from WPProbesConfigs.json

        Args:
            config_name: Name of config (e.g., "CERN", "MOCK")

        Returns:
            dict: Config with machineId, address, port, machineType, kafka_broker
        """
        config_path = "configs/WPProbesConfigs.json"

        if not os.path.exists(config_path):
            raise FileNotFoundError(
                f"Config file not found: {config_path}\n"
                f"Please create configs/WPProbesConfigs.json"
            )

        with open(config_path, 'r') as f:
            all_configs = json.load(f)

        if config_name not in all_configs:
            available = ', '.join(all_configs.keys())
            raise KeyError(
                f"Config '{config_name}' not found in {config_path}\n"
                f"Available configs: {available}"
            )

        return all_configs[config_name]

    def _load_probe_config_with_db(self, config_name, kafka_broker=None):
        """
        Load probe station config - DB for machine info, file for kafka_broker

        Args:
            config_name: Name of config/location (e.g., "CERN", "MOCK")
            kafka_broker: Kafka broker to use for DB connection (if querying DB)

        Returns:
            dict: Config with machineId, address, port, machineType, kafka_broker
        """
        print(f"🔍 Loading configuration for '{config_name}'...")

        # ALWAYS load config file first to get kafka_broker
        config_path = "configs/WPProbesConfigs.json"
        file_config = None

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    all_configs = json.load(f)
                    if config_name in all_configs:
                        file_config = all_configs[config_name]
            except Exception as e:
                print(f"   ⚠️  Warning: Could not load config file: {e}")

        # Get kafka_broker from file config
        if file_config and 'kafka_broker' in file_config:
            kafka_broker = file_config['kafka_broker']
            print(f"   ✅ Using kafka_broker from config file: {kafka_broker}")

        # NOW try database with the correct broker
        db_config = self._load_from_database(config_name, kafka_broker=kafka_broker, timeout=5.0)

        # If we got DB config, merge with kafka_broker from file
        if db_config:
            print(f"   ✅ Loaded machine info from database")

            # Add kafka_broker from file
            if kafka_broker:
                db_config['kafka_broker'] = kafka_broker

            return db_config

        if not os.path.exists(config_path):
            raise FileNotFoundError(
                f"Config file not found: {config_path}\n"
                f"Please create configs/WPProbesConfigs.json"
            )

        if not file_config:
            available = ', '.join(all_configs.keys()) if 'all_configs' in locals() else 'unknown'
            raise KeyError(
                f"Config '{config_name}' not found in {config_path}\n"
                f"Available configs: {available}"
            )

        print(f"   ✅ Loaded from config file")
        return file_config

    def _load_from_database(self, location_name, kafka_broker=None, timeout=5.0):
        """
        Load prober configuration from database (silent - no prints on failure)

        NOTE: Does NOT include kafka_broker - that always comes from config file

        Args:
            location_name: Location name (e.g., "CERN")
            kafka_broker: Kafka broker to use for DB connection
            timeout: Query timeout in seconds

        Returns:
            Config dict or None if not found/error
        """
        try:
            # Import here to avoid circular dependency
            from actions.WPDataBaseActions import get_machine_by_location

            # Query database with correct broker
            machine_data = get_machine_by_location(
                location_name,
                kafka_broker=kafka_broker,  # ← Pass broker!
                timeout=timeout
            )

            if not machine_data:
                return None

            # Construct address from name + hostName
            machine_name = machine_data.get("name", "").lower()
            host_name = machine_data.get("hostName", "localhost")

            # Build full address: wp<n>01.<hostname>
            if machine_name and host_name and host_name != "localhost":
                full_address = f"{machine_name}01.{host_name}"
            else:
                full_address = host_name

            # Convert DB format to config format
            # NOTE: kafka_broker is NOT included - always from config file
            config = {
                "address": full_address,
                "port": machine_data.get("connectionPort", 35555),
                "machineType": machine_data.get("software", "sentio"),
                "machineId": machine_data.get("id", 0),
                "description": machine_data.get("generalLocation", "")
            }

            return config

        except Exception as e:
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
            print(f"\n🔌 Auto-initializing prober connection...")

            from actions.WPProjectActions import svt_initialise_wp

            port = config.get('port', 35555)
            address_host = config.get('address', 'localhost')
            full_address = f"{address_host}:{port}"

            g = SvtWPAagentGlobalParameters.getInstance()

            init_params = {
                'address': full_address,
                'machine_type': config.get('machineType', 'sentio'),
                'machine_id': config.get('machineId', 0),
                'machine_name': config.get('description', config_name),
                'initialization_mode': 'config',
                'force': True
            }

            if 'projectName' in config:
                init_params['projectName'] = config['projectName']

            print(f"   Address: {full_address}")
            print(f"   Type: {init_params['machine_type']}")
            print(f"   Machine ID: {init_params['machine_id']}")

            g.set_machine_id(init_params['machine_id'])

            result = svt_initialise_wp(**init_params)

            if result.get('status', '').lower() == 'success':
                msg = result.get('data', {}).get('message', 'Initialized successfully')
                print(f"✅ {msg}")
                return True
            else:
                print(f"❌ Initialization failed:")
                error_obj = result.get('error', {})
                error_msg = error_obj.get('message', 'Unknown error')
                error_code = error_obj.get('code', 'N/A')
                print(f"   Error code: {error_code}")
                print(f"   Error message: {error_msg}")
                print(f"\n   Full result:")
                import json
                print(json.dumps(result, indent=2))
                return False

        except Exception as e:
            print(f"❌ Auto-initialization error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def listen(self, config_name=None):
        """
        Start the listener service with optional auto-initialization
        """
        if config_name:
            print(f"\n{'=' * 70}")
            print(f"  Starting WP Agent: {config_name}")
            print(f"{'=' * 70}\n")

            try:
                # Load config (DB query happens AFTER we know kafka_broker from file)
                config = self._load_probe_config_with_db(config_name)
                self.wp_agent_name = config_name

                print(f"\n📋 Loaded config for '{config_name}':")
                print(f"   Machine ID: {config.get('machineId')}")
                print(f"   Address: {config.get('address')}:{config.get('port', 35555)}")
                print(f"   Type: {config.get('machineType', 'sentio')}")
                if 'description' in config:
                    print(f"   Description: {config['description']}")

                kafka_broker = config.get('kafka_broker')
                if kafka_broker:
                    print(f"   Kafka Broker: {kafka_broker}")

                print()

                # Set wpAgentName in global parameters
                try:
                    g = SvtWPAagentGlobalParameters.getInstance()
                    g.wpAgentName = config_name
                    print(f"✓ Set wpAgentName: {config_name}\n")
                except Exception as e:
                    print(f"⚠️  Warning: Could not set wpAgentName: {e}\n")

                # Initialize all Kafka clients with correct broker
                if kafka_broker:
                    # Health check
                    print(f"🔌 Initializing health check...")
                    print(f"   Broker: {kafka_broker}")
                    self.health_check = ListenerHealthCheck(bootstrap_servers=kafka_broker)
                    print(f"   ✅ Health check initialized\n")

                    # WP Kafka client
                    print(f"🔌 Initializing WP Kafka Client...")
                    print(f"   Broker: {kafka_broker}")
                    self.kafka = KafkaClient(bootstrap_servers=kafka_broker)
                    print(f"   ✅ WP Kafka client initialized\n")

                    # DB Kafka client
                    from services.WPDbKafkaClient import DBKafkaClient

                    # Reset singleton if exists
                    if DBKafkaClient._instance:
                        try:
                            DBKafkaClient._instance.close()
                        except:
                            pass
                        DBKafkaClient._instance = None

                    print(f"🔌 Initializing DB Kafka Client...")
                    print(f"   Broker: {kafka_broker}")
                    db_client = DBKafkaClient.get_instance(bootstrap_servers=kafka_broker)
                    print(f"   ✅ DB Kafka client initialized\n")
                else:
                    print(f"⚠️  No kafka_broker in config, using defaults")
                    self.health_check = ListenerHealthCheck()
                    self.kafka = KafkaClient()

                # Auto-initialize prober
                init_success = self._auto_initialize_prober(config_name, config)

                if not init_success:
                    print(f"\n⚠️  Warning: Auto-initialization failed")
                    print(f"   Continuing to start listener anyway...\n")

            except (FileNotFoundError, KeyError) as e:
                print(f"❌ Error loading config: {e}")
                print(f"\n💡 Available options:")
                print(f"   1. Create configs/WPProbesConfigs.json")
                print(f"   2. Run without config: python main.py listen")
                return
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                import traceback
                traceback.print_exc()
                return
        else:
            print(f"\n{'=' * 70}")
            print(f"  Starting WP Agent (no auto-config)")
            print(f"{'=' * 70}\n")
            print(f"💡 Tip: Start with a config for auto-initialization:")
            print(f"   python main.py listen CERN\n")

            if self.kafka is None:
                self.kafka = KafkaClient()
            if self.health_check is None:
                self.health_check = ListenerHealthCheck()

        # Start Kafka listener
        print(f"{'=' * 70}")
        print(f"  Starting Kafka Listener")
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
            if age == float('inf'):
                print(f"❌ Listener is DOWN (no heartbeat found)")
            else:
                print(f"❌ Listener is DOWN (last heartbeat: {age:.1f}s ago)")
            print(f"\n💡 To start the listener, run:")
            print(f"   python main.py listen <CONFIG_NAME>")

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

        print(f"⚠️  Sending '{command}' WITHOUT health check (forced)")
        return self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=True,
            timeout=timeout
        )
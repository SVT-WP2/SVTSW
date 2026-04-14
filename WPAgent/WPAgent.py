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
        self.kafka = KafkaClient()
        self.health_check = ListenerHealthCheck()
        self.wp_agent_name = None

    def send(self, command, data=None, repeat=1, delay=0, check_health=True, wait_for_reply=True, timeout=30.0):
        """
        Send a command via Kafka and wait for response.
        (Same as before - no changes)
        """
        # ========================================================================
        # SPECIAL HANDLING: Initialize with withDB parameter
        # ========================================================================

        # if command == "Initialize" and data:
        #     # Normalize params to dict if needed
        #     if isinstance(data, str):
        #         param_dict = {}
        #         for item in data.split():
        #             if '=' in item:
        #                 k, v = item.split('=', 1)
        #                 param_dict[k] = v
        #         data = param_dict

        #     # Check for withDB parameter
        #     if isinstance(data, dict):
        #         withDB_value = str(data.get('withDB', '')).lower()
        #         if withDB_value in ['true', '1', 'yes']:
        #             print("🔍 Database initialization requested - handling producer-side...")

        #             try:
        #                 from services.WPInitializationService import WPInitializationService

        #                 init_service = WPInitializationService(self)
        #                 projectName = data.get('projectName')
        #                 force_value = str(data.get('force', '')).lower()
        #                 force = force_value in ['true', '1', 'yes']
        #                 db_timeout = float(data.get('db_timeout', 15.0))

        #                 return init_service.initialize_from_database(
        #                     force=force,
        #                     db_timeout=db_timeout
        #                 )
        #             except ImportError as e:
        #                 return {
        #                     "status": "error",
        #                     "output": f"initialization_service.py not found. Error: {e}"
        #                 }
        #             except Exception as e:
        #                 import traceback
        #                 traceback.print_exc()
        #                 return {
        #                     "status": "error",
        #                     "output": f"Database initialization failed: {str(e)}"
        #                 }

        # Check listener health before sending
        if check_health:
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
            dict: Config with machineId, address, port, machineType
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

    def _load_probe_config_with_db(self, config_name):
        """
        Load probe station config - tries DB first, automatically falls back to JSON file

        Args:
            config_name: Name of config/location (e.g., "CERN", "MOCK")

        Returns:
            dict: Config with machineId, address, port, machineType
        """
        # Always try database first
        print(f"🔍 Loading configuration for '{config_name}'...")
        config = self._load_from_database(config_name, timeout=5.0)

        if config:
            print(f"   ✅ Loaded from database")
            return config

        # Fallback to config file
        print(f"   ℹ️  Database unavailable or location not found")
        print(f"   📋 Loading from config file...")

        config_path = "configs/WPProbesConfigs.json"

        if not os.path.exists(config_path):
            raise FileNotFoundError(
                f"Config file not found: {config_path}\n"
                f"Please create configs/WPProbesConfigs.json or add '{config_name}' to database"
            )

        with open(config_path, 'r') as f:
            all_configs = json.load(f)

        if config_name not in all_configs:
            available = ', '.join(all_configs.keys())
            raise KeyError(
                f"Config '{config_name}' not found in database or {config_path}\n"
                f"Available configs: {available}"
            )

        print(f"   ✅ Loaded from config file")
        return all_configs[config_name]

    def _load_from_database(self, location_name, timeout=5.0):
        """
        Load prober configuration from database (silent - no prints on failure)

        Args:
            location_name: Location name (e.g., "CERN")
            timeout: Query timeout in seconds

        Returns:
            Config dict or None if not found/error
        """
        try:
            from actions.WPDataBaseActions import get_machine_by_location

            # Query database (silently)
            machine_data = get_machine_by_location(location_name, timeout=timeout)

            if not machine_data:
                return None

            # Construct address from name + hostName
            # Example: name="CERN" + "01" + hostName="cern.ch" => "wpmit01.cern.ch"
            machine_name = machine_data.get("name", "").lower()
            host_name = machine_data.get("hostName", "localhost")

            # Build full address: wp<name>01.<hostname>
            if machine_name and host_name and host_name != "localhost":
                full_address = f"{machine_name}01.{host_name}"
            else:
                # Fallback to just hostname if name is missing
                full_address = host_name

            # Convert DB format to config format
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

        This calls svt_initialise_wp() directly to set up the prober
        without needing a separate Initialize command

        Args:
            config_name: Name of the config (e.g., "CERN", "MOCK")
            config: Config dict from JSON
        """
        try:
            print(f"\n🔌 Auto-initializing prober connection...")

            # Import the initialization function
            from actions.WPProjectActions import svt_initialise_wp

            # Build address
            port = config.get('port', 35555)
            address_host = config.get('address', 'localhost')
            full_address = f"{address_host}:{port}"
            # from WPAagentGlobalParameters import SvtWPAagentGlobalParameters
            #
            g = SvtWPAagentGlobalParameters.getInstance()
            # g.wpAgentName= "CERN"

            # Prepare initialization parameters
            init_params = {
                'address': full_address,
                'machine_type': config.get('machineType', 'sentio'),
                'machine_id': config.get('machineId', 0),
                'machine_name': config.get('description', config_name),
                'initialization_mode': 'config',  # Mark as config-driven
                'force': True  # Force init on startup
            }

            # Add optional project if specified in config
            if 'projectName' in config:
                init_params['projectName'] = config['projectName']

            print(f"   Address: {full_address}")
            print(f"   Type: {init_params['machine_type']}")
            print(f"   Machine ID: {init_params['machine_id']}")

            g.set_machine_id(init_params['machine_id'])


            # Call the initialization function directly
            result = svt_initialise_wp(**init_params)

            if result.get('status', '').lower() == 'success':
                msg = result.get('data', {}).get('message', 'Initialized successfully')
                print(f"✅ {msg}")
                return True
            else:
                # ENHANCED ERROR LOGGING
                print(f"❌ Initialization failed:")

                # Get error details
                error_obj = result.get('error', {})
                error_msg = error_obj.get('message', 'Unknown error')
                error_code = error_obj.get('code', 'N/A')

                print(f"   Error code: {error_code}")
                print(f"   Error message: {error_msg}")

                # Show full result for debugging
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

        Args:
            config_name: Optional probe station config name (e.g., "CERN", "MOCK")
                        If provided, loads config and auto-initializes prober

        Usage:
            python main.py listen            # Start without auto-init
            python main.py listen CERN       # Auto-init with CERN config
            python main.py listen MOCK       # Auto-init with mock prober
        """
        if config_name:
            print(f"\n{'=' * 70}")
            print(f"  Starting WP Agent: {config_name}")
            print(f"{'=' * 70}\n")

            try:
                # Load config
                config = self._load_probe_config_with_db(config_name)
                self.wp_agent_name = config_name

                print(f"📋 Loaded config for '{config_name}':")
                print(f"   Machine ID: {config.get('machineId')}")
                print(f"   Address: {config.get('address')}:{config.get('port', 35555)}")
                print(f"   Type: {config.get('machineType', 'sentio')}")
                if 'description' in config:
                    print(f"   Description: {config['description']}")
                print()

                # Set wpAgentName in global parameters first
                try:
                    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
                    g = SvtWPAagentGlobalParameters.getInstance()
                    g.wpAgentName = config_name
                    print(f"✓ Set wpAgentName: {config_name}\n")
                except Exception as e:
                    print(f"⚠️  Warning: Could not set wpAgentName: {e}\n")

                # Auto-initialize prober connection
                init_success = self._auto_initialize_prober(config_name, config)

                if not init_success:
                    print(f"\n⚠️  Warning: Auto-initialization failed")
                    print(f"   You may need to run Initialize command manually")
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
            print(f"   python main.py listen CERN")
            print(f"   python main.py listen MOCK\n")
            print(f"   You will need to run Initialize command manually.\n")

        # Start Kafka listener
        print(f"{'=' * 70}")
        print(f"  Starting Kafka Listener")
        print(f"{'=' * 70}\n")
        self.kafka.listen()

    def check_listener_health(self):
        """Check if the listener is alive and responding"""
        print("🔍 Checking listener health...")
        is_alive, age = self.health_check.is_listener_alive(timeout=2.0)

        if is_alive:
            print(f"✅ Listener is ALIVE (heartbeat age: {age:.1f}s)")
            print(f"   Heartbeat topic: {self.health_check.HEARTBEAT_TOPIC}")
        else:
            if age == float('inf'):
                print(f"❌ Listener is DOWN (no heartbeat found)")
                print(f"   No heartbeats detected on topic: {self.health_check.HEARTBEAT_TOPIC}")
            else:
                print(f"❌ Listener is DOWN (last heartbeat: {age:.1f}s ago)")
                print(f"   Timeout threshold: {self.health_check.HEARTBEAT_TIMEOUT}s")

            print(f"\n💡 To start the listener, run:")
            print(f"   python main.py listen <CONFIG_NAME>")

        return is_alive

    def wait_for_listener(self, max_wait=30.0):
        """Wait until listener comes online"""
        return self.health_check.wait_for_listener(max_wait=max_wait)

    def send_force(self, command, data=None, repeat=1, delay=0, timeout=30.0):
        """Force send a command without checking listener health"""
        print(f"⚠️  Sending '{command}' WITHOUT health check (forced)")
        return self.kafka.send(
            command=command,
            data=data,
            repeat=repeat,
            delay=delay,
            wait_for_reply=True,
            timeout=timeout
        )
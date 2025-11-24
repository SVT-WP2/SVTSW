from kafka_client import KafkaClient
from services.listener_heartbeat import ListenerHealthCheck
import threading
import time


class WaferProberAgent:
    def __init__(self):
        self.kafka = KafkaClient()
        self.health_check = ListenerHealthCheck()

    def send(self, command, params=None, repeat=1, delay=0, check_health=True, wait_for_reply=True, timeout=30.0):
        """
        Send a command via Kafka and wait for response.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command (default: 1)
            delay: Delay between repeats in seconds (default: 0)
            check_health: Whether to check listener health before sending (default: True)
            wait_for_reply: Whether to wait for response from listener (default: True)
            timeout: How long to wait for reply in seconds (default: 30.0)

        Returns:
            dict: Response from listener with status and output
        """
        # ========================================================================
        # SPECIAL HANDLING: Initialize with with_db parameter
        # ========================================================================

        if command == "Initialize" and params:
            # Normalize params to dict if needed
            if isinstance(params, str):
                # Parse "key=value" or "key1=value1 key2=value2" format
                param_dict = {}
                for item in params.split():
                    if '=' in item:
                        k, v = item.split('=', 1)
                        param_dict[k] = v
                params = param_dict

            # Check for with_db parameter
            if isinstance(params, dict):
                with_db_value = str(params.get('with_db', '')).lower()
                if with_db_value in ['true', '1', 'yes']:
                    # Database initialization requested - handle producer-side
                    print("🔍 Database initialization requested - handling producer-side...")

                    try:
                        from services.WPInitializationService import WPInitializationService

                        init_service = WPInitializationService(self)

                        # Extract other parameters
                        project_name = params.get('project_name')
                        force_value = str(params.get('force', '')).lower()
                        force = force_value in ['true', '1', 'yes']
                        db_timeout = float(params.get('db_timeout', 15.0))

                        # Do producer-side database initialization
                        # This will show prompts to user and send final command to listener
                        return init_service.initialize_from_database(
                            project_name=project_name,
                            force=force,
                            db_timeout=db_timeout
                        )
                    except ImportError as e:
                        return {
                            "status": "error",
                            "output": f"initialization_service.py not found. Please install it for database initialization. Error: {e}"
                        }
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        return {
                            "status": "error",
                            "output": f"Database initialization failed: {str(e)}"
                        }

        # ========================================================================
        # Normal command flow continues here
        # ========================================================================

        # Check if listener is alive before sending
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
                print(f"   1. Start the listener: python main.py listen")
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

        # Send command and wait for reply
        return self.kafka.send(
            command=command,
            params=params,
            repeat=repeat,
            delay=delay,
            wait_for_reply=wait_for_reply,
            timeout=timeout
        )

    def send_async(self, command, params=None, repeat=1, delay=0):
        """
        Send a command without waiting for reply (fire and forget).
        Useful for non-critical commands or batch operations.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command
            delay: Delay between repeats in seconds
        """
        print(f"📤 Sending '{command}' (async - no reply expected)")
        return self.kafka.send(
            command=command,
            params=params,
            repeat=repeat,
            delay=delay,
            wait_for_reply=False
        )

    def listen(self):
        """Start the listener service"""
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
            print(f"   python main.py listen")

        return is_alive

    def wait_for_listener(self, max_wait=30.0):
        """
        Wait until listener comes online

        Args:
            max_wait: Maximum time to wait in seconds (default: 30.0)

        Returns:
            bool: True if listener came online, False if timeout
        """
        return self.health_check.wait_for_listener(max_wait=max_wait)

    def send_force(self, command, params=None, repeat=1, delay=0, timeout=30.0):
        """
        Force send a command without checking listener health.
        Still waits for reply.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command
            delay: Delay between repeats in seconds
            timeout: How long to wait for reply (seconds)
        """
        print(f"⚠️  Sending '{command}' WITHOUT health check (forced)")
        return self.kafka.send(
            command=command,
            params=params,
            repeat=repeat,
            delay=delay,
            wait_for_reply=True,
            timeout=timeout
        )
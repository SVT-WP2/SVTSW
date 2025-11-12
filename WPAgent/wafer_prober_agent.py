from kafka_client import KafkaClient
from services.listener_heartbeat import ListenerHealthCheck
import threading
import time


class WaferProberAgent:
    def __init__(self):
        self.kafka = KafkaClient()
        self.health_check = ListenerHealthCheck()

    def send(self, command, params=None, repeat=1, delay=0, check_health=True):
        """
        Send a command via Kafka.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command, repeat=1 means that it will be run once
            delay: Delay between repeats in seconds
            check_health: Whether to check listener health before sending (default: True)
        """
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

                print(f"\n❓ The command '{command}' will be queued but may not execute.")
                print(f"   Options:")
                print(f"   1. Start the listener: python main.py listen")
                print(f"   2. Send anyway (will queue): Continue")
                print(f"   3. Cancel: Ctrl+C")

                response = input(f"\n   Continue sending? (yes/no): ").strip().lower()

                if response not in ['yes', 'y']:
                    print("❌ Command cancelled")
                    return

                print("📤 Sending command anyway (will be queued)...")

        self.kafka.send(command, params, repeat, delay)

    def listen(self):
        self.kafka.listen()

    def run_both(self, command, params=None, repeat=1, delay=0):
        def consume():
            self.kafka.listen()

        thread = threading.Thread(target=consume, daemon=True)
        thread.start()

        time.sleep(2)
        self.kafka.send(command, params, repeat, delay)

        while True:
            time.sleep(1)

    def list_commands(self):
        from command_handler import CommandHandler  # <- Import locally
        handler = CommandHandler.getInstance()
        print("Available Commands:")
        for cmd in handler.listAvailableCommands():
            print(f" - {cmd}")

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

    def send_force(self, command, params=None, repeat=1, delay=0):
        """
        Force send a command without checking listener health.
        Use this when you know the listener will start later.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command
            delay: Delay between repeats in seconds
        """
        print(f"⚠️  Sending '{command}' WITHOUT health check (forced)")
        self.kafka.send(command, params, repeat, delay)
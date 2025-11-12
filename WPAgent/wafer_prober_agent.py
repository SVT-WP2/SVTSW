from kafka_client import KafkaClient
from services.listener_heartbeat import ListenerHealthCheck
import threading
import time


class WaferProberAgent:
    def __init__(self):
        self.kafka = KafkaClient()
        self.health_check = ListenerHealthCheck()

    def send(self, command, params=None, repeat=1, delay=0):
        """
        Send a command via Kafka.

        Args:
            command: Command name to execute
            params: Command parameters (dict or string)
            repeat: Number of times to repeat the command, repeat=1 means that it will be run once
            delay: Delay between repeats in seconds
        """
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
        is_alive, age = self.health_check.is_listener_alive(timeout=2.0)

        if is_alive:
            print(f"✅ Listener is ALIVE (heartbeat age: {age:.1f}s)")
        else:
            if age == float('inf'):
                print(f"❌ Listener is DOWN (no heartbeat found)")
            else:
                print(f"❌ Listener is DOWN (last heartbeat: {age:.1f}s ago)")

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
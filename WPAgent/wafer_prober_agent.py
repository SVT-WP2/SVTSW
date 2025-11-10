from kafka_client import KafkaClient
import threading
import time


class WaferProberAgent:
    def __init__(self):
        self.kafka = KafkaClient()

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
    # NOT SURE I NEED IT HERE
    def status(self):
        """Get current agent status"""
        from actions.WPProjectActions import get_project_status
        result = get_project_status()

        if result["status"] == "success":
            data = result.get("data", {})
            print("\n Agent Status:")
            print(f"  Address: {data.get('address', 'Not set')}")
            print(f"  Machine Type: {data.get('machine_type', 'Not set')}")
            print(f"  Project: {data.get('project_name', 'Not set')}")
            print(f"  Prober Status: {data.get('prober_status', 'Unknown')}")
            print(f"  Initialized: {'✅ Yes' if data.get('prober_initialized') else '❌ No'}")
            print(f"  Ready: {'✅ Yes' if data.get('ready_for_commands') else f'❌ No '}")
        elif result["status"] == "uninitialized":
            data = result.get("data", {})
            print("\n Agent Status:")
            print(f"  Initialized: ❌ No")
            print(f"  Status: Waiting for 'Initialize' command")
            print(f"  Ready: ❌ No - {data.get('ready_message', 'Not initialized')}")
        else:
            print(f"⚠️  {result['output']}")

        return result



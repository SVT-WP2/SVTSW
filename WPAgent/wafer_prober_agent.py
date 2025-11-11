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




from kafka_client import KafkaClient
from command_handler import CommandHandler
import threading
import time

class WaferProberAgent:
    def __init__(self):
        # TODO: Initialize agent and get address and so on . Then Kafka command that reload this parammeters HERE HAS TO BE DB agent and get from database
        self.kafka = KafkaClient()
        self.handler = CommandHandler.getInstance()

    def send(self, command, params=None, repeat=1, delay=0):
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
        print("Available Commands:")
        for cmd in self.handler.listAvailableCommands():
            print(f" - {cmd}")
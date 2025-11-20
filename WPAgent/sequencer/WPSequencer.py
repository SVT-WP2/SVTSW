import json
import time
from utilities.WPAgentLogger import WPAgentLogger, Severity

# Initialize logger
logger = WPAgentLogger()

class WPSequencer:
    def __init__(self, executor):
        """
        Sequencer class for running a series of wafer prober commands.
        :param executor: Callable function that accepts (command_name, params) and executes the command.
        """
        self.sequence = []
        self.execute_command = executor

    def load_sequence(self, filepath):
        """
        Load a JSON file defining the command sequence.
        :param filepath: Path to the JSON file.
        """


        with open(filepath, 'r', encoding='utf-8') as f:
            self.sequence = json.load(f)

    def run_sequence(self, delay=0.5):
        """
        Execute all commands in the loaded sequence with optional delay between steps.
        :param delay: Delay in seconds between each command (default is 0.5s).
        """
        command_list = [step.get("command") for step in self.sequence]

        logger.log_command(
            messageOut=f"Running a sequence of commands: {', '.join(command_list)}",
            severityLevel=Severity.INFO,
            command="WP_RUN_SEQUENCE",
            params=None,
            result={"commands": command_list}
        )

        for idx, step in enumerate(self.sequence):
            command = step.get("command")
            params = step.get("params", {})
            print(f"[Step {idx + 1}] Executing '{command}' with params: {params}")

            result = self.execute_command(command, params)

            if result.get("status") != "success":
                print(f"[❌ Step {idx + 1} failed] {result.get('output')}")
                logger.log_command(
                    messageOut=f"Step {idx + 1} '{command}' failed: {result.get('output')}",
                    severityLevel=Severity.ERROR,
                    command=command,
                    params=params,
                    result=result
                )
                return result
            time.sleep(delay)



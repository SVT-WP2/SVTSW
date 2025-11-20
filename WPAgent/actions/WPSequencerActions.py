# actions/WPSequencerActions.py
import time
import json
from utilities.WPAgentLogger import WPAgentLogger, Severity
from sequencer.WPSequencer import WPSequencer


def run_sequence(filepath=None, executor=None):
    if not filepath:
        return {"status": "error", "output": "Missing 'filepath' for sequence."}
    if executor is None:
        return {"status": "error", "output": "Missing executor function for sequence execution."}

    from cmd_map import execute_command  # optional; can be removed now since executor is passed in
    sequencer = WPSequencer(executor=executor)
    sequencer.load_sequence(filepath)
    sequencer.run_sequence()

    return {
        "status": "success",
        "output": f"Sequence from {filepath} executed successfully."
    }
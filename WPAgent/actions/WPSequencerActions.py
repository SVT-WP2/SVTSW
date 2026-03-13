from utilities.WPResponseBuilder import ResponseBuilder
from sequencer.WPSequencer import WPSequencer
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

from stateMachine.WpAgentStateMachine import WPAgentState


def run_sequence(filepath=None, executor=None):
    """Run a command sequence from JSON file"""
    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    if not filepath:
        return ResponseBuilder.error("RunSequencerReply", "Missing 'filepath' for sequence", 400)

    if executor is None:
        return ResponseBuilder.error("RunSequencerReply", "Missing executor function for sequence execution", 400)

    g = SvtWPAagentGlobalParameters.getInstance()

    try:
        from WPCmdMap import execute_command
        sequencer = WPSequencer(executor=executor)
        sequencer.load_sequence(filepath)
        sequencer.run_sequence()

        # Update state after sequence
        agentStateMachine.force_state(WPAgentState.UsedByDeveloper)

        return ResponseBuilder.success("RunSequencerReply", f"Sequence from {filepath} executed successfully")

    except Exception as e:
        agentStateMachine.enter_error_state(str(e))
        return ResponseBuilder.error("RunSequencerReply", str(e), 500)
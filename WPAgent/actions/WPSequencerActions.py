from utilities.WPResponseBuilder import ResponseBuilder
from sequencer.WPSequencer import WPSequencer


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
        g.wpag_state = "WP_Idle"

        return ResponseBuilder.success("RunSequencerReply", f"Sequence from {filepath} executed successfully")

    except Exception as e:
        g.wpag_state = "WP_Error"
        return ResponseBuilder.error("RunSequencerReply", str(e), 500)
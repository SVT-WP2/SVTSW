from utilities.WPResponseBuilder import ResponseBuilder
from sequencer.WPSequencer import WPSequencer
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine

from stateMachine.WpAgentStateMachine import WPAgentState


def run_sequencer(filepath, user=None, waferAgentName=None, executor=None):
    """Execute a sequence of commands from JSON file"""
    import json
    from WPCmdMap import execute_command

    try:
        with open(filepath, 'r') as f:
            sequence = json.load(f)

        results = []

        for i, step in enumerate(sequence, 1):
            command = step.get('command')
            data = step.get('data', {})

            if user:
                data['user'] = user
            if waferAgentName:
                data['waferAgentName'] = waferAgentName

            print(f"\n[Step {i}/{len(sequence)}] Executing: {command}")
            print(f"   Parameters: {data}")

            result = execute_command(command, data)

            if not result:
                error_msg = f"Command '{command}' returned None"
                print(f"   ❌ {error_msg}")

                return ResponseBuilder.error(
                    "RunSequencerReply",
                    f"Step {i} failed: {error_msg}",
                    500
                )

            results.append(result)

            # Check status
            status = result.get('status')

            if status != 'Success':
                # Extract error message
                error_obj = result.get('error', {})
                error_msg = error_obj.get('message', 'Unknown error')

                print(f"   ❌ Failed: {error_msg}")

                return ResponseBuilder.error(
                    "RunSequencerReply",
                    f"Step {i} '{command}' failed: {error_msg}",
                    500
                )

        return ResponseBuilder.success(
            "RunSequencerReply",
            f"Successfully executed {len(sequence)} commands"
        )

    except FileNotFoundError:
        return ResponseBuilder.error(
            "RunSequencerReply",
            f"File not found: {filepath}",
            404
        )

    except json.JSONDecodeError as e:
        return ResponseBuilder.error(
            "RunSequencerReply",
            f"Invalid JSON: {str(e)}",
            400
        )

    except Exception as e:
        import traceback
        traceback.print_exc()

        return ResponseBuilder.error(
            "RunSequencerReply",
            f"Sequencer error: {str(e)}",
            500
        )

# WPSequencerActionsYAML.py
import yaml
import traceback
from utilities.WPResponseBuilder import ResponseBuilder
from utilities.WPValidationDecorator import validate_command, get_reply_type


@validate_command
def run_sequencer_yaml(filepath, user=None, waferAgentName=None, executor=None, **kwargs):
    """Execute a sequence of commands from a YAML file"""
    reply = get_reply_type()

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            doc = yaml.safe_load(f)

        context  = doc.get("params", {})
        sequence = doc.get("steps", [])

        if user:
            context["user"] = user
        if waferAgentName:
            context["waferAgentName"] = waferAgentName

        context.update(kwargs)  # dies, or any other future runtime field

        def resolve(value):
            if isinstance(value, str) and value.startswith("$"):
                return context.get(value[1:], value)
            if isinstance(value, dict):
                return {k: resolve(v) for k, v in value.items()}
            if isinstance(value, list):
                return [resolve(v) for v in value]
            return value

        def run_steps(steps):
            for i, step in enumerate(steps, 1):

                if "foreach" in step:
                    items    = resolve(step["foreach"])
                    loop_var = step.get("as", "item")
                    for item in items:
                        context[loop_var] = item
                        error = run_steps(step["steps"])
                        if error:
                            return error
                    continue

                command = step["command"]
                data    = resolve(step.get("params", {}))

                print(f"\n[Step {i}/{len(steps)}] Executing: {command}")
                print(f"   Parameters: {data}")

                result = executor(command, data)

                if not result:
                    msg = f"Command '{command}' returned None"
                    print(f"   ❌ {msg}")
                    return ResponseBuilder.error(reply, f"Step {i} failed: {msg}", 500)

                if result.get("status") != "Success":
                    error_msg = result.get("error", {}).get("message", "Unknown error")
                    print(f"   ❌ Failed: {error_msg}")
                    return ResponseBuilder.error(reply, f"Step {i} '{command}' failed: {error_msg}", 500)

            return None

        error = run_steps(sequence)
        if error:
            return error

        return ResponseBuilder.success(reply, f"Successfully executed YAML sequence from {filepath}")

    except FileNotFoundError:
        return ResponseBuilder.error(reply, f"File not found: {filepath}", 404)

    except yaml.YAMLError as e:
        return ResponseBuilder.error(reply, f"Invalid YAML: {str(e)}", 400)

    except Exception as e:
        traceback.print_exc()
        return ResponseBuilder.error(reply, f"Sequencer error: {str(e)}", 500)
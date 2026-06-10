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

        context = doc.get("params", {})
        sequence = doc.get("steps", [])

        context.update(kwargs)          # runtime fields first (dies, etc.)
        if user:                        # named params always win
            context["user"] = user
        if waferAgentName:
            context["waferAgentName"] = waferAgentName

        def resolve(value):
            if isinstance(value, str) and value.startswith("$"):
                key = value[1:]
                # dot notation: $step.x → context["step"]["x"]
                parts = key.split(".")
                result = context.get(parts[0], value)
                for part in parts[1:]:
                    if isinstance(result, dict):
                        result = result.get(part, value)
                    else:
                        return value
                return result
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

                command  = step["command"]
                data     = resolve(step.get("params", {}))
                store_as = step.get("as")

                # ── conditional execution ──────────────────────────────────────
                when = step.get("when")
                if when:
                    parts = when.strip().split("==")
                    if len(parts) == 2:
                        left  = resolve(parts[0].strip())
                        right = parts[1].strip().strip('"')   # ← strip quotes from right side
                        print(f"   🔍 when: '{left}' == '{right}' → {str(left) == right}")
                        if str(left) != right:
                            continue
                # ──────────────────────────────────────────────────────────────

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

                if store_as:
                    context[store_as] = {"steps": result.get("steps", [])}
                    print(f"   📦 Stored '{store_as}': {len(context[store_as]['steps'])} steps")

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
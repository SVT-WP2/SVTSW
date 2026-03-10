from WPAgent import WaferProberAgent
import fire
import json
import sys


def _serialize(x):
    if x is None:
        return ""

    # If it's our Kafka reply format
    if isinstance(x, dict):
        status = x.get("status")
        data = x.get("data")
        error = x.get("error")

        # Pretty help / text output
        if isinstance(data, dict) and "output" in data:
            return data["output"]

        # Error formatting
        if status and status != "Success":
            msg = error.get("message") if isinstance(error, dict) else error
            return f"❌ {status}: {msg}"

    # fallback
    try:
        return json.dumps(x, indent=2, ensure_ascii=False)
    except TypeError:
        return str(x)


# Special handling for: python main.py send Help MoveChuckXY
if len(sys.argv) >= 4 and sys.argv[1] == "send" and sys.argv[2] == "help":
    # Convert: python main.py send Help MoveChuckXY
    # To:      python main.py send Help --params='{"command":"MoveChuckXY"}'
    if not sys.argv[3].startswith("--"):
        command_name = sys.argv[3]
        sys.argv[3] = f'--data={{"command":"{command_name}"}}'

if __name__ == "__main__":
    fire.Fire(WaferProberAgent, serialize=_serialize)

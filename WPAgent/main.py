
from WPAgent import WaferProberAgent
import fire
import json
import sys

def _serialize(x):
    if x is None:
        return ""
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

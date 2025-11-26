from wafer_prober_agent import WaferProberAgent
import fire
import sys

# Special handling for: python main.py send Help MoveChuckXY
if len(sys.argv) >= 4 and sys.argv[1] == "send" and sys.argv[2] == "help":
    # Convert: python main.py send Help MoveChuckXY
    # To:      python main.py send Help --params='{"command":"MoveChuckXY"}'
    if not sys.argv[3].startswith("--"):
        command_name = sys.argv[3]
        sys.argv[3] = f'--params={{"command":"{command_name}"}}'

if __name__ == "__main__":
    fire.Fire(WaferProberAgent)
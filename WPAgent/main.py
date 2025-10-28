from wafer_prober_agent import WaferProberAgent
from wafer_prober_control import WaferProberControl
import fire

if __name__ == "__main__":
    # expose both the original agent and the newer centralized control object
    fire.Fire({
        "agent": WaferProberAgent,
        "control": WaferProberControl
    })
from typing import Optional, Dict, Any
import json

from wafer_prober_agent import WaferProberAgent
from services.kafka_db_service import KafkaDBService
from globals.svtWPAagentGlobalParameters import SvtWPAagentGlobalParameters
from kafka_client import KafkaClient


class WaferProberControl(WaferProberAgent):
    """Centralized control object for the Wafer Prober Agent.

    Responsibilities:
    - Configuration management (load from DB or provided dict/JSON)
    - Database interactions (via KafkaDBService)
    - Sequence execution (placeholder APIs to run sequences)

    Behaviour controlled by `get_from_db` flag:
    - True: try to fetch parameters from DB
    - False: use provided config dict or JSON
    """

    def __init__(self, get_from_db: bool = True, config: Optional[Dict[str, Any]] = None, kafka_client: Optional[KafkaClient] = None):
        # allow overriding Kafka client for tests
        self.kafka = kafka_client or KafkaClient()
        # keep a DB service wrapper for retrieving parameters
        self.db_service = KafkaDBService(self.kafka)
        # hold config and flag
        self.get_from_db = bool(get_from_db)
        self._config = config or {}

        # ensure base agent init (it will create its own kafka & handler if needed)
        super().__init__()

        # global param store
        self.globals = SvtWPAagentGlobalParameters.getInstance()

        # Load configuration depending on flag
        if self.get_from_db:
            print("WaferProberControl: loading configuration from DB")
            # Prefer the specialized DB service, but keep fallback to globals loader
            try:
                self.fetch_parameters_from_db()
            except Exception as e:
                print(f"Warning: fetch from DB failed ({e}), falling back to globals.load_from_db()")
                self.globals.load_from_db()
        else:
            print("WaferProberControl: loading configuration from provided config or JSON")
            if isinstance(self._config, dict) and self._config:
                self.globals.load_from_dict(self._config)
            else:
                # no dict provided; no-op — user can call `load_config_from_json` or `load_config_dict`
                pass

    # Configuration management helpers
    def load_config_from_json(self, json_path: str):
        """Load configuration from a JSON file and apply to globals."""
        with open(json_path, "r") as f:
            cfg = json.load(f)
        self._config = cfg
        self.globals.load_from_dict(cfg)

    def load_config_dict(self, cfg: Dict[str, Any]):
        """Load configuration from a provided dictionary."""
        self._config = cfg
        self.globals.load_from_dict(cfg)

    # Database interactions
    def fetch_parameters_from_db(self, timeout: float = 10.0):
        """Fetch useful parameters from the DB via KafkaDBService and apply to globals.

        This method demonstrates usage of the `KafkaDBService`. It is intentionally
        conservative: it queries enums such as chip types and orientations and uses
        the first available entries to populate global parameters where appropriate.
        """
        # Example: fetch chip types and orientations and set them in globals
        chip_types = self.db_service.get_chip_types(timeout=timeout)
        orientations = self.db_service.get_orientations(timeout=timeout)

        # Apply to globals conservatively
        cfg = {}
        if chip_types:
            cfg["chip_name"] = chip_types[0]
        if orientations:
            cfg["orientation"] = orientations[0]

        # If there are other DB-backed values, this is the place to fetch them
        # For now, call the globals loader to preserve any existing DB simulation
        try:
            self.globals.load_from_db()
        except Exception:
            # Best-effort: apply minimal cfg
            self.globals.load_from_dict(cfg)

    # Sequence execution APIs
    def execute_sequence(self, sequence: Any, blocking: bool = True):
        """Execute a sequence.

        sequence may be a sequence name, a dictionary describing steps, or a callable.
        This method is a placeholder to centralize sequence execution logic used by the agent.
        """
        print(f"Executing sequence: {sequence} (blocking={blocking})")

        # If sequence is a callable, call it
        if callable(sequence):
            result = sequence()
            return result

        # If sequence is a list/dict, implement sequence runner here (placeholder)
        # For now we only simulate execution
        if blocking:
            print("Sequence execution completed (simulated)")
            return True
        else:
            # run in a separate thread if non-blocking
            import threading

            def _runner():
                print("Sequence started (background simulated)")
                try:
                    import time

                    time.sleep(1)
                except Exception:
                    pass
                print("Sequence finished (background simulated)")

            thread = threading.Thread(target=_runner, daemon=True)
            thread.start()
            return thread

    def get_status(self) -> Dict[str, Any]:
        """Return a small status summary for the control object and globals."""
        return {
            "get_from_db": self.get_from_db,
            "global_info": self.globals.get_info()
        }

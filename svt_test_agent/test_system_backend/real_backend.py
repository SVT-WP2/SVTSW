"""
SVT Test Agent real backend.

This backend defines the interface to a real test system. It uses a
ConnectionHandle placeholder to represent the underlying communication
mechanism (REST, gRPC, sockets, DLLs, etc.), which can be populated
with a concrete implementation later.

Location: svt_test_agent/test_system_backend/real_backend.py
"""

import logging
import threading
from typing import Any, Dict, Iterable, Optional, Tuple

from .interface import ITestBackend

logger = logging.getLogger("RealBackend")
JsonDict = Dict[str, Any]


class ConnectionHandle:
    """
    Placeholder for your real connection (REST/gRPC/socket/DLL/etc.).
    Fill methods with your actual implementation later.
    """

    def __init__(self, **kwargs):
        self.connected = False
        self.kwargs = kwargs

    def connect(self):
        # TODO: open session/authenticate/etc.
        # e.g., self.session = requests.Session(); self.session.post(...)
        self.connected = True

    def close(self):
        # TODO: cleanly close/cleanup
        self.connected = False

    def start_job(self, chip_type: str, test_name: str, params: JsonDict) -> str:
        # TODO: send job to your system and return job_id
        return "job-123"

    def get_status(self, job_id: str) -> Dict[str, Any]:
        # TODO: poll your system for status/results
        # Return shape suggestion:
        # {
        #   "running": True/False,
        #   "success": True/False,
        #   "message": str,
        #   "results": {"inputs": {...}, "outputs": {...}} or
        #   "error": "..."
        # }
        return {
            "running": False,
            "success": True,
            "message": "Completed",
            "results": {"inputs": {}, "outputs": {}},
        }

    def cancel_job(self, job_id: str):
        # TODO: send cancel/abort signal to system
        pass


class RealBackend(ITestBackend):
    """
    Real system backend.

    Uses ConnectionHandle (placeholder) so you can keep connection
    details undecided for now while wiring up the overall backend
    contract.
    """

    def __init__(self, **conn_kwargs):
        self._conn_kwargs = conn_kwargs
        self._conn: Optional[ConnectionHandle] = None
        self._job_id: Optional[str] = None

    def _ensure_connected(self):
        if self._conn is None:
            self._conn = ConnectionHandle(**self._conn_kwargs)
            self._conn.connect()
            logger.info("RealBackend connected with %s", self._conn_kwargs)
        elif not self._conn.connected:
            self._conn.connect()
            logger.info("RealBackend reconnected")

    def initialize(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> None:
        self._ensure_connected()
        if abort.is_set():
            return
        logger.info(
            "RealBackend: initialize %s/%s with params=%s",
            chip_type,
            test_name,
            params,
        )

    def run(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> Iterable[Tuple[Any, str, str]]:
        self._ensure_connected()

        # 1) start job
        self._job_id = self._conn.start_job(chip_type, test_name, params)
        logger.info("RealBackend: started job %s", self._job_id)

        # 2) poll
        while True:
            # TODO

            if abort.is_set():
                self._conn.cancel_job(self._job_id)
                logger.info("RealBackend: aborted job %s", self._job_id)
                return
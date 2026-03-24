"""
SVT Test Agent backend interface.

Defines the abstract backend contract that all test-system backends
must implement. Backends are responsible for initializing a test
environment and streaming progress/status updates during execution.

Location: svt_test_agent/test_system_backend/interface.py
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, Tuple
import threading

JsonDict = Dict[str, Any]


class ITestBackend(ABC):
    """
    Contract for test-system backends:

      • initialize(): prepare the backend for a test.
      • run(): execute the test and yield progress tuples in the form
          (values_or_error, status, message)
        where status ∈ {"TestRunning", "TestSuccess", "TestFail"}.

    Backends must regularly check `abort.is_set()` and terminate early
    if an abort request is detected.
    """

    @abstractmethod
    def initialize(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def run(
        self,
        chip_type: str,
        test_name: str,
        params: JsonDict,
        abort: threading.Event,
    ) -> Iterable[Tuple[Any, str, str]]:
        raise NotImplementedError
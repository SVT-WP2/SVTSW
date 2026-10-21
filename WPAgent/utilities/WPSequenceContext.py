"""
WPSequenceContext - marks the span of a *trusted* built-in sequence.

A trusted sequence is one of the fixed YAML sequences registered in COMMAND_ROUTER
(TakeImage*, BrightnessCorrection). The caller is checked ONCE, when the sequence
command itself is validated (it is an expert command). While the sequence runs,
its individual steps may use commands that are normally developer-only:

  * the per-step hierarchy check is skipped      (WPValidator._validate_user_permission)
  * the per-step state-machine check is skipped  (WPCmdMap.execute_command)
  * steps do not change the state machine state  (WPAgentStateMachine.transition),
    so the agent is back in the state it had before the sequence when it ends
    (an error inside a step still enters the Error state)

Everything else still applies to every step: agent name, login, testing lock,
parameter schemas and orientation checks.

Custom sequence files (RunSequencer / RunSequencerYAML) are never trusted.
"""

import contextvars
from contextlib import contextmanager

_trusted_sequence = contextvars.ContextVar("wp_trusted_sequence", default=None)


@contextmanager
def trusted_sequence(name: str):
    token = _trusted_sequence.set(name)
    try:
        yield
    finally:
        _trusted_sequence.reset(token)


def in_trusted_sequence() -> bool:
    return _trusted_sequence.get() is not None


def current_trusted_sequence():
    return _trusted_sequence.get()

from enum import Enum, auto

class SvtWpAgentState(Enum):
    Idle = auto()
    Running = auto()
    Retrying = auto()
    Failed = auto()
    Aborted = auto()

class SvtWpAgentEvent(Enum):
    Start = auto()
    Success = auto()
    Error = auto()
    Abort = auto()

class SvtWpAgentStateMachine:
    def __init__(self, maxRetries=3):
        self.state = SvtWpAgentState.Idle
        self.retryCount = 0
        self.maxRetries = maxRetries

    def updateState(self, event: SvtWpAgentEvent):
        if self.state in [SvtWpAgentState.Idle, SvtWpAgentState.Retrying] and event == SvtWpAgentEvent.Start:
            self.state = SvtWpAgentState.Running

        elif self.state == SvtWpAgentState.Running:
            if event == SvtWpAgentEvent.Success:
                self._reset()
            elif event == SvtWpAgentEvent.Error:
                self.retryCount += 1
                self.state = SvtWpAgentState.Retrying if self.retryCount <= self.maxRetries else SvtWpAgentState.Failed

        elif self.state == SvtWpAgentState.Retrying:
            if event == SvtWpAgentEvent.Success:
                self._reset()
            elif event == SvtWpAgentEvent.Error:
                self.retryCount += 1
                self.state = SvtWpAgentState.Retrying if self.retryCount <= self.maxRetries else SvtWpAgentState.Failed

        elif self.state == SvtWpAgentState.Failed and event == SvtWpAgentEvent.Abort:
            self.state = SvtWpAgentState.Aborted

    def _reset(self):
        self.state = SvtWpAgentState.Idle
        self.retryCount = 0

    def abort(self):
        self.updateState(SvtWpAgentEvent.Abort)

    def reset(self):
        self._reset()

    def getState(self):
        return self.state

    def isReadyToExecute(self):
        return self.state in [SvtWpAgentState.Idle, SvtWpAgentState.Retrying]

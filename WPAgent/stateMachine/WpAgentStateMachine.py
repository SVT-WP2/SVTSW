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
        self.current_command = None  # Track what's currently executing

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
        self.current_command = None

    def abort(self):
        self.updateState(SvtWpAgentEvent.Abort)

    def reset(self):
        self._reset()

    def getState(self):
        return self.state

    def isReadyToExecute(self):
        """Check if agent is ready to accept new commands"""
        return self.state in [SvtWpAgentState.Idle, SvtWpAgentState.Retrying]

    def isBusy(self):
        """Check if agent is currently processing a command"""
        return self.state == SvtWpAgentState.Running

    def isInProcess(self):
        """Alias for isBusy() - check if command is in process"""
        return self.isBusy()

    def setCurrentCommand(self, command_name: str):
        """Set the currently executing command name"""
        self.current_command = command_name

    def getCurrentCommand(self):
        """Get the currently executing command name"""
        return self.current_command

    def canExecute(self, command_name: str = None):
        """
        Check if a command can be executed.
        Returns (can_execute: bool, reason: str)
        """
        if self.isBusy():
            return False, f"Agent is busy executing '{self.current_command}'. Please wait."

        if not self.isReadyToExecute():
            return False, f"Agent is in '{self.state.name}' state. Cannot execute commands."

        return True, "Ready"
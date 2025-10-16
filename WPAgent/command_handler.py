from cmd_map import COMMAND_ROUTER, execute_command
from WPAgentUtilities.WPAgentLogger import WPAgentLogger, Severity

#Initialisation of the logger
logger = WPAgentLogger()


class CommandHandler:
    _instance = None

    def __init__(self):
        pass

    @classmethod
    def getInstance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def listAvailableCommands(self):
        commands = list(COMMAND_ROUTER.keys())
        logger.log_command(
            messageOut="Available commands listed",
            severityLevel=Severity.INFO,
            command="WP_LIST_AVAILABLE_COMMANDS",
            params=None,
            result={"available_commands": commands}
        )
        return commands

    def handleCommand(self, command, params=None):
        return execute_command(command, params)
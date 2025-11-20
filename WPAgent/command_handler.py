from utilities.WPAgentLogger import WPAgentLogger, Severity

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

    def listAvailableCommands(self, commands_list):
        return list(commands_list.keys())

    def handleCommand(self, command, params=None):
        from cmd_map import execute_command
        return execute_command(command, params)
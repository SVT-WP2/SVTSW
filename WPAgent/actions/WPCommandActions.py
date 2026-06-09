import json
from WPCommandHandler import CommandHandler
from utilities.WPResponseBuilder import ResponseBuilder


def list_available_commands(router, user=None, waferAgentName=None, **kwargs):
    commands = list(router.keys())
    formatted = json.dumps({"available_commands": commands}, indent=4)
    return ResponseBuilder.success("ListAvailableCommandsReply", formatted)

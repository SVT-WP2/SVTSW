import json
from command_handler import CommandHandler

def list_available_commands(router, **kwargs):
    handler = CommandHandler.getInstance()
    commands = list(router.keys()) 
    result = {
        "status": "success",
        "available_commands": commands,
        "output": f"{len(commands)} commands available"
    }
    formatted_result = json.dumps(result, indent=4)
    return {"status": "success", "output": formatted_result}
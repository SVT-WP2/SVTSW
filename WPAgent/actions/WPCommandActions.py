from command_handler import CommandHandler

def list_available_commands(router, **kwargs):
    handler = CommandHandler.getInstance()
    commands = list(router.keys()) 
    result_lines = ["status: success", "available_commands:"] + [f"  - {cmd}" for cmd in commands] + [f"output: {len(commands)} commands available"]
    formatted_result = "\n".join(result_lines)
    return {"status": "success", "output": formatted_result}
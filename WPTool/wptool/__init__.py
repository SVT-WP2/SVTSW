"""The WP tool: a stateless command-line tool for the wafer prober (plan #405, phase 1).

Every request is independent (D10): the tool keeps only its connection to the machine.
"""

__version__ = "0.1.0"

# The name of the tool and the version of the tool contract (Documentation/Tools/tool-contract.md).
TOOL_NAME = "wp-tool"
CONTRACT_VERSION = "0.1"

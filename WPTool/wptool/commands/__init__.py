"""The commands of the tool. Importing this package registers every command module in `wptool.registry.REGISTRY`.

The test-only commands (`_testing`) are registered only when the environment variable WPTOOL_TESTING is 1.
"""

import os

from wptool.commands import connect, frame

if os.environ.get("WPTOOL_TESTING") == "1":
    from wptool.commands import _testing

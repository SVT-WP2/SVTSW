"""pytest setup of svt-wp-core. The SENTIO library is stubbed as in WPAgent/tests/conftest.py, so no test needs a prober."""

import sys
from unittest.mock import MagicMock

# ── Stub the SENTIO hardware SDK ───────────────────────────────────────────────
# sentio_prober_control is a hardware SDK whose installed version may be
# incomplete (e.g. missing ChuckXYReference in 25.2.1).  We stub the whole
# package here at MODULE LEVEL — before pytest collects any test files — so
# that the import chain WPLoginActions → WPTestingActions → WPFactory →
# WPSentioProber → sentio_prober_control is short-circuited cleanly.
# MagicMock auto-creates any attribute (ChuckXYReference, SentioProber, …)
# on first access, so no ImportError is raised.
_sentio_stub = MagicMock()
for _mod_name in [
    "sentio_prober_control",
    "sentio_prober_control.Sentio",
    "sentio_prober_control.Sentio.Enumerations",
    "sentio_prober_control.Sentio.ProberSentio",
    "sentio_prober_control.Sentio.Response",
    "sentio_prober_control.Communication",
    "sentio_prober_control.Sentio.CommandGroups",
]:
    sys.modules.setdefault(_mod_name, _sentio_stub)

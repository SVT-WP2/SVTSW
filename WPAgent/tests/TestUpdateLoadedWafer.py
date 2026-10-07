"""
Tests for the developer-only UpdateLoadedWafer command (fix wafer orientation in DB).

Run:  python3 -m pytest tests/unit/TestUpdateLoadedWafer.py -q
"""

import pytest
from unittest.mock import MagicMock, patch

import actions.WPDataBaseActions  # noqa: F401  (registers submodule for patch())
import WPCmdMap
from stateMachine.WpAgentStateMachine import WPAgentState as S
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine as sm


def _login(g, hierarchy="Developer"):
    g.wpAgentName = "T"
    g.wpMachineId = 5
    g.set_user("u1", hierarchy)


def _run(data, db=None):
    d = dict(data, user="u1", waferAgentName="T")
    db = db or MagicMock()
    with patch("actions.WPDataBaseActions._get_db_client", return_value=db):
        return WPCmdMap.execute_command("UpdateLoadedWafer", d), db


def _code(r):
    return (r.get("error") or {}).get("code")


@pytest.fixture(autouse=True)
def _reset_state():
    yield
    sm.force_state(S.ServiceOn)


class TestUpdateLoadedWafer:
    def test_developer_updates_orientation_in_db_and_globals(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 7, "orientation": "west"})
        assert r["status"] == "Success"
        db.update_machine_loaded_wafer.assert_called_once()
        kw = db.update_machine_loaded_wafer.call_args.kwargs
        assert kw["wafer_id"] == 7 and kw["orientation"] == "West" and kw["wp_machine_id"] == 5
        assert globals_instance.wafer_orientation == "West"
        assert globals_instance.loaded_wafer_id == 7

    def test_reply_type_is_command_reply(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, _ = _run({"waferId": 7, "orientation": "East"})
        assert r["type"] == "UpdateLoadedWaferReply"

    @pytest.mark.parametrize("hierarchy", ["User", "Expert"])
    def test_non_developers_are_forbidden(self, globals_instance, hierarchy):
        _login(globals_instance, hierarchy)
        globals_instance.set_wafer_loaded(7, "Unknown")
        r, db = _run({"waferId": 7, "orientation": "West"})
        assert _code(r) in (403, 409)
        db.update_machine_loaded_wafer.assert_not_called()

    def test_requires_login(self, globals_instance):
        globals_instance.wpAgentName = "T"
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 7, "orientation": "West"})
        assert r["status"] != "Success"
        db.update_machine_loaded_wafer.assert_not_called()

    def test_wrong_agent_name_rejected(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        db = MagicMock()
        with patch("actions.WPDataBaseActions._get_db_client", return_value=db):
            r = WPCmdMap.execute_command(
                "UpdateLoadedWafer", {"waferId": 7, "orientation": "West", "user": "u1", "waferAgentName": "OTHER"}
            )
        assert _code(r) == 403
        db.update_machine_loaded_wafer.assert_not_called()

    def test_no_wafer_loaded(self, globals_instance):
        _login(globals_instance)
        globals_instance.loaded_wafer_id = None
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 7, "orientation": "West"})
        assert _code(r) == 400
        db.update_machine_loaded_wafer.assert_not_called()

    def test_wafer_id_must_match_loaded_wafer(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 8, "orientation": "West"})
        assert _code(r) == 400
        db.update_machine_loaded_wafer.assert_not_called()
        assert globals_instance.loaded_wafer_id == 7

    @pytest.mark.parametrize("bad", ["flat_down", "up", "", "Westish"])
    def test_invalid_orientation_rejected(self, globals_instance, bad):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 7, "orientation": bad})
        assert _code(r) == 400
        db.update_machine_loaded_wafer.assert_not_called()

    def test_missing_params_rejected_by_schema(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"waferId": 7})
        assert r["status"] != "Success"
        db.update_machine_loaded_wafer.assert_not_called()

    def test_db_failure_is_reported_and_globals_unchanged(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_wafer_loaded(7, "North")
        sm.force_state(S.UsedByDeveloper)
        db = MagicMock()
        db.update_machine_loaded_wafer.return_value = None
        r, _ = _run({"waferId": 7, "orientation": "West"}, db)
        assert r["status"] != "Success"
        assert _code(r) == 500
        assert r["type"] == "UpdateLoadedWaferReply"
        assert globals_instance.wafer_orientation == "North"

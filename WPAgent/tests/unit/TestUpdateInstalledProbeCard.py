"""
Tests for the developer-only UpdateInstalledProbeCard command (fix probe card
orientation in DB).

Run:  python3 -m pytest tests/unit/TestUpdateInstalledProbeCard.py -q
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
        return WPCmdMap.execute_command("UpdateInstalledProbeCard", d), db


def _code(r):
    return (r.get("error") or {}).get("code")


@pytest.fixture(autouse=True)
def _reset_state():
    yield
    sm.force_state(S.ServiceOn)


class TestUpdateInstalledProbeCard:
    def test_developer_updates_orientation_in_db_and_globals(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 2, "orientation": "west"})
        assert r["status"] == "Success"
        db.update_machine_installed_probe_card.assert_called_once()
        kw = db.update_machine_installed_probe_card.call_args.kwargs
        assert kw["probe_card_id"] == 2 and kw["orientation"] == "West" and kw["wp_machine_id"] == 5
        assert globals_instance.probe_card_orientation == "West"
        assert globals_instance.probe_card_id == 2

    def test_reply_type_is_command_reply(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, _ = _run({"probeCardId": 2, "orientation": "East"})
        assert r["type"] == "UpdateInstalledProbeCardReply"

    @pytest.mark.parametrize("hierarchy", ["User", "Expert"])
    def test_non_developers_are_forbidden(self, globals_instance, hierarchy):
        _login(globals_instance, hierarchy)
        globals_instance.set_probe_card(2, "Unknown")
        r, db = _run({"probeCardId": 2, "orientation": "West"})
        assert _code(r) in (403, 409)
        db.update_machine_installed_probe_card.assert_not_called()

    def test_requires_login(self, globals_instance):
        globals_instance.wpAgentName = "T"
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 2, "orientation": "West"})
        assert r["status"] != "Success"
        db.update_machine_installed_probe_card.assert_not_called()

    def test_wrong_agent_name_rejected(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        db = MagicMock()
        with patch("actions.WPDataBaseActions._get_db_client", return_value=db):
            r = WPCmdMap.execute_command(
                "UpdateInstalledProbeCard",
                {"probeCardId": 2, "orientation": "West", "user": "u1", "waferAgentName": "OTHER"},
            )
        assert _code(r) == 403
        db.update_machine_installed_probe_card.assert_not_called()

    def test_no_probe_card_installed(self, globals_instance):
        _login(globals_instance)
        globals_instance.probe_card_id = None
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 2, "orientation": "West"})
        assert _code(r) == 400
        db.update_machine_installed_probe_card.assert_not_called()

    def test_probe_card_id_must_match_installed_card(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 3, "orientation": "West"})
        assert _code(r) == 400
        db.update_machine_installed_probe_card.assert_not_called()
        assert globals_instance.probe_card_id == 2

    @pytest.mark.parametrize("bad", ["flat_down", "up", "", "Westish"])
    def test_invalid_orientation_rejected(self, globals_instance, bad):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 2, "orientation": bad})
        assert _code(r) == 400
        db.update_machine_installed_probe_card.assert_not_called()

    def test_missing_orientation_rejected(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "Unknown")
        sm.force_state(S.UsedByDeveloper)
        r, db = _run({"probeCardId": 2})
        assert r["status"] != "Success"
        db.update_machine_installed_probe_card.assert_not_called()

    def test_db_failure_is_reported_and_globals_unchanged(self, globals_instance):
        _login(globals_instance)
        globals_instance.set_probe_card(2, "North")
        sm.force_state(S.UsedByDeveloper)
        db = MagicMock()
        db.update_machine_installed_probe_card.return_value = None
        r, _ = _run({"probeCardId": 2, "orientation": "West"}, db)
        assert r["status"] != "Success"
        assert _code(r) == 500
        assert r["type"] == "UpdateInstalledProbeCardReply"
        assert globals_instance.probe_card_orientation == "North"

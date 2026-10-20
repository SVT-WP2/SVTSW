"""
SentioProberImpl.is_alive: socket-level connection check that sends no command.

Run:  python3 -m pytest tests/unit/TestSentioIsAlive.py -q -p no:cacheprovider
"""

import socket
from unittest.mock import MagicMock

import pytest

from drivers.WPSentioProber import SentioProberImpl


@pytest.fixture
def pair():
    a, b = socket.socketpair()
    yield a, b
    for s in (a, b):
        s.close()


def _impl(sock):
    impl = object.__new__(SentioProberImpl)
    impl.prober = MagicMock()
    impl.prober.comm = MagicMock()
    impl.prober.comm._CommunicatorTcpIp__socket = sock
    return impl


def test_idle_open_connection_is_alive(pair):
    a, _ = pair
    impl = _impl(a)
    assert impl.is_alive() is True
    impl.prober.send_cmd.assert_not_called()


def test_pending_data_is_alive_and_not_consumed(pair):
    a, b = pair
    b.send(b"x")
    assert _impl(a).is_alive() is True
    assert a.recv(1) == b"x"


def test_peer_closed_is_dead(pair):
    a, b = pair
    b.close()
    assert _impl(a).is_alive() is False


def test_locally_closed_socket_is_dead(pair):
    a, _ = pair
    a.close()
    assert _impl(a).is_alive() is False


def test_unreachable_socket_assumed_alive():
    impl = object.__new__(SentioProberImpl)
    impl.prober = MagicMock(spec=["comm"])
    impl.prober.comm = object()
    assert impl.is_alive() is True


def test_keepalive_enabled_on_the_socket(pair):
    a, _ = pair
    impl = _impl(a)
    impl._enable_keepalive()
    if hasattr(socket, "SO_KEEPALIVE") and not hasattr(socket, "SIO_KEEPALIVE_VALS"):
        assert a.getsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE) != 0

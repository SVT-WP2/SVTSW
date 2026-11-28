"""A recording fake of the SENTIO library (`sentio_prober_control` 24.4.0), for the shared SENTIO driver. No network.

`install(monkeypatch)` puts the fake modules into `sys.modules`, imports the shared `WPSentioProber` again on them, and
gives `(SentioProberImpl, library)`: every call of the driver on the library is in `library.calls` as
`(name, args)`, `name` with its group (`map.step_die`, `vision.find_home`, `status.get_prop`). The answers have the
types that the library returns (read from its source): `map.get_num_dies` an int, `get_chuck_xy` two floats,
`send_cmd` a response with `message()`, ...

The real modules are put back at the end of the test.
"""

from __future__ import annotations

import enum
import importlib
import sys
import types

DRIVER = "svt_wp_core.drivers.WPSentioProber"
LIBRARY_MODULES = (
    "sentio_prober_control",
    "sentio_prober_control.Sentio",
    "sentio_prober_control.Sentio.Enumerations",
    "sentio_prober_control.Sentio.ProberSentio",
    "sentio_prober_control.Sentio.Response",
)


class _Abbr(enum.Enum):
    def toSentioAbbr(self):
        return self.name


class ChuckXYReference(_Abbr):
    Zero = 0
    Home = 1
    Relative = 2
    Center = 3
    User = 4


class ChuckZReference(_Abbr):
    Zero = 0
    Relative = 1
    Contact = 2
    Separation = 3


class WorkArea(_Abbr):
    Probing = 0
    Offaxis = 1


class DieNumber(_Abbr):
    Present = 0
    Selected = 1


class ChuckSite(_Abbr):
    Wafer = 0


class CameraMountPoint(_Abbr):
    Scope = 0
    OffAxis = 1


class SnapshotType(_Abbr):
    CameraRaw = 0
    WithOverlays = 1


class SnapshotLocation(_Abbr):
    Local = 0
    Prober = 1


class LoadPosition(_Abbr):
    Front = 0
    Center = 1


class FakeResponse:
    def __init__(self, message: str = "", cmd_id: int = 0):
        self._message = message
        self._cmd_id = cmd_id

    def ok(self) -> bool:
        return True

    def message(self) -> str:
        return self._message

    def cmd_id(self) -> int:
        return self._cmd_id


class Answers:
    """What the fake library answers; a test may change a value."""

    def __init__(self):
        self.current_index = "46,0,0"  # map:die:get_current_index (the format that WPAgent reads)
        self.position_hint = "OffAxisCamera"  # get_chuck_position_hint, first part
        self.z_position_hint = "Separation"  # status:get_prop Z_Position_Hint, chuck
        self.num_dies = 180
        self.xy = (1000.0, -2000.0)
        self.z = 9800.0
        self.site_heights = (10000.0, 200.0, 0.0, 0.0)
        self.focus = 15300.0


class FakeLibrary:
    """The calls of the driver on the library, and the answers."""

    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []
        self.answers = Answers()
        self.addresses: list[str] = []

    def record(self, name: str, *args) -> None:
        self.calls.append((name, args))


class _Group:
    def __init__(self, library: FakeLibrary, prefix: str):
        self._library = library
        self._prefix = prefix


class _Map(_Group):
    def step_die(self, col, row, site=0):
        self._library.record("map.step_die", col, row, site)
        return int(col), int(row), int(site)

    def step_next_die(self):
        self._library.record("map.step_next_die")
        return 0, 0, 0

    def get_num_dies(self, selection):
        self._library.record("map.get_num_dies", selection)
        return int(self._library.answers.num_dies)


class _Vision(_Group):
    def find_home(self):
        self._library.record("vision.find_home")
        return FakeResponse()

    def auto_focus(self, *args):
        self._library.record("vision.auto_focus", *args)
        return float(self._library.answers.focus)

    def align_wafer(self, *args):
        self._library.record("vision.align_wafer", *args)

    def switch_camera(self, mount):
        self._library.record("vision.switch_camera", mount)


class _Status(_Group):
    def get_prop(self, name, arg=None):
        self._library.record("status.get_prop", name, arg)
        answer = self._library.answers.z_position_hint
        if isinstance(answer, BaseException):
            raise answer
        return answer


class _Comm:
    """No `_CommunicatorTcpIp__socket`: the driver then skips the keepalive and takes the connection as alive."""

    def __init__(self, library: FakeLibrary):
        self._library = library

    def disconnect(self):
        self._library.record("comm.disconnect")


class FakeSentioProber:
    def __init__(self, library: FakeLibrary):
        self._library = library
        self.comm = _Comm(library)
        self.map = _Map(library, "map")
        self.vision = _Vision(library, "vision")
        self.status = _Status(library, "status")

    def _r(self, name, *args):
        self._library.record(name, *args)

    def local_mode(self):
        self._r("local_mode")

    def open_project(self, project, restore_heights=False):
        self._r("open_project", project, restore_heights)

    def move_chuck_xy(self, ref, x, y):
        self._r("move_chuck_xy", ref, x, y)
        if ref is None:
            # The real library: None.toSentioAbbr() fails before anything is sent.
            raise AttributeError("'NoneType' object has no attribute 'toSentioAbbr'")
        return float(x), float(y)

    def move_chuck_z(self, ref, z):
        self._r("move_chuck_z", ref, z)
        return float(z)

    def move_chuck_home(self):
        self._r("move_chuck_home")
        return self._library.answers.xy

    def move_chuck_contact(self):
        self._r("move_chuck_contact")
        return self._library.answers.site_heights[0]

    def move_chuck_separation(self):
        self._r("move_chuck_separation")
        return self._library.answers.site_heights[0] - self._library.answers.site_heights[1]

    def move_chuck_work_area(self, area):
        self._r("move_chuck_work_area", area)
        return FakeResponse()

    def enable_chuck_overtravel(self, stat):
        self._r("enable_chuck_overtravel", stat)
        return FakeResponse()

    def get_chuck_xy(self, site, ref):
        self._r("get_chuck_xy", site, ref)
        return self._library.answers.xy

    def get_chuck_z(self, ref):
        self._r("get_chuck_z", ref)
        return float(self._library.answers.z)

    def get_chuck_site_height(self, site):
        self._r("get_chuck_site_height", site)
        return self._library.answers.site_heights

    def send_cmd(self, cmd):
        self._r("send_cmd", cmd)
        answers = self._library.answers
        if cmd == "map:die:get_current_index":
            return FakeResponse(answers.current_index)
        if cmd == "get_chuck_position_hint":
            return FakeResponse(answers.position_hint)
        return FakeResponse("", cmd_id=7)

    def wait_complete(self, id_or_resp, timeout=300):
        self._r("wait_complete", id_or_resp)
        return FakeResponse()


def install(monkeypatch):
    """The fake library in `sys.modules`, the shared driver imported on it: `(SentioProberImpl, library)`."""
    library = FakeLibrary()

    class SentioProber:
        @staticmethod
        def create_prober(comm_type, address):
            library.addresses.append(address)
            library.record("create_prober", comm_type, address)
            return FakeSentioProber(library)

    root = types.ModuleType("sentio_prober_control")
    sentio = types.ModuleType("sentio_prober_control.Sentio")
    enumerations = types.ModuleType("sentio_prober_control.Sentio.Enumerations")
    prober_sentio = types.ModuleType("sentio_prober_control.Sentio.ProberSentio")
    response = types.ModuleType("sentio_prober_control.Sentio.Response")
    for cls in (ChuckXYReference, ChuckZReference, WorkArea, DieNumber, ChuckSite, CameraMountPoint, SnapshotType, SnapshotLocation, LoadPosition):
        setattr(enumerations, cls.__name__, cls)
    prober_sentio.SentioProber = SentioProber
    response.Response = FakeResponse
    sentio.Enumerations = enumerations
    sentio.ProberSentio = prober_sentio
    sentio.Response = response
    root.Sentio = sentio
    modules = dict(zip(LIBRARY_MODULES, (root, sentio, enumerations, prober_sentio, response)))
    for name in (*LIBRARY_MODULES, DRIVER):
        # monkeypatch puts the real module back (or removes the fake one) at the end of the test.
        if name in sys.modules:
            monkeypatch.setitem(sys.modules, name, sys.modules[name])
        else:
            monkeypatch.setitem(sys.modules, name, None)
    for name, module in modules.items():
        sys.modules[name] = module
    del sys.modules[DRIVER]
    driver = importlib.import_module(DRIVER)
    return driver.SentioProberImpl, library

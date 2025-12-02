from sentio_prober_control.Sentio.ProberSentio import SentioProber
from sentio_prober_control.Sentio.Enumerations import *
from interfaces.prober_interface import AbstractProber


class SentioProberImpl(AbstractProber):
    def __init__(self, address):
        self.prober = SentioProber.create_prober("tcpip", address)
        self.prober.initialize_if_needed()

    def initialize(self):
        self.prober.initialize_if_needed()

    def open_project(self, path: str):
        self.prober.open_project(path)

    def move_chuck_xy(self, x: float, y: float):
        return self.prober.move_chuck_xy(ChuckXYReference.Zero, x, y)

    def move_chuck_z(self, z: float):
        return self.prober.move_chuck_z(ChuckXYReference.Zero, z)

    def run_ptpa(self):
        # self.prober.vision.switch_camera(CameraMountPoint.OffAxis)
        # self.prober.vision.auto_focus()
        # TODO: Have to be tested
        # self.prober.vision.compensation.start_execute(mode='OffAxis',type='BothWithProbeTips')
        resp = self.prober.send_cmd("vis:compensation:start_execute OffAxis, BothWithProbeTips, True")
        # self.prober.wait_complete(resp.cmd_id())

    def step_next_die(self):
        return self.prober.map.step_next_die()

    def step_prev_die(self):
        return self.prober.send_cmd("map:step_previous_die")


    def go_to_die(self, col: int, row: int):
        return self.prober.map.step_die(col, row)

    def switch_camera(self, mount_point: str):
        from sentio_prober_control.Sentio.Enumerations import CameraMountPoint
        cam_enum = getattr(CameraMountPoint, mount_point)
        self.prober.vision.switch_camera(cam_enum)

    def move_chuck_home(self):
        self.prober.move_chuck_home()

    def unload_wafer(self):
        self.prober.move_chuck_load(LoadPosition.Front)

    def local_mode(self):
        self.prober.local_mode()

    def load_wafer(self):
        self.prober.move_chuck_load(LoadPosition.Center)

    def find_home(self):
        self.prober.vision.find_home()

    def align_wafer(self, alig_die_col: int, alig_die_row: int, subsite: int = 0):
        col, row, sub = self.prober.map.step_die(alig_die_col, alig_die_row, subsite)
        print(f"Column Index {col}, Row Index {row}, Subsite Index: {sub}")
        # TODO : Have to be tested
        self.prober.vision.align_wafer()
        # reps = self.prober.send_cmd(f"vis:align_wafer")
        # self.prober.wait_complete(reps.cmd_id())

    def go_to_contact(self):
        self.prober.move_chuck_contact()

    def go_to_separation(self):
        self.prober.move_chuck_separation()

    def auto_focus(self):
        self.prober.vision.auto_focus()

    def move_chuck_work_area(self, work_area):
        from sentio_prober_control.Sentio.Enumerations import WorkArea
        try:
            work_area_enum = getattr(WorkArea, work_area)
        except AttributeError:
            valid_areas = [e.name for e in WorkArea]
            raise ValueError(f"Invalid work area '{work_area}'. Valid options are: {valid_areas}")
        self.prober.move_chuck_work_area(work_area_enum)

    def get_current_index(self):
        resp = self.prober.send_cmd("map:die:get_current_index")

        if hasattr(resp, 'message'):
            return resp.message()
        elif hasattr(resp, 'data'):
            return resp.data()
        elif hasattr(resp, 'value'):
            return resp.value()
        else:
            # Last resort - convert to string
            return str(resp)

    def get_dies_number(self):

        resp = self.prober.map.get_num_dies(DieNumber.Selected)

        if hasattr(resp, 'message'):
            return resp.message()
        elif hasattr(resp, 'data'):
            return resp.data()
        elif hasattr(resp, 'value'):
            return resp.value()
        else:
            # Last resort - convert to string
            return str(resp)

    def get_camera_status(self):
        resp = "doesnt exist"
        return resp

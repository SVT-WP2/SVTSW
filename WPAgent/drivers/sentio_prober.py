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
        zero_x, zero_y = self.prober.get_chuck_xy("Wafer", "Zero")
        return self.prober.move_chuck_xy("Zero", zero_x + x, zero_y + y)

    def run_ptpa(self):
        self.prober.vision.switch_camera(CameraMountPoint.OffAxis)
        self.prober.vision.auto_focus()
        #TODO: Have to be tested
        self.prober.vision.compensation.start_execute(mode='OffAxis',type='BothWithProbeTips')
        # resp = self.prober.send_cmd("vis:compensation:start_execute OffAxis, BothWithProbeTips, True")
        # self.prober.wait_complete(resp.cmd_id())

    def step_next_die(self):
        return self.prober.map.step_next_die()

    def go_to_die(self, col: int, row: int):
        return self.prober.map.step_die(col,row)

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

    def align_wafer(self, home_die_col, home_die_row, subsite=None ):
        col, row, sub = self.prober.map.step_die(home_die_col, home_die_row, subsite)
        print(f"Column Index {col}, Row Index {row}, Subsite Index: {sub}")
        #TODO : Have to be tested
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

    

    



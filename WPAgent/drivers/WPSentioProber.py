from sentio_prober_control.Sentio.ProberSentio import SentioProber
from sentio_prober_control.Sentio.Enumerations import *
from interfaces.WPProberInterface import AbstractProber
from sentio_prober_control.Sentio.Enumerations import ChuckXYReference, ChuckZReference
from sentio_prober_control.Sentio import Response


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

    def move_chuck_center(self):
        resp = self.prober.send_cmd("move_chuck_center")
        #self.prober.wait_complete()

    def move_chuck_z(self, z: float):
        return self.prober.move_chuck_z(ChuckZReference.Zero, z)

    def run_ptpa(self):
        resp = self.prober.send_cmd("vis:compensation:start_execute OffAxis, BothWithProbeTips, True")

        if not resp.ok():
            raise Exception(f"PTPA failed: {resp.message()}")

        self.prober.wait_complete(resp.cmd_id())
        print(resp.message())

    def step_next_die(self):
        return self.prober.map.step_next_die()

    def step_prev_die(self):
        return self.prober.send_cmd("map:step_previous_die")

    def go_to_die(self, col: int, row: int):
        return self.prober.map.step_die(col, row)

    def switch_camera(self, mountPoint: str):
        from sentio_prober_control.Sentio.Enumerations import CameraMountPoint
        cam_enum = getattr(CameraMountPoint, mountPoint)
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
        resp = self.prober.vision.auto_focus()
        self.prober.wait_complete(resp.cmd_id())

    def move_chuck_work_area(self, work_area):
        from sentio_prober_control.Sentio.Enumerations import WorkArea
        try:
            work_area_enum = getattr(WorkArea, work_area)
        except AttributeError:
            valid_areas = [e.name for e in WorkArea]
            raise ValueError(f"Invalid work area '{work_area}'. Valid options are: {valid_areas}")
        self.prober.move_chuck_work_area(work_area_enum)

    def move_chuck_offaxis_area(self):
        self.prober.move_chuck_work_area(WorkArea.Offaxis)

    def move_chuck_wide(self):
        "Moving to probing area"
        self.prober.move_chuck_work_area(WorkArea.Probing)

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

    def set_overtravel(self, overtravelGap: float):
        "Sets overtravel gap for all chuck sites in μm"
        self.prober.send_cmd("set_chuck_overtravel_gap")

    def enable_overtravel(self, overtravel: bool):
        "overtravel (bool): True to enable, False to disable."
        self.prober.enable_chuck_overtravel(overtravel)

    def get_chuck_position(self):
        """
        Get current chuck position status.

        Returns exactly "In Contact" or "In Separation".

        Uses the Sentio Python library method:
            self.prober.status.get_prop("Z_Position_Hint", "chuck")

        Returns:
            str: "In Contact" or "In Separation"

        Example:
            >>> prober.get_chuck_position()
            "In Contact"

            >>> prober.get_chuck_position()
            "In Separation"
        """
        try:
            # Query position using Sentio library's status.get_prop() method
            # This sends: "status:get_prop Z_Position_Hint, chuck"
            # Response from Sentio: "0,0,Contact" or "0,0,Separation"
            # Library parses it and returns: "Contact" or "Separation"
            position = self.prober.status.get_prop("Z_Position_Hint", "chuck")

            # Convert to string and clean up
            position_str = str(position).strip()

            # Normalize to lowercase for comparison
            position_lower = position_str.lower()

            # Return formatted status: "In Contact" or "In Separation"
            if 'contact' in position_lower:
                return "In Contact"
            elif 'separation' in position_lower or 'sep' in position_lower:
                return "In Separation"
            else:
                # For any other position (Hover, Lift, Home, Overtravel)
                # Return as-is with "In " prefix
                return f"In {position_str}"

        except Exception as e:
            return f"Error: {str(e)}"

    def get_chuck_stage(self):
        try:
            # Query position using Sentio library's status.get_prop() method
            # This sends: "status:get_prop Z_Position_Hint, chuck"
            # Response from Sentio: "0,0,Contact" or "0,0,Separation"
            # Library parses it and returns: "Contact" or "Separation"
            position = self.prober.status.get_prop("Z_Position_Hint", "chuck")

            # Convert to string and clean up
            position_str = str(position).strip()

            # Normalize to lowercase for comparison
            position_lower = position_str.lower()

            # Return formatted status: "In Contact" or "In Separation"
            if 'contact' in position_lower:
                return "In Contact"
            elif 'separation' in position_lower or 'sep' in position_lower:
                return "In Separation"
            else:
                # For any other position (Hover, Lift, Home, Overtravel)
                # Return as-is with "In " prefix
                return f"In {position_str}"

        except Exception as e:
            return f"Error: {str(e)}"

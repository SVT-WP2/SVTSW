from sentio_prober_control.Sentio.ProberSentio import SentioProber
#from sentio_prober_control.Sentio import Enumerations -> would then require Enumerations.WorkArea ...
from sentio_prober_control.Sentio.Enumerations import CameraMountPoint, WorkArea, ChuckXYReference, ChuckZReference, SnapshotType, SnapshotLocation, LoadPosition, DieNumber, SnapshotType, SnapshotLocation 
from interfaces.WPProberInterface import AbstractProber
from sentio_prober_control.Sentio import Response


class SentioProberImpl(AbstractProber):
    def __init__(self, address):
        self.prober = SentioProber.create_prober("tcpip", address)
        self.prober.initialize_if_needed()

    def initialize(self):
        self.prober.initialize_if_needed()

    def open_project(self, path: str):
        self.prober.open_project(path, restore_heights=True)

    def move_chuck_xy(self, x: float, y: float, position: str):
        reference = None
        if position == "Zero":
            reference = ChuckXYReference.Zero
        elif position == "Relative":
            reference = ChuckXYReference.Relative
        elif position == "Center":
            reference = ChuckXYReference.Center
        return self.prober.move_chuck_xy(reference, x, y)

    def move_chuck_top_left(self, x: float, y: float, position: str):
        reference = ChuckXYReference.Center
        x = 20.0
        y = -15.0
        return self.prober.move_chuck_xy(reference, x, y)

    def move_chuck_top_right(self, x: float, y: float, position: str):
        reference = ChuckXYReference.Center
        x = -20.0
        y = -15.0
        return self.prober.move_chuck_xy(reference, x, y)

    def move_chuck_bottom_left(self, x: float, y: float, position: str):
        reference = ChuckXYReference.Center
        x = 20.0
        y = 15.0
        return self.prober.move_chuck_xy(reference, x, y)

    def move_chuck_bottom_right(self, x: float, y: float, position: str):
        reference = ChuckXYReference.Center
        x = -20.0
        y = 15.0
        return self.prober.move_chuck_xy(reference, x, y)

    def move_chuck_center(self):
        self.prober.send_cmd("move_chuck_center")
        # self.prober.wait_complete(resp.cmd_id())

    def move_chuck_z(self, z: float):
        return self.prober.move_chuck_z(ChuckZReference.Zero, z)

    def set_ptpa(self, enable: bool):
        """Enable or disable PTPA compensation"""
        resp = self.prober.send_cmd(f"vis:compensation:enable Both, {enable}")
        return resp

    def run_ptpa(self):
        resp = self.prober.send_cmd(
            "vis:compensation:start_execute OffAxis, BothWithProbeTips, True"
        )

        if not resp.ok():
            raise Exception(f"PTPA failed: {resp.message()}")

        self.prober.wait_complete(resp.cmd_id())

    def step_next_die(self):
        return self.prober.map.step_next_die()

    def step_prev_die(self):
        return self.prober.send_cmd("map:step_previous_die")

    def go_to_die(self, col: int, row: int):
        return self.prober.map.step_die(col, row)

    def switch_camera(self, mountPoint: str):
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

    def align_wafer(self, align_die_col: int, align_die_row: int, subsite: int = 0):
        col, row, sub = self.prober.map.step_die(align_die_col, align_die_row, subsite)
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

    def move_chuck_work_area(self, work_area):
        try:
            work_area_enum = getattr(WorkArea, work_area)
        except AttributeError:
            valid_areas = [e.name for e in WorkArea]
            raise ValueError(
                f"Invalid work area '{work_area}'. Valid options are: {valid_areas}"
            )
        self.prober.move_chuck_work_area(work_area_enum)

    def move_chuck_offaxis_area(self):
        self.prober.move_chuck_work_area(WorkArea.Offaxis)

    def move_chuck_wide(self):
        "Moving to probing area"
        self.prober.move_chuck_work_area(WorkArea.Probing)

    def get_current_index(self):
        resp = self.prober.send_cmd("map:die:get_current_index")

        if hasattr(resp, "message"):
            return resp.message()
        elif hasattr(resp, "data"):
            return resp.data()
        elif hasattr(resp, "value"):
            return resp.value()
        else:
            # Last resort - convert to string
            return str(resp)

    def get_dies_number(self):

        resp = self.prober.map.get_num_dies(DieNumber.Selected)

        if hasattr(resp, "message"):
            return resp.message()
        elif hasattr(resp, "data"):
            return resp.data()
        elif hasattr(resp, "value"):
            return resp.value()
        else:
            # Last resort - convert to string
            return str(resp)

    def get_camera_status(self):
        resp = "doesnt exist"
        return resp

    def set_overtravel(self, overtravelGap: float):
        "Sets overtravel gap for all chuck sites in μm"
        self.prober.send_cmd(f"set_chuck_overtravel_gap {overtravelGap}")

    def enable_overtravel(self, overtravel: bool):
        "overtravel (bool): True to enable, False to disable."
        self.prober.enable_chuck_overtravel(overtravel)

    def get_current_working_area(self):
        response = self.prober.send_cmd("get_chuck_position_hint")
        parts = str(response.message()).split(",")
        position_hint = parts[
            0
        ]  # e.g. "Probing", "FrontLoad", "SideLoad", "OffAxisCamera"

        return str(position_hint)

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
            if "contact" in position_lower:
                return "In Contact"
            elif "separation" in position_lower or "sep" in position_lower:
                return "In Separation"
            else:
                # For any other position (Hover, Lift, Home, Overtravel)
                # Return as-is with "In " prefix
                return f"In {position_str}"

        except Exception as e:
            return f"Error: {str(e)}"
            

    def take_image(
        self,
        snapshot_type : str = "CameraRaw",
        save_locally : bool =True,
        outputDir : str = "screenshots",
        num_columns : int = 3,
        num_rows : int = 3,
        column_spacing_um : int = 3400,
        row_spacing_um : int = 2800,
        start_x_um : int = 0,
        start_y_um : int = 0,
        settle_time_s : float = 1,
    ):
        self.prober.take_image(snapshot_type, save_locally, outputDir, num_columns, num_rows, column_spacing_um, row_spacing_um, start_x_um, start_y_um, settle_time_s)

    def take_screenshot(
        self,
        filename: str = None,
        snapshot_type: str = "CameraRaw",
        save_locally: bool = True,
        output_dir: str = "screenshotsSVT",
    ):
        """
        Take a screenshot from the prober camera.

        Args:
            filename: Output filename (auto-generated if None)
            snapshot_type: "CameraRaw" or "WithOverlays"
            save_locally: If True, downloads to local machine; if False, saves on prober
            output_dir: Directory to save screenshots

        Returns:
            str: Full path to saved screenshot
        """
        import datetime
        import os
        
        # Map string to enum — only two valid values exist
        type_map = {
            "CameraRaw": SnapshotType.CameraRaw,
            "WithOverlays": SnapshotType.WithOverlays,
        }
        what = type_map.get(snapshot_type, SnapshotType.CameraRaw)

        if not filename:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"screenshot_{timestamp}.jpg"

        # API always returns JPEG bytes — enforce .jpg regardless of user input
        if not filename.lower().endswith(('.jpg', '.jpeg')):
            filename = os.path.splitext(filename)[0] + '.jpg'

        if save_locally:
            os.makedirs(output_dir, exist_ok=True)
            full_path = os.path.join(output_dir, filename)
            self.prober.vision.snap_image(
                file=full_path,
                what=what,
                where=SnapshotLocation.Local
            )
        else:
            full_path = filename  # path on prober PC
            self.prober.vision.snap_image(
                file=full_path,
                what=what,
                where=SnapshotLocation.Prober
            )

        return full_path

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
            if "contact" in position_lower:
                return "In Contact"

            elif "default" in position_lower or "def" in position_lower:
                return "In Default"
            else:
                # For any other position (Hover, Lift, Home, Overtravel)
                # Return as-is with "In " prefix
                return f"In {position_str}"

        except Exception as e:
            return f"Error: {str(e)}"

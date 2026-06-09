from abc import ABC, abstractmethod


class AbstractProber(ABC):
    @abstractmethod
    def initialize(self):
        """Initialize connection to prober"""
        pass

    @abstractmethod
    def open_project(self, path: str):
        """Open project in Sentio"""
        pass

    @abstractmethod
    def move_chuck_xy(self, x: float, y: float, position: str):
        """Move chuck XY with relative position to map"""
        pass

    @abstractmethod
    def move_chuck_center(self):
        """Move chuck center"""
        pass

    @abstractmethod
    def move_chuck_offaxis_area(self):
        """Move chuck offaxis site"""
        pass

    @abstractmethod
    def move_chuck_wide(self):
        """Move chuck wide site"""
        pass

    @abstractmethod
    def run_ptpa(self):
        """Run PTPA"""
        pass

    @abstractmethod
    def step_next_die(self):
        """Move chuck to next die"""
        pass

    @abstractmethod
    def go_to_die(self, col: int, row: int):
        """Move chuck to die with column row"""
        pass

    @abstractmethod
    def switch_camera(self, mountPoint: str):
        """Switch camera"""
        pass

    @abstractmethod
    def move_chuck_home(self):
        """Move chuck home"""
        pass

    @abstractmethod
    def unload_wafer(self):
        """unload wafer"""
        pass

    @abstractmethod
    def local_mode(self):
        """Release remote control"""
        pass

    @abstractmethod
    def load_wafer(self):
        """Load wafer to center"""
        pass

    @abstractmethod
    def get_chuck_position(self):
        """Get current chuck position (In Contact/In Separation)"""
        pass

    @abstractmethod
    def set_overtravel(self, overtravelGap: float):
        """Set overtravel"""
        pass

    @abstractmethod
    def enable_overtravel(self, overtravel: bool):
        """Enable overtravel"""
        pass

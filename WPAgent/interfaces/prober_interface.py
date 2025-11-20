from abc import ABC, abstractmethod

class AbstractProber(ABC):
    @abstractmethod
    def initialize(self):
        pass

    @abstractmethod
    def open_project(self, path: str):
        pass

    @abstractmethod
    def move_chuck_xy(self, x: float, y: float):
        pass

    @abstractmethod
    def run_ptpa(self):
        pass

    @abstractmethod
    def step_next_die(self):
        pass

    @abstractmethod
    def go_to_die(self,col: int, row: int):
        pass

    @abstractmethod
    def switch_camera(self, mount_point: str):
        pass

    @abstractmethod
    def move_chuck_home(self):
        pass

    @abstractmethod
    def unload_wafer(self):
        pass

    @abstractmethod
    def local_mode(self):
        pass

    @abstractmethod
    def load_wafer(self):
        pass


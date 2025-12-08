import time
import random
from interfaces.WPProberInterface import AbstractProber


class MockProberImpl(AbstractProber):
    """
    Mock prober that simulates real prober behavior with delays
    Perfect for testing without hardware
    """

    def __init__(self, address):
        """Initialize mock prober"""
        self.address = address
        self.is_initialized = False
        self.current_position = {"x": 0, "y": 0}
        self.current_die = {"col": 0, "row": 0, "subsite": 0}
        self.camera_position = "OffAxis"
        self.wafer_loaded = False
        self.at_contact = False

        print(f"🔧 Mock Prober created for {address}")
        time.sleep(0.5)  # Simulate connection delay

    def initialize(self):
        """Simulate initialization"""
        print(f"⚙️  Initializing mock prober at {self.address}...")
        time.sleep(1)  # Simulate init time
        self.is_initialized = True
        print("✅ Mock prober initialized")

    def open_project(self, path: str):
        """Simulate opening a project"""
        print(f"📁 Opening project: {path}")
        time.sleep(0.8)
        print("✅ Project opened")

    def move_chuck_xy(self, x: float, y: float):
        """Simulate chuck movement"""
        old_pos = self.current_position.copy()
        print(f"🎯 Moving chuck from ({old_pos['x']}, {old_pos['y']}) to ({x}, {y})")
        time.sleep(1.5)  # Simulate movement time
        self.current_position = {"x": x, "y": y}
        print(f"✅ Chuck moved to ({x}, {y})")
        return True

    def run_ptpa(self):
        """Simulate PTPA (Probe Tip Position Alignment)"""
        print("🔬 Running PTPA...")
        time.sleep(3)  # PTPA takes longer
        print("✅ PTPA completed")

    def step_next_die(self):
        """Simulate stepping to next die"""
        print(f"➡️  Stepping from die ({self.current_die['col']}, {self.current_die['row']})")
        time.sleep(0.5)
        self.current_die['col'] += 1
        print(f"✅ Stepped to die ({self.current_die['col']}, {self.current_die['row']})")
        return self.current_die

    def go_to_die(self, col, row, subsite=0):
        """Simulate going to specific die"""
        print(f"🎯 Moving to die ({col}, {row}, subsite {subsite})")
        time.sleep(1)
        self.current_die = {"col": col, "row": row, "subsite": subsite}
        print(f"✅ At die ({col}, {row}, subsite {subsite})")
        return self.current_die

    def switch_camera(self, mount_point: str):
        """Simulate camera switch"""
        print(f"📷 Switching camera from {self.camera_position} to {mount_point}")
        time.sleep(0.8)
        self.camera_position = mount_point
        print(f"✅ Camera switched to {mount_point}")

    def move_chuck_home(self):
        """Simulate moving chuck to home position"""
        print("🏠 Moving chuck to home position...")
        time.sleep(2)
        self.current_position = {"x": 0, "y": 0}
        print("✅ Chuck at home position")

    def unload_wafer(self):
        """Simulate wafer unload"""
        if not self.wafer_loaded:
            print("⚠️  No wafer loaded")
            return
        print("📤 Unloading wafer...")
        time.sleep(2)
        self.wafer_loaded = False
        print("✅ Wafer unloaded")

    def local_mode(self):
        """Simulate switching to local mode"""
        print("🔓 Switching to local mode")
        time.sleep(0.3)

    def load_wafer(self):
        """Simulate wafer load"""
        if self.wafer_loaded:
            print("⚠️  Wafer already loaded")
            return
        print("📥 Loading wafer...")
        time.sleep(2.5)
        self.wafer_loaded = True
        print("✅ Wafer loaded")

    def find_home(self):
        """Simulate finding home position"""
        print("🔍 Finding home position...")
        time.sleep(1.5)
        print("✅ Home position found")

    def align_wafer(self, align_die_col, align_die_row, subsite=None):
        """Simulate wafer alignment"""
        print(f"📐 Aligning wafer at  die ({align_die_col}, {align_die_row})")
        time.sleep(3)
        self.current_die = {"col": align_die_col, "row": align_die_row, "subsite": subsite or 0}
        print("✅ Wafer aligned")

    def go_to_contact(self):
        """Simulate moving to contact position"""
        print("⬇️  Moving to contact position...")
        time.sleep(1)
        self.at_contact = True
        print("✅ At contact position")

    def go_to_separation(self):
        """Simulate moving to separation position"""
        print("⬆️  Moving to separation position...")
        time.sleep(1)
        self.at_contact = False
        print("✅ At separation position")

    def auto_focus(self):
        """Simulate auto focus"""
        print("🔍 Running auto focus...")
        time.sleep(2)
        print("✅ Auto focus completed")

    def move_chuck_work_area(self, work_area):
        """Simulate moving to work area"""
        print(f"🎯 Moving to work area: {work_area}")
        time.sleep(1.5)
        print(f"✅ Moved to {work_area} work area")


class SlowMockProberImpl(MockProberImpl):
    """
    Extra slow mock prober for testing concurrent command blocking
    All operations take 5+ seconds
    """

    def __init__(self, address):
        super().__init__(address)
        print("🐌 Slow Mock Prober initialized (5s delays)")

    def move_chuck_xy(self, x: float, y: float):
        """Extra slow movement"""
        print(f"🐌 SLOW: Moving chuck to ({x}, {y})... (5 seconds)")
        time.sleep(5)
        self.current_position = {"x": x, "y": y}
        print(f"✅ Chuck moved to ({x}, {y})")
        return True

    def move_chuck_home(self):
        """Extra slow home movement"""
        print("🐌 SLOW: Moving chuck to home... (5 seconds)")
        time.sleep(5)
        self.current_position = {"x": 0, "y": 0}
        print("✅ Chuck at home position")

    def auto_focus(self):
        """Extra slow auto focus"""
        print("🐌 SLOW: Running auto focus... (5 seconds)")
        time.sleep(5)
        print("✅ Auto focus completed")


class FailingMockProberImpl(MockProberImpl):
    """
    Mock prober that randomly fails operations
    Useful for testing error handling
    """

    def __init__(self, address, failure_rate=0.3):
        super().__init__(address)
        self.failure_rate = failure_rate
        print(f"⚠️  Failing Mock Prober initialized ({failure_rate * 100}% failure rate)")

    def _should_fail(self):
        """Randomly decide if operation should fail"""
        return random.random() < self.failure_rate

    def move_chuck_xy(self, x: float, y: float):
        """Movement that might fail"""
        if self._should_fail():
            print(f"❌ MOCK FAILURE: Could not move chuck to ({x}, {y})")
            raise Exception(f"Mock failure: Chuck movement failed")
        return super().move_chuck_xy(x, y)

    def auto_focus(self):
        """Auto focus that might fail"""
        if self._should_fail():
            print("❌ MOCK FAILURE: Auto focus failed")
            raise Exception("Mock failure: Auto focus failed")
        return super().auto_focus()

    def step_next_die(self):
        """Die stepping that might fail"""
        if self._should_fail():
            print("❌ MOCK FAILURE: Could not step to next die")
            raise Exception("Mock failure: Die stepping failed")
        return super().step_next_die()
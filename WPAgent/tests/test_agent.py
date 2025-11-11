#!/usr/bin/env python3
"""
WPAgent Test Runner with Mock Prober
Run tests without connecting to real hardware
"""

# ✅ ADD PARENT DIRECTORY TO PATH
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import time
from threading import Thread

# Test configuration
USE_MOCK_PROBER = True  # Set to True to use mock prober


def setup_mock_prober():
    """Configure factory to use mock prober"""
    from drivers import factory
    from tests.mock_prober import MockProberImpl, SlowMockProberImpl

    # Add mock prober to factory
    factory.prober_classes['sentio'] = MockProberImpl
    factory.prober_classes['sentio_slow'] = SlowMockProberImpl

    print("✅ Mock prober configured\n")


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0

        if USE_MOCK_PROBER:
            setup_mock_prober()

    def log(self, msg, color=Colors.RESET):
        print(f"{color}{msg}{Colors.RESET}")

    def test(self, name, func):
        """Run a test and track results"""
        print(f"\n{'=' * 60}")
        self.log(f"TEST: {name}", Colors.BOLD + Colors.BLUE)
        print('=' * 60)

        try:
            func()
            self.log(f"✅ PASS: {name}", Colors.GREEN)
            self.passed += 1
        except Exception as e:
            self.log(f"❌ FAIL: {name}", Colors.RED)
            self.log(f"   Error: {str(e)}", Colors.RED)
            self.failed += 1

    def assert_equal(self, actual, expected, msg=""):
        """Assert equality"""
        if actual != expected:
            raise AssertionError(f"{msg}: Expected {expected}, got {actual}")

    def assert_contains(self, text, substring, msg=""):
        """Assert substring is in text"""
        if substring not in str(text):
            raise AssertionError(f"{msg}: '{substring}' not found in '{text}'")

    # ==================== TESTS ====================

    def test_initialization(self):
        """Test 1: Initialize the agent"""
        from actions.WPProjectActions import svt_initialise_wp
        from drivers.factory import ProberFactory

        print("\n1. Initializing WP Agent...")
        result = svt_initialise_wp(
            address="mock://localhost:35555",
            machine_type="sentio",
            project_name="test_project"
        )

        print(f"Result: {result}")
        self.assert_equal(result["status"], "success", "Initialization failed")

        # Check factory state
        factory = ProberFactory.get_instance()
        assert factory.is_initialized(), "Factory not initialized"
        print("✓ Initialization successful")

    def test_sequential_commands(self):
        """Test 2: Execute commands sequentially"""
        from cmd_map import execute_command

        commands = [
            ("MoveChuckHome", {}),
            ("MoveChuckXY", {"x": 100, "y": 200}),
            ("StepNextDie", {}),
            ("AutoFocus", {})
        ]

        for cmd, params in commands:
            print(f"\n2. Executing {cmd}...")
            result = execute_command(cmd, params)
            print(f"Result: {result}")
            self.assert_equal(result["status"], "success", f"{cmd} failed")
            print(f"✓ {cmd} completed")

    def test_busy_flag(self):
        """Test 3: Test busy flag blocks concurrent commands"""
        from cmd_map import execute_command
        from SVTWpAgentStateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine
        import threading

        results = {"first": None, "second": None}

        def run_first():
            """Run first command (slow)"""
            print("\n3a. Starting first command (MoveChuckHome - slow)...")
            results["first"] = execute_command("MoveChuckHome", {})

        def run_second():
            """Try to run second command while first is busy"""
            time.sleep(0.5)  # Wait a bit to ensure first started
            print("\n3b. Trying second command while first is running...")
            print(f"   Agent state: {agentStateMachine.getState().name}")
            print(f"   Is busy: {agentStateMachine.isBusy()}")
            results["second"] = execute_command("StepNextDie", {})

        # Start both threads
        t1 = threading.Thread(target=run_first)
        t2 = threading.Thread(target=run_second)

        t1.start()
        t2.start()

        t1.join()
        t2.join()

        print(f"\n3c. First command result: {results['first']}")
        print(f"3d. Second command result: {results['second']}")

        # First should succeed
        self.assert_equal(results["first"]["status"], "success", "First command should succeed")

        # Second should fail with busy message
        self.assert_equal(results["second"]["status"], "error", "Second command should be blocked")
        self.assert_contains(results["second"]["output"], "busy", "Should show busy message")

        print("✓ Busy flag works correctly")

    def test_commands_with_params(self):
        """Test 4: Commands with various parameters"""
        from cmd_map import execute_command

        test_cases = [
            ("MoveChuckXY", {"x": 50, "y": 100}),
            ("GoToDie", {"col": 5, "row": 3, "subsite": 0}),
            ("SwitchCamera", {"mount_point": "OffAxis"}),
        ]

        for cmd, params in test_cases:
            print(f"\n4. Testing {cmd} with params {params}...")
            result = execute_command(cmd, params)
            print(f"Result: {result}")
            self.assert_equal(result["status"], "success", f"{cmd} with params failed")
            print(f"✓ {cmd} with params successful")

    def test_state_transitions(self):
        """Test 5: State machine transitions"""
        from SVTWpAgentStateMachine.SvtWpAgentStateMachineGlobals import agentStateMachine
        from SVTWpAgentStateMachine.SvtWpAgentStateMachine import SvtWpAgentState, SvtWpAgentEvent
        from cmd_map import execute_command

        print("\n5a. Initial state:")
        print(f"   State: {agentStateMachine.getState().name}")
        print(f"   Is busy: {agentStateMachine.isBusy()}")
        print(f"   Can execute: {agentStateMachine.canExecute()}")

        print("\n5b. Executing command...")
        result = execute_command("AutoFocus", {})

        print("\n5c. After execution:")
        print(f"   State: {agentStateMachine.getState().name}")
        print(f"   Is busy: {agentStateMachine.isBusy()}")

        self.assert_equal(agentStateMachine.getState(), SvtWpAgentState.Idle, "Should return to Idle")
        assert not agentStateMachine.isBusy(), "Should not be busy"

        print("✓ State transitions correct")

    def test_invalid_command(self):
        """Test 6: Invalid command handling"""
        from cmd_map import execute_command

        print("\n6. Testing invalid command...")
        result = execute_command("NonExistentCommand", {})
        print(f"Result: {result}")

        self.assert_equal(result["status"], "error", "Should return error")
        self.assert_contains(result["output"], "Unknown command", "Should show unknown command message")

        print("✓ Invalid command handled correctly")

    def test_reinitialization(self):
        """Test 7: Re-initialization with force"""
        from actions.WPProjectActions import svt_initialise_wp

        print("\n7a. Re-initializing without force...")
        result1 = svt_initialise_wp(
            address="mock://localhost:35555",
            machine_type="sentio"
        )
        print(f"Result: {result1}")
        self.assert_contains(result1["output"], "Already initialized", "Should skip re-init")

        print("\n7b. Re-initializing with force=True...")
        result2 = svt_initialise_wp(
            address="mock://localhost:35555",
            machine_type="sentio",
            force=True
        )
        print(f"Result: {result2}")
        self.assert_equal(result2["status"], "success", "Force re-init should succeed")

        print("✓ Re-initialization works correctly")

    def test_project_status(self):
        """Test 8: Get project status"""
        from actions.WPProjectActions import get_project_status

        print("\n8. Getting project status...")
        result = get_project_status()
        print(f"Result: {result}")

        self.assert_equal(result["status"], "success", "Status check failed")
        assert "data" in result, "Should have data field"

        data = result["data"]
        print(f"\n   Address: {data.get('address')}")
        print(f"   Machine Type: {data.get('machine_type')}")
        print(f"   Project: {data.get('project_name')}")
        print(f"   Initialized: {data.get('prober_initialized')}")
        print(f"   Ready: {data.get('ready_for_commands')}")

        print("✓ Status check successful")

    # ==================== RUN ALL ====================

    def run_all(self):
        """Run all tests"""
        self.log("\n" + "=" * 70, Colors.BOLD + Colors.BLUE)
        self.log("    WPAgent Test Suite (Mock Prober Mode)", Colors.BOLD + Colors.BLUE)
        self.log("=" * 70 + "\n", Colors.BOLD + Colors.BLUE)

        if USE_MOCK_PROBER:
            self.log(" Using MOCK PROBER - no hardware needed!\n", Colors.YELLOW)
        else:
            self.log("⚠️  Using REAL PROBER - ensure hardware is connected!\n", Colors.YELLOW)

        start = time.time()

        # Run tests
        # self.test("Initialization", self.test_initialization)
        # self.test("Sequential Commands", self.test_sequential_commands)
        # self.test("Busy Flag (Concurrent Commands)", self.test_busy_flag)
        # self.test("Commands with Parameters", self.test_commands_with_params)
        self.test("State Machine Transitions", self.test_state_transitions)
        # self.test("Invalid Command Handling", self.test_invalid_command)
        # self.test("Re-initialization", self.test_reinitialization)
        # self.test("Project Status", self.test_project_status)

        # Summary
        duration = time.time() - start
        self.print_summary(duration)

    def print_summary(self, duration):
        """Print test summary"""
        total = self.passed + self.failed

        print("\n" + "=" * 70)
        self.log("TEST SUMMARY", Colors.BOLD)
        print("=" * 70)

        print(f"\nTotal: {total}")
        self.log(f"Passed: {self.passed}", Colors.GREEN)
        self.log(f"Failed: {self.failed}", Colors.RED)
        print(f"Duration: {duration:.2f}s")

        if self.failed == 0:
            self.log("\n ALL TESTS PASSED! \n", Colors.GREEN + Colors.BOLD)
        else:
            self.log(f"\n⚠️  {self.failed} TEST(S) FAILED\n", Colors.RED + Colors.BOLD)


def main():
    runner = TestRunner()
    runner.run_all()


if __name__ == "__main__":
    main()
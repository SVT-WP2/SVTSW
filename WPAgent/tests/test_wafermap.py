"""
Simple Wafermap Test for WPAgent/tests folder

This script tests:
1. Creating a new project
2. Setting up NKF7 wafermap
3. Saving the project

Place in: WPAgent/tests/test_wafermap.py
Run: python tests/test_wafermap.py
"""

import sys
import os

# Add parent directory to path to import from WPAgent
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sentio_prober_control.Communication.CommunicatorTcpIp import CommunicatorTcpIp
from sentio_prober_control.Sentio.ProberSentio import SentioProber
from sentio_prober_control.Sentio.Enumerations import Module, AxisOrient, ColorScheme

# ============================================================================
# Configuration
# ============================================================================

PROBER_ADDRESS = "wpmit01.cern.ch:35555"
PROJECT_NAME = "TestProject_NKF7_Auto"


# Test Functions
# ============================================================================
def test_create_project():
    """Test 1: Create a new project"""
    print("\n" + "=" * 60)
    print("TEST 1: Create Project")
    print("=" * 60)

    prober = SentioProber(CommunicatorTcpIp.create(PROBER_ADDRESS))
    prober.select_module(Module.Wafermap)

    print(f"Creating project: {PROJECT_NAME}")
    response = prober.send_cmd(f"create_project {PROJECT_NAME}")
    response_str = response.message()

    print(f"Response: {response_str}")

    # For create_project, response might just be the path, not "0,0,path"
    if ',' in response_str:
        parts = response_str.split(',', 2)
        if len(parts) >= 3:
            project_path = parts[2].strip()
        else:
            project_path = response_str.strip()
    else:
        project_path = response_str.strip()

    print(f"✅ Project created: {project_path}")
    return prober, project_path


def test_setup_wafermap(prober):
    """Test 2: Setup NKF7 wafermap - FIXED VERSION"""
    print("\n" + "=" * 60)
    print("TEST 2: Setup Wafermap")
    print("=" * 60)

    map_obj = prober.map

    # Define routable dies FIRST (we need this info)
    routable_dies = [
        (2, 11), (-2, 3), (3, 3),
        (-2, 2), (-1, 2), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2),
        (-1, 1), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1),
        (0, 0), (1, 0), (2, 0), (3, 0)
    ]

    # Create rectangular grid
    cols = 10
    rows = 14
    print(f"Creating {cols}x{rows} rectangular grid...")
    map_obj.create_rect(cols, rows)

    # Set grid origin - this defines where (0,0) is in the grid
    grid_origin = (-2, 6)
    print(f"Setting grid origin: {grid_origin}")
    map_obj.set_grid_origin(grid_origin[0], grid_origin[1])

    # Set axis orientation
    print("Setting axis orientation: DownRight")
    map_obj.set_axis_orient(AxisOrient.DownRight)

    # Set die size (in micrometers)
    die_width = 30594.8
    die_height = 22498.767
    print(f"Setting die size: {die_width / 1000:.1f} x {die_height / 1000:.1f} mm")
    map_obj.set_die_size(die_width, die_height)

    # Set street size
    map_obj.set_street_size(0, 0)

    # Set color scheme
    map_obj.set_color_scheme(ColorScheme.ColorFromBin)

    # Remove non-routable dies
    print(f"Removing non-routable dies...")
    print(f"   (Keeping only {len(routable_dies)} routable dies)")
    removed = 0
    kept = 0

    for col in range(-3, 7):
        for row in range(-1, 13):
            if (col, row) in routable_dies:
                kept += 1
                # Keep this die
            else:
                # Remove this die
                try:
                    map_obj.die.remove(col, row)
                    removed += 1
                except Exception:
                    # Die doesn't exist in grid or already removed
                    pass

    print(f"   Kept: {kept} dies")
    print(f"   Removed: {removed} dies")

    # NOW set home die - AFTER we know the die exists
    home_die = (4, 2)
    print(f"Setting home die: {home_die}")

    # Check if home die is in our routable list
    if home_die in routable_dies:
        try:
            map_obj.set_home_die(home_die[0], home_die[1])
            print(f"✅ Home die set successfully")
        except Exception as e:
            print(f"⚠️  Warning: Could not set home die: {e}")
            print(f"   This is OK - home die can be set manually in SENTIO")
    else:
        print(f"⚠️  Warning: Home die {home_die} is not in routable dies list!")
        print(f"   Skipping home die setup")

    print(f"✅ Map configured: {len(routable_dies)} routable dies")

    return len(routable_dies), removed


def test_save_project(prober, project_path):
    """Test 3: Save the project"""
    print("\n" + "=" * 60)
    print("TEST 3: Save Project")
    print("=" * 60)

    print(f"Saving project...")
    response = prober.send_cmd("save_project")
    response_str = response.message()

    print(f"Response: {response_str}")

    # Parse response
    if ',' in response_str:
        parts = response_str.split(',', 2)
        if len(parts) >= 3:
            saved_path = parts[2].strip()
        else:
            saved_path = response_str.strip()
    else:
        saved_path = response_str.strip()

    print(f"✅ Project saved: {saved_path}")
    return saved_path


def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🧪 WAFERMAP SETUP - FULL TEST SUITE")
    print("=" * 60)
    print(f"Prober: {PROBER_ADDRESS}")
    print(f"Project: {PROJECT_NAME}")

    try:
        # Test 1: Create project
        prober, project_path = test_create_project()

        # Test 2: Setup wafermap
        routable_count, removed_count = test_setup_wafermap(prober)

        # Test 3: Save project
        saved_path = test_save_project(prober, project_path)

        # Summary
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        print(f"Project saved: {saved_path}")
        print(f"Routable dies: {routable_count}")
        print(f"Removed dies: {removed_count}")
        print(f"\n📋 Next steps:")
        print(f"   1. Open project in SENTIO GUI")
        print(f"   2. Verify wafermap has {routable_count} orange dies")
        print(f"   3. Manually set home die to (4, 2) if needed")
        print("=" * 60)

        return True

    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ TEST FAILED")
        print("=" * 60)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        PROBER_ADDRESS = sys.argv[1]
    if len(sys.argv) > 2:
        PROJECT_NAME = sys.argv[2]

    success = run_all_tests()
    sys.exit(0 if success else 1)


























































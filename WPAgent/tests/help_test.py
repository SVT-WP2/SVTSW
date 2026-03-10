"""
Direct test of help_command - works from tests/ directory

Usage:
    cd /data/akostina/SVTSW/WPAgent/tests
    python3.12 test_help_fixed.py

    OR

    cd /data/akostina/SVTSW/WPAgent
    python3.12 tests/test_help_fixed.py
"""

import sys
import os

# Add parent directory to path so we can import from actions/
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

print(f"Python path: {parent_dir}")
print(f"Current dir: {os.getcwd()}\n")

# Now import
from actions.WPProjectActions import help_command
import json


def test_help():
    """Test help_command directly"""
    print("=" * 70)
    print("  TESTING help_command() DIRECTLY")
    print("=" * 70)

    print("\n1. Testing help with no parameters...")
    try:
        result = help_command()

        print(f"\n✓ Function returned successfully")
        print(f"Type: {type(result)}")

        if isinstance(result, dict):
            print(f"\nKeys in result: {list(result.keys())}")
            print(f"Status: {result.get('status')}")
            print(f"Type field: {result.get('type')}")

            # Show full response (truncated)
            print(f"\nFull response (first 500 chars):")
            response_str = json.dumps(result, indent=2)
            print(response_str[:500])

            # Check if it's the correct format
            if result.get('status') == 'Success' and result.get('type') == 'HelpReply':
                print("\n✅ CORRECT FORMAT - ResponseBuilder is working!")

                # Show the message
                data = result.get('data', {})
                if 'message' in data:
                    print(f"\nMessage length: {len(data['message'])} characters")
                    print(f"First 300 chars of message:")
                    print("-" * 70)
                    print(data['message'][:300])
                    print("-" * 70)
            else:
                print("\n❌ WRONG FORMAT")
                print(f"   Expected: status='Success', type='HelpReply'")
                print(f"   Got: status='{result.get('status')}', type='{result.get('type')}'")
        else:
            print(f"\n❌ Result is not a dict, it's: {type(result)}")
            print(f"Result: {result}")

        return result

    except Exception as e:
        print(f"\n❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_help_with_command():
    """Test help_command with specific command"""
    print("\n" + "=" * 70)
    print("  TESTING help_command('MoveChuckXY')")
    print("=" * 70)

    try:
        result = help_command(command='MoveChuckXY')

        print(f"\n✓ Function returned successfully")
        print(f"Status: {result.get('status')}")
        print(f"Type: {result.get('type')}")

        if result.get('status') == 'Success':
            print("\n✅ Got help for MoveChuckXY")
            # Show a bit of the message
            data = result.get('data', {})
            if 'message' in data:
                msg = data['message']
                print(f"\nMessage preview (first 300 chars):")
                print("-" * 70)
                print(msg[:300])
                print("-" * 70)

        return result

    except Exception as e:
        print(f"\n❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        return None


def check_help_file():
    """Check if help JSON file exists"""
    print("\n" + "=" * 70)
    print("  CHECKING WPCommandsHelpList.json")
    print("=" * 70)

    # Change to parent directory for relative paths
    os.chdir(parent_dir)
    print(f"Changed to: {os.getcwd()}\n")

    paths = [
        "utilities/WPCommandsHelpList.json",
        "WPCommandsHelpList.json",
        "../utilities/WPCommandsHelpList.json"
    ]

    for path in paths:
        exists = os.path.exists(path)
        abs_path = os.path.abspath(path)
        print(f"{'✓' if exists else '✗'} {path}")
        print(f"   (full path: {abs_path})")

        if exists:
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                print(f"   → Valid JSON with {len(data)} commands")
                print(f"   → Sample commands: {list(data.keys())[:5]}")
                return True
            except Exception as e:
                print(f"   → Error: {e}")

    print("\n❌ Help file not found in any location!")
    return False


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  HELP COMMAND DIRECT TEST")
    print("=" * 70)

    # Check file first
    file_ok = check_help_file()

    if not file_ok:
        print("\n" + "=" * 70)
        print("  ⚠️  WARNING: Help file missing")
        print("=" * 70)
        print("\nThe help_command will fail because it can't find:")
        print("  utilities/WPCommandsHelpList.json")
        print("\nLet's test anyway to see the exact error...\n")

    # Test help
    result1 = test_help()

    if file_ok:
        # Test help with command
        result2 = test_help_with_command()
    else:
        result2 = None

    # Summary
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)

    if result1 and result1.get('status') == 'Success':
        print("✅ help() works correctly")
    else:
        print("❌ help() has issues")
        if result1 and result1.get('status') == 'Error':
            error = result1.get('error', {})
            print(f"   Error message: {error.get('message')}")

    if result2 and result2.get('status') == 'Success':
        print("✅ help('MoveChuckXY') works correctly")
    else:
        if file_ok:
            print("❌ help('MoveChuckXY') has issues")

    print("\n" + "=" * 70)
    print("\nNow try running via Kafka:")
    print("  python3.12 main.py send help")
    print("=" * 70 + "\n")
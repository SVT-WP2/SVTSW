#!/usr/bin/env python3
"""
Test script to verify coordinate conversion functionality.
Run this to test the conversion map before integrating into WPAgent.
"""

import json
import sys

# Test data based on babymosaix_conversion.json
CONVERSION_MAP = [
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-1", "row_global": 3, "column_global": 2, "row_local": -1,
     "column_local": 1},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-1", "row_global": 3, "column_global": 3, "row_local": -1,
     "column_local": 2},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-2", "row_global": 6, "column_global": 2, "row_local": 0,
     "column_local": 0},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-2", "row_global": 6, "column_global": 3, "row_local": 0,
     "column_local": 1},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-3", "row_global": 30, "column_global": 2, "row_local": 8,
     "column_local": 0},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-3", "row_global": 30, "column_global": 3, "row_local": 8,
     "column_local": 1},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-4", "row_global": 33, "column_global": 2, "row_local": 9,
     "column_local": 1},
    {"asic_type": "BABYMOSAIX", "SN_prefix": "babyMOSAIX-4", "row_global": 33, "column_global": 4, "row_local": 9,
     "column_local": 3},
]


def global_to_local(row_global, column_global):
    """Convert global to local coordinates"""
    for entry in CONVERSION_MAP:
        if entry["row_global"] == row_global and entry["column_global"] == column_global:
            return (entry["row_local"], entry["column_local"], entry["SN_prefix"])
    return None


def local_to_global(row_local, column_local, sn_prefix):
    """Convert local to global coordinates"""
    for entry in CONVERSION_MAP:
        if (entry["row_local"] == row_local and
                entry["column_local"] == column_local and
                entry["SN_prefix"] == sn_prefix):
            return (entry["row_global"], entry["column_global"])
    return None


def run_tests():
    """Run comprehensive tests"""

    print("\n" + "=" * 80)
    print(" COORDINATE CONVERSION TEST SUITE")
    print("=" * 80)

    # Test 1: Global to Local Conversions
    print("\n📋 Test 1: Global to Local Conversions")
    print("-" * 80)

    test_cases_g2l = [
        (3, 2, (-1, 1, "babyMOSAIX-1")),
        (6, 2, (0, 0, "babyMOSAIX-2")),
        (6, 3, (0, 1, "babyMOSAIX-2")),
        (30, 2, (8, 0, "babyMOSAIX-3")),
        (30, 3, (8, 1, "babyMOSAIX-3")),
        (33, 2, (9, 1, "babyMOSAIX-4")),
        (33, 4, (9, 3, "babyMOSAIX-4")),
    ]

    passed = 0
    failed = 0

    for row_g, col_g, expected in test_cases_g2l:
        result = global_to_local(row_g, col_g)
        if result == expected:
            print(f"✅ Global ({row_g},{col_g}) → Local {result[0:2]} on {result[2]}")
            passed += 1
        else:
            print(f"❌ Global ({row_g},{col_g}) - Expected {expected}, Got {result}")
            failed += 1

    # Test 2: Local to Global Conversions
    print("\n📋 Test 2: Local to Global Conversions")
    print("-" * 80)

    test_cases_l2g = [
        (-1, 1, "babyMOSAIX-1", (3, 2)),
        (0, 0, "babyMOSAIX-2", (6, 2)),
        (0, 1, "babyMOSAIX-2", (6, 3)),
        (8, 0, "babyMOSAIX-3", (30, 2)),
        (8, 1, "babyMOSAIX-3", (30, 3)),
        (9, 1, "babyMOSAIX-4", (33, 2)),
        (9, 3, "babyMOSAIX-4", (33, 4)),
    ]

    for row_l, col_l, sn, expected in test_cases_l2g:
        result = local_to_global(row_l, col_l, sn)
        if result == expected:
            print(f"✅ Local ({row_l},{col_l}) on {sn} → Global {result}")
            passed += 1
        else:
            print(f"❌ Local ({row_l},{col_l}) on {sn} - Expected {expected}, Got {result}")
            failed += 1

    # Test 3: Invalid Coordinates
    print("\n📋 Test 3: Invalid Coordinate Handling")
    print("-" * 80)

    invalid_tests = [
        ("Global (999, 999)", lambda: global_to_local(999, 999)),
        ("Local (99, 99) on invalid ASIC", lambda: local_to_global(99, 99, "invalid")),
    ]

    for description, test_func in invalid_tests:
        result = test_func()
        if result is None:
            print(f"✅ {description} correctly returns None")
            passed += 1
        else:
            print(f"❌ {description} should return None, got {result}")
            failed += 1

    # Test 4: Round-trip Conversion
    print("\n📋 Test 4: Round-trip Conversions (Global → Local → Global)")
    print("-" * 80)

    round_trip_tests = [
        (6, 2),
        (30, 3),
        (33, 4),
    ]

    for row_g_orig, col_g_orig in round_trip_tests:
        # Global to Local
        result_l = global_to_local(row_g_orig, col_g_orig)
        if result_l:
            row_l, col_l, sn = result_l
            # Local back to Global
            result_g = local_to_global(row_l, col_l, sn)
            if result_g == (row_g_orig, col_g_orig):
                print(f"✅ ({row_g_orig},{col_g_orig}) → ({row_l},{col_l}) → ({result_g[0]},{result_g[1]})")
                passed += 1
            else:
                print(f"❌ Round-trip failed: ({row_g_orig},{col_g_orig}) → {result_g}")
                failed += 1
        else:
            print(f"❌ Failed to convert ({row_g_orig},{col_g_orig}) to local")
            failed += 1

    # Summary
    print("\n" + "=" * 80)
    print(" TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f" Success Rate: {100 * passed / (passed + failed):.1f}%")
    print("=" * 80)

    return failed == 0


def print_conversion_table():
    """Print formatted conversion table"""
    print("\n" + "=" * 80)
    print("📋 BABYMOSAIX COORDINATE CONVERSION TABLE")
    print("=" * 80)

    # Group by ASIC
    asics = {}
    for entry in CONVERSION_MAP:
        sn = entry["SN_prefix"]
        if sn not in asics:
            asics[sn] = []
        asics[sn].append(entry)

    for sn in sorted(asics.keys()):
        print(f"\n🔹 {sn}")
        print(f"{'Global (Row,Col)':<20} {'Local (Row,Col)':<20}")
        print("-" * 40)

        for entry in asics[sn]:
            global_coord = f"({entry['row_global']}, {entry['column_global']})"
            local_coord = f"({entry['row_local']}, {entry['column_local']})"
            print(f"{global_coord:<20} {local_coord:<20}")

    print("=" * 80)


def interactive_mode():
    """Interactive conversion mode"""
    print("\n" + "=" * 80)
    print(" INTERACTIVE CONVERSION MODE")
    print("=" * 80)
    print("\nCommands:")
    print("  g2l <row> <col>           - Convert Global to Local")
    print("  l2g <row> <col> <sn>      - Convert Local to Global")
    print("  table                     - Show conversion table")
    print("  test                      - Run test suite")
    print("  quit                      - Exit")
    print("=" * 80)

    while True:
        try:
            cmd = input("\n> ").strip().split()

            if not cmd:
                continue

            if cmd[0] == "quit":
                break
            elif cmd[0] == "table":
                print_conversion_table()
            elif cmd[0] == "test":
                run_tests()
            elif cmd[0] == "g2l" and len(cmd) == 3:
                row_g = int(cmd[1])
                col_g = int(cmd[2])
                result = global_to_local(row_g, col_g)
                if result:
                    print(f"✅ Global ({row_g},{col_g}) → Local ({result[0]},{result[1]}) on {result[2]}")
                else:
                    print(f"❌ No mapping found for Global ({row_g},{col_g})")
            elif cmd[0] == "l2g" and len(cmd) == 4:
                row_l = int(cmd[1])
                col_l = int(cmd[2])
                sn = cmd[3]
                result = local_to_global(row_l, col_l, sn)
                if result:
                    print(f"✅ Local ({row_l},{col_l}) on {sn} → Global ({result[0]},{result[1]})")
                else:
                    print(f"❌ No mapping found for Local ({row_l},{col_l}) on {sn}")
            else:
                print("❌ Invalid command. Type 'quit' to exit.")

        except (ValueError, IndexError):
            print("❌ Invalid input format")
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break


if __name__ == "__main__":
    # Run tests
    success = run_tests()

    # Show conversion table
    print_conversion_table()

    # Enter interactive mode if requested
    if len(sys.argv) > 1 and sys.argv[1] == "-i":
        interactive_mode()

    sys.exit(0 if success else 1)
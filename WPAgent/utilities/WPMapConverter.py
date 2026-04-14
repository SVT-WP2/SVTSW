import json
import os
from typing import Optional, Tuple, Dict, List


class CoordinateConverter:
    """
    Handles conversion between global and local die coordinates.

    The conversion map is loaded from JSON files that define the mapping
    between global wafer coordinates and local ASIC coordinates.

    TODO: Convertion map has to be loaded from DB
    """

    def __init__(self, conversion_map_path: Optional[str] = None):
        """
        Initialize the coordinate converter.

        Args:
            conversion_map_path: Path to JSON file with conversion mappings.
                               If None, uses default path.
        """
        self.conversion_map: List[Dict] = []
        self.asic_type: Optional[str] = None

        if conversion_map_path:
            self.load_conversion_map(conversion_map_path)

    def load_conversion_map(self, filepath: str) -> bool:
        """
        Load conversion map from JSON file.

        Args:
            filepath: Path to JSON file

        Returns:
            bool: True if loaded successfully, False otherwise

        Example JSON format:
        [
          {
            "asic_type": "BABYMOSAIX",
            "SN_prefix": "babyMOSAIX-2",
            "row_global": 6,
            "column_global": 2,
            "row_local": 0,
            "column_local": 0
          },
          ...
        ]
        """
        try:
            if not os.path.exists(filepath):
                print(f"❌ Conversion map file not found: {filepath}")
                return False

            with open(filepath, 'r') as f:
                self.conversion_map = json.load(f)

            # Extract ASIC type from first entry
            if self.conversion_map:
                self.asic_type = self.conversion_map[0].get("asic_type")
                print(f"✅ Loaded conversion map: {len(self.conversion_map)} entries")
                print(f"   ASIC Type: {self.asic_type}")

                # Print available SN prefixes
                prefixes = set(entry.get("SN_prefix") for entry in self.conversion_map)
                print(f"   SN Prefixes: {', '.join(sorted(prefixes))}")

                return True
            else:
                print(f"⚠️ Conversion map is empty")
                return False

        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in conversion map: {e}")
            return False
        except Exception as e:
            print(f"❌ Error loading conversion map: {e}")
            return False

    def global_to_local(
            self,
            row_global: int,
            column_global: int,
            sn_prefix: Optional[str] = None
    ) -> Optional[Tuple[int, int, str]]:
        """
        Convert global coordinates to local coordinates.

        Args:
            row_global: Global row coordinate
            column_global: Global column coordinate
            sn_prefix: Optional ASIC serial number prefix to filter by

        Returns:
            Tuple of (row_local, column_local, SN_prefix) if found, None otherwise

        Example:
            converter.global_to_local(6, 2)
            # Returns: (0, 0, "babyMOSAIX-2")

            converter.global_to_local(30, 3, "babyMOSAIX-3")
            # Returns: (8, 1, "babyMOSAIX-3")
        """
        if not self.conversion_map:
            print(f"⚠️ No conversion map loaded")
            return None

        # Search for matching entry
        for entry in self.conversion_map:
            # Check if global coordinates match
            if (entry.get("row_global") == row_global and
                    entry.get("column_global") == column_global):

                # If SN prefix specified, must match
                if sn_prefix and entry.get("SN_prefix") != sn_prefix:
                    continue

                row_local = entry.get("row_local")
                column_local = entry.get("column_local")
                entry_sn_prefix = entry.get("SN_prefix")

                return (row_local, column_local, entry_sn_prefix)

        # Not found
        return None

    def local_to_global(
            self,
            row_local: int,
            column_local: int,
            sn_prefix: str
    ) -> Optional[Tuple[int, int]]:
        """
        Convert local coordinates to global coordinates.

        Args:
            row_local: Local row coordinate
            column_local: Local column coordinate
            sn_prefix: ASIC serial number prefix (required)

        Returns:
            Tuple of (row_global, column_global) if found, None otherwise

        Example:
            converter.local_to_global(0, 0, "babyMOSAIX-2")
            # Returns: (6, 2)

            converter.local_to_global(8, 1, "babyMOSAIX-3")
            # Returns: (30, 3)
        """
        if not self.conversion_map:
            print(f"⚠️ No conversion map loaded")
            return None

        if not sn_prefix:
            print(f"⚠️ SN prefix is required for local to global conversion")
            return None

        # Search for matching entry
        for entry in self.conversion_map:
            if (entry.get("row_local") == row_local and
                    entry.get("column_local") == column_local and
                    entry.get("SN_prefix") == sn_prefix):
                row_global = entry.get("row_global")
                column_global = entry.get("column_global")

                return (row_global, column_global)

        # Not found
        return None

    def svt_to_local(
            self,
            row_svt: int,
            column_svt: int,
            sn_prefix: Optional[str] = None
    ) -> Optional[Tuple[int, int, str]]:
        """
        Convert SVT coordinates to local ASIC coordinates.

        Args:
            row_svt: SVT row coordinate
            column_svt: SVT column coordinate
            sn_prefix: Optional ASIC serial number prefix to filter by

        Returns:
            Tuple of (row_local, column_local, SN_prefix) if found, None otherwise
        """
        if not self.conversion_map:
            print("⚠️ No conversion map loaded")
            return None

        for entry in self.conversion_map:
            if (entry.get("row_svt") == row_svt and
                    entry.get("column_svt") == column_svt):
                if sn_prefix and entry.get("SN_prefix") != sn_prefix:
                    continue
                return (entry.get("row_local"), entry.get("column_local"), entry.get("SN_prefix"))

        return None

    def local_to_svt(
            self,
            row_local: int,
            column_local: int,
            sn_prefix: str
    ) -> Optional[Tuple[int, int]]:
        """
        Convert local ASIC coordinates to SVT coordinates.

        Args:
            row_local: Local row coordinate
            column_local: Local column coordinate
            sn_prefix: ASIC serial number prefix (required)

        Returns:
            Tuple of (row_svt, column_svt) if found, None otherwise
        """
        if not self.conversion_map:
            print("⚠️ No conversion map loaded")
            return None

        if not sn_prefix:
            print("⚠️ SN prefix is required for local to SVT conversion")
            return None

        for entry in self.conversion_map:
            if (entry.get("row_local") == row_local and
                    entry.get("column_local") == column_local and
                    entry.get("SN_prefix") == sn_prefix):
                return (entry.get("row_svt"), entry.get("column_svt"))

        return None

    def its3_to_local(
            self,
            id_its3: int,
            sn_prefix: Optional[str] = None
    ) -> Optional[Tuple[int, int, str]]:
        """
        Convert ITS3 die ID to local ASIC coordinates.

        Args:
            id_its3: ITS3 die identifier
            sn_prefix: Optional ASIC serial number prefix to filter by

        Returns:
            Tuple of (row_local, column_local, SN_prefix) if found, None otherwise
        """
        if not self.conversion_map:
            print("⚠️ No conversion map loaded")
            return None

        for entry in self.conversion_map:
            if entry.get("id_its3") == id_its3:
                if sn_prefix and entry.get("SN_prefix") != sn_prefix:
                    continue
                return (entry.get("row_local"), entry.get("column_local"), entry.get("SN_prefix"))

        return None

    def local_to_its3(
            self,
            row_local: int,
            column_local: int,
            sn_prefix: str
    ) -> Optional[int]:
        """
        Convert local ASIC coordinates to ITS3 die ID.

        Args:
            row_local: Local row coordinate
            column_local: Local column coordinate
            sn_prefix: ASIC serial number prefix (required)

        Returns:
            id_its3 integer if found, None otherwise
        """
        if not self.conversion_map:
            print("⚠️ No conversion map loaded")
            return None

        if not sn_prefix:
            print("⚠️ SN prefix is required for local to ITS3 conversion")
            return None

        for entry in self.conversion_map:
            if (entry.get("row_local") == row_local and
                    entry.get("column_local") == column_local and
                    entry.get("SN_prefix") == sn_prefix):
                return entry.get("id_its3")

        return None

    def get_asic_bounds(self, sn_prefix: str) -> Optional[Dict]:
        """
        Get the bounds (min/max coordinates) for a specific ASIC.

        Args:
            sn_prefix: ASIC serial number prefix

        Returns:
            Dictionary with min/max coordinates or None

        Example:
            converter.get_asic_bounds("babyMOSAIX-2")
            # Returns: {
            #   'row_local_min': 0, 'row_local_max': 0,
            #   'col_local_min': 0, 'col_local_max': 5,
            #   'row_global_min': 6, 'row_global_max': 6,
            #   'col_global_min': 2, 'col_global_max': 7,
            #   'total_dies': 6
            # }
        """
        if not self.conversion_map:
            return None

        # Filter entries for this ASIC
        asic_entries = [e for e in self.conversion_map if e.get("SN_prefix") == sn_prefix]

        if not asic_entries:
            return None

        # Calculate bounds
        bounds = {
            'row_local_min': min(e['row_local'] for e in asic_entries),
            'row_local_max': max(e['row_local'] for e in asic_entries),
            'col_local_min': min(e['column_local'] for e in asic_entries),
            'col_local_max': max(e['column_local'] for e in asic_entries),
            'row_global_min': min(e['row_global'] for e in asic_entries),
            'row_global_max': max(e['row_global'] for e in asic_entries),
            'col_global_min': min(e['column_global'] for e in asic_entries),
            'col_global_max': max(e['column_global'] for e in asic_entries),
            'total_dies': len(asic_entries)
        }

        return bounds

    def list_asics(self) -> List[str]:
        """
        Get list of all ASIC SN prefixes in the conversion map.

        Returns:
            List of unique SN prefixes
        """
        if not self.conversion_map:
            return []

        prefixes = set(entry.get("SN_prefix") for entry in self.conversion_map)
        return sorted(prefixes)

    def get_all_coordinates_for_asic(self, sn_prefix: str) -> List[Dict]:
        """
        Get all coordinate mappings for a specific ASIC.

        Args:
            sn_prefix: ASIC serial number prefix

        Returns:
            List of coordinate mappings
        """
        if not self.conversion_map:
            return []

        return [
            {
                'row_global': e['row_global'],
                'column_global': e['column_global'],
                'row_local': e['row_local'],
                'column_local': e['column_local']
            }
            for e in self.conversion_map
            if e.get("SN_prefix") == sn_prefix
        ]

    def print_conversion_table(self, sn_prefix: Optional[str] = None):
        """
        Print a formatted conversion table.

        Args:
            sn_prefix: Optional - filter by specific ASIC
        """
        if not self.conversion_map:
            print("No conversion map loaded")
            return

        # Filter entries
        if sn_prefix:
            entries = [e for e in self.conversion_map if e.get("SN_prefix") == sn_prefix]
            print(f"\n📋 Conversion Table for {sn_prefix}")
        else:
            entries = self.conversion_map
            print(f"\n📋 Full Conversion Table")

        print("=" * 80)
        print(f"{'Global (Row,Col)':<20} {'Local (Row,Col)':<20} {'ASIC':<20}")
        print("=" * 80)

        for entry in entries:
            global_coord = f"({entry['row_global']}, {entry['column_global']})"
            local_coord = f"({entry['row_local']}, {entry['column_local']})"
            asic = entry.get("SN_prefix", "")

            print(f"{global_coord:<20} {local_coord:<20} {asic:<20}")

        print("=" * 80)
        print(f"Total entries: {len(entries)}\n")


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

# Global converter instance
_converter_instance = None


def get_converter(conversion_map_path: Optional[str] = None) -> CoordinateConverter:
    """
    Get or create singleton CoordinateConverter instance.

    Args:
        conversion_map_path: Path to conversion map JSON file

    Returns:
        CoordinateConverter instance
    """
    global _converter_instance

    if _converter_instance is None:
        _converter_instance = CoordinateConverter(conversion_map_path)
    elif conversion_map_path:
        # Reload with new map
        _converter_instance.load_conversion_map(conversion_map_path)

    return _converter_instance


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    converter = CoordinateConverter()
    converter.load_conversion_map("configs/WPMapConversion.json")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing Global → Local")
    print("-" * 80)
    # (row_global, col_global) → expected (row_local, col_local, sn_prefix)
    test_global_to_local = [
        ((3, 2),  (0,   0, "babyMOSAIX")),
        ((6, 2),  (1,   1, "babyMOSAIX")),
        ((6, 7),  (-4,  1, "babyMOSAIX")),
        ((30, 3), (0,   9, "babyMOSAIX")),
        ((33, 5), (-3, 10, "babyMOSAIX")),
        ((16, 1), (0,   2, "MOSAIX")),
        ((20, 1), (0,  -2, "MOSAIX")),
        ((99, 99), None),                   # should NOT be found
    ]
    for (rg, cg), expected in test_global_to_local:
        result = converter.global_to_local(rg, cg)
        status = "✅" if result == expected else "❌"
        print(f"{status} Global ({rg},{cg}) → {result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing Local → Global")
    print("-" * 80)
    # (row_local, col_local, sn_prefix) → expected (row_global, col_global)
    test_local_to_global = [
        ((0,   0, "babyMOSAIX"),  (3,  2)),
        ((1,   1, "babyMOSAIX"),  (6,  2)),
        ((-4,  1, "babyMOSAIX"),  (6,  7)),
        ((0,   9, "babyMOSAIX"),  (30, 3)),
        ((-3, 10, "babyMOSAIX"),  (33, 5)),
        ((0,   2, "MOSAIX"),      (16, 1)),
        ((0,  -2, "MOSAIX"),      (20, 1)),
        ((99, 99, "babyMOSAIX"),  None),    # should NOT be found
    ]
    for (rl, cl, sn), expected in test_local_to_global:
        result = converter.local_to_global(rl, cl, sn)
        status = "✅" if result == expected else "❌"
        print(f"{status} Local ({rl},{cl}) on {sn} → {result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing SVT → Local")
    print("-" * 80)
    # (row_svt, col_svt, sn_prefix) → expected (row_local, col_local, sn_prefix)
    test_svt_to_local = [
        ((1, 1, "babyMOSAIX"),  (0,   0, "babyMOSAIX")),
        ((2, 1, "babyMOSAIX"),  (1,   1, "babyMOSAIX")),
        ((2, 6, "babyMOSAIX"),  (-4,  1, "babyMOSAIX")),
        ((3, 2, "babyMOSAIX"),  (0,   9, "babyMOSAIX")),
        ((4, 4, "babyMOSAIX"),  (-3, 10, "babyMOSAIX")),
        ((1, 1, "MOSAIX"),      (0,   2, "MOSAIX")),
        ((5, 1, "MOSAIX"),      (0,  -2, "MOSAIX")),
        ((9, 9, "babyMOSAIX"),  None),      # should NOT be found
    ]
    for (rs, cs, sn), expected in test_svt_to_local:
        result = converter.svt_to_local(rs, cs, sn)
        status = "✅" if result == expected else "❌"
        print(f"{status} SVT ({rs},{cs}) on {sn} → {result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing Local → SVT")
    print("-" * 80)
    # (row_local, col_local, sn_prefix) → expected (row_svt, col_svt)
    test_local_to_svt = [
        ((0,   0, "babyMOSAIX"),  (1, 1)),
        ((1,   1, "babyMOSAIX"),  (2, 1)),
        ((-4,  1, "babyMOSAIX"),  (2, 6)),
        ((0,   9, "babyMOSAIX"),  (3, 2)),
        ((-3, 10, "babyMOSAIX"),  (4, 4)),
        ((0,   2, "MOSAIX"),      (1, 1)),
        ((0,  -2, "MOSAIX"),      (5, 1)),
        ((99, 99, "babyMOSAIX"),  None),    # should NOT be found
    ]
    for (rl, cl, sn), expected in test_local_to_svt:
        result = converter.local_to_svt(rl, cl, sn)
        status = "✅" if result == expected else "❌"
        print(f"{status} Local ({rl},{cl}) on {sn} → {result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing ITS3 → Local")
    print("-" * 80)
    # (id_its3, sn_prefix) → expected (row_local, col_local, sn_prefix)
    test_its3_to_local = [
        ((3,  "babyMOSAIX"),  (0,   0, "babyMOSAIX")),
        ((9,  "babyMOSAIX"),  (1,   1, "babyMOSAIX")),
        ((4,  "babyMOSAIX"),  (-4,  1, "babyMOSAIX")),
        ((14, "babyMOSAIX"),  (0,   9, "babyMOSAIX")),
        ((16, "babyMOSAIX"),  (-3, 10, "babyMOSAIX")),
        ((0,  "MOSAIX"),      (0,   2, "MOSAIX")),
        ((4,  "MOSAIX"),      (0,  -2, "MOSAIX")),
        ((99, "babyMOSAIX"),  None),        # should NOT be found
    ]
    for (id_i, sn), expected in test_its3_to_local:
        result = converter.its3_to_local(id_i, sn)
        status = "✅" if result == expected else "❌"
        print(f"{status} ITS3 id={id_i} on {sn} → {result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n🧪 Testing Local → ITS3")
    print("-" * 80)
    # (row_local, col_local, sn_prefix) → expected id_its3
    test_local_to_its3 = [
        ((0,   0, "babyMOSAIX"),  3),
        ((1,   1, "babyMOSAIX"),  9),
        ((-4,  1, "babyMOSAIX"),  4),
        ((0,   9, "babyMOSAIX"),  14),
        ((-3, 10, "babyMOSAIX"),  16),
        ((0,   2, "MOSAIX"),      0),
        ((0,  -2, "MOSAIX"),      4),
        ((99, 99, "babyMOSAIX"),  None),    # should NOT be found
    ]
    for (rl, cl, sn), expected in test_local_to_its3:
        result = converter.local_to_its3(rl, cl, sn)
        status = "✅" if result == expected else "❌"
        print(f"{status} Local ({rl},{cl}) on {sn} → ITS3 id={result}  (expected {expected})")

    # -------------------------------------------------------------------------
    print("\n📋 Conversion table for babyMOSAIX")
    converter.print_conversion_table("babyMOSAIX")
    print("\n📋 Conversion table for MOSAIX")
    converter.print_conversion_table("MOSAIX")
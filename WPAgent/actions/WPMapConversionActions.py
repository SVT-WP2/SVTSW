from utilities.WPMapConverter import get_converter
import os


def convert_global_to_local(row_global=None, column_global=None, sn_prefix=None,
                            conversion_map=None):
    """
    Convert global die coordinates to local ASIC coordinates.

    Args:
        row_global (int): Global row coordinate
        column_global (int): Global column coordinate
        sn_prefix (str, optional): ASIC serial number prefix to filter by
        conversion_map (str, optional): Path to conversion map JSON file

    Returns:
        dict: {
            "status": "success" or "error",
            "output": message,
            "data": {
                "row_global": int,
                "column_global": int,
                "row_local": int,
                "column_local": int,
                "sn_prefix": str
            }
        }

    Example:
        python main.py send ConvertGlobalToLocal --params='{
            "row_global": 6,
            "column_global": 2
        }'

        # Returns: {"row_local": 0, "column_local": 0, "sn_prefix": "babyMOSAIX-2"}
    """

    # Validate parameters
    if row_global is None or column_global is None:
        return {
            "status": "error",
            "output": "Missing required parameters: row_global and column_global"
        }

    try:
        # Get converter instance
        converter = get_converter()

        # Load conversion map if provided
        if conversion_map:
            if not converter.load_conversion_map(conversion_map):
                return {
                    "status": "error",
                    "output": f"Failed to load conversion map from {conversion_map}"
                }

        # Check if map is loaded
        if not converter.conversion_map:
            # Try default location
            default_map = "configs/WPMapConversion.json"
            if os.path.exists(default_map):
                converter.load_conversion_map(default_map)
            else:
                return {
                    "status": "error",
                    "output": "No conversion map loaded. Use 'conversion_map' parameter to specify path."
                }

        # Perform conversion
        result = converter.global_to_local(row_global, column_global, sn_prefix)

        if result:
            row_local, column_local, found_sn_prefix = result

            return {
                "status": "success",
                "output": f"Global ({row_global},{column_global}) → Local ({row_local},{column_local}) on {found_sn_prefix}",
                "data": {
                    "row_global": row_global,
                    "column_global": column_global,
                    "row_local": row_local,
                    "column_local": column_local,
                    "sn_prefix": found_sn_prefix
                }
            }
        else:
            return {
                "status": "error",
                "output": f"No mapping found for global coordinates ({row_global},{column_global})" +
                          (f" with SN prefix '{sn_prefix}'" if sn_prefix else "")
            }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Coordinate conversion failed: {str(e)}"
        }


def convert_local_to_global(row_local=None, column_local=None, sn_prefix=None,
                            conversion_map=None):
    """
    Convert local ASIC coordinates to global die coordinates.

    Args:
        row_local (int): Local row coordinate
        column_local (int): Local column coordinate
        sn_prefix (str): ASIC serial number prefix (REQUIRED)
        conversion_map (str, optional): Path to conversion map JSON file

    Returns:
        dict: {
            "status": "success" or "error",
            "output": message,
            "data": {
                "row_local": int,
                "column_local": int,
                "row_global": int,
                "column_global": int,
                "sn_prefix": str
            }
        }

    Example:
        python main.py send ConvertLocalToGlobal --params='{
            "row_local": 0,
            "column_local": 0,
            "sn_prefix": "babyMOSAIX-2"
        }'

        # Returns: {"row_global": 6, "column_global": 2}
    """

    # Validate parameters
    if row_local is None or column_local is None:
        return {
            "status": "error",
            "output": "Missing required parameters: row_local and column_local"
        }

    if not sn_prefix:
        return {
            "status": "error",
            "output": "Missing required parameter: sn_prefix"
        }

    try:
        # Get converter instance
        converter = get_converter()

        # Load conversion map if provided
        if conversion_map:
            if not converter.load_conversion_map(conversion_map):
                return {
                    "status": "error",
                    "output": f"Failed to load conversion map from {conversion_map}"
                }

        # Check if map is loaded
        if not converter.conversion_map:
            # Try default location
            default_map = "configs/WPMapConversion.json""
            if os.path.exists(default_map):
                converter.load_conversion_map(default_map)
            else:
                return {
                    "status": "error",
                    "output": "No conversion map loaded. Use 'conversion_map' parameter to specify path."
                }

        # Perform conversion
        result = converter.local_to_global(row_local, column_local, sn_prefix)

        if result:
            row_global, column_global = result

            return {
                "status": "success",
                "output": f"Local ({row_local},{column_local}) on {sn_prefix} → Global ({row_global},{column_global})",
                "data": {
                    "row_local": row_local,
                    "column_local": column_local,
                    "row_global": row_global,
                    "column_global": column_global,
                    "sn_prefix": sn_prefix
                }
            }
        else:
            return {
                "status": "error",
                "output": f"No mapping found for local coordinates ({row_local},{column_local}) on {sn_prefix}"
            }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Coordinate conversion failed: {str(e)}"
        }


def load_conversion_map(conversion_map=None):
    """
    Load a coordinate conversion map from file.

    Args:
        conversion_map (str): Path to conversion map JSON file

    Returns:
        dict: Status message

    Example:
        python main.py send LoadConversionMap --params='{
            "conversion_map": "coordinate_maps/babymosaix_conversion.json"
        }'
    """

    if not conversion_map:
        return {
            "status": "error",
            "output": "Missing required parameter: conversion_map"
        }

    try:
        converter = get_converter()

        if converter.load_conversion_map(conversion_map):
            asics = converter.list_asics()
            return {
                "status": "success",
                "output": f"Loaded conversion map with {len(converter.conversion_map)} entries for {len(asics)} ASICs",
                "data": {
                    "total_entries": len(converter.conversion_map),
                    "asic_type": converter.asic_type,
                    "asic_prefixes": asics
                }
            }
        else:
            return {
                "status": "error",
                "output": f"Failed to load conversion map from {conversion_map}"
            }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Failed to load conversion map: {str(e)}"
        }


def list_coordinate_asics(conversion_map=None):
    """
    List all ASICs in the conversion map.

    Args:
        conversion_map (str, optional): Path to conversion map JSON file

    Returns:
        dict: List of ASIC prefixes

    Example:
        python main.py send ListCoordinateAsics
    """

    try:
        converter = get_converter()

        # Load map if provided
        if conversion_map:
            converter.load_conversion_map(conversion_map)

        if not converter.conversion_map:
            return {
                "status": "error",
                "output": "No conversion map loaded"
            }

        asics = converter.list_asics()

        # Get bounds for each ASIC
        asic_info = []
        for sn_prefix in asics:
            bounds = converter.get_asic_bounds(sn_prefix)
            if bounds:
                asic_info.append({
                    "sn_prefix": sn_prefix,
                    "total_dies": bounds['total_dies'],
                    "global_range": f"({bounds['row_global_min']}-{bounds['row_global_max']}, {bounds['col_global_min']}-{bounds['col_global_max']})",
                    "local_range": f"({bounds['row_local_min']}-{bounds['row_local_max']}, {bounds['col_local_min']}-{bounds['col_local_max']})"
                })

        return {
            "status": "success",
            "output": f"Found {len(asics)} ASIC(s) in conversion map",
            "data": {
                "asic_type": converter.asic_type,
                "asics": asic_info
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "output": f"Failed to list ASICs: {str(e)}"
        }
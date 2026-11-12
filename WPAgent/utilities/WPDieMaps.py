"""
WPDieMaps - die labels -> local die coordinates (col, row), using the die map of
the wafer type of the OPEN PROJECT.

One map per wafer type, in configs/:
    WPMapConversion_<wafer type>.json      e.g. WPMapConversion_ER2.json, WPMapConversion_ER2B.json

The wafer type is the first part of the SENTIO project name:
    ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW      -> ER2
    ER2B_Pad_babyMOSAIX_Vertical_V0_NotchW_ArrowW -> ER2B
so a new wafer type only needs its map file. A map lists every die explicitly
(see the "_help" in the map files):
    {"label": "BAM03", "aliases": ["babyMOSAIX-1_1"], "SN_prefix": "babyMOSAIX",
     "column_local": 0, "row_local": 0, ...}

label_to_coordinates() trusts only the map of the open project, and refuses:
  * a label that is not in that map (e.g. an ER2 label while an ER2B project is open);
  * an SVT serial number of another wafer type (suffix _<wafer type>-W<n>);
  * a die of the other ASIC project (the local coordinates of a babyMOSAIX die
    only exist in the babyMOSAIX project, those of a MOSAIX die in the MOSAIX one).
"""

import json
import os
import re

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "configs")
MAP_FILE = "WPMapConversion_{}.json"

_SVT_SUFFIX = re.compile(r"_([A-Za-z0-9]+)-W\d+$")    # "..._ER2-W1": wafer type ER2, wafer 1
_maps = {}                                           # wafer type -> loaded map (cache)


def wafer_type(project):
    """Wafer type of a SENTIO project: the part of its name before the first "_"."""
    name = str(project or "").strip()
    if not name:
        raise ValueError("No project open: the die map is chosen from the open project")
    return name.split("_", 1)[0]


def map_path(wafer):
    """configs/WPMapConversion_<wafer>.json"""
    return os.path.join(CONFIG_DIR, MAP_FILE.format(wafer))


def available_wafer_types():
    """Wafer types that have a die map in configs/."""
    prefix, suffix = MAP_FILE.split("{}")
    return sorted(f[len(prefix):-len(suffix)] for f in os.listdir(CONFIG_DIR)
                  if f.startswith(prefix) and f.endswith(suffix))


def die_map(wafer):
    """The die map of a wafer type: {"wafer_type", "dies", "by_name": {label or alias: die}}."""
    if wafer not in _maps:
        path = map_path(wafer)
        if not os.path.exists(path):
            raise ValueError(f"No die map for wafer type '{wafer}': expected {path} "
                             f"(available: {', '.join(available_wafer_types()) or 'none'})")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        by_name = {}
        for die in data["dies"]:
            for name in [die["label"], *die.get("aliases", [])]:
                if name in by_name:
                    raise ValueError(f"{path}: name '{name}' is used by two dies")
                by_name[name] = die
        _maps[wafer] = {"wafer_type": data.get("wafer_type", wafer),
                        "dies": data["dies"], "by_name": by_name}
    return _maps[wafer]


def project_asic(project, dies):
    """SN_prefix of the dies of this project: the longest SN_prefix of the map found in
    the project name ("babyMOSAIX" wins over "MOSAIX"), or None."""
    prefixes = sorted({d["SN_prefix"] for d in dies}, key=len, reverse=True)
    return next((p for p in prefixes if p in str(project)), None)


def label_to_coordinates(label, project):
    """(col, row) of a die label, alias or SVT serial number in the open project.

    Raises ValueError, with the reason, when the label cannot be trusted for this project.
    """
    wafer = wafer_type(project)
    dmap = die_map(wafer)
    name = str(label).strip()

    suffix = _SVT_SUFFIX.search(name)               # SVT serial number: "babyMOSAIX-1_1_ER2-W1"
    if suffix:
        if suffix.group(1) != wafer:
            raise ValueError(f"'{label}' is a {suffix.group(1)} serial number, "
                             f"but the open project '{project}' is {wafer}")
        name = name[:suffix.start()]

    die = dmap["by_name"].get(name)
    if die is None:
        labels = ", ".join(d["label"] for d in dmap["dies"])
        raise ValueError(f"Unknown {wafer} die '{label}' (project '{project}'). Labels: {labels}")

    asic = project_asic(project, dmap["dies"])
    if asic is None:
        raise ValueError(f"Cannot tell from its name which dies project '{project}' contains")
    if die["SN_prefix"] != asic:
        raise ValueError(f"{wafer} die '{label}' is a {die['SN_prefix']} die, but the open project "
                         f"'{project}' is {asic}: open the {die['SN_prefix']} project first")

    col, row = die["column_local"], die["row_local"]
    print(f"   📍 {wafer} die '{label}' ({die['label']}, {die['SN_prefix']}) "
          f"→ Local(col={col}, row={row})")
    return col, row

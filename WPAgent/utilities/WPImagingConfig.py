"""
Imaging settings shared by the die-imaging sequences.

configs/WPImagingConfig.json holds the raster start: the offset (um) from the die
position reached by MoveChuckRowColumn to the centre of the first tile, by name.
"LEC" serves all ER2 / ER2B dies and imaging types (same LEC pad pattern and
probe card). GenerateRasterSteps uses it when start_x_um / start_y_um are empty:

    {"LEC": {"start_x_um": 29750, "start_y_um": -27500}}
"""

import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "configs", "WPImagingConfig.json")


def raster_start(name="LEC", path=CONFIG_PATH):
    """(start_x_um, start_y_um) of block `name` of the imaging config. Raises ValueError."""
    with open(path, encoding="utf-8") as f:
        blocks = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    if name not in blocks:
        raise ValueError(f"No raster start '{name}' in {path}; known: {sorted(blocks)}")
    try:
        return float(blocks[name]["start_x_um"]), float(blocks[name]["start_y_um"])
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError(f"{path}: block '{name}' needs numeric start_x_um and start_y_um ({e})")

"""
Die maps per wafer type (utilities/WPDieMaps.py, configs/WPMapConversion_<type>.json).

Run:  python3 -m pytest tests/unit/TestDieMaps.py -q
"""

import csv
import json
import os

import pytest

from utilities.WPDieMaps import available_wafer_types, die_map, label_to_coordinates, wafer_type

ITS3 = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ITS3TestAgent")
PROJECTS = {
    ("ER2", "babyMOSAIX"): "ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW",
    ("ER2", "MOSAIX"): "ER2_MOSAIX_Vertical_V0_NotchW_ArrowW",
    ("ER2B", "babyMOSAIX"): "ER2B_babyMOSAIX_Vertical_V0_NotchW_ArrowW",
    ("ER2B", "MOSAIX"): "ER2B_MOSAIX_Vertical_V0_NotchW_ArrowW",
}


def test_wafer_type_from_project():
    assert wafer_type("ER2_babyMOSAIX_Vertical_V0_NotchW_ArrowW") == "ER2"
    assert wafer_type("ER2B_Pad_MOSAIX_Vertical_V0_NotchW_ArrowW") == "ER2B"
    with pytest.raises(ValueError, match="No project open"):
        wafer_type(None)
    assert {"ER2", "ER2B"} <= set(available_wafer_types())


@pytest.mark.parametrize("wafer, run_list", [("ER2", "run_list.csv"), ("ER2B", "run_list_er2b.csv")])
def test_maps_match_the_its3_run_lists(wafer, run_list):
    path = os.path.join(ITS3, run_list)
    if not os.path.exists(path):
        pytest.skip("ITS3TestAgent run list not available")
    for r in csv.DictReader(open(path)):
        die = die_map(wafer)["by_name"][r["DIE"]]
        project = PROJECTS[(wafer, die["SN_prefix"])]
        assert label_to_coordinates(r["DIE"], project) == tuple(json.loads(r["WP[col,row]"])), r["DIE"]


def test_same_label_different_wafer_types():
    assert label_to_coordinates("BAM01", PROJECTS[("ER2", "babyMOSAIX")]) == (-2, 0)
    assert label_to_coordinates("BAM01", PROJECTS[("ER2B", "babyMOSAIX")]) == (0, 0)


def test_svt_serial_numbers():
    assert label_to_coordinates("babyMOSAIX-1_1_ER2-W1", PROJECTS[("ER2", "babyMOSAIX")]) == (0, 0)
    assert label_to_coordinates("MOSAIX-1_ER2-W7", PROJECTS[("ER2", "MOSAIX")]) == (0, 2)
    with pytest.raises(ValueError, match="is a ER2 serial number"):
        label_to_coordinates("babyMOSAIX-1_1_ER2-W1", PROJECTS[("ER2B", "babyMOSAIX")])


def test_refusals():
    with pytest.raises(ValueError, match="open the MOSAIX project"):
        label_to_coordinates("SEG0", PROJECTS[("ER2", "babyMOSAIX")])
    with pytest.raises(ValueError, match="open the babyMOSAIX project"):
        label_to_coordinates("BAM00", PROJECTS[("ER2B", "MOSAIX")])
    with pytest.raises(ValueError, match="Unknown ER2B die"):
        label_to_coordinates("SEG0", PROJECTS[("ER2B", "MOSAIX")])
    with pytest.raises(ValueError, match="No die map for wafer type 'ER3'"):
        label_to_coordinates("BAM00", "ER3_babyMOSAIX_Vertical")

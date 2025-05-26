import json

def extract_nkf7_interger_coords(json_path, debug=False):
    with open(json_path, "r") as f:
        data = json.load(f)

    map_groups = data.get("MapGroups", {})
    groups = data.get("Groups", {})

    nkf7_coords = {}
    row_summary = {}

    for row_key, row_data in map_groups.items():
        if not row_key.startswith("MapGroupsRow"):
            continue

        try:
            row_index = int(row_key.replace("MapGroupsRow", ""))
        except ValueError:
            continue

        columns = row_data.get("MapGroupsColumns", [])
        row_nkf7_count = 0
        active_cols = []

        for col_index, col_entry in enumerate(columns):
            group_name = col_entry.get("GroupName")
            if group_name not in {"Group2", "Group9"}:
                continue
            if group_name not in groups:
                continue

            group_asics = groups[group_name]
            interger = col_entry.get("MechanicallyIntergerASICs", [])

            target_pos = 8 if group_name == "Group2" else 7

            if interger == ["All"] or target_pos in interger:
                if target_pos < len(group_asics):
                    family = group_asics[target_pos].get("FamilyType", "")
                    if "NKF7" in family:
                        key = f"NKF7_S_{-col_index}_{-row_index}"
                        nkf7_coords[key] = [-col_index, -row_index]
                        row_nkf7_count += 1
                        active_cols.append(col_index)
                        if debug:
                            print(f"Row {row_key}, Col {col_index}: NKF7 at PosInGroup {target_pos} in {group_name}")

        if row_nkf7_count > 0:
            row_summary[row_key] = {
                "count": row_nkf7_count,
                "columns": active_cols
            }

    print(f"✅ Total NKF7 ASIC placements found: {len(nkf7_coords)}")
    print(f"The rows with good NKf7 are: {row_summary}")
    print(f"✅ Rows with NKF7 ASICs: {len(row_summary)}")

    return nkf7_coords, row_summary




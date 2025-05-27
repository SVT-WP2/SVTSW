import json
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Extracts NKF7 ASIC coordinates and summary by scanning Group2/Group9 for testable ASICs
def extract_nkf7_interger_coords(json_path, debug=False):
    with open(json_path, "r") as f:
        data = json.load(f)

    map_groups = data.get("MapGroups", {})
    groups = data.get("Groups", {})

    nkf7_coords = {}       # Stores wafer coordinates per ASIC (for full map)
    row_summary = {}       # Stores row-wise summary for only rows that have NKF7: count + list of column indexes

    for row_key, row_data in map_groups.items():
        if not row_key.startswith("MapGroupsRow"):
            continue  # Skip irrelevant keys

        try:
            row_index = int(row_key.replace("MapGroupsRow", ""))
        except ValueError:
            continue

        columns = row_data.get("MapGroupsColumns", [])
        current_col_index = 0
        row_nkf7_count = 0
        active_cols = []

        # Loop through each group mapping block in the row
        for col_entry in columns:
            group_name = col_entry.get("GroupName")
            if group_name not in {"Group2", "Group9"}:
                # Even if it's not a target group, we still need to advance column index
                existing_asics = col_entry.get("ExistingAsics", [])
                if existing_asics == ["All"]:
                    current_col_index += len(groups.get(group_name, []))
                else:
                    current_col_index += len(existing_asics)
                continue

            # Resolve list of asics in the group
            group_asics = groups.get(group_name, [])
            interger = col_entry.get("MechanicallyIntergerASICs", [])
            existing_asics = col_entry.get("ExistingAsics", [])

            if existing_asics == ["All"]:
                asic_indices = list(range(len(group_asics)))
            else:
                asic_indices = existing_asics

            if interger == ["All"]:
                interger_indices = set(asic_indices)
            else:
                interger_indices = set(interger)

            # Determine which PosInGroup corresponds to NKF7 for each group
            target_pos = 8 if group_name == "Group2" else 7

            # Loop through all ASICs this group maps in the wafer
            for i, asic_idx in enumerate(asic_indices):
                col_idx = current_col_index + i  # Physical wafer column

                if asic_idx != target_pos:
                    continue
                if asic_idx not in interger_indices:
                    continue
                if asic_idx >= len(group_asics):
                    continue

                family = group_asics[asic_idx].get("FamilyType", "")
                if "NKF7" not in family:
                    continue

                # Register coordinate and update counters
                key = f"NKF7_S_{-col_idx}_{-row_index}"
                nkf7_coords[key] = [-col_idx, -row_index]
                row_nkf7_count += 1
                active_cols.append(col_idx)

                if debug:
                    print(f"[{row_key}] ASIC PosInGroup {asic_idx} (Group: {group_name}) at column {col_idx} is NKF7 ✅")

            current_col_index += len(asic_indices)

        if row_nkf7_count > 0:
            row_summary[row_key] = {
                "count": row_nkf7_count,
                "columns": active_cols
            }

    print(f"✅ Total NKF7 ASIC placements found: {len(nkf7_coords)}")
    return nkf7_coords, row_summary

# Plots the NKF7 layout as a grid of rectangles (one per ASIC)
def plot_nkf7_wafer_map(json_path):
    with open(json_path, "r") as f:
        row_summary = json.load(f)

    fig, ax = plt.subplots(figsize=(12, 12))

    # Add one rectangle per NKF7 coordinate
    for row_key, info in row_summary.items():
        try:
            row_index = int(row_key.replace("MapGroupsRow", ""))
        except ValueError:
            continue

        for col_index in info["columns"]:
            rect = patches.Rectangle(
                (col_index, row_index), 1, 1,  # (x, y, width, height)
                edgecolor='black',
                facecolor='blue'
            )
            ax.add_patch(rect)

    # Determine limits based on used coordinates
    all_x = [col for info in row_summary.values() for col in info["columns"]]
    all_y = [int(k.replace("MapGroupsRow", "")) for k in row_summary.keys()]
    if all_x and all_y:
        ax.set_xlim(min(all_x) - 1, max(all_x) + 2)
        ax.set_ylim(min(all_y) - 1, max(all_y) + 2)

    ax.set_aspect("equal")
    ax.set_title("NKF7 Wafer Map (Rectangular Tiles)", fontsize=14)
    ax.set_xlabel("Column Index")
    ax.set_ylabel("Row Index")
    ax.invert_yaxis()  # Match visual layout from wafer images
    ax.grid(True)

    plt.tight_layout()
    plt.show()

# Main function: run parser, save summary, and show plot
def main():
    input_path = "ER1GlobalWaferMap.json"
    output_path = "nkf7_row_summary.json"

    try:
        _, row_summary = extract_nkf7_interger_coords(input_path, debug=False)

        # Save summary to JSON
        with open(output_path, "w") as f:
            json.dump(row_summary, f, indent=2)

        print(f"✅ Summary saved to {output_path}")
        print(f"✅ Rows with NKF7 ASICs: {len(row_summary)}")

    except Exception as e:
        print(f"❌ Error: {e}")

    # Always plot after summary generation
    plot_nkf7_wafer_map(output_path)

if __name__ == "__main__":
    main()

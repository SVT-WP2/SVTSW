from drivers.WPFactory import get_prober
from utilities.WPHelpers import resolve_project_parameters
from utilities.WPResponseBuilder import ResponseBuilder
import os
from stateMachine.WpAgentStateMachineGlobals import agentStateMachine
from stateMachine.WpAgentStateMachine import WPAgentState
from utilities.WPValidationDecorator import validate_command
from utilities.WPMapConverter import get_converter

from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters
from drivers.WPFactory import get_current_prober
from actions.WPTestingActions import _ensure_initialized
from actions.WPTestingActions import move_chuck_die

def sleep(seconds=1, user=None, waferAgentName=None, **kwargs):
    """Sleep for a given number of seconds."""
    import time
    seconds = float(seconds)
    print(f"   💤 Sleeping {seconds}s...")
    time.sleep(seconds)
    return ResponseBuilder.success("SleepReply", f"Slept {seconds}s")
    
def generate_raster_steps(
        num_columns=1,
        num_rows=1,
        column_spacing_um=-2623,
        row_spacing_um=2133,
        start_x_um=-21088,
        start_y_um=-27245,
        settle_time_s=1,
        user=None,
        waferAgentName=None,
        **kwargs
):
    """Pre-compute raster positions and filenames — no prober calls."""

    # coerce — YAML/Kafka may deliver these as strings or wrong types
    num_columns       = int(num_columns)
    num_rows          = int(num_rows)
    column_spacing_um = float(column_spacing_um)
    row_spacing_um    = float(row_spacing_um)
    start_x_um        = float(start_x_um)
    start_y_um        = float(start_y_um)

    print(f"   🔍 RasterSteps: cols={num_columns} rows={num_rows} "
          f"x={start_x_um} y={start_y_um} "
          f"col_sp={column_spacing_um} row_sp={row_spacing_um}")

    steps = []

    steps.append({"action": "move", "x": start_x_um, "y": start_y_um, "filename": None, "settle": settle_time_s})
    steps.append({"action": "move", "x": column_spacing_um / 4, "y": -row_spacing_um / 4, "filename": None, "settle": settle_time_s})

    for row in range(num_rows):
        for col in range(num_columns):
            fname = f"{(num_rows - 1 - row):02d}_{col:02d}.jpg"
            steps.append({"action": "snapshot", "x": 0, "y": 0, "filename": fname, "settle": 0})

            if col < num_columns - 1:
                steps.append({"action": "move", "x": -abs(column_spacing_um), "y": 0, "filename": None, "settle": settle_time_s})

        if row < num_rows - 1:
            steps.append({
                "action": "move",
                "x": +abs(column_spacing_um) * (num_columns - 1),
                "y": -abs(row_spacing_um),
                "filename": None,
                "settle": settle_time_s
            })

    return {"status": "Success", "steps": steps}

def stitch_images_for_die(folder, user=None, waferAgentName=None, **kwargs):
    try:
        from utilities.WPImageStitching import stitch_images
        from datetime import datetime

        die_name  = os.path.basename(os.path.normpath(folder))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{timestamp}_{die_name}.jpg"

        stitched_path = stitch_images(folder=folder, output_filename=output_filename)
        return ResponseBuilder.success("StitchImagesReply", f"Stitched -> {stitched_path}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("StitchImagesReply", str(e), 500)


def cleanup_raster_images(folder, user=None, waferAgentName=None, **kwargs):
    """Delete all grid tile images, keeping only the stitched result."""
    import glob
    try:
        # tiles are named 00_00.jpg, 01_03.jpg etc
        pattern = os.path.join(folder, "??_??.jpg")
        tiles = glob.glob(pattern)
        for f in tiles:
            os.remove(f)
        return ResponseBuilder.success("CleanupRasterImagesReply", f"Deleted {len(tiles)} tiles from {folder}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("CleanupRasterImagesReply", str(e), 500)
        
def take_image(
        snapshot_type="CameraRaw",
        save_locally=True,
        outputDir="screenshots",
        num_columns=5,              #BAM: 28882x23475 10columns 8rows
        num_rows=5,
        column_spacing_um=-2623,
        row_spacing_um=2133,
        start_x_um=-21088,
        start_y_um=-27245,
        settle_time_s=1,
        user=None,
        waferAgentName=None
):
    """
    Step the chuck in a row/column raster, snap a JPEG at each position,
    then stitch all tiles into a single output image.
    Images saved as 00_00.jpg under outputDir.
    Starts at (start_x_um, start_y_um) absolutely, then steps relatively.
    """

    import time

    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("TakeImageReply", error["output"], 400)

    try:
        from utilities.WPImageStitching import stitch_images

        prober = get_current_prober()        
        saved_files = []

        os.makedirs(outputDir, exist_ok=True)

        prober.find_home()
        prober.go_to_die(-3, 0)
        prober.move_chuck_xy(start_x_um, start_y_um, "Relative")
        prober.move_chuck_xy(column_spacing_um/4, -row_spacing_um/4, "Relative")
        time.sleep(settle_time_s)

        for row in range(num_rows):
            for col in range(num_columns):

                # row=0 is bottom-left → invert row index for filename
                fname = f"{(num_rows - 1 - row):02d}_{col:02d}.jpg"

                filepath = prober.take_screenshot(
                    filename=fname,
                    snapshot_type=snapshot_type,
                    save_locally=save_locally,
                    output_dir=outputDir
                )
                saved_files.append(os.path.abspath(filepath))

                # Step RIGHT after each column (except the last)
                if col < num_columns - 1:
                    prober.move_chuck_xy(-abs(column_spacing_um), 0, "Relative")
                    time.sleep(settle_time_s)

            # After finishing a row: reset X to col 0, step UP one row
            if row < num_rows - 1:
                prober.move_chuck_xy(
                    +abs(column_spacing_um) * (num_columns - 1),  # ← back to col 0
                    -abs(row_spacing_um),                          # ↑ step up (flipped)
                    "Relative"
                )
                time.sleep(settle_time_s)


        stitched_path = stitch_images(folder=outputDir)

        return ResponseBuilder.success(
            "TakeImageReply",
            f"Captured {len(saved_files)} images, stitched -> {stitched_path}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("TakeImageReply", str(e), 500)

def take_screenshot(
        fileName=None,
        snapshot_type="CameraRaw",
        save_locally=True,
        outputDir="screenshotsSVT",
        user=None,
        waferAgentName=None
):
    """
    Take a screenshot from prober camera.

    Args:
        fileName: Optional filename (auto-generated if not provided, always saved as .jpg)
        snapshot_type: "CameraRaw" (raw sensor image) or "WithOverlays" (SENTIO UI overlay)
        save_locally: True to save on WP Agent machine, False to save on prober PC
        outputDir: Directory to save screenshots (only used when save_locally=True)
        user: User performing action
        waferAgentName: Agent name

    Returns:
        Response with screenshot absolute path
    """
    error = _ensure_initialized()
    if error:
        return ResponseBuilder.error("TakeScreenshotReply", error["output"], 400)

    try:
        prober = get_current_prober()

        filepath = prober.take_screenshot(
            filename=fileName,
            snapshot_type=snapshot_type,
            save_locally=save_locally,
            output_dir=outputDir
        )

        abs_path = os.path.abspath(filepath)

        return ResponseBuilder.success(
            "TakeScreenshotReply",
            f"Screenshot saved: {abs_path}"
        )

    except RuntimeError as e:
        return ResponseBuilder.error("TakeScreenshotReply", str(e), 400)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return ResponseBuilder.error("TakeScreenshotReply", str(e), 500)
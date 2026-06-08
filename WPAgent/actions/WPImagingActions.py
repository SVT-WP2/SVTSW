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
"""
labmaster_mcm_utils.py — Driver for Teledyne LeCroy LabMaster MCM / 10-36Zi-A

Scope family : MAUI oscilloscopes (LabMaster 10 Zi-A / MCM Zi-A)
Reference    : MAUI Oscilloscopes Remote Control and Automation Manual (Feb 2026)
               https://cdn.teledynelecroy.com/files/manuals/maui-remote-control-and-automation-manual.pdf
               (local partial text copy: manuals/maui-remote-control-and-automation-manual.txt)

Control path : IEEE 488.2 legacy GPIB commands + VBS Automation over VISA/TCP
VISA address : TCPIP0::<ip>::inst0::INSTR   (VXI-11, recommended)
               TCPIP0::<ip>::1861::SOCKET   (VICP raw socket — needs special framing, avoid)

Channel names: C1..C4 (single module) or C1..C16 (MCM with multiple modules)

Key facts verified against the manual
-------------------------------------
- settodefaultsetup blocks *OPC?/WaitUntilIdle until the panel is loaded;
  synchronize with a long-timeout query (manual, Part 2 "Timing and
  Synchronization").
- Forcing a sample rate requires app.Acquisition.Horizontal.Maximize =
  "FixedSampleRate" first; otherwise SampleRate is not user-settable.
- Even with COMM_HEADER OFF, 'C1:WAVEFORM? DAT1' answers 'DAT1,#9<len><data>'
  — the IEEE block reader must scan for '#' (handled by the base class).
- WAVEFORM_SETUP NP,0 means "return all acquired points".
- SCDP (SCREEN_DUMP) returns RAW image bytes with NO IEEE block header.
- 80 GSa/s on the 10-36Zi-A requires ≤ 2 active channels (interleaved ADCs).
"""

import csv
import struct
import time

from .instrument import Instrument, snap_125_up


class LabMasterMCM(Instrument):
    """Teledyne LeCroy LabMaster MCM Zi-A / 10-36Zi-A driver."""

    MODEL = 'Teledyne LeCroy LabMaster MCM Zi-A / 10-36Zi-A'
    DEFAULT_CHANNEL = 'C1'
    VERTICAL_DIVISIONS = 8
    HORIZONTAL_DIVISIONS = 10

    # ── Connection ────────────────────────────────────────────────────────

    def _post_connect(self):
        # Clear status registers and any pending errors from previous sessions
        self.write('*CLS')
        # Force-stop any running acquisition so the scope responds to VBS queries
        self.write("VBS 'app.Acquisition.TriggerMode = \"Stopped\"'")
        # Suppress echoed command headers in query responses
        self.write('COMM_HEADER OFF')

    # ── VBS Automation helpers ────────────────────────────────────────────

    def vbs(self, command: str) -> None:
        """Send a VBS Automation command (fire-and-forget)."""
        self.write(f"VBS '{command}'")

    def vbs_query(self, expression: str, timeout_ms: int = 10000) -> str:
        """Query a VBS Automation expression, return its string value."""
        return self.query(f"VBS? 'return={expression}'", timeout_ms=timeout_ms)

    def wait_idle(self, timeout_s: float = 30.0) -> bool:
        """Block until the scope reports idle (app.WaitUntilIdle).

        Returns True when idle, False on timeout or VISA error.
        WaitUntilIdle returns 1 on success and 0 on timeout (manual, Part 2).
        VISA errors are caught and logged so a slow scope doesn't crash the run.
        """
        try:
            result = self.vbs_query(f'app.WaitUntilIdle({timeout_s})',
                                    timeout_ms=int(timeout_s * 1000) + 5000)
            idle = result.strip() not in ('0',)
        except Exception as exc:
            print(f'[wait_idle] VISA error during WaitUntilIdle: {exc}')
            idle = False
        if not idle:
            print(f'[wait_idle] WaitUntilIdle timed out after {timeout_s} s')
        return idle

    # ── Error checking ────────────────────────────────────────────────────

    def check_errors(self) -> list:
        """CMR? returns (and clears) the command error register; 0 = OK."""
        try:
            cmr = self.query('CMR?').strip()
        except Exception as exc:                       # noqa: BLE001
            return [f'CMR? query failed: {exc}']
        return [] if cmr in ('', '0') else [f'CMR (command error register) = {cmr}']

    # ── 1. Initialize ─────────────────────────────────────────────────────

    def initialize(self, channel: str = 'C1', **options) -> None:
        """
        Bring the scope to a known state.

        options:
          default_setup (bool, default True) — recall the factory default
            setup first. Disable to preserve the current front-panel state.

        Sequence: [settodefaultsetup → long-timeout sync] → enable only the
        requested channel → stop any running acquisition.
        """
        if options.get('default_setup', True):
            self.vbs('app.SetToDefaultSetup')
            # SetToDefaultSetup can take several seconds; use a fixed sleep
            # rather than WaitUntilIdle which requires a VBS query response.
            time.sleep(8)

        # Enable only the requested channel (extend range for >4ch MCM)
        n_channels = 4
        try:
            ch_idx = int(channel[1:])
            n_channels = max(n_channels, ch_idx)
        except ValueError:
            pass
        for i in range(1, n_channels + 1):
            state = 'True' if f'C{i}' == channel.upper() else 'False'
            self.vbs(f'app.Acquisition.C{i}.View = {state}')

        # Stop any running acquisition before reconfiguring
        self.vbs('app.Acquisition.TriggerMode = "Stopped"')
        time.sleep(2)

        print(f'[initialize] Ready — active channel: {channel}')

    # ── 2. Vertical (channel) settings ────────────────────────────────────

    def set_vertical(self, channel: str = 'C1',
                     scale_V: float = None,
                     amplitude_window_V: float = None,
                     offset_V: float = 0.0,
                     coupling: str = 'D50') -> None:
        """
        Configure vertical settings for one channel.

        Specify EITHER scale_V (volts/div) OR amplitude_window_V (total
        full-scale amplitude window = 8 divisions). amplitude_window_V wins
        if both are given.

        coupling: 'DC'  — DC (only valid option on LabMaster MCM Zi-A firmware;
                          D50/D1M/A1M are rejected with CMR=5 on this model)
                  'GND' — ground

        Legacy GPIB commands: <ch>:VDIV, <ch>:OFFSET, <ch>:COUPLING
        """
        if amplitude_window_V is not None:
            scale_V = amplitude_window_V / self.VERTICAL_DIVISIONS
        if scale_V is None:
            scale_V = 0.1
        self.write(f'{channel}:VDIV {scale_V:.6g}')
        self.write(f'{channel}:OFFSET {offset_V:.6g}')
        self.write(f'{channel}:COUPLING {coupling}')
        print(f'[set_vertical] {channel}: {scale_V:.6g} V/div '
              f'(window {scale_V * self.VERTICAL_DIVISIONS:.6g} V) | '
              f'offset {offset_V:.6g} V | coupling {coupling}')

    # ── 3. Trigger ────────────────────────────────────────────────────────

    def set_trigger(self, source: str = None,
                    level_V: float = 0.0,
                    slope: str = 'Positive') -> None:
        """
        Configure an edge trigger.

        source : 'C1'..'C4' (None → leave current source)
        slope  : 'Positive' | 'Negative' | 'Either'

        CVARs: app.Acquisition.Trigger.Source / .Edge.Level / .Edge.Slope
        (app.acquisition.trigger.edge.level is shown in the manual, Part 2)
        """
        self.vbs('app.Acquisition.Trigger.Type = "Edge"')
        if source is not None:
            self.vbs(f'app.Acquisition.Trigger.Source = "{source}"')
            self.vbs(f'app.Acquisition.Trigger.Edge.Source = "{source}"')
        self.vbs(f'app.Acquisition.Trigger.Edge.Level = {level_V:.6g}')
        self.vbs(f'app.Acquisition.Trigger.Edge.Slope = "{slope}"')
        print(f'[set_trigger] Edge | source {source or "(unchanged)"} | '
              f'level {level_V:.6g} V | slope {slope}')

    # ── 4. Acquisition: sample rate + memory ──────────────────────────────

    def set_acquisition(self, sample_rate_sps: float = 80e9,
                        n_points: int = 1_000_000) -> None:
        """
        Force a specific sample rate and number of acquired points.

        Verified requirement: SampleRate is only settable after
            app.Acquisition.Horizontal.Maximize = "FixedSampleRate"

        The acquisition window is then defined by the timebase, which is
        locked to a 1-2-5 sequence. Strategy:
          - HorScale is snapped UP to the next 1-2-5 step covering
            n_points / sample_rate, so at least n_points are in the window;
          - MaxSamples = n_points caps the memory, so the scope acquires
            exactly n_points at the requested rate;
          - the CSV export additionally caps the transfer (WAVEFORM_SETUP NP).

        n_points = 0 means "do not constrain memory" (acquire whatever the
        current timebase yields; export all points).

        At 80 GSa/s the LabMaster 10-36Zi-A supports ≤ 2 active channels.
        """
        self.vbs('app.Acquisition.Horizontal.Maximize = "FixedSampleRate"')
        self.vbs(f'app.Acquisition.Horizontal.SampleRate = {sample_rate_sps:.6e}')

        if n_points and n_points > 0:
            window_s = n_points / sample_rate_sps
            hor_scale = snap_125_up(window_s / self.HORIZONTAL_DIVISIONS)
            self.vbs(f'app.Acquisition.Horizontal.HorScale = {hor_scale:.6e}')
            self.vbs(f'app.Acquisition.Horizontal.MaxSamples = {n_points}')
            print(f'[set_acquisition] requested {sample_rate_sps/1e9:.1f} GSa/s | '
                  f'{n_points:,} pts | window {window_s*1e6:.4g} µs '
                  f'(timebase {hor_scale:.3g} s/div)')
        else:
            print(f'[set_acquisition] requested {sample_rate_sps/1e9:.1f} GSa/s | '
                  f'points: scope default (export all)')

        time.sleep(3)

        # Read back what the scope actually adapted to (CVARs snap to legal values)
        try:
            actual_rate = float(self.vbs_query('app.Acquisition.Horizontal.SampleRate'))
            actual_max = self.vbs_query('app.Acquisition.Horizontal.MaxSamples')
            print(f'[set_acquisition] scope adapted: {actual_rate/1e9:.2f} GSa/s | '
                  f'MaxSamples {actual_max}')
        except Exception:                              # noqa: BLE001
            pass

    # ── 5. Single acquisition ─────────────────────────────────────────────

    def single_acquisition(self, channel: str = 'C1',
                           timeout_s: float = 10.0,
                           force_trigger: bool = True) -> None:
        """
        Arm a single acquisition and block until complete.

        app.Acquisition.Acquire(timeout_s, force_trigger):
          force_trigger=True  → software trigger fires if no real trigger
                                arrives within timeout_s (lab bring-up)
          force_trigger=False → wait passively for a real trigger
        Returns 1 if a real trigger occurred, 0 if forced / timed out.
        """
        force = 'True' if force_trigger else 'False'
        try:
            result = self.vbs_query(
                f'app.Acquisition.Acquire({timeout_s}, {force})',
                timeout_ms=int(timeout_s * 1000) + 10000,
            )
        except Exception as exc:
            raise RuntimeError(
                f'[single_acquisition] FAILED — no trigger received within '
                f'{timeout_s:.0f}s and scope did not respond.\n'
                f'  Check: signal present on {channel}? Scope in LXI VXI-11 mode?\n'
                f'  (underlying error: {exc})'
            ) from None
        self.wait_idle(timeout_s=timeout_s + 5)
        triggered = result.strip() == '1'
        print(f'[single_acquisition] Complete '
              f'({"real trigger" if triggered else "forced/timeout"}; '
              f'acquire returned {result!r})')

    # ── 6. Save waveform as CSV ───────────────────────────────────────────

    def save_waveform_csv(self, filename: str,
                          channel: str = 'C1',
                          n_points: int = 0) -> None:
        """
        Transfer the waveform from *channel* and save as CSV
        (columns: time_s, voltage_V).

        n_points: 0 = all acquired points (WAVEFORM_SETUP NP,0);
                  N > 0 = transfer at most N points.

        Protocol (IEEE 488.2 legacy commands)
        -------------------------------------
        1. COMM_FORMAT DEF9,WORD,BIN — 16-bit signed binary, IEEE block
        2. COMM_ORDER LO             — little-endian
        3. WAVEFORM_SETUP SP,0,NP,{n},FP,0,SN,0
        4. {ch}:WAVEFORM? DAT1       — response 'DAT1,#9<len><data>'
           (the base-class block reader skips the 'DAT1,' prefix)
        5. {ch}:INSPECT? "FIELD"     — ASCII scaling parameters:
              V = VERTICAL_GAIN × code − VERTICAL_OFFSET
              t = HORIZ_OFFSET + i × HORIZ_INTERVAL
        """
        s = self.session
        old_timeout = s.timeout
        s.timeout = 120000  # large transfers can be slow
        try:
            self.write('COMM_FORMAT DEF9,WORD,BIN')
            self.write('COMM_ORDER LO')
            self.write(f'WAVEFORM_SETUP SP,0,NP,{max(n_points, 0)},FP,0,SN,0')

            self.write(f'{channel}:WAVEFORM? DAT1')
            data_bytes = self.read_ieee_block()
            n_actual = len(data_bytes) // 2
            raw_vals = struct.unpack(f'<{n_actual}h', data_bytes)

            # INSPECT? always answers ASCII: '"FIELD_NAME : value"'
            def _insp(field):
                raw = self.query(f'{channel}:INSPECT? "{field}"').strip().strip('"')
                return float(raw.split(':')[-1].strip())

            v_gain = _insp('VERTICAL_GAIN')
            v_offset = _insp('VERTICAL_OFFSET')
            h_int = _insp('HORIZ_INTERVAL')
            h_offset = _insp('HORIZ_OFFSET')

            with open(filename, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['time_s', 'voltage_V'])
                for i, code in enumerate(raw_vals):
                    t = h_offset + i * h_int
                    v = v_gain * code - v_offset
                    writer.writerow([f'{t:.6e}', f'{v:.6e}'])

            print(f'[save_waveform_csv] {n_actual:,} points → {filename}')
            print(f'  V_gain={v_gain:.4e} V/cnt | V_offset={v_offset:.4e} V | '
                  f'dt={h_int*1e12:.3f} ps | t0={h_offset*1e9:.3f} ns')
        finally:
            s.timeout = old_timeout

    # ── 7. Save screen image ──────────────────────────────────────────────

    def save_image(self, filename: str) -> None:
        """
        Capture the oscilloscope display as PNG.

        SCDP returns RAW image bytes with no IEEE block header, so the data
        is read with the raw (termchar-disabled) reader. Most reliable over
        VXI-11 (TCPIP0::<ip>::inst0::INSTR).
        """
        s = self.session
        old_timeout = s.timeout
        s.timeout = 60000
        try:
            self.write('HARDCOPY_SETUP DEV,PNG,FORMAT,LANDSCAPE,BCKG,WHITE,'
                       'DEST,REMOTE,PORT,NET')
            self.write('SCREEN_DUMP')
            img_data = self.read_raw_response()
            with open(filename, 'wb') as f:
                f.write(img_data)
            print(f'[save_image] {len(img_data):,} bytes → {filename}')
        finally:
            s.timeout = old_timeout

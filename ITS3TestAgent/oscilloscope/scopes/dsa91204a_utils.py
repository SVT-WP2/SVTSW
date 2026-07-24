"""
dsa91204a_utils.py — Driver for Keysight/Agilent DSA91204A (Infiniium 90000)

Reference : Agilent Infiniium 90000 Series Oscilloscopes Programmer's
            Reference (e.g. https://www.keysight.com/us/en/assets/9018-06975/
            programming-guides/9018-06975.pdf)

VISA      : 'TCPIP0::<ip>::5025::SOCKET' (raw socket, fastest) or
            'TCPIP0::<ip>::inst0::INSTR' (VXI-11)

Channels  : CHANnel1 .. CHANnel4

Important Infiniium-vs-InfiniiVision notes (verified in the 90000 Programmer's
Reference — these differ from the InfiniiVision 1000/3000-X command set):
  - :ACQuire:MODE takes RTIMe (not NORMal)
  - memory depth / sample rate are :ACQuire:POINts[:ANALog] and
    :ACQuire:SRATe[:ANALog]; :WAVeform:POINts? is QUERY-ONLY and there is
    no :WAVeform:POINts:MODE on Infiniium
  - coupling is :CHANnel<N>:INPut {DC | DC50 | AC | LFR1 | LFR2}
    (no :CHANnel:COUPling / :CHANnel:IMPedance). The DSA91204A front end is
    50 Ω only.
  - single acquisition under remote control: :DIGitize <ch> (stops when the
    acquisition completes), synchronized with *OPC?
  - :SYSTem:HEADer OFF is required so query responses are bare values
"""

import csv
import math
import struct
from datetime import datetime

from .instrument import Instrument


class DSA91204A(Instrument):
    """Keysight/Agilent DSA91204A Infiniium oscilloscope driver."""

    MODEL = 'Keysight/Agilent DSA91204A (Infiniium 90000 series)'
    DEFAULT_CHANNEL = 'CHANnel1'
    VERTICAL_DIVISIONS = 8
    HORIZONTAL_DIVISIONS = 10

    # ── Connection ────────────────────────────────────────────────────────

    def _post_connect(self):
        self.write('*CLS')
        # Bare query responses (no ':CHAN1:RANG +8.0E-01'-style headers)
        self.write(':SYSTem:HEADer OFF')

    # ── Error checking ────────────────────────────────────────────────────

    def check_errors(self, max_errors: int = 20) -> list:
        """Drain :SYSTem:ERRor? queue; returns [] when clean."""
        errors = []
        for _ in range(max_errors):
            try:
                resp = self.query(':SYSTem:ERRor?')
            except Exception as exc:                   # noqa: BLE001
                errors.append(f':SYSTem:ERRor? query failed: {exc}')
                break
            code = resp.split(',')[0].strip()
            try:
                if int(float(code)) == 0:
                    break
            except ValueError:
                pass
            errors.append(resp)
        return errors

    # ── 1. Initialize ─────────────────────────────────────────────────────

    def initialize(self, channel: str = 'CHANnel1', **options) -> None:
        """
        Reset the scope to a deterministic initial state.

        options:
          reset     (bool, default True)  — *RST, *CLS, *OPC?
          autoscale (bool, default False) — :AUToscale. Off by default: it
            fights the explicit vertical / sample-rate configuration that
            follows, and takes several seconds.

        Then: headers off, real-time acquisition mode, 100 % completion,
        enable only *channel*, waveform-transfer defaults (WORD, LSBFirst).
        """
        if options.get('reset', True):
            self.write('*RST')
            self.write('*CLS')
            self.opc()
            self.write(':SYSTem:HEADer OFF')   # *RST may restore headers

        if options.get('autoscale', False):
            self.write(':AUToscale')
            self.opc(timeout_ms=30000)

        self.write(':ACQuire:MODE RTIMe')      # real-time sampling (90000)
        self.write(':ACQuire:COMPlete 100')

        digits = ''.join(c for c in channel if c.isdigit())
        active_idx = int(digits) if digits else 1
        for i in range(1, 5):
            self.write(f':CHANnel{i}:DISPlay {"ON" if i == active_idx else "OFF"}')

        self.write(':WAVeform:FORMat WORD')
        self.write(':WAVeform:BYTeorder LSBFirst')
        self.write(f':WAVeform:SOURce {channel}')
        print(f'[initialize] Ready — active channel: {channel}')

    # ── 2. Vertical (channel) settings ────────────────────────────────────

    def set_vertical(self, channel: str = 'CHANnel1',
                     scale_V: float = None,
                     amplitude_window_V: float = None,
                     offset_V: float = 0.0,
                     coupling: str = 'DC') -> None:
        """
        Configure vertical settings for one channel.

        Specify EITHER scale_V (volts/div, sent as :SCALe) OR
        amplitude_window_V (total full-scale window, sent as :RANGe =
        8 divisions). amplitude_window_V wins if both are given.

        coupling → :CHANnel<N>:INPut {DC | DC50 | AC | LFR1 | LFR2}.
        The DSA91204A input is 50 Ω only.
        """
        self.write(f':{channel}:DISPlay ON')
        if amplitude_window_V is not None:
            self.write(f':{channel}:RANGe {amplitude_window_V:.6g}')
            scale_V = amplitude_window_V / self.VERTICAL_DIVISIONS
        else:
            if scale_V is None:
                scale_V = 0.2
            self.write(f':{channel}:SCALe {scale_V:.6g}')
        self.write(f':{channel}:OFFSet {offset_V:.6g}')
        self.write(f':{channel}:INPut {coupling}')
        print(f'[set_vertical] {channel}: {scale_V:.6g} V/div '
              f'(window {scale_V * self.VERTICAL_DIVISIONS:.6g} V) | '
              f'offset {offset_V:.6g} V | input {coupling}')

    # ── 3. Trigger ────────────────────────────────────────────────────────

    def set_trigger(self, source: str = None,
                    level_V: float = 0.0,
                    slope: str = 'POSitive') -> None:
        """
        Configure an edge trigger.

        :TRIGger:MODE EDGE / :TRIGger:EDGE:SOURce / :TRIGger:LEVel <ch>,<V>
        / :TRIGger:EDGE:SLOPe {POSitive | NEGative | EITHer}
        """
        self.write(':TRIGger:MODE EDGE')
        if source is not None:
            self.write(f':TRIGger:EDGE:SOURce {source}')
            self.write(f':TRIGger:LEVel {source},{level_V:.6g}')
        self.write(f':TRIGger:EDGE:SLOPe {slope}')
        print(f'[set_trigger] Edge | source {source or "(unchanged)"} | '
              f'level {level_V:.6g} V | slope {slope}')

    # ── 4. Acquisition: sample rate + memory / timebase ───────────────────

    def set_acquisition(self, sample_rate_sps: float = None,
                        n_points: int = None) -> None:
        """
        Set sample rate and/or memory depth.

        :ACQuire:SRATe[:ANALog] {AUTO | <rate>}
        :ACQuire:POINts[:ANALog] {AUTO | <points>}

        When BOTH are given, the timebase range is set first to
        n_points / sample_rate so the three coupled quantities
        (range = points / rate) are consistent.
        None → leave that quantity on AUTO.
        """
        if sample_rate_sps and n_points:
            window_s = n_points / sample_rate_sps
            self.write(f':TIMebase:RANGe {window_s:.6e}')
        if sample_rate_sps:
            self.write(f':ACQuire:SRATe {sample_rate_sps:.6e}')
        else:
            self.write(':ACQuire:SRATe AUTO')
        if n_points:
            self.write(f':ACQuire:POINts {int(n_points)}')
        else:
            self.write(':ACQuire:POINts AUTO')

        rate_txt = (f'{sample_rate_sps/1e9:.1f} GSa/s'
                    if sample_rate_sps else 'AUTO')
        pts_txt = f'{n_points:,}' if n_points else 'AUTO'
        print(f'[set_acquisition] rate {rate_txt} | points {pts_txt}')

    def set_timebase(self, scale_s: float = 1e-9,
                     position_s: float = 0.0) -> None:
        """Explicit timebase: :TIMebase:SCALe (s/div) and :POSition."""
        self.write(f':TIMebase:SCALe {scale_s:.6e}')
        self.write(f':TIMebase:POSition {position_s:.6e}')
        self.write(':TIMebase:REFerence CENTer')
        print(f'[set_timebase] {scale_s:.3g} s/div | position {position_s:.3g} s')

    # ── 5. Run / Stop / Single ────────────────────────────────────────────

    def run(self) -> None:
        self.write(':RUN')
        print('[run] Acquiring')

    def stop(self) -> None:
        self.write(':STOP')
        print('[stop] Stopped')

    def single_acquisition(self, channel: str = 'CHANnel1',
                           timeout_s: float = 30.0,
                           force_trigger: bool = True) -> None:
        """
        Take one complete acquisition and stop.

        Uses :DIGitize <channel> — the recommended Infiniium macro for
        remote single capture (acquires with current ACQuire settings, then
        stops) — synchronized with *OPC?.

        force_trigger=True  → :TRIGger:SWEep AUTO (scope self-triggers if no
                              edge arrives — useful for lab bring-up)
        force_trigger=False → triggered sweep; :DIGitize waits for a real
                              edge. (Token is TRIGgered; very old firmware
                              may use NORMal instead.)
        """
        self.write(f':TRIGger:SWEep {"AUTO" if force_trigger else "TRIGgered"}')
        self.write(f':DIGitize {channel}')
        self.opc(timeout_ms=int(timeout_s * 1000))
        print('[single_acquisition] Complete (digitized and stopped)')

    # ── 6. Save waveform CSV ──────────────────────────────────────────────

    def save_waveform_csv(self, filename: str,
                          channel: str = 'CHANnel1',
                          n_points: int = 0) -> None:
        """
        Read the waveform record of *channel* from acquisition memory and
        save as CSV (columns: time_s, voltage_V).

        The record length is governed by :ACQuire:POINts (set_acquisition);
        :WAVeform:POINts? is query-only on Infiniium. n_points > 0 only
        truncates the exported CSV if the record is longer.

        Scaling (from :WAVeform:PREamble?, 10+ comma-separated fields):
          t = (i - Xref) * Xinc + Xorig
          V = (code - Yref) * Yinc + Yorig
        """
        s = self.session
        old_timeout = s.timeout
        s.timeout = 120000
        try:
            self.write(f':WAVeform:SOURce {channel}')
            self.write(':WAVeform:FORMat WORD')
            self.write(':WAVeform:BYTeorder LSBFirst')

            pre = self.query(':WAVeform:PREamble?').split(',')
            x_inc, x_orig, x_ref = (float(pre[i]) for i in (4, 5, 6))
            y_inc, y_orig, y_ref = (float(pre[i]) for i in (7, 8, 9))

            self.write(':WAVeform:DATA?')
            data_bytes = self.read_ieee_block()

            n_actual = len(data_bytes) // 2
            raw_vals = struct.unpack(f'<{n_actual}h', data_bytes)
            if n_points and n_points > 0:
                raw_vals = raw_vals[:n_points]

            with open(filename, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['time_s', 'voltage_V'])
                for i, code in enumerate(raw_vals):
                    t = (i - x_ref) * x_inc + x_orig
                    v = (code - y_ref) * y_inc + y_orig
                    writer.writerow([f'{t:.6e}', f'{v:.6e}'])

            print(f'[save_waveform_csv] {len(raw_vals):,} points '
                  f'(record {n_actual:,}) → {filename}')
        finally:
            s.timeout = old_timeout

    # ── 7. Save screen image ──────────────────────────────────────────────

    def save_image(self, filename: str, img_format: str = 'PNG') -> None:
        """Capture the display via :DISPlay:DATA? (IEEE block response)."""
        s = self.session
        old_timeout = s.timeout
        s.timeout = 60000
        try:
            self.write(f':DISPlay:DATA? {img_format}')
            img_data = self.read_ieee_block()
            with open(filename, 'wb') as f:
                f.write(img_data)
            print(f'[save_image] {len(img_data):,} bytes → {filename}')
        finally:
            s.timeout = old_timeout

    # ── 8. Color Grade / Eye display ──────────────────────────────────────

    def setup_eye(self, persistence: str = 'INFinite') -> None:
        """
        Enable color-grade (eye diagram) display.

        :DISPlay:PERSistence {MINimum | INFinite | <seconds>} and
        :DISPlay:CGRade.
        """
        self.write(f':DISPlay:PERSistence {persistence}')
        self.write(':DISPlay:CGRade ON')
        self.write(':DISPlay:CGRade:SCHeme TEMP')   # temperature color map
        print(f'[setup_eye] Color grade ON, persistence={persistence}')

    # ── 9. Clock recovery ─────────────────────────────────────────────────

    def setup_clock_recovery(self, method: str = 'PLL',
                             data_rate_bps: float = 5.12e9,
                             jtf_bw_hz: float = None) -> None:
        """
        Configure embedded clock recovery for serial-data analysis.

        method       : 'PLL' | 'EXPlicit' | ...
        jtf_bw_hz    : JTF 3 dB bandwidth; default rule of thumb rate/1667.
        """
        if jtf_bw_hz is None:
            jtf_bw_hz = data_rate_bps / 1667.0
        self.write(f':MEASure:CLOCk:METHod {method}')
        if method.upper().startswith('PLL'):
            self.write(f':MEASure:CLOCk:METHod:JTF {jtf_bw_hz:.6e}')
        self.write(':MEASure:CLOCk:METHod:EDGE BOTH')
        print(f'[setup_clock_recovery] {method}, '
              f'{data_rate_bps/1e9:.4f} Gbps, JTF={jtf_bw_hz/1e6:.3f} MHz')

    # ── 10. Eye measurements (CGRade) ─────────────────────────────────────

    def measure_eye(self, channel: str = 'CHANnel1') -> dict:
        """
        Read CGRade (color grade / eye) measurements.

        :MEASure:CGRade:{EHEight, EWIDth, JITTer, CROSsing, QFACtor,
        DCDistortion}
        """
        s = self.session
        old_timeout = s.timeout
        s.timeout = 30000
        try:
            self.write(f':MEASure:SOURce {channel}')
            results = {
                'eye_height_V':  self.query_float(':MEASure:CGRade:EHEight?'),
                'eye_width_s':   self.query_float(':MEASure:CGRade:EWIDth?'),
                'jitter_s':      self.query_float(':MEASure:CGRade:JITTer?'),
                'crossing_pct':  self.query_float(':MEASure:CGRade:CROSsing?'),
                'q_factor':      self.query_float(':MEASure:CGRade:QFACtor?'),
                'dc_distortion': self.query_float(':MEASure:CGRade:DCDistortion?'),
            }
            print(f'[measure_eye] Results on {channel}:')
            for k, v in results.items():
                print(f'  {k:20s} = {v:.6g}')
            return results
        finally:
            s.timeout = old_timeout

    # ── 11. RJ/DJ jitter decomposition ────────────────────────────────────

    def setup_rjdj(self, channel: str = 'CHANnel1',
                   ber: float = 1e-12,
                   method: str = 'BOTH') -> None:
        """
        Enable RJ/DJ jitter decomposition.

        :MEASure:RJDJ:{SOURce, BER, METHod, INTerpolate, STATe}
        method: 'BOTH' | 'HISTogram' | 'SPECtrum'
        """
        exp = abs(int(round(math.log10(ber))))
        self.write(f':MEASure:RJDJ:SOURce {channel}')
        self.write(f':MEASure:RJDJ:BER E{exp}')   # token E12 ⇒ BER 1e-12
        self.write(f':MEASure:RJDJ:METHod {method}')
        self.write(':MEASure:RJDJ:INTerpolate ON')
        self.write(':MEASure:RJDJ:STATe ON')
        print(f'[setup_rjdj] Enabled on {channel}, BER=1e-{exp}, method={method}')

    def measure_rjdj(self, channel: str = 'CHANnel1') -> dict:
        """
        Read RJ/DJ decomposition results.

        :MEASure:RJDJ:RJ? / :TJRJDJ? / :ALL?
        :ALL? returns comma-separated values: RJrms, RJpp, DJpp, DDJpp,
        PJpp, TJpp (seconds).
        """
        s = self.session
        old_timeout = s.timeout
        s.timeout = 60000   # decomposition can be slow
        try:
            rj = self.query_float(':MEASure:RJDJ:RJ?')
            tj = self.query_float(':MEASure:RJDJ:TJRJDJ?')
            all_raw = self.query(':MEASure:RJDJ:ALL?')
            labels = ['RJ_rms_s', 'RJ_pp_s', 'DJ_pp_s',
                      'DDJ_pp_s', 'PJ_pp_s', 'TJ_pp_s']
            all_vals = []
            for tok in all_raw.split(','):
                try:
                    all_vals.append(float(tok))
                except ValueError:
                    all_vals.append(None)

            results = {'RJ_rms_s': rj, 'TJ_s': tj}
            results.update(dict(zip(labels, all_vals)))

            print(f'[measure_rjdj] Results on {channel}:')
            for k, v in results.items():
                if isinstance(v, float):
                    print(f'  {k:15s} = {v:.6g} s  ({v*1e12:.3f} ps)')
                else:
                    print(f'  {k:15s} = {v}')
            return results
        finally:
            s.timeout = old_timeout

    # ── 12. Data rate measurement ─────────────────────────────────────────

    def measure_data_rate(self, channel: str = 'CHANnel1') -> float:
        """:MEASure:DATarate? — measured data rate in bps."""
        self.write(f':MEASure:SOURce {channel}')
        rate = self.query_float(':MEASure:DATarate?')
        print(f'[measure_data_rate] {rate/1e9:.6f} Gbps on {channel}')
        return rate

    # ── 13. Save jitter data on the scope's disk ──────────────────────────

    def save_jitter_data(self, remote_path: str = 'C:\\Temp\\jitter_export.txt'
                         ) -> None:
        """
        Save jitter trend/histogram data to a file on the scope's own disk
        (:DISK:SAVE:JITTer). Retrieve it via the scope's shared folder/FTP.
        """
        self.write(f':DISK:SAVE:JITTer "{remote_path}", VERBOSE')
        self.opc()
        print(f'[save_jitter_data] Saved on scope → {remote_path}')

    # ── 14. Save measurement results to CSV and TXT (local files) ─────────

    def save_results(self, filename_base: str,
                     channel: str,
                     data_rate_bps: float,
                     eye: dict,
                     jitter: dict) -> None:
        """
        Save eye and jitter measurement dicts to <base>.csv and <base>.txt.
        Pure local file I/O — no instrument communication.
        """
        units = {
            'eye_height_V': 'V', 'eye_width_s': 's', 'jitter_s': 's',
            'crossing_pct': '%', 'q_factor': '', 'dc_distortion': '',
            'RJ_rms_s': 's', 'TJ_s': 's', 'RJ_pp_s': 's', 'DJ_pp_s': 's',
            'DDJ_pp_s': 's', 'PJ_pp_s': 's', 'TJ_pp_s': 's',
        }
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')

        csv_path = f'{filename_base}.csv'
        with open(csv_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['metric', 'value', 'unit'])
            writer.writerow(['timestamp', ts, ''])
            writer.writerow(['channel', channel, ''])
            writer.writerow(['data_rate', data_rate_bps, 'bps'])
            for k, v in {**eye, **jitter}.items():
                if v is None:
                    value = ''
                elif isinstance(v, (int, float)):
                    value = f'{v:.6e}'
                else:
                    value = str(v)
                writer.writerow([k, value, units.get(k, '')])
        print(f'[save_results] CSV → {csv_path}')

        txt_path = f'{filename_base}.txt'
        with open(txt_path, 'w') as f:
            f.write('DSA91204A Eye & Jitter Results\n')
            f.write('=' * 40 + '\n')
            f.write(f'Timestamp  : {ts}\n')
            f.write(f'Channel    : {channel}\n')
            f.write(f'Data rate  : {data_rate_bps/1e9:.4f} Gbps\n\n')

            f.write('Eye Measurements\n' + '-' * 40 + '\n')
            for k, v in eye.items():
                if v is None:
                    f.write(f'  {k:20s} = NO RESULT\n')
                elif k.endswith('_V'):
                    f.write(f'  {k:20s} = {v:.4f} V\n')
                elif k.endswith('_s'):
                    f.write(f'  {k:20s} = {v*1e12:.3f} ps\n')
                else:
                    f.write(f'  {k:20s} = {v:.4f}\n')

            f.write('\nJitter Decomposition\n' + '-' * 40 + '\n')
            for k, v in jitter.items():
                if v is None:
                    f.write(f'  {k:15s} = NO RESULT\n')
                elif isinstance(v, (int, float)):
                    f.write(f'  {k:15s} = {v*1e12:.3f} ps\n')
                else:
                    f.write(f'  {k:15s} = {v}\n')
        print(f'[save_results] TXT → {txt_path}')

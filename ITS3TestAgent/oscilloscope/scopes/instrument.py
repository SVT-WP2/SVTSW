"""
instrument.py — Generic, model-independent VISA instrument layer.

Every scope driver in this package derives from `Instrument`, which provides
the completely generic functionality:

  - connection management (open / close / context manager, single session)
  - write / query / query_float
  - IEEE 488.2 definite-length binary block reads, robust against leading
    response prefixes (e.g. LeCroy answers 'DAT1,#9...' even with CHDR OFF)
  - raw (headerless) binary reads for screen dumps
  - an error-check hook (`check_errors`) that drivers implement

Uniform driver API
------------------
Model drivers implement these methods so acquire.py stays model-agnostic:

  initialize(channel, **options)
  set_vertical(channel, scale_V, amplitude_window_V, offset_V, coupling)
  set_trigger(source, level_V, slope)
  set_acquisition(sample_rate_sps, n_points)
  single_acquisition(channel, timeout_s, force_trigger)
  save_waveform_csv(filename, channel, n_points)
  save_image(filename)
  check_errors() -> list[str]

Usage
-----
    with SomeScope('TCPIP0::1.2.3.4::inst0::INSTR') as scope:
        scope.initialize(channel='C1')
        ...
The session is opened lazily on first I/O and closed on context exit.
"""

import math
import pyvisa


def snap_125_up(value: float) -> float:
    """Round *value* up to the next 1-2-5 step (1, 2, 5, 10, 20, ...).

    Oscilloscope timebase knobs are usually locked to a 1-2-5 sequence;
    snapping up guarantees the acquisition window is at least as long
    as requested.
    """
    if value <= 0:
        raise ValueError(f'snap_125_up requires a positive value, got {value}')
    exponent = math.floor(math.log10(value))
    for mantissa in (1.0, 2.0, 5.0, 10.0):
        candidate = mantissa * 10.0 ** exponent
        if candidate >= value * (1.0 - 1e-9):
            return candidate
    raise AssertionError('unreachable')


class Instrument:
    """Generic VISA instrument: model-independent functionality only."""

    MODEL = 'generic instrument'          # overridden by drivers
    DEFAULT_CHANNEL = None                # overridden by drivers

    def __init__(self, visa_address: str, timeout_ms: int = 15000):
        self.visa_address = visa_address
        self.timeout_ms = int(timeout_ms)
        self._rm = None
        self._session = None

    # ── Connection management ─────────────────────────────────────────────

    def open(self):
        """Open the VISA session (idempotent). Returns the pyvisa resource."""
        if self._session is not None:
            return self._session
        self._rm = pyvisa.ResourceManager()
        s = self._rm.open_resource(self.visa_address)
        s.timeout = self.timeout_ms
        s.read_termination = '\n'
        s.write_termination = '\n'
        self._session = s
        self._post_connect()
        print(f'[connect] {self.idn()}')
        return s

    def _post_connect(self) -> None:
        """Driver hook: put the instrument into a known remote-I/O state
        (e.g. disable response headers). Called once per open()."""

    def close(self) -> None:
        if self._session is not None:
            try:
                self._session.close()
            finally:
                self._session = None
        if self._rm is not None:
            try:
                self._rm.close()
            finally:
                self._rm = None

    @property
    def session(self):
        """The pyvisa resource, opening the connection on first use."""
        return self._session if self._session is not None else self.open()

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False

    # ── Generic I/O ───────────────────────────────────────────────────────

    def write(self, command: str) -> None:
        self.session.write(command)

    def query(self, command: str, timeout_ms: int = None) -> str:
        s = self.session
        if timeout_ms is None:
            return s.query(command).strip()
        old = s.timeout
        s.timeout = timeout_ms
        try:
            return s.query(command).strip()
        finally:
            s.timeout = old

    def query_float(self, command: str, timeout_ms: int = None) -> float:
        return float(self.query(command, timeout_ms))

    def idn(self) -> str:
        """*IDN? — identification string (universal IEEE 488.2)."""
        return self.query('*IDN?')

    def reset(self) -> None:
        """*RST + *CLS + *OPC? — universal IEEE 488.2 reset-and-sync."""
        self.write('*RST')
        self.write('*CLS')
        self.query('*OPC?', timeout_ms=30000)

    def opc(self, timeout_ms: int = 30000) -> None:
        """Block until the instrument reports operation complete."""
        self.query('*OPC?', timeout_ms=timeout_ms)

    # ── Binary transfers ──────────────────────────────────────────────────

    def read_ieee_block(self, max_prefix_bytes: int = 64) -> bytes:
        """
        Read an IEEE 488.2 definite-length binary block: #<N><len><data>.

        Scans forward for the '#' marker so that any ASCII prefix in the
        response (e.g. LeCroy's 'DAT1,' before the block, present even with
        COMM_HEADER OFF) is skipped. Uses read_bytes() so '\\n' bytes inside
        the binary payload cannot terminate the read early. Afterwards the
        trailing response terminator is drained so the next query is clean.
        """
        s = self.session
        # 1. Scan for '#'
        prefix = b''
        while len(prefix) < max_prefix_bytes:
            b = s.read_bytes(1)
            if b == b'#':
                break
            prefix += b
        else:
            raise IOError(f'IEEE block marker "#" not found '
                          f'(got prefix {prefix[:32]!r}...)')
        # 2. Length header
        n_digits = int(s.read_bytes(1))
        if n_digits == 0:
            raise IOError('Indefinite-length blocks (#0) are not supported')
        n_bytes = int(s.read_bytes(n_digits))
        # 3. Payload
        data = s.read_bytes(n_bytes)
        # 4. Drain the trailing terminator (short timeout; absence is fine)
        old = s.timeout
        s.timeout = 1000
        try:
            s.read_raw()
        except pyvisa.errors.VisaIOError:
            pass
        finally:
            s.timeout = old
        return data

    def read_raw_response(self, inter_chunk_timeout_ms: int = 2000) -> bytes:
        """
        Read a raw, headerless binary response (e.g. LeCroy SCDP screen
        dumps, which have no IEEE block wrapper). Disables the termination
        character while reading so embedded '\\n' bytes don't truncate the
        data, and keeps reading until the instrument stops sending.

        Most reliable over VXI-11 (...::inst0::INSTR), where the end of the
        transfer is signalled by EOI.
        """
        s = self.session
        old_term, old_timeout = s.read_termination, s.timeout
        chunks = []
        try:
            s.read_termination = None
            chunks.append(s.read_raw())
            s.timeout = inter_chunk_timeout_ms
            while True:
                try:
                    chunk = s.read_raw()
                except pyvisa.errors.VisaIOError:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
        finally:
            s.read_termination = old_term
            s.timeout = old_timeout
        return b''.join(chunks)

    # ── Error checking hook ───────────────────────────────────────────────

    def check_errors(self) -> list:
        """Return a list of pending instrument error strings (driver hook)."""
        return []

    def report_errors(self, stage: str = '') -> list:
        """Print and return any pending instrument errors."""
        errors = self.check_errors()
        for e in errors:
            print(f'[warning] instrument error{f" after {stage}" if stage else ""}: {e}')
        return errors

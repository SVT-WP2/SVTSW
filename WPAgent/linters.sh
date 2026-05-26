#!/usr/bin/env bash
# ─────────────────────────────────────────────
# run_lint.sh  —  Run all linters on WPAgent
#
# Usage:
#   ./run_lint.sh            flake8 + pylint
#   ./run_lint.sh --all      + mypy type checking
#   ./run_lint.sh --fix      auto-format with black first
# ─────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
ERRORS=0

# ── find Python ───────────────────────────────
PY=""
if command -v python3.12 &>/dev/null; then PY=python3.12
elif command -v python &>/dev/null; then PY=python
else
    echo "[ERROR] No Python found. Install Python 3 from https://python.org"
    exit 1
fi
echo "Using: $($PY --version)"
echo ""

# ── optional: auto-format with black first ────
if [[ "${1:-}" == "--fix" ]]; then
    if ! $PY -m black --version &>/dev/null; then
        echo "[black] Not installed. Run: $PY -m pip install black"
    else
        echo "[black] Auto-formatting..."
        $PY -m black .
    fi
    echo ""
fi

# ── flake8 ────────────────────────────────────
echo "========================================"
echo " flake8  (errors and real issues)"
echo "========================================"
if ! $PY -m flake8 --version &>/dev/null; then
    echo "[SKIP] flake8 not installed. Run: $PY -m pip install flake8"
else
    $PY -m flake8 . --exclude=__pycache__,.idea,.git,venv,build,dist || ERRORS=1
fi
echo ""

# ── pylint ────────────────────────────────────
echo "========================================"
echo " pylint  (deep static analysis)"
echo "========================================"
if ! $PY -m pylint --version &>/dev/null; then
    echo "[SKIP] pylint not installed. Run: $PY -m pip install pylint"
else
    $PY -m pylint \
        WPAgent.py WPCmdMap.py WPCommandHandler.py WPKafkaClient.py WPSender.py \
        actions drivers globals interfaces sequencer services stateMachine utilities \
        --score=no || ERRORS=1
fi
echo ""

# ── mypy (only with --all) ────────────────────
if [[ "${1:-}" == "--all" ]]; then
    echo "========================================"
    echo " mypy  (type checking)"
    echo "========================================"
    if ! $PY -m mypy --version &>/dev/null; then
        echo "[SKIP] mypy not installed. Run: $PY -m pip install mypy"
    else
        $PY -m mypy . --ignore-missing-imports \
            --exclude "venv|build|dist|__pycache__" || ERRORS=1
    fi
    echo ""
fi

# ── summary ───────────────────────────────────
echo "========================================"
if [[ $ERRORS -eq 0 ]]; then
    echo " [PASS] All linters passed cleanly."
else
    echo " [FAIL] Issues found — see output above."
fi
echo "========================================"
exit $ERRORS

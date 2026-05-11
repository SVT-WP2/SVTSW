#!/bin/bash

set -e

# folder of this script
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VENV="$BASE_DIR/venv"
PYTHON="$VENV/bin/python"
PIP="$VENV/bin/pip"
REQ="$BASE_DIR/requirements.txt"

cd "$BASE_DIR"

echo "[WPAgent] Starting bootstrap check..."

# 1. Create venv if missing
if [ ! -d "$VENV" ]; then
    echo "[WPAgent] Creating virtual environment..."
    python3.12 -m venv "$VENV"
fi

# 2. Ensure pip exists
if [ ! -f "$PIP" ]; then
    echo "[WPAgent] pip missing, repairing venv..."
    "$PYTHON" -m ensurepip --upgrade
fi

# 3. Install dependencies if requirements exist
if [ -f "$REQ" ]; then
    echo "[WPAgent] Installing dependencies..."
    "$PIP" install --upgrade pip
    "$PIP" install -r "$REQ"
else
    echo "[WPAgent] WARNING: requirements.txt not found"
fi

# 4. Run the agent
echo "[WPAgent] Starting application..."
exec "$PYTHON" main.py "$@"
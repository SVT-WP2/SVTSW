#!/bin/bash

set -e

# Folder of this script — works from any working directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VENV="$BASE_DIR/venv"
PYTHON="$VENV/bin/python"
PIP="$VENV/bin/pip"
REQ="$BASE_DIR/requirements.txt"
REQ_HASH_FILE="$VENV/.req_hash"

cd "$BASE_DIR"

echo "[WPAgent] Starting bootstrap check..."

# 1. Create venv if missing
if [ ! -d "$VENV" ]; then
    echo "[WPAgent] Creating virtual environment..."
    python3.12 -m venv "$VENV"
fi

# 2. Install/update dependencies only if requirements.txt changed
if [ -f "$REQ" ]; then
    CURRENT_HASH=$(md5sum "$REQ" | cut -d' ' -f1)
    if [ ! -f "$REQ_HASH_FILE" ] || [ "$(cat "$REQ_HASH_FILE")" != "$CURRENT_HASH" ]; then
        echo "[WPAgent] Requirements changed, installing dependencies..."
        "$PIP" install --upgrade pip --quiet
        "$PIP" install -r "$REQ" --quiet
        echo "$CURRENT_HASH" > "$REQ_HASH_FILE"
    else
        echo "[WPAgent] Dependencies up to date, skipping install."
    fi
else
    echo "[WPAgent] WARNING: requirements.txt not found, skipping install."
fi

# 3. Run the agent — exec replaces the shell so signals go directly to Python
echo "[WPAgent] Starting application..."
exec "$PYTHON" main.py "$@"
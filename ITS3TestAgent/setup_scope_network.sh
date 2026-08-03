#!/bin/bash
# setup_scope_network.sh — configure the scope USB-ethernet link + agent venv.
#
# Ported from oscilloscope-automation/setup.sh into the ITS3 TestAgent. Two jobs:
#   1. Set the scope's USB ethernet adapter to 192.168.0.1/24 (so the scope is
#      reachable over VISA). Interface is resolved by oscilloscope/scope_network.py
#      (explicit > $SCOPE_IFACE > per-host map > saved > single auto-detected enx*).
#   2. Create/activate the agent's .venv and install requirements.txt
#      (confluent-kafka, tqdm, json5, pyvisa, pyvisa-py).
#
# Run with `source` (not `bash`) so the venv stays active in your shell:
#   source setup_scope_network.sh
#
# Options (env or args): SCOPE_IFACE=<iface>, SCOPE_IP=<cidr>
#   source setup_scope_network.sh --iface enxAABBCC --ip 192.168.0.1/24

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SCOPE_IP="${SCOPE_IP:-192.168.0.1/24}"
IFACE_ARG=""
# minimal arg passthrough
while [ "$#" -gt 0 ]; do
    case "$1" in
        --iface) IFACE_ARG="--iface $2"; shift 2 ;;
        --ip)    SCOPE_IP="$2"; shift 2 ;;
        *) shift ;;
    esac
done
[ -n "$SCOPE_IFACE" ] && IFACE_ARG="--iface $SCOPE_IFACE"

# ── 1. Network: delegate to the ported Python module (single source of truth) ──
echo "[network] Ensuring scope link $SCOPE_IP ..."
python3 -m oscilloscope.scope_network --ip "$SCOPE_IP" $IFACE_ARG
NET_RC=$?
if [ "$NET_RC" -ne 0 ]; then
    echo "[network] WARNING: scope network setup did not complete (rc=$NET_RC)."
    echo "          The scope may be unreachable over VISA until it is fixed."
fi

# ── 2. Python environment (agent's own .venv) ─────────────────────────────────
python3 -m venv "$SCRIPT_DIR/.venv"
source "$SCRIPT_DIR/.venv/bin/activate"
python -m pip install --upgrade pip -q
python -m pip install -r "$SCRIPT_DIR/requirements.txt" -q

echo ""
echo "Setup complete. Environment active. Python: $(which python)"
echo ""
echo "Run the agent with scope capture:"
echo "  python3 its3_test_agent.py L1W04_S4 --config its3_test_agent_config_scope.json"

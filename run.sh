#!/usr/bin/env bash
# ==============================================================================
# Linux SSD Explorer Launcher
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"

echo "============================================================"
echo " Starting Linux SSD Explorer"
echo " Access URL: http://${HOST}:${PORT}"
echo "============================================================"

exec "./.venv/bin/python" "server.py"

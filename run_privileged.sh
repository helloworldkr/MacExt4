#!/usr/bin/env bash
# ==============================================================================
# Privileged Linux SSD Explorer Launcher
# Gives direct uninhibited read access to raw physical /dev/rdiskX devices
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo " Starting Privileged Linux SSD Explorer"
echo " (Allows unrestricted access to /dev/rdisk* hardware block devices)"
echo "============================================================"

if [ "$1" = "--app" ] || [ "$1" = "-a" ]; then
    sudo "./.venv/bin/python" "desktop_app.py"
else
    sudo "./.venv/bin/python" "server.py"
fi

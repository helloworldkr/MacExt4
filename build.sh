#!/usr/bin/env bash
# ==============================================================================
# Build and Install Linux SSD Reader for macOS
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo " 1. Building Linux SSD Reader with PyInstaller..."
echo "============================================================"

# Close any running instance of the app before rebuilding
killall LinuxSSDReader 2>/dev/null || true

# Run PyInstaller
"./.venv/bin/python" -m PyInstaller --clean --noconfirm "LinuxSSDReader.spec"

echo "============================================================"
echo " 2. Installing to /Applications..."
echo "============================================================"

"./install_app.sh"

echo "============================================================"
echo " Build & Installation complete!"
echo " You can now launch 'Linux SSD Reader' from Applications."
echo "============================================================"

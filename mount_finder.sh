#!/usr/bin/env bash
# ==============================================================================
# Paragon-Style ExtFS for macOS — Mount Linux Drive to Finder
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

DEVICE="${1}"
MOUNTPOINT="${2:-$HOME/Desktop/LinuxDisk}"

echo "============================================================"
echo " Mounting Linux ext4 Drive into macOS Finder"
echo " Mount Location: $MOUNTPOINT"
echo "============================================================"

if [ -z "$DEVICE" ]; then
    "./.venv/bin/python" "extfs_mount.py" --mountpoint "$MOUNTPOINT" --background
else
    "./.venv/bin/python" "extfs_mount.py" "$DEVICE" --mountpoint "$MOUNTPOINT" --background
fi

echo "Opening in Finder..."
sleep 0.5
open "$MOUNTPOINT"
echo "Done! The Linux disk is now accessible at: $MOUNTPOINT"

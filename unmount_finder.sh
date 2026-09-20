#!/usr/bin/env bash
# ==============================================================================
# Unmount Linux Drive from macOS Finder
# ==============================================================================
set -e

MOUNTPOINT="${1:-$HOME/Desktop/LinuxDisk}"

echo "Unmounting $MOUNTPOINT..."
umount "$MOUNTPOINT" 2>/dev/null || diskutil unmount force "$MOUNTPOINT" 2>/dev/null || true
echo "Unmounted successfully."

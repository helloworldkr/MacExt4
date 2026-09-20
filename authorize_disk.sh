#!/usr/bin/env bash
# ==============================================================================
# Linux SSD Reader - Disk Hardware Permission Authorizer
# Grants read access to external raw disk block devices on macOS
# ==============================================================================
set -e

DISK="${1:-/dev/disk4}"
DISK_ID="$(basename "$DISK" | sed -E 's/^r//')"

echo "============================================================"
echo " Granting read permissions to /dev/${DISK_ID}*"
echo "============================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "Prompting for administrator authorization..."
  osascript -e "do shell script \"chmod o+r /dev/${DISK_ID}* /dev/r${DISK_ID}*\" with administrator privileges"
else
  chmod o+r /dev/${DISK_ID}* /dev/r${DISK_ID}*
fi

echo "Success! Read permissions granted to /dev/${DISK_ID}* and /dev/r${DISK_ID}*."
echo "You can now mount the drive in Linux SSD Reader."

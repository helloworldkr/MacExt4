#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
APP_SRC="$DIR/dist/LinuxSSDReader.app"
APP_DEST="/Applications/LinuxSSDReader.app"

if [ ! -d "$APP_SRC" ]; then
    echo "App bundle not found in dist/. Please run build first."
    exit 1
fi

echo "============================================================"
echo " Installing Linux SSD Reader to /Applications"
echo "============================================================"

rm -rf "$APP_DEST"
cp -R "$APP_SRC" "$APP_DEST"

# Remove quarantine attribute if present
xattr -rd com.apple.quarantine "$APP_DEST" 2>/dev/null || true

echo "Installation complete!"
echo "You can now open 'Linux SSD Reader' directly from Applications, Spotlight, or Launchpad."

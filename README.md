# Linux SSD Explorer & ExtFS for macOS

A native ext2, ext3, and ext4 filesystem driver and explorer for macOS. Available as a **standalone macOS Application (`/Applications/LinuxSSDReader.app`)**, **native macOS Finder mounter (like Paragon extFS)**, and interactive Web Dashboard.

---

## 0. Standalone macOS Desktop App (`LinuxSSDReader.app`)

The application is packaged as a native Mac app in `/Applications/LinuxSSDReader.app`:

- **Double-click to launch**: Launches from Spotlight, Launchpad, or the Applications folder without opening a Terminal.
- **Native WebKit Window**: Opens directly in a dedicated desktop window.
- **Touch ID & Administrator Elevation**: Built-in 1-click elevation button (`⚡ Unlock Hardware Access (Touch ID)`) to access raw physical SSDs.
- **Full Disk Access (FDA)**: Integrated 1-click shortcut to macOS Privacy & Security settings.

To reinstall or rebuild the app:
```bash
./install_app.sh
```

---

## 1. Native Finder Mount (Paragon extFS style)

Mount your Linux ext4 drive directly into macOS so it shows up on your **Desktop** and opens in **Finder**:

```bash
# Auto-detects connected ext4 drive and mounts to ~/Desktop/LinuxDisk
./mount_finder.sh

# Or mount a specific device / partition:
./mount_finder.sh /dev/rdisk2

# Unmount cleanly when done:
./unmount_finder.sh
```

### What you can do in Finder:
- Double-click folders to navigate normally.
- Open files in **TextEdit, VSCode, Preview, VLC**, etc.
- Drag & drop files and folders to your Mac desktop or local drives.
- Zero kernel extensions required (uses Kext-less FUSE-T).

---

## 2. Web Explorer Dashboard

For a complete visual disk manager, partition explorer, and streaming zip downloader:

```bash
./run.sh
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

- Real-time disk capacity bar, inode stats, and volume UUID.
- Interactive code / text viewer with syntax highlighting.
- 16-byte memory Hex dump viewer.
- Image viewer.
- Download individual files or stream entire folders as `.zip` archives.

---

## 3. Command-Line (CLI)

```bash
# Scan and list all attached disks and ext4 partitions
./.venv/bin/python cli.py disks

# Superblock details
./.venv/bin/python cli.py info /dev/rdisk2

# List directory contents
./.venv/bin/python cli.py ls /dev/rdisk2 /etc

# Print file content to terminal
./.venv/bin/python cli.py cat /dev/rdisk2 /etc/os-release

# Extract folder from Linux SSD to local folder on your Mac
./.venv/bin/python cli.py extract /dev/rdisk2 /var/log ./extracted_logs
```

---

## Physical Hardware Disks on macOS

macOS restricts access to raw hardware block devices (`/dev/rdisk*`) to the root user. To allow access without permission errors:
```bash
./run_privileged.sh
```
*(Or run `sudo chmod o+r /dev/rdisk2` for that device).*

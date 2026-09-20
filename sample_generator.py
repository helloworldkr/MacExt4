"""
Creates or populates a realistic Linux root filesystem ext4 image for testing and demonstration.
"""

import os
import subprocess

DEBUGFS_BIN = "/opt/homebrew/opt/e2fsprogs/sbin/debugfs"
MKE2FS_BIN = "/opt/homebrew/opt/e2fsprogs/sbin/mke2fs"

def create_sample_disk(target_path: str = "sample_linux_disk.img", size_mb: int = 32) -> str:
    """Create a formatted ext4 disk image with realistic Linux files and directory structure."""
    if os.path.exists(target_path):
        os.remove(target_path)

    # 1. Create sparse image file
    with open(target_path, "wb") as f:
        f.seek(size_mb * 1024 * 1024 - 1)
        f.write(b"\0")

    # 2. Format with mke2fs
    mke2fs_cmd = [
        MKE2FS_BIN,
        "-t", "ext4",
        "-F",
        "-L", "Ubuntu_SSD_Root",
        target_path
    ]
    subprocess.run(mke2fs_cmd, check=True, capture_output=True)

    # 3. Populate directories and files using debugfs
    commands = [
        # Dirs
        "mkdir etc",
        "mkdir etc/nginx",
        "mkdir var",
        "mkdir var/log",
        "mkdir home",
        "mkdir home/developer",
        "mkdir home/developer/scripts",
        "mkdir boot",
        "mkdir usr",
        "mkdir usr/bin",
        "mkdir mnt"
    ]

    # Create temporary files to write into the ext4 image
    tmp_files = {
        "os-release": (
            "NAME=\"Ubuntu\"\n"
            "VERSION=\"24.04 LTS (Noble Numbat)\"\n"
            "ID=ubuntu\n"
            "ID_LIKE=debian\n"
            "PRETTY_NAME=\"Ubuntu 24.04 LTS\"\n"
            "VERSION_ID=\"24.04\"\n"
            "HOME_URL=\"https://www.ubuntu.com/\"\n"
        ),
        "hostname": "linux-workstation-nvme\n",
        "fstab": (
            "# /etc/fstab: static file system information.\n"
            "UUID=58cfe9ed-d20e-42d5-adac-d23664163910 /               ext4    errors=remount-ro 0       1\n"
            "/dev/nvme0n1p1  /boot/efi       vfat    umask=0077      0       1\n"
        ),
        "nginx.conf": (
            "user www-data;\n"
            "worker_processes auto;\n"
            "pid /run/nginx.pid;\n\n"
            "events {\n"
            "    worker_connections 768;\n"
            "}\n\n"
            "http {\n"
            "    sendfile on;\n"
            "    tcp_nopush on;\n"
            "    types_hash_max_size 2048;\n"
            "    include /etc/nginx/mime.types;\n"
            "    default_type application/octet-stream;\n"
            "    server {\n"
            "        listen 80 default_server;\n"
            "        root /var/www/html;\n"
            "        index index.html;\n"
            "    }\n"
            "}\n"
        ),
        "syslog": (
            "Sep 19 21:00:01 ubuntu-ssd systemd[1]: Starting Daily apt download activities...\n"
            "Sep 19 21:00:05 ubuntu-ssd systemd[1]: apt-daily.service: Deactivated successfully.\n"
            "Sep 19 21:15:22 ubuntu-ssd kernel: [ 142.102] nvme0n1: p1 p2 p3\n"
            "Sep 19 21:15:23 ubuntu-ssd kernel: [ 142.205] EXT4-fs (nvme0n1p2): mounted filesystem with ordered data mode.\n"
            "Sep 19 21:30:00 ubuntu-ssd CRON[18420]: (root) CMD (/usr/local/bin/backup_check.sh)\n"
        ),
        "app.py": (
            "#!/usr/bin/env python3\n"
            "import os\n"
            "import sys\n\n"
            "def main():\n"
            "    print('Data extraction service active on Linux drive!')\n"
            "    print(f'Kernel: {os.uname().release}')\n\n"
            "if __name__ == '__main__':\n"
            "    main()\n"
        ),
        "README.md": (
            "# Linux SSD Archive\n\n"
            "This SSD contains Linux root and developer data.\n"
            "- Partition scheme: GPT\n"
            "- Filesystem: ext4\n"
            "- Mounted and read safely on macOS with LinuxDiskReader.\n"
        )
    }

    # Write each file
    for filename, content in tmp_files.items():
        with open(f".tmp_{filename}", "w") as f:
            f.write(content)

    commands.extend([
        "write .tmp_os-release etc/os-release",
        "write .tmp_hostname etc/hostname",
        "write .tmp_fstab etc/fstab",
        "write .tmp_nginx.conf etc/nginx/nginx.conf",
        "write .tmp_syslog var/log/syslog",
        "write .tmp_app.py home/developer/scripts/app.py",
        "write .tmp_README.md README.md",
    ])

    # Run debugfs commands
    debugfs_input = "\n".join(commands) + "\nquit\n"
    subprocess.run(
        [DEBUGFS_BIN, "-w", target_path],
        input=debugfs_input.encode("utf-8"),
        check=True,
        capture_output=True
    )

    # Clean up temp files
    for filename in tmp_files.keys():
        tmp_path = f".tmp_{filename}"
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return target_path


if __name__ == "__main__":
    path = create_sample_disk()
    print(f"Sample Linux SSD image generated at: {path} ({os.path.getsize(path)} bytes)")

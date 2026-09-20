"""
ExtFS for macOS — Native ext2/ext3/ext4 FUSE Mount Driver (Paragon-style)
Mounts any Linux SSD, hard disk, or image directly into macOS Finder.
Uses FUSE-T (kext-less, zero kernel extensions required).
"""

import os
import sys
import stat
import time
import errno
import ctypes
import argparse
import subprocess
from typing import Dict, Any, Optional

import fuse
from fuse import FUSE, Operations, FuseOSError

# Explicitly bind to FUSE-T (Kext-less FUSE for macOS)
FUSE_T_DYLIB = "/usr/local/lib/libfuse-t.dylib"
if os.path.exists(FUSE_T_DYLIB):
    fuse._libfuse = ctypes.CDLL(FUSE_T_DYLIB)
    fuse._system = "Darwin"

from reader import LinuxFileSystem
from disk_detector import list_disks


class ExtFS(Operations):
    def __init__(self, device_path: str, offset: int = 0):
        self.fs = LinuxFileSystem(device_path, offset=offset)
        self.info = self.fs.get_info()

    def getattr(self, path: str, fh=None) -> Dict[str, Any]:
        """Return stat attributes for a file or directory."""
        norm_path = "/" + "/".join([p for p in path.strip("/").split("/") if p and p != "."])
        try:
            inode, _ = self.fs._resolve_inode(norm_path)
            mode = inode.i_mode
            size = getattr(inode, "i_size", 0) if not stat.S_ISDIR(mode) else 4096
            nlinks = getattr(inode, "i_links_count", 1) or 1
            uid = os.getuid()  # Map to current macOS user for transparent Finder access
            gid = os.getgid()
            atime = inode.i_atime or int(time.time())
            mtime = inode.i_mtime or int(time.time())
            ctime = inode.i_ctime or int(time.time())

            return {
                "st_mode": mode,
                "st_nlink": nlinks,
                "st_size": size,
                "st_uid": uid,
                "st_gid": gid,
                "st_atime": atime,
                "st_mtime": mtime,
                "st_ctime": ctime
            }
        except FileNotFoundError:
            raise FuseOSError(errno.ENOENT)
        except Exception:
            raise FuseOSError(errno.EIO)

    def readdir(self, path: str, fh):
        """Read directory entries."""
        try:
            entries = self.fs.listdir(path)
            names = [".", ".."] + [e["name"] for e in entries]
            return names
        except FileNotFoundError:
            raise FuseOSError(errno.ENOENT)
        except NotADirectoryError:
            raise FuseOSError(errno.ENOTDIR)
        except Exception:
            raise FuseOSError(errno.EIO)

    def read(self, path: str, size: int, offset: int, fh) -> bytes:
        """Read chunk of data from a file."""
        try:
            return self.fs.read_file(path, offset=offset, limit=size)
        except FileNotFoundError:
            raise FuseOSError(errno.ENOENT)
        except IsADirectoryError:
            raise FuseOSError(errno.EISDIR)
        except Exception:
            raise FuseOSError(errno.EIO)

    def readlink(self, path: str) -> str:
        """Read target of symbolic link."""
        try:
            inode, _ = self.fs._resolve_inode(path)
            if hasattr(inode, "readlink"):
                return inode.readlink().decode("utf-8", errors="replace")
            raise FuseOSError(errno.EINVAL)
        except Exception:
            raise FuseOSError(errno.EIO)

    def statfs(self, path: str) -> Dict[str, Any]:
        """Return filesystem capacity metrics."""
        bsize = self.info.get("block_size", 4096)
        blocks = self.info.get("total_blocks", 100000)
        bfree = self.info.get("free_blocks", 50000)
        files = self.info.get("total_inodes", 50000)
        ffree = self.info.get("free_inodes", 25000)
        return {
            "f_bsize": bsize,
            "f_frsize": bsize,
            "f_blocks": blocks,
            "f_bfree": bfree,
            "f_bavail": bfree,
            "f_files": files,
            "f_ffree": ffree,
            "f_favail": ffree,
            "f_flag": os.ST_RDONLY,
            "f_namemax": 255
        }


def mount_extfs(device_path: str, mountpoint: str, offset: int = 0, open_finder: bool = True, background: bool = False):
    """Mount ext4 filesystem at mountpoint and optionally open in Finder."""
    os.makedirs(mountpoint, exist_ok=True)
    volname = os.path.basename(device_path)

    print(f"===========================================================")
    print(f"   Paragon-Style ExtFS for macOS (Native Finder Mount)")
    print(f"   Source Device: {device_path} (offset: {offset})")
    print(f"   Mount Point:   {mountpoint}")
    print(f"===========================================================")

    if open_finder:
        # Schedule opening Finder in background once mounted
        subprocess.Popen(["sh", "-c", f"sleep 1 && open '{mountpoint}'"])

    fuse_ops = ExtFS(device_path, offset=offset)
    FUSE(
        fuse_ops,
        mountpoint,
        foreground=not background,
        ro=True,
        nothreads=True,
        volname=volname
    )


def unmount_extfs(mountpoint: str):
    """Unmount an active mountpoint cleanly."""
    subprocess.run(["umount", mountpoint], check=False)
    print(f"Unmounted {mountpoint}")


def main():
    parser = argparse.ArgumentParser(description="Mount ext2/ext3/ext4 filesystem natively on macOS")
    parser.add_argument("device", nargs="?", help="Path to raw disk (/dev/rdiskX) or image file")
    parser.add_argument("--mountpoint", "-m", default=os.path.expanduser("~/Desktop/LinuxDisk"), help="Mount directory path (default: ~/Desktop/LinuxDisk)")
    parser.add_argument("--offset", "-o", type=int, default=0, help="Partition offset in bytes")
    parser.add_argument("--background", "-b", action="store_true", help="Run mount in background")
    parser.add_argument("--no-finder", action="store_true", help="Do not open Finder automatically")
    parser.add_argument("--unmount", "-u", action="store_true", help="Unmount the filesystem")

    args = parser.parse_args()

    if args.unmount:
        unmount_extfs(args.mountpoint)
        return

    device = args.device
    if not device:
        # Auto-detect first ext4 device or sample
        disks = list_disks()
        for d in disks:
            if d.get("is_ext4"):
                device = d["device_path"]
                for p in d.get("partitions", []):
                    if p.get("is_ext4"):
                        args.offset = p.get("offset", 0)
                        break
                break

    if not device:
        sample = os.path.abspath("sample_linux_disk.img")
        if not os.path.exists(sample):
            from sample_generator import create_sample_disk
            create_sample_disk(sample)
        device = sample

    mount_extfs(
        device,
        args.mountpoint,
        offset=args.offset,
        open_finder=not args.no_finder,
        background=args.background
    )


if __name__ == "__main__":
    main()

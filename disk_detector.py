"""
Disk and partition discovery utility for Linux SSDs / hard disks on macOS.
Detects physical disks, external USB/Thunderbolt drives, partitions, and disk images.
"""

import os
import glob
import plistlib
import subprocess
from typing import List, Dict, Any, Optional

EXT4_SUPERBLOCK_OFFSET = 1024
EXT4_MAGIC = b"\x53\xef"  # 0xEF53 little-endian


def read_device_bytes(device_path: str, offset: int, length: int) -> bytes:
    """Read bytes from a file, block device, or macOS raw disk device safely."""
    # Prefer block device (/dev/diskX) over raw character device (/dev/rdiskX) for unaligned reads
    targets = [device_path]
    if "/dev/rdisk" in device_path:
        block_path = device_path.replace("/dev/rdisk", "/dev/disk")
        if block_path not in targets:
            targets.insert(0, block_path)
    elif "/dev/disk" in device_path:
        raw_path = device_path.replace("/dev/disk", "/dev/rdisk")
        if raw_path not in targets:
            targets.append(raw_path)

    for target in targets:
        try:
            with open(target, "rb") as f:
                f.seek(offset)
                data = f.read(length)
                if len(data) == length:
                    return data
        except OSError as e:
            # Sector-aligned read fallback for raw /dev/rdisk devices on macOS
            if getattr(e, "errno", None) == 22 or "Invalid argument" in str(e):
                try:
                    sector_size = 4096
                    start_aligned = (offset // sector_size) * sector_size
                    end_aligned = ((offset + length + sector_size - 1) // sector_size) * sector_size
                    with open(target, "rb") as f:
                        f.seek(start_aligned)
                        chunk = f.read(end_aligned - start_aligned)
                        rel = offset - start_aligned
                        if len(chunk) >= rel + length:
                            return chunk[rel:rel + length]
                except Exception:
                    pass
        except Exception:
            pass
    return b""


def is_ext4_at_offset(device_path: str, offset: int = 0) -> bool:
    """Check if an ext2/3/4 filesystem superblock exists at the given offset."""
    magic = read_device_bytes(device_path, offset + EXT4_SUPERBLOCK_OFFSET + 56, 2)
    return magic == EXT4_MAGIC


def get_volume_info(device_path: str, offset: int = 0) -> Dict[str, Any]:
    """Extract basic volume info from the ext4 superblock directly."""
    info = {
        "is_ext4": False,
        "volume_name": "",
        "uuid": "",
        "block_size": 1024,
        "blocks_count": 0,
        "free_blocks_count": 0,
        "inodes_count": 0,
        "free_inodes_count": 0,
        "error": None
    }
    sb = read_device_bytes(device_path, offset + EXT4_SUPERBLOCK_OFFSET, 1024)
    if len(sb) < 120 or sb[56:58] != EXT4_MAGIC:
        return info

    try:
        import struct
        # Superblock fields
        inodes_count = struct.unpack("<I", sb[0:4])[0]
        blocks_count = struct.unpack("<I", sb[4:8])[0]
        free_blocks = struct.unpack("<I", sb[12:16])[0]
        free_inodes = struct.unpack("<I", sb[16:20])[0]
        log_block_size = struct.unpack("<I", sb[24:28])[0]
        block_size = 1024 << log_block_size

        # UUID (16 bytes at offset 104)
        uuid_bytes = sb[104:120]
        import uuid
        vol_uuid = str(uuid.UUID(bytes=uuid_bytes))

        # Volume label (16 bytes at offset 120)
        vol_name = sb[120:136].decode("latin1", errors="ignore").rstrip("\x00")

        info.update({
            "is_ext4": True,
            "volume_name": vol_name or "Linux Filesystem",
            "uuid": vol_uuid,
            "block_size": block_size,
            "blocks_count": blocks_count,
            "free_blocks_count": free_blocks,
            "inodes_count": inodes_count,
            "free_inodes_count": free_inodes,
            "total_bytes": blocks_count * block_size,
            "free_bytes": free_blocks * block_size,
        })
    except Exception as e:
        info["error"] = str(e)
    return info


def scan_partitions(device_path: str) -> List[Dict[str, Any]]:
    """Scan GPT, MBR, and whole device for ext4 partitions."""
    partitions = []
    try:
        # Check whole device / offset 0
        if is_ext4_at_offset(device_path, 0):
            info = get_volume_info(device_path, 0)
            partitions.append({
                "name": "Whole Device (Ext4)",
                "partition_index": 0,
                "offset": 0,
                "is_ext4": True,
                "volume_info": info
            })

        # Check GPT partition table
        gpt_header = read_device_bytes(device_path, 512, 92)
        if gpt_header[:8] == b"EFI PART":
            import struct
            part_lba = struct.unpack("<Q", gpt_header[72:80])[0]
            num_parts = struct.unpack("<I", gpt_header[80:84])[0]
            part_size = struct.unpack("<I", gpt_header[84:88])[0]
            for i in range(min(num_parts, 64)):
                p_bytes = read_device_bytes(device_path, part_lba * 512 + i * part_size, part_size)
                if len(p_bytes) < 128 or p_bytes[:16] == b"\x00" * 16:
                    continue
                start_lba = struct.unpack("<Q", p_bytes[32:40])[0]
                end_lba = struct.unpack("<Q", p_bytes[40:48])[0]
                p_name = p_bytes[56:128].decode("utf-16le", errors="ignore").rstrip("\x00")
                p_offset = start_lba * 512
                p_size = (end_lba - start_lba + 1) * 512
                
                is_ext = is_ext4_at_offset(device_path, p_offset)
                vol_info = get_volume_info(device_path, p_offset) if is_ext else {}
                partitions.append({
                    "name": p_name or f"GPT Partition {i+1}",
                    "partition_index": i + 1,
                    "offset": p_offset,
                    "size": p_size,
                    "is_ext4": is_ext,
                    "volume_info": vol_info
                })

        # Check MBR
        if not partitions:
            mbr_tail = read_device_bytes(device_path, 510, 2)
            if mbr_tail == b"\x55\xaa":
                import struct
                for i in range(4):
                    entry = read_device_bytes(device_path, 446 + i * 16, 16)
                    if len(entry) < 16:
                        continue
                    p_type = entry[4]
                    if p_type == 0:
                        continue
                    start_lba = struct.unpack("<I", entry[8:12])[0]
                    num_sectors = struct.unpack("<I", entry[12:16])[0]
                    p_offset = start_lba * 512
                    p_size = num_sectors * 512
                    is_ext = is_ext4_at_offset(device_path, p_offset)
                    vol_info = get_volume_info(device_path, p_offset) if is_ext else {}
                    partitions.append({
                        "name": f"MBR Partition {i+1} (type 0x{p_type:02X})",
                        "partition_index": i + 1,
                        "offset": p_offset,
                        "size": p_size,
                        "is_ext4": is_ext,
                        "volume_info": vol_info
                    })
    except PermissionError:
        partitions.append({
            "name": "Access Restricted",
            "offset": 0,
            "is_ext4": False,
            "error": "Permission denied (Run with sudo or grant disk access)"
        })
    except Exception as e:
        partitions.append({
            "name": "Scan Error",
            "offset": 0,
            "is_ext4": False,
            "error": str(e)
        })

    return partitions


def list_disks() -> List[Dict[str, Any]]:
    """List all detected physical disks, external drives, and disk image files."""
    disks = []

    # 1. Parse macOS diskutil list -plist
    try:
        proc = subprocess.run(["diskutil", "list", "-plist"], capture_output=True, text=False)
        if proc.returncode == 0:
            plist_data = plistlib.loads(proc.stdout)
            all_disks = plist_data.get("AllDisksAndPartitions", [])
            for disk in all_disks:
                device_id = disk.get("DeviceIdentifier", "")
                dev_path = f"/dev/{device_id}"
                rdev_path = f"/dev/r{device_id}"
                size = disk.get("Size", 0)
                content = disk.get("Content", "")
                
                # Check permissions
                readable = os.access(rdev_path, os.R_OK) or os.access(dev_path, os.R_OK)
                
                # Check partitions
                partitions = []
                for p in disk.get("Partitions", []):
                    p_id = p.get("DeviceIdentifier", "")
                    p_dev = f"/dev/{p_id}"
                    p_rdev = f"/dev/r{p_id}"
                    p_size = p.get("Size", 0)
                    p_content = p.get("Content", "")
                    p_name = p.get("VolumeName", "") or p_content or p_id
                    
                    is_ext = is_ext4_at_offset(p_dev, 0) or is_ext4_at_offset(p_rdev, 0)
                    is_linux_candidate = is_ext or ("Linux" in p_content and "Swap" not in p_content)
                    vol_info = get_volume_info(p_dev, 0) if is_ext else {}
                    
                    partitions.append({
                        "identifier": p_id,
                        "device_path": p_dev if os.path.exists(p_dev) else p_rdev,
                        "name": p_name,
                        "size": p_size,
                        "content_type": p_content,
                        "is_ext4": is_ext,
                        "is_linux_candidate": is_linux_candidate,
                        "offset": 0,
                        "volume_info": vol_info
                    })

                # If no subpartitions or if whole disk has ext4
                whole_is_ext = False
                if readable:
                    target_scan = dev_path if os.path.exists(dev_path) else rdev_path
                    whole_is_ext = is_ext4_at_offset(target_scan, 0)
                    if not partitions:
                        partitions = scan_partitions(target_scan)

                has_ext = whole_is_ext or any(p.get("is_ext4") or p.get("is_linux_candidate") for p in partitions)
                disks.append({
                    "identifier": device_id,
                    "device_path": dev_path if os.path.exists(dev_path) else rdev_path,
                    "size": size,
                    "content_type": content,
                    "is_readable": readable,
                    "is_ext4": has_ext,
                    "partitions": partitions,
                    "type": "physical"
                })
    except Exception as e:
        print(f"Error reading diskutil list: {e}")

    # 2. Check local disk images (.img, .raw, .iso, .dd)
    image_patterns = ["*.img", "*.raw", "*.dd", "*.iso", "*.bin"]
    search_dirs = [os.getcwd()]
    import sys
    if hasattr(sys, "_MEIPASS"):
        search_dirs.append(sys._MEIPASS)
    app_data = os.path.expanduser("~/Library/Application Support/LinuxSSDReader")
    if os.path.exists(app_data):
        search_dirs.append(app_data)

    seen_paths = set()
    for sdir in search_dirs:
        for pattern in image_patterns:
            for img_path in glob.glob(os.path.join(sdir, pattern)):
                real_p = os.path.realpath(img_path)
                if real_p in seen_paths:
                    continue
                seen_paths.add(real_p)
                size = os.path.getsize(img_path)
                parts = scan_partitions(img_path)
                has_ext = any(p.get("is_ext4") for p in parts)
                disks.append({
                    "identifier": os.path.basename(img_path),
                    "device_path": img_path,
                    "size": size,
                    "content_type": "Disk Image",
                    "is_readable": True,
                    "is_ext4": has_ext,
                    "partitions": parts,
                    "type": "image"
                })

    return disks


if __name__ == "__main__":
    disks = list_disks()
    print(f"Found {len(disks)} devices/images:")
    for d in disks:
        print(f" - {d['identifier']} ({d['device_path']}) ext4={d['is_ext4']} readable={d['is_readable']}")
        for p in d.get("partitions", []):
            print(f"    * {p.get('name', 'Partition')}: ext4={p.get('is_ext4')} offset={p.get('offset', 0)}")

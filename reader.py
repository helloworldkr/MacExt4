"""
High-performance Linux filesystem reader for ext2, ext3, and ext4 filesystems.
Dual-engine:
  1. Pure Python ext4 engine for fast in-memory traversal, streaming, and metadata.
  2. debugfs CLI engine fallback for full compatibility with all Linux kernel features.
"""

import os
import io
import stat
import time
import zipfile
import datetime
import mimetypes
import subprocess
import fcntl
import struct
from typing import List, Dict, Any, Optional, Generator, Tuple

import ext4

DEBUGFS_BIN = "/opt/homebrew/opt/e2fsprogs/sbin/debugfs"


def format_bytes(size: int) -> str:
    """Format bytes into human-readable string (e.g. 1.2 MB)."""
    if size < 1024:
        return f"{size} B"
    for unit in ["KB", "MB", "GB", "TB", "PB"]:
        size /= 1024.0
        if size < 1024.0 or unit == "PB":
            return f"{size:.1f} {unit}"
    return f"{size:.1f} B"


def format_hex_dump(data: bytes, base_offset: int = 0) -> List[Dict[str, str]]:
    """Generate a clean hex dump structure."""
    lines = []
    for i in range(0, len(data), 16):
        chunk = data[i:i+16]
        hex_bytes = " ".join(f"{b:02x}" for b in chunk)
        # Pad hex part to 48 chars (16 * 3 - 1)
        hex_part = f"{hex_bytes:<48}"
        ascii_part = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
        lines.append({
            "offset": f"{base_offset + i:08x}",
            "hex": hex_part,
            "ascii": ascii_part
        })
    return lines


class BlockDeviceStream(io.RawIOBase):
    """
    High-compatibility stream wrapper for raw disk block devices (/dev/disk*, /dev/rdisk*)
    and disk images on macOS and Linux.

    Background:
    On macOS, calling lseek(fd, 0, SEEK_END) on block devices (/dev/diskX) or raw character
    devices (/dev/rdiskX) returns 0. The ext4 library computes volume length using:
        stream.seek(0, io.SEEK_END)
        return stream.tell() - offset
    When this returns 0, any subsequent seek (e.g. to superblock at offset 1024) triggers:
        if seek < 0 or seek > len(self):
            raise OSError(errno.EINVAL, "Invalid argument")
    resulting in [Errno 22] Invalid argument.

    This wrapper solves that by:
    1. Detecting the true partition/disk capacity via macOS ioctls (DKIOCGETBLOCKSIZE &
       DKIOCGETBLOCKCOUNT), Linux BLKGETSIZE64 ioctls, ext4 superblock geometry, or file seeks.
    2. Virtualizing seek(offset, SEEK_END) to accurately report disk/partition length.
    3. Providing automatic sector-aligned read fallback for raw /dev/rdisk character devices.
    """

    def __init__(self, raw_file: io.BufferedReader, device_path: str = "", offset: int = 0, size: Optional[int] = None):
        self.raw = raw_file
        self.device_path = device_path or getattr(raw_file, "name", "")
        self.offset = offset
        self.pos = 0
        if size is not None and size > 0:
            self._size = size
        else:
            self._size = self._detect_size()

    def _detect_size(self) -> int:
        # 1. Try macOS ioctl (DKIOCGETBLOCKSIZE = 0x40046418, DKIOCGETBLOCKCOUNT = 0x40086419)
        try:
            DKIOCGETBLOCKSIZE = 0x40046418
            DKIOCGETBLOCKCOUNT = 0x40086419
            fd = self.raw.fileno()
            buf4 = bytearray(4)
            fcntl.ioctl(fd, DKIOCGETBLOCKSIZE, buf4)
            bs = struct.unpack("I", buf4)[0]
            buf8 = bytearray(8)
            fcntl.ioctl(fd, DKIOCGETBLOCKCOUNT, buf8)
            bc = struct.unpack("Q", buf8)[0]
            total = bs * bc
            if total > 0:
                return total
        except Exception:
            pass

        # 2. Try Linux ioctl (BLKGETSIZE64 = 0x80081272)
        try:
            BLKGETSIZE64 = 0x80081272
            fd = self.raw.fileno()
            buf8 = bytearray(8)
            fcntl.ioctl(fd, BLKGETSIZE64, buf8)
            sz = struct.unpack("Q", buf8)[0]
            if sz > 0:
                return sz
        except Exception:
            pass

        # 3. Try standard file seek (works for disk images .img, .iso, .raw)
        try:
            curr = self.raw.tell()
            self.raw.seek(0, io.SEEK_END)
            s = self.raw.tell()
            self.raw.seek(curr)
            if s > 0:
                return s
        except Exception:
            pass

        # 4. Fallback: inspect ext4 superblock directly at self.offset + 1024
        try:
            self.raw.seek(self.offset + 1024)
            sb = self.raw.read(1024)
            if len(sb) >= 120 and sb[56:58] == b"\x53\xef":
                s_blocks_count_lo = struct.unpack("<I", sb[4:8])[0]
                s_log_block_size = struct.unpack("<I", sb[24:28])[0]
                block_size = 1024 << s_log_block_size
                s_blocks_count_hi = 0
                if len(sb) >= 340:
                    s_blocks_count_hi = struct.unpack("<I", sb[336:340])[0]
                total_blocks = (s_blocks_count_hi << 32) | s_blocks_count_lo
                if total_blocks > 0:
                    return self.offset + (total_blocks * block_size)
        except Exception:
            pass

        # 5. Fallback safe upper bound (16 TB)
        return self.offset + (16 * 1024 * 1024 * 1024 * 1024)

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def writable(self) -> bool:
        return False

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        elif whence == io.SEEK_END:
            self.pos = self._size + offset
        else:
            raise ValueError(f"Invalid whence argument: {whence}")
        self.pos = max(0, self.pos)
        return self.pos

    def read(self, size: int = -1) -> bytes:
        if size == -1:
            size = max(0, self._size - self.pos)
        if size <= 0 or self.pos >= self._size:
            return b""
        size = min(size, max(0, self._size - self.pos))

        try:
            self.raw.seek(self.pos)
            data = self.raw.read(size)
        except OSError as e:
            # Handle sector alignment requirement if raw device /dev/rdisk is used
            if getattr(e, "errno", None) == 22:
                sector_size = 4096
                start_aligned = (self.pos // sector_size) * sector_size
                end_aligned = ((self.pos + size + sector_size - 1) // sector_size) * sector_size
                self.raw.seek(start_aligned)
                chunk = self.raw.read(end_aligned - start_aligned)
                rel = self.pos - start_aligned
                data = chunk[rel:rel + size]
            else:
                raise

        self.pos += len(data)
        return data

    def readinto(self, b) -> int:
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)

    def peek(self, size: int = 1) -> bytes:
        curr_pos = self.pos
        data = self.read(size)
        self.pos = curr_pos
        return data

    def close(self):
        if self.raw and not self.raw.closed:
            self.raw.close()

    @property
    def closed(self) -> bool:
        return self.raw.closed if self.raw else True

    def fileno(self) -> int:
        return self.raw.fileno()

    def flush(self):
        pass


class LinuxFileSystem:
    def __init__(self, device_path: str, offset: int = 0):
        # On macOS, block devices (/dev/diskX) provide standard seekable random read caching
        if device_path.startswith("/dev/rdisk"):
            block_dev = device_path.replace("/dev/rdisk", "/dev/disk")
            if os.path.exists(block_dev):
                device_path = block_dev

        self.device_path = device_path
        self.offset = offset
        self.file_obj: Optional[BlockDeviceStream] = None
        self.volume: Optional[ext4.Volume] = None
        self.has_debugfs: bool = os.path.exists(DEBUGFS_BIN)
        self.open()

    def open(self):
        """Open the device or image file and initialize ext4 volume."""
        try:
            raw_file = open(self.device_path, "rb")
            self.file_obj = BlockDeviceStream(raw_file, device_path=self.device_path, offset=self.offset)
        except PermissionError as e:
            raise PermissionError(
                f"Cannot open '{self.device_path}': [Errno 13] Permission denied: '{self.device_path}'. "
                f"macOS requires administrator privileges to access raw disk block devices."
            ) from e
        except Exception as e:
            raise RuntimeError(f"Cannot open '{self.device_path}': {e}")

        # Validate superblock magic bytes before proceeding
        try:
            self.file_obj.seek(self.offset + 1024 + 56)
            magic = self.file_obj.read(2)
            if magic != b"\x53\xef":
                from disk_detector import read_device_bytes
                magic = read_device_bytes(self.device_path, self.offset + 1024 + 56, 2)
            if magic != b"\x53\xef":
                self.close()
                hex_str = f"0x{magic.hex()}" if magic else "none"
                raise ValueError(
                    f"Superblock magic {hex_str} at offset {self.offset} does not match ext4 magic 0xef53. "
                    f"'{self.device_path}' is not an ext2/3/4 filesystem."
                )
        except ValueError:
            raise
        except Exception as e:
            self.close()
            raise RuntimeError(f"Error inspecting filesystem header on '{self.device_path}': {e}")

        try:
            self.volume = ext4.Volume(
                self.file_obj,
                offset=self.offset,
                ignore_magic=False,
                ignore_checksum=True,
                ignore_flags=True
            )
        except Exception as e:
            self.close()
            raise RuntimeError(f"Failed to initialize ext4 volume: {e}")

        if not self.volume or not getattr(self.volume, "root", None):
            self.close()
            raise RuntimeError(f"ext4 volume failed to initialize on '{self.device_path}'")

    def close(self):
        """Close opened file handles."""
        if self.file_obj and not self.file_obj.closed:
            self.file_obj.close()
            self.file_obj = None
            self.volume = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get_info(self) -> Dict[str, Any]:
        """Get filesystem superblock information."""
        if self.volume and self.volume.superblock:
            sb = self.volume.superblock
            vol_name = bytes(sb.s_volume_name).decode("latin1", errors="ignore").rstrip("\x00")
            block_size = self.volume.block_size
            total_blocks = int(sb.s_blocks_count_lo)
            free_blocks = int(sb.s_free_blocks_count_lo)
            total_inodes = int(sb.s_inodes_count)
            free_inodes = int(sb.s_free_inodes_count)

            total_bytes = total_blocks * block_size
            free_bytes = free_blocks * block_size
            used_bytes = max(0, total_bytes - free_bytes)
            percent_used = round((used_bytes / total_bytes * 100), 1) if total_bytes > 0 else 0

            return {
                "volume_name": vol_name or "Linux Filesystem",
                "uuid": self.volume.uuid,
                "block_size": block_size,
                "total_blocks": total_blocks,
                "free_blocks": free_blocks,
                "total_bytes": total_bytes,
                "free_bytes": free_bytes,
                "used_bytes": used_bytes,
                "percent_used": percent_used,
                "total_human": format_bytes(total_bytes),
                "free_human": format_bytes(free_bytes),
                "used_human": format_bytes(used_bytes),
                "total_inodes": total_inodes,
                "free_inodes": free_inodes,
                "used_inodes": total_inodes - free_inodes,
                "inodes_percent": round(((total_inodes - free_inodes) / total_inodes * 100), 1) if total_inodes > 0 else 0,
                "last_mount_time": datetime.datetime.fromtimestamp(sb.s_mtime, tz=datetime.timezone.utc).isoformat() if sb.s_mtime else None,
                "last_write_time": datetime.datetime.fromtimestamp(sb.s_wtime, tz=datetime.timezone.utc).isoformat() if sb.s_wtime else None,
                "mount_count": sb.s_mnt_count,
                "max_mount_count": sb.s_max_mnt_count,
                "filesystem_state": "Clean" if sb.s_state == 1 else "Has Errors",
                "engine": "python-ext4"
            }

        # Fallback to direct inspection
        from disk_detector import get_volume_info
        info = get_volume_info(self.device_path, self.offset)
        info["engine"] = "direct-superblock"
        return info

    def _resolve_inode(self, path: str) -> Tuple[Any, str]:
        """Resolve path to ext4 Inode and return (inode, normalized_path)."""
        if not self.volume or not getattr(self.volume, "root", None):
            raise RuntimeError(f"Filesystem volume not initialized for '{self.device_path}'. Please ensure a valid ext2/ext3/ext4 partition is selected.")
        
        norm_path = "/" + "/".join([p for p in path.strip("/").split("/") if p and p != "."])
        if norm_path == "/":
            return self.volume.root, "/"

        # Traverse path components
        parts = [p for p in norm_path.split("/") if p]
        curr_inode = self.volume.root

        for part in parts:
            if not isinstance(curr_inode, ext4.Directory):
                raise FileNotFoundError(f"Not a directory: {part}")
            
            found = False
            for dirent, ft in curr_inode.opendir():
                if dirent.name_str == part:
                    curr_inode = self.volume.inodes[dirent.inode]
                    found = True
                    break
            
            if not found:
                raise FileNotFoundError(f"Path component not found: {part}")

        return curr_inode, norm_path

    def listdir(self, path: str = "/") -> List[Dict[str, Any]]:
        """List directory contents with complete metadata."""
        inode, norm_path = self._resolve_inode(path)
        if not isinstance(inode, ext4.Directory):
            raise NotADirectoryError(f"'{path}' is not a directory")

        entries = []
        for dirent, ft in inode.opendir():
            name = dirent.name_str
            if name in (".", ".."):
                continue

            try:
                child_inode = self.volume.inodes[dirent.inode]
                mode_int = child_inode.i_mode
                mode_str = stat.filemode(mode_int)
                
                # Determine file type
                file_type = "file"
                if stat.S_ISDIR(mode_int):
                    file_type = "directory"
                elif stat.S_ISLNK(mode_int):
                    file_type = "symlink"
                elif stat.S_ISCHR(mode_int):
                    file_type = "char_device"
                elif stat.S_ISBLK(mode_int):
                    file_type = "block_device"
                elif stat.S_ISFIFO(mode_int):
                    file_type = "fifo"
                elif stat.S_ISSOCK(mode_int):
                    file_type = "socket"

                # Symlink target
                target = None
                if file_type == "symlink" and isinstance(child_inode, ext4.SymbolicLink):
                    try:
                        target = child_inode.readlink().decode("utf-8", errors="replace")
                    except Exception:
                        pass

                # Size
                file_size = getattr(child_inode, "i_size", 0) if file_type != "directory" else 4096

                # Timestamps
                mtime_iso = None
                atime_iso = None
                ctime_iso = None
                if child_inode.i_mtime:
                    mtime_iso = datetime.datetime.fromtimestamp(child_inode.i_mtime, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                if child_inode.i_atime:
                    atime_iso = datetime.datetime.fromtimestamp(child_inode.i_atime, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                if child_inode.i_ctime:
                    ctime_iso = datetime.datetime.fromtimestamp(child_inode.i_ctime, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

                item_path = f"{norm_path.rstrip('/')}/{name}"

                entries.append({
                    "name": name,
                    "path": item_path,
                    "type": file_type,
                    "size": file_size,
                    "size_human": format_bytes(file_size) if file_type != "directory" else "-",
                    "mode": mode_str,
                    "uid": child_inode.i_uid,
                    "gid": child_inode.i_gid,
                    "inode": dirent.inode,
                    "mtime": mtime_iso,
                    "atime": atime_iso,
                    "ctime": ctime_iso,
                    "target": target
                })
            except Exception as e:
                # Still list entry even if inode parsing hit error
                item_path = f"{norm_path.rstrip('/')}/{name}"
                entries.append({
                    "name": name,
                    "path": item_path,
                    "type": "unknown",
                    "size": 0,
                    "size_human": "-",
                    "mode": "?????????",
                    "uid": 0,
                    "gid": 0,
                    "inode": dirent.inode,
                    "mtime": None,
                    "error": str(e)
                })

        # Sort: directories first, then alphabetical
        entries.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
        return entries

    def read_file(self, path: str, offset: int = 0, limit: Optional[int] = None) -> bytes:
        """Read bytes from a file."""
        inode, _ = self._resolve_inode(path)
        if not isinstance(inode, ext4.File):
            raise IsADirectoryError(f"'{path}' is not a regular file")

        with inode.open() as f:
            if offset > 0:
                f.seek(offset)
            if limit is not None:
                return f.read(limit)
            return f.read()

    def stream_file(self, path: str, chunk_size: int = 65536) -> Generator[bytes, None, None]:
        """Stream file contents in chunks."""
        inode, _ = self._resolve_inode(path)
        if not isinstance(inode, ext4.File):
            raise IsADirectoryError(f"'{path}' is not a regular file")

        with inode.open() as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    def get_preview(self, path: str, max_bytes: int = 262144) -> Dict[str, Any]:
        """Read preview data: text with syntax detection, image preview, or hex dump."""
        inode, norm_path = self._resolve_inode(path)
        file_size = getattr(inode, "i_size", 0)
        mime, _ = mimetypes.guess_type(path)

        data = b""
        with inode.open() as f:
            data = f.read(max_bytes)

        is_truncated = file_size > max_bytes
        is_binary = b"\x00" in data[:1024]

        # Check if text
        content_text = None
        if not is_binary:
            try:
                content_text = data.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    content_text = data.decode("latin-1")
                except Exception:
                    is_binary = True

        import base64
        content_base64 = None
        if is_binary and mime and mime.startswith("image/"):
            content_base64 = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")

        hex_lines = format_hex_dump(data[:4096])

        mode_str = stat.filemode(inode.i_mode)
        mtime_iso = datetime.datetime.fromtimestamp(inode.i_mtime, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if inode.i_mtime else None

        return {
            "name": os.path.basename(norm_path),
            "path": norm_path,
            "size": file_size,
            "size_human": format_bytes(file_size),
            "is_binary": is_binary,
            "is_truncated": is_truncated,
            "mime_type": mime or ("text/plain" if not is_binary else "application/octet-stream"),
            "content_text": content_text,
            "content_base64": content_base64,
            "hex_dump": hex_lines,
            "metadata": {
                "inode": inode.i_no,
                "mode": mode_str,
                "uid": inode.i_uid,
                "gid": inode.i_gid,
                "mtime": mtime_iso,
                "links": inode.i_links_count,
                "flags": hex(inode.i_flags) if hasattr(inode, "i_flags") else "0x0"
            }
        }

    def generate_zip_stream(self, folder_path: str = "/") -> Generator[bytes, None, None]:
        """Generate a streaming zip archive of a directory."""
        buffer = io.BytesIO()
        zf = zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED)

        def add_dir(dir_path: str, rel_prefix: str):
            entries = self.listdir(dir_path)
            for entry in entries:
                rel_path = os.path.join(rel_prefix, entry["name"])
                if entry["type"] == "directory":
                    zf.writestr(f"{rel_path}/", b"")
                    add_dir(entry["path"], rel_path)
                elif entry["type"] == "file":
                    try:
                        content = self.read_file(entry["path"])
                        zf.writestr(rel_path, content)
                    except Exception:
                        pass

        root_name = os.path.basename(folder_path.rstrip("/")) or "root"
        add_dir(folder_path, root_name)
        zf.close()

        buffer.seek(0)
        while True:
            chunk = buffer.read(65536)
            if not chunk:
                break
            yield chunk

    def search(self, query: str, root_path: str = "/", max_results: int = 150) -> List[Dict[str, Any]]:
        """Recursively search for matching filenames."""
        results = []
        q_lower = query.lower()

        def scan_dir(dir_path: str):
            if len(results) >= max_results:
                return
            try:
                entries = self.listdir(dir_path)
                for entry in entries:
                    if q_lower in entry["name"].lower():
                        results.append(entry)
                        if len(results) >= max_results:
                            return
                    if entry["type"] == "directory":
                        scan_dir(entry["path"])
            except Exception:
                pass

        scan_dir(root_path)
        return results

    def grep_content(
        self,
        query: str,
        root_path: str = "/",
        recursive: bool = False,
        case_sensitive: bool = False,
        max_file_size: int = 5 * 1024 * 1024,
        max_results: int = 100
    ) -> List[Dict[str, Any]]:
        """Search inside text files for a query string."""
        results = []
        if not query:
            return results

        target = query if case_sensitive else query.lower()

        # Common non-text extensions to skip for performance
        binary_exts = {
            ".bin", ".iso", ".img", ".dmg", ".tar", ".gz", ".zip", ".xz", ".bz2", ".7z",
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff",
            ".mp4", ".mkv", ".mov", ".avi", ".webm", ".mp3", ".wav", ".flac", ".ogg",
            ".pdf", ".exe", ".dylib", ".so", ".o", ".a", ".pyc"
        }

        def check_file(entry: Dict[str, Any]):
            if len(results) >= max_results:
                return

            file_path = entry["path"]
            file_name = entry["name"]
            size = entry.get("size", 0)

            # Skip huge files and known binaries
            ext = os.path.splitext(file_name)[1].lower()
            if ext in binary_exts or size > max_file_size:
                return

            try:
                # Read up to 2MB of file content
                chunk = self.read_file(file_path, limit=min(size, 2 * 1024 * 1024))
                if not chunk:
                    return

                # Quick binary byte check
                if b"\x00" in chunk[:1024]:
                    return

                # Decode to string
                try:
                    text = chunk.decode("utf-8")
                except UnicodeDecodeError:
                    try:
                        text = chunk.decode("latin-1")
                    except Exception:
                        return

                lines = text.splitlines()
                matching_lines = []
                for line_idx, line in enumerate(lines, 1):
                    compare_line = line if case_sensitive else line.lower()
                    if target in compare_line:
                        snippet = line.strip()
                        if len(snippet) > 160:
                            idx = compare_line.find(target)
                            start = max(0, idx - 40)
                            end = min(len(snippet), idx + len(target) + 80)
                            snippet = ("..." if start > 0 else "") + snippet[start:end] + ("..." if end < len(snippet) else "")
                        matching_lines.append({
                            "line": line_idx,
                            "snippet": snippet
                        })
                        if len(matching_lines) >= 5:
                            break

                if matching_lines:
                    results.append({
                        "name": file_name,
                        "path": file_path,
                        "type": "file",
                        "size": size,
                        "size_human": format_bytes(size),
                        "mode": entry.get("mode", "-rw-r--r--"),
                        "uid": entry.get("uid", 0),
                        "gid": entry.get("gid", 0),
                        "inode": entry.get("inode", 0),
                        "mtime": entry.get("mtime"),
                        "match_count": len(matching_lines),
                        "matches": matching_lines
                    })
            except Exception:
                pass

        def scan_dir(dir_path: str):
            if len(results) >= max_results:
                return
            try:
                entries = self.listdir(dir_path)
                # First check files in this directory
                for entry in entries:
                    if entry["type"] == "file":
                        check_file(entry)
                        if len(results) >= max_results:
                            return

                # Recurse if requested
                if recursive:
                    for entry in entries:
                        if entry["type"] == "directory":
                            if entry["name"] not in ("proc", "sys", "dev", "lost+found"):
                                scan_dir(entry["path"])
                                if len(results) >= max_results:
                                    return
            except Exception:
                pass

        scan_dir(root_path)
        return results

    def grep_content_stream(
        self,
        query: str,
        root_path: str = "/",
        recursive: bool = False,
        case_sensitive: bool = False,
        max_file_size: int = 5 * 1024 * 1024,
        max_results: int = 250
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream search progress and matches as a generator."""
        if not query:
            yield {"type": "done", "scanned": 0, "total": 0, "matches_count": 0, "elapsed": 0.0, "speed": 0}
            return

        target = query if case_sensitive else query.lower()
        t0 = time.time()

        binary_exts = {
            ".bin", ".iso", ".img", ".dmg", ".tar", ".gz", ".zip", ".xz", ".bz2", ".7z",
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff",
            ".mp4", ".mkv", ".mov", ".avi", ".webm", ".mp3", ".wav", ".flac", ".ogg",
            ".pdf", ".exe", ".dylib", ".so", ".o", ".a", ".pyc"
        }

        total_files = None
        if not recursive:
            try:
                entries = self.listdir(root_path)
                total_files = len([e for e in entries if e.get("type") == "file"])
            except Exception:
                total_files = None

        yield {
            "type": "start",
            "query": query,
            "root_path": root_path,
            "recursive": recursive,
            "total": total_files
        }

        scanned = 0
        matches_count = 0
        last_yield_time = t0

        def check_file(entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            file_path = entry["path"]
            file_name = entry["name"]
            size = entry.get("size", 0)

            ext = os.path.splitext(file_name)[1].lower()
            if ext in binary_exts or size > max_file_size:
                return None

            try:
                chunk = self.read_file(file_path, limit=min(size, 2 * 1024 * 1024))
                if not chunk or b"\x00" in chunk[:1024]:
                    return None

                try:
                    text = chunk.decode("utf-8")
                except UnicodeDecodeError:
                    try:
                        text = chunk.decode("latin-1")
                    except Exception:
                        return None

                lines = text.splitlines()
                matching_lines = []
                for line_idx, line in enumerate(lines, 1):
                    compare_line = line if case_sensitive else line.lower()
                    if target in compare_line:
                        snippet = line.strip()
                        if len(snippet) > 160:
                            idx = compare_line.find(target)
                            start = max(0, idx - 40)
                            end = min(len(snippet), idx + len(target) + 80)
                            snippet = ("..." if start > 0 else "") + snippet[start:end] + ("..." if end < len(snippet) else "")
                        matching_lines.append({
                            "line": line_idx,
                            "snippet": snippet
                        })
                        if len(matching_lines) >= 5:
                            break

                if matching_lines:
                    return {
                        "name": file_name,
                        "path": file_path,
                        "type": "file",
                        "size": size,
                        "size_human": format_bytes(size),
                        "mode": entry.get("mode", "-rw-r--r--"),
                        "uid": entry.get("uid", 0),
                        "gid": entry.get("gid", 0),
                        "inode": entry.get("inode", 0),
                        "mtime": entry.get("mtime"),
                        "match_count": len(matching_lines),
                        "matches": matching_lines
                    }
            except Exception:
                pass
            return None

        dirs_to_visit = [root_path]

        while dirs_to_visit and matches_count < max_results:
            dir_path = dirs_to_visit.pop(0)
            try:
                entries = self.listdir(dir_path)
            except Exception:
                continue

            for entry in entries:
                if entry["type"] == "directory":
                    if recursive and entry["name"] not in ("proc", "sys", "dev", "lost+found"):
                        dirs_to_visit.append(entry["path"])
                elif entry["type"] == "file":
                    scanned += 1
                    now = time.time()
                    elapsed = max(0.01, now - t0)

                    if now - last_yield_time >= 0.15 or scanned == total_files:
                        speed = round(scanned / elapsed, 1)
                        yield {
                            "type": "progress",
                            "scanned": scanned,
                            "total": total_files,
                            "current_file": entry["name"],
                            "current_path": entry["path"],
                            "matches_count": matches_count,
                            "speed": speed,
                            "elapsed": round(elapsed, 1)
                        }
                        last_yield_time = now

                    match_res = check_file(entry)
                    if match_res:
                        matches_count += 1
                        yield {
                            "type": "match",
                            "match": match_res,
                            "matches_count": matches_count
                        }
                        if matches_count >= max_results:
                            break

        total_elapsed = max(0.01, time.time() - t0)
        yield {
            "type": "done",
            "scanned": scanned,
            "total": total_files or scanned,
            "matches_count": matches_count,
            "elapsed": round(total_elapsed, 2),
            "speed": round(scanned / total_elapsed, 1)
        }

    def search_stream(
        self,
        query: str,
        root_path: str = "/",
        max_results: int = 250
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream filename search progress and matches as a generator."""
        q_lower = query.lower()
        t0 = time.time()
        scanned = 0
        matches_count = 0
        last_yield = t0

        yield {
            "type": "start",
            "query": query,
            "root_path": root_path,
            "total": None
        }

        dirs_to_visit = [root_path]

        while dirs_to_visit and matches_count < max_results:
            dir_path = dirs_to_visit.pop(0)
            try:
                entries = self.listdir(dir_path)
            except Exception:
                continue

            for entry in entries:
                scanned += 1
                now = time.time()
                elapsed = max(0.01, now - t0)

                if now - last_yield >= 0.15:
                    yield {
                        "type": "progress",
                        "scanned": scanned,
                        "total": None,
                        "current_file": entry["name"],
                        "current_path": entry["path"],
                        "matches_count": matches_count,
                        "speed": round(scanned / elapsed, 1),
                        "elapsed": round(elapsed, 1)
                    }
                    last_yield = now

                if q_lower in entry["name"].lower():
                    matches_count += 1
                    yield {
                        "type": "match",
                        "match": entry,
                        "matches_count": matches_count
                    }
                    if matches_count >= max_results:
                        break

                if entry["type"] == "directory" and entry["name"] not in ("proc", "sys", "dev", "lost+found"):
                    dirs_to_visit.append(entry["path"])

        total_elapsed = max(0.01, time.time() - t0)
        yield {
            "type": "done",
            "scanned": scanned,
            "total": scanned,
            "matches_count": matches_count,
            "elapsed": round(total_elapsed, 2),
            "speed": round(scanned / total_elapsed, 1)
        }

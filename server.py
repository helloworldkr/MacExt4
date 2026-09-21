"""
FastAPI server for LinuxDiskReader.
Provides REST API and serves the modern interactive web application.
"""

import os
import io
import sys
import json
import re
import subprocess
import threading
import asyncio
import urllib.parse
import time
from typing import Optional, Dict, Any

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from disk_detector import list_disks, scan_partitions, get_volume_info
from reader import LinuxFileSystem, format_bytes
from sample_generator import create_sample_disk
import saved_searches

app = FastAPI(title="LinuxDiskReader", description="Read Linux SSDs and ext2/3/4 partitions on macOS")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global active filesystem session
active_fs: Optional[LinuxFileSystem] = None
active_device: Optional[str] = None
active_offset: int = 0
fs_lock = threading.Lock()


def get_resource_path(relative_path: str) -> str:
    """Get absolute path to bundled resource (works for dev and PyInstaller)."""
    if hasattr(sys, "_MEIPASS"):
        cand = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(cand):
            return cand
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)


def get_writable_path(filename: str) -> str:
    """Get a writable path for disk images or state files."""
    cwd_path = os.path.abspath(filename)
    if os.path.exists(cwd_path):
        return cwd_path

    bundled = get_resource_path(filename)
    if os.path.exists(bundled):
        return bundled

    app_data = os.path.expanduser("~/Library/Application Support/LinuxSSDReader")
    os.makedirs(app_data, exist_ok=True)
    return os.path.join(app_data, filename)


def _clean_param(val, default=None):
    if hasattr(val, "default"):
        return val.default
    return val if val is not None else default


async def _is_client_disconnected(req) -> bool:
    if not req:
        return False
    try:
        return await req.is_disconnected()
    except Exception:
        return False


def get_current_fs() -> LinuxFileSystem:
    global active_fs, active_device, active_offset
    if active_fs is not None and getattr(active_fs, "volume", None) is not None:
        return active_fs

    # Close any stale filesystem
    if active_fs is not None:
        try:
            active_fs.close()
        except Exception:
            pass
        active_fs = None

    # Try finding the first readable ext4 device
    disks = list_disks()
    for d in disks:
        if d.get("is_ext4") and d.get("is_readable"):
            cand_dev = d["device_path"]
            cand_offset = 0
            for p in d.get("partitions", []):
                if p.get("is_ext4"):
                    cand_offset = p.get("offset", 0)
                    cand_dev = p.get("device_path", cand_dev)
                    break
            try:
                candidate_fs = LinuxFileSystem(cand_dev, offset=cand_offset)
                if candidate_fs.volume:
                    active_fs = candidate_fs
                    active_device = cand_dev
                    active_offset = cand_offset
                    return active_fs
            except Exception:
                pass

    # If none found, load or generate sample disk
    sample_path = get_writable_path("sample_linux_disk.img")
    if not os.path.exists(sample_path):
        bundled = get_resource_path("sample_linux_disk.img")
        if os.path.exists(bundled):
            sample_path = bundled
        else:
            create_sample_disk(sample_path)
    active_device = os.path.abspath(sample_path)
    active_offset = 0
    active_fs = LinuxFileSystem(active_device, offset=0)
    return active_fs


@app.get("/api/disks")
def api_disks():
    """List all detected physical disks, external drives, partitions, and disk images."""
    try:
        # Ensure active_fs is initialized
        get_current_fs()
        disks = list_disks()
        return {
            "disks": disks,
            "active_device": active_device,
            "active_offset": active_offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mount")
def api_mount(payload: Dict[str, Any]):
    """Switch active filesystem to specified device and offset."""
    global active_fs, active_device, active_offset
    device_path = payload.get("device_path")
    offset = int(payload.get("offset", 0))

    if not device_path:
        raise HTTPException(status_code=400, detail="Missing device_path")

    if not os.path.exists(device_path):
        raise HTTPException(status_code=404, detail=f"Device or file not found: {device_path}")

    # If the target is a whole disk (e.g. /dev/disk4) and offset is 0,
    # auto-detect if there is a known Linux partition (e.g. /dev/disk4s2)
    dev_name = os.path.basename(device_path)
    if dev_name.startswith("disk") and "s" not in dev_name and offset == 0:
        try:
            disks = list_disks()
            for d in disks:
                if d.get("device_path") == device_path or d.get("identifier") == dev_name:
                    for p in d.get("partitions", []):
                        if p.get("is_ext4") or p.get("content_type") == "Linux Filesystem" or p.get("is_linux_candidate"):
                            if p.get("device_path") and os.path.exists(p["device_path"]):
                                device_path = p["device_path"]
                                offset = p.get("offset", 0)
                                break
                    break
        except Exception:
            pass

    # Validate and open new filesystem BEFORE closing existing one
    try:
        new_fs = LinuxFileSystem(device_path, offset=offset)
        if not new_fs.volume:
            raise ValueError(f"'{device_path}' at offset {offset} could not be loaded as ext4.")
        info = new_fs.get_info()
    except PermissionError as e:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied accessing '{device_path}'. Click 'Unlock Hardware Access' or run with sudo to grant read permissions."
        )
    except Exception as e:
        err_msg = str(e)
        if "Permission denied" in err_msg or "Errno 13" in err_msg:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied accessing '{device_path}'. Click 'Unlock Hardware Access' or run with sudo to grant read permissions."
            )
        raise HTTPException(status_code=400, detail=f"Cannot mount filesystem: {err_msg}")

    # Close previous filesystem
    if active_fs:
        try:
            active_fs.close()
        except Exception:
            pass

    active_fs = new_fs
    active_device = device_path
    active_offset = offset
    return {
        "status": "success",
        "device_path": device_path,
        "offset": offset,
        "info": info
    }


@app.get("/api/status")
def api_status():
    """Get active filesystem volume stats and health."""
    try:
        fs = get_current_fs()
        if not fs or not fs.volume:
            return {
                "mounted": False,
                "error": "No ext2/ext3/ext4 volume currently mounted"
            }
        info = fs.get_info()
        return {
            "mounted": True,
            "device_path": active_device,
            "offset": active_offset,
            "info": info
        }
    except Exception as e:
        return {
            "mounted": False,
            "error": str(e)
        }


@app.get("/api/ls")
def api_ls(path: str = Query("/", description="Filesystem directory path")):
    """List directory contents."""
    try:
        fs = get_current_fs()
        entries = fs.listdir(path)
        return {
            "path": path,
            "entries": entries,
            "count": len(entries)
        }
    except NotADirectoryError:
        raise HTTPException(status_code=400, detail=f"'{path}' is not a directory")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Path not found: '{path}'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/preview")
def api_preview(path: str = Query(..., description="File path to preview")):
    """Get file preview, code content, hex dump, or image."""
    try:
        fs = get_current_fs()
        preview = fs.get_preview(path)
        return preview
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: '{path}'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download")
def api_download(path: str = Query(..., description="File path to download")):
    """Download single file."""
    try:
        fs = get_current_fs()
        filename = os.path.basename(path.rstrip("/")) or "download.bin"
        encoded_filename = urllib.parse.quote(filename)

        headers = {
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}"
        }
        return StreamingResponse(
            fs.stream_file(path),
            media_type="application/octet-stream",
            headers=headers
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: '{path}'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download-zip")
def api_download_zip(path: str = Query("/", description="Folder path to download as ZIP")):
    """Download entire directory recursively as a ZIP archive."""
    try:
        fs = get_current_fs()
        folder_name = os.path.basename(path.rstrip("/")) or "linux_disk_root"
        filename = f"{folder_name}.zip"
        encoded_filename = urllib.parse.quote(filename)

        headers = {
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}"
        }
        return StreamingResponse(
            fs.generate_zip_stream(path),
            media_type="application/zip",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download-text")
async def api_download_text(request: Request):
    """Download plain text content as an attachment file."""
    try:
        data = await request.json()
        raw_filename = data.get("filename") or "search_results.txt"
        filename = os.path.basename(raw_filename) or "search_results.txt"
        if not filename.endswith(".txt"):
            filename += ".txt"
        content = data.get("content", "")
        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}"
        }
        return Response(
            content=content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/search/export")
def api_search_export(
    q: str = Query(..., description="Search query"),
    path: str = Query("/", description="Root search path"),
    mode: str = Query("filename", description="Search mode: 'filename' or 'grep'"),
    recursive: bool = Query(True, description="Recursive search"),
    case_sensitive: bool = Query(False, description="Case-sensitive match"),
    whole_word: bool = Query(False, description="Match whole word only"),
    use_regex: bool = Query(False, description="Treat query as regular expression"),
    include_exts: Optional[str] = Query(None, description="Comma-separated extensions to include"),
    exclude_exts: Optional[str] = Query(None, description="Comma-separated extensions or folder names to exclude"),
    type_filter: str = Query("all", description="Filter by item type: 'all', 'file', 'directory', 'symlink'"),
    min_size: Optional[int] = Query(None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(None, description="Maximum file size in bytes"),
    date_filter: Optional[str] = Query(None, description="Date modified cutoff: '24h', '7d', '30d', '1y'")
):
    """Export search results directly as formatted plain text report with active filters."""
    try:
        q = _clean_param(q, "")
        path = _clean_param(path, "/")
        mode = _clean_param(mode, "filename")
        recursive = bool(_clean_param(recursive, False))
        case_sensitive = bool(_clean_param(case_sensitive, False))
        whole_word = bool(_clean_param(whole_word, False))
        use_regex = bool(_clean_param(use_regex, False))
        include_exts = _clean_param(include_exts, None)
        exclude_exts = _clean_param(exclude_exts, None)
        type_filter = _clean_param(type_filter, "all")
        min_size = _clean_param(min_size, None)
        max_size = _clean_param(max_size, None)
        date_filter = _clean_param(date_filter, None)

        fs = get_current_fs()
        info = fs.get_info()
        vol_name = info.get("volume_name") or "Linux Ext4"

        lines = [
            "=" * 80,
            "LINUX SSD EXPLORER - SEARCH RESULTS REPORT",
            "=" * 80,
            f"Volume / Disk : {vol_name}",
            f"Search Query  : \"{q}\"",
            f"Search Mode   : {'Inside Files (Grep)' if mode == 'grep' else 'Filename Search'}",
            f"Search Scope  : {path} {'(Recursive)' if recursive else ''}",
            f"Generated At  : {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        ]

        if include_exts:
            lines.append(f"Include Exts  : {include_exts}")
        if exclude_exts:
            lines.append(f"Exclude Exts  : {exclude_exts}")
        if type_filter and type_filter != "all":
            lines.append(f"Type Filter   : {type_filter}")
        if min_size or max_size:
            lines.append(f"Size Bounds   : {min_size or 0} B to {max_size or 'unlimited'} B")
        if date_filter and date_filter != "any":
            lines.append(f"Date Modified : {date_filter}")

        if mode == "grep":
            results = fs.grep_content(
                query=q,
                root_path=path,
                recursive=recursive,
                case_sensitive=case_sensitive,
                whole_word=whole_word,
                use_regex=use_regex,
                include_exts=include_exts,
                exclude_exts=exclude_exts,
                min_size=min_size,
                max_size=max_size,
                date_filter=date_filter
            )
            total_matches = sum(len(r.get("matches", [])) for r in results)
            lines.append(f"Total Matches : {len(results)} file(s) with {total_matches} occurrence(s)")
            lines.append("=" * 80)
            lines.append("")

            for idx, item in enumerate(results, 1):
                lines.append(f"[{idx}] {item['path']}")
                lines.append(f"    Type        : File")
                lines.append(f"    Size        : {item.get('size_human', '0 B')} ({item.get('size', 0):,} bytes)")
                lines.append(f"    Permissions : {item.get('mode', '-rw-r--r--')} (UID: {item.get('uid', 0)}, GID: {item.get('gid', 0)})")
                if item.get("inode"):
                    lines.append(f"    Inode       : {item['inode']}")
                if item.get("mtime"):
                    lines.append(f"    Modified    : {item['mtime']}")
                matches = item.get("matches", [])
                lines.append(f"    Matches     : {len(matches)} occurrence(s)")
                lines.append(f"    {'-' * 80}")
                for m in matches:
                    lines.append(f"      Line {str(m.get('line', '')).ljust(5)}: {m.get('snippet', '')}")
                lines.append(f"    {'-' * 80}")
                lines.append("")
        else:
            results = fs.search(
                query=q,
                root_path=path,
                include_exts=include_exts,
                exclude_exts=exclude_exts,
                type_filter=type_filter,
                min_size=min_size,
                max_size=max_size,
                date_filter=date_filter,
                case_sensitive=case_sensitive,
                whole_word=whole_word,
                use_regex=use_regex
            )
            lines.append(f"Total Matches : {len(results)} item(s) found")
            lines.append("=" * 80)
            lines.append("")

            for idx, item in enumerate(results, 1):
                lines.append(f"[{idx}] {item['path']}")
                lines.append(f"    Type        : {item.get('type', 'file').capitalize()}")
                lines.append(f"    Size        : {item.get('size_human', '0 B')} ({item.get('size', 0):,} bytes)")
                lines.append(f"    Permissions : {item.get('mode', '-rw-r--r--')} (UID: {item.get('uid', 0)}, GID: {item.get('gid', 0)})")
                if item.get("inode"):
                    lines.append(f"    Inode       : {item['inode']}")
                if item.get("mtime"):
                    lines.append(f"    Modified    : {item['mtime']}")
                if item.get("target"):
                    lines.append(f"    Symlink To  : {item['target']}")
                lines.append("")

        lines.append("=" * 80)
        lines.append(f"End of Report ({len(results)} items) - Linux SSD Explorer")
        lines.append("=" * 80)

        report_text = "\n".join(lines)
        safe_q = re.sub(r'[^a-zA-Z0-9_-]', '_', q)[:30] or "results"
        filename = f"search_{mode}_{safe_q}.txt"
        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}"
        }
        return Response(
            content=report_text.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search")
def api_search(
    q: str = Query("", description="Search query"),
    path: str = Query("/", description="Root search path"),
    include_exts: Optional[str] = Query(None, description="Extensions to include"),
    exclude_exts: Optional[str] = Query(None, description="Extensions or folders to exclude"),
    type_filter: str = Query("all", description="Item type: 'all', 'file', 'directory', 'symlink'"),
    min_size: Optional[int] = Query(None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(None, description="Maximum file size in bytes"),
    date_filter: Optional[str] = Query(None, description="Date modified filter: '24h', '7d', '30d', '1y'"),
    case_sensitive: bool = Query(False, description="Case-sensitive matching"),
    whole_word: bool = Query(False, description="Whole word matching"),
    use_regex: bool = Query(False, description="Regular expression matching")
):
    """Search files recursively with advanced filtering."""
    try:
        q = _clean_param(q, "")
        path = _clean_param(path, "/")
        include_exts = _clean_param(include_exts, None)
        exclude_exts = _clean_param(exclude_exts, None)
        type_filter = _clean_param(type_filter, "all")
        min_size = _clean_param(min_size, None)
        max_size = _clean_param(max_size, None)
        date_filter = _clean_param(date_filter, None)
        case_sensitive = bool(_clean_param(case_sensitive, False))
        whole_word = bool(_clean_param(whole_word, False))
        use_regex = bool(_clean_param(use_regex, False))

        fs = get_current_fs()
        results = fs.search(
            query=q,
            root_path=path,
            include_exts=include_exts,
            exclude_exts=exclude_exts,
            type_filter=type_filter,
            min_size=min_size,
            max_size=max_size,
            date_filter=date_filter,
            case_sensitive=case_sensitive,
            whole_word=whole_word,
            use_regex=use_regex
        )
        return {
            "query": q,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/grep")
def api_grep(
    q: str = Query(..., description="Search query string to find inside files"),
    path: str = Query("/", description="Root search path"),
    recursive: bool = Query(False, description="Recursive directory scan"),
    case_sensitive: bool = Query(False, description="Case-sensitive match"),
    whole_word: bool = Query(False, description="Whole word matching"),
    use_regex: bool = Query(False, description="Regular expression matching"),
    include_exts: Optional[str] = Query(None, description="Extensions to include"),
    exclude_exts: Optional[str] = Query(None, description="Extensions or folders to exclude"),
    min_size: Optional[int] = Query(None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(None, description="Maximum file size in bytes"),
    date_filter: Optional[str] = Query(None, description="Date cutoff: '24h', '7d', '30d', '1y'")
):
    """Search inside text files for a query string (grep) with advanced filters."""
    try:
        q = _clean_param(q, "")
        path = _clean_param(path, "/")
        recursive = bool(_clean_param(recursive, False))
        case_sensitive = bool(_clean_param(case_sensitive, False))
        whole_word = bool(_clean_param(whole_word, False))
        use_regex = bool(_clean_param(use_regex, False))
        include_exts = _clean_param(include_exts, None)
        exclude_exts = _clean_param(exclude_exts, None)
        min_size = _clean_param(min_size, None)
        max_size = _clean_param(max_size, None)
        date_filter = _clean_param(date_filter, None)

        fs = get_current_fs()
        results = fs.grep_content(
            query=q,
            root_path=path,
            recursive=recursive,
            case_sensitive=case_sensitive,
            whole_word=whole_word,
            use_regex=use_regex,
            include_exts=include_exts,
            exclude_exts=exclude_exts,
            min_size=min_size,
            max_size=max_size,
            date_filter=date_filter
        )
        return {
            "query": q,
            "root_path": path,
            "recursive": recursive,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search/stream")
async def api_search_stream(
    request: Request,
    q: str = Query("", description="Search query"),
    path: str = Query("/", description="Root search path"),
    include_exts: Optional[str] = Query(None, description="Extensions to include"),
    exclude_exts: Optional[str] = Query(None, description="Extensions or folders to exclude"),
    type_filter: str = Query("all", description="Item type: 'all', 'file', 'directory', 'symlink'"),
    min_size: Optional[int] = Query(None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(None, description="Maximum file size in bytes"),
    date_filter: Optional[str] = Query(None, description="Date cutoff: '24h', '7d', '30d', '1y'"),
    case_sensitive: bool = Query(False, description="Case-sensitive matching"),
    whole_word: bool = Query(False, description="Whole word matching"),
    use_regex: bool = Query(False, description="Regular expression matching")
):
    """Stream filename search progress and matches using Server-Sent Events (SSE) with filters."""
    q = _clean_param(q, "")
    path = _clean_param(path, "/")
    include_exts = _clean_param(include_exts, None)
    exclude_exts = _clean_param(exclude_exts, None)
    type_filter = _clean_param(type_filter, "all")
    min_size = _clean_param(min_size, None)
    max_size = _clean_param(max_size, None)
    date_filter = _clean_param(date_filter, None)
    case_sensitive = bool(_clean_param(case_sensitive, False))
    whole_word = bool(_clean_param(whole_word, False))
    use_regex = bool(_clean_param(use_regex, False))

    fs = get_current_fs()

    async def event_generator():
        queue = asyncio.Queue(maxsize=100)
        loop = asyncio.get_running_loop()
        stop_event = threading.Event()
        done_sentinel = object()

        def worker():
            with fs_lock:
                try:
                    for event in fs.search_stream(
                        query=q,
                        root_path=path,
                        include_exts=include_exts,
                        exclude_exts=exclude_exts,
                        type_filter=type_filter,
                        min_size=min_size,
                        max_size=max_size,
                        date_filter=date_filter,
                        case_sensitive=case_sensitive,
                        whole_word=whole_word,
                        use_regex=use_regex,
                        stop_event=stop_event
                    ):
                        if stop_event.is_set():
                            break
                        asyncio.run_coroutine_threadsafe(queue.put(event), loop).result()
                except Exception as e:
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "error": str(e)}), loop).result()
                finally:
                    asyncio.run_coroutine_threadsafe(queue.put(done_sentinel), loop).result()

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        try:
            while True:
                if await _is_client_disconnected(request):
                    stop_event.set()
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.25)
                    if item is done_sentinel:
                        break
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    if await _is_client_disconnected(request):
                        stop_event.set()
                        break
                    yield ": ping\n\n"
        finally:
            stop_event.set()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/grep/stream")
async def api_grep_stream(
    request: Request,
    q: str = Query(..., description="Search query string to find inside files"),
    path: str = Query("/", description="Root search path"),
    recursive: bool = Query(False, description="Recursive directory scan"),
    case_sensitive: bool = Query(False, description="Case-sensitive match"),
    whole_word: bool = Query(False, description="Whole word matching"),
    use_regex: bool = Query(False, description="Regular expression matching"),
    include_exts: Optional[str] = Query(None, description="Extensions to include"),
    exclude_exts: Optional[str] = Query(None, description="Extensions or folders to exclude"),
    min_size: Optional[int] = Query(None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(None, description="Maximum file size in bytes"),
    date_filter: Optional[str] = Query(None, description="Date cutoff: '24h', '7d', '30d', '1y'")
):
    """Stream grep search progress, scanned files count, and matches as SSE with filters."""
    q = _clean_param(q, "")
    path = _clean_param(path, "/")
    recursive = bool(_clean_param(recursive, False))
    case_sensitive = bool(_clean_param(case_sensitive, False))
    whole_word = bool(_clean_param(whole_word, False))
    use_regex = bool(_clean_param(use_regex, False))
    include_exts = _clean_param(include_exts, None)
    exclude_exts = _clean_param(exclude_exts, None)
    min_size = _clean_param(min_size, None)
    max_size = _clean_param(max_size, None)
    date_filter = _clean_param(date_filter, None)

    fs = get_current_fs()

    async def event_generator():
        queue = asyncio.Queue(maxsize=100)
        loop = asyncio.get_running_loop()
        stop_event = threading.Event()
        done_sentinel = object()

        def worker():
            with fs_lock:
                try:
                    for event in fs.grep_content_stream(
                        query=q,
                        root_path=path,
                        recursive=recursive,
                        case_sensitive=case_sensitive,
                        whole_word=whole_word,
                        use_regex=use_regex,
                        include_exts=include_exts,
                        exclude_exts=exclude_exts,
                        min_size=min_size,
                        max_size=max_size,
                        date_filter=date_filter,
                        stop_event=stop_event
                    ):
                        if stop_event.is_set():
                            break
                        asyncio.run_coroutine_threadsafe(queue.put(event), loop).result()
                except Exception as e:
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "error": str(e)}), loop).result()
                finally:
                    asyncio.run_coroutine_threadsafe(queue.put(done_sentinel), loop).result()

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        try:
            while True:
                if await _is_client_disconnected(request):
                    stop_event.set()
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.25)
                    if item is done_sentinel:
                        break
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    if await _is_client_disconnected(request):
                        stop_event.set()
                        break
                    yield ": ping\n\n"
        finally:
            stop_event.set()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ==============================================================================
# Saved Searches Endpoints (Save search results inside the app)
# ==============================================================================

@app.get("/api/saved-searches")
def api_get_saved_searches():
    """Retrieve list of saved searches stored inside the app."""
    try:
        return saved_searches.list_saved_searches()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/saved-searches")
def api_create_saved_search(payload: Dict[str, Any]):
    """Save current search query and results inside the app."""
    try:
        query = str(payload.get("query", "")).strip()
        results = payload.get("results", [])
        mode = payload.get("mode", "filename")
        root_path = payload.get("root_path", "/")
        vol_name = payload.get("volume_name")
        vol_id = payload.get("volume_id")
        name = payload.get("name")
        filters = payload.get("filters", {})

        if not results:
            raise HTTPException(status_code=400, detail="Cannot save empty search results")

        entry = saved_searches.save_search(
            query=query,
            results=results,
            mode=mode,
            root_path=root_path,
            volume_name=vol_name,
            volume_id=vol_id,
            name=name,
            filters=filters
        )
        return {"status": "saved", "entry": entry}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/saved-searches/{search_id}")
def api_get_saved_search(search_id: str):
    """Get full results of a specific saved search."""
    item = saved_searches.get_saved_search(search_id)
    if not item:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return item


@app.delete("/api/saved-searches/{search_id}")
def api_delete_saved_search(search_id: str):
    """Delete a specific saved search."""
    deleted = saved_searches.delete_saved_search(search_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"status": "deleted", "id": search_id}


@app.delete("/api/saved-searches")
def api_clear_saved_searches():
    """Clear all saved searches in the app."""
    saved_searches.clear_saved_searches()
    return {"status": "cleared"}


# ==============================================================================
# Disk Index & Search Acceleration Endpoints
# ==============================================================================

@app.get("/api/index/status")
def api_index_status():
    """Get disk scan index status and storage statistics."""
    try:
        fs = get_current_fs()
        if not getattr(fs, "index", None):
            return {"indexed": False, "stats": None}
        return {"indexed": True, "stats": fs.index.get_stats()}
    except Exception as e:
        return {"indexed": False, "error": str(e)}


@app.get("/api/index/stream")
async def api_index_stream(
    request: Request,
    path: str = Query("/", description="Root path to index")
):
    """Stream full-disk indexing progress using Server-Sent Events (SSE)."""
    fs = get_current_fs()

    async def event_generator():
        queue = asyncio.Queue(maxsize=100)
        loop = asyncio.get_running_loop()
        stop_event = threading.Event()
        done_sentinel = object()

        def worker():
            with fs_lock:
                try:
                    for event in fs.index_disk_stream(root_path=path, stop_event=stop_event):
                        if stop_event.is_set():
                            break
                        asyncio.run_coroutine_threadsafe(queue.put(event), loop).result()
                except Exception as e:
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "error": str(e)}), loop).result()
                finally:
                    asyncio.run_coroutine_threadsafe(queue.put(done_sentinel), loop).result()

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        try:
            while True:
                if await request.is_disconnected():
                    stop_event.set()
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.25)
                    if item is done_sentinel:
                        break
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        stop_event.set()
                        break
                    yield ": ping\n\n"
        finally:
            stop_event.set()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/index/clear")
def api_index_clear():
    """Clear index cache for the active disk."""
    try:
        fs = get_current_fs()
        if getattr(fs, "index", None):
            fs.index.clear()
            return {"status": "cleared", "stats": fs.index.get_stats()}
        return {"status": "no_index"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/create-sample")
def api_create_sample():
    """Generate sample Linux SSD image."""
    try:
        target = os.path.abspath("sample_linux_disk.img")
        create_sample_disk(target)
        # Mount it
        global active_fs, active_device, active_offset
        if active_fs:
            try:
                active_fs.close()
            except Exception:
                pass
        active_fs = LinuxFileSystem(target, offset=0)
        active_device = target
        active_offset = 0
        return {
            "status": "created",
            "path": target,
            "info": active_fs.get_info()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/permissions")
def api_permissions():
    """Check process privileges and Full Disk Access status."""
    is_root = os.geteuid() == 0
    has_fda = False
    try:
        test_dir = os.path.expanduser("~/Library/Safari")
        if os.path.exists(test_dir):
            os.listdir(test_dir)
            has_fda = True
    except Exception:
        has_fda = False

    return {
        "is_root": is_root,
        "euid": os.geteuid(),
        "has_fda": has_fda,
        "mode": "Privileged (Hardware Access Active)" if is_root else "Standard Mode"
    }


@app.post("/api/open-fda")
def api_open_fda():
    """Open macOS System Settings directly to Full Disk Access."""
    try:
        subprocess.run(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"], check=False)
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/elevate")
def api_elevate(payload: Optional[Dict[str, Any]] = None):
    """Grant read permissions to raw disk block devices via macOS Touch ID / admin prompt."""
    if os.geteuid() == 0:
        return {"status": "already_privileged", "message": "Already running with administrator privileges."}

    device_path = (payload or {}).get("device_path", "")
    target_pattern = "/dev/disk* /dev/rdisk*"
    if device_path:
        import re
        dev_name = os.path.basename(device_path)
        m = re.match(r"^(r?disk\d+)", dev_name)
        if m:
            base_disk = m.group(1).lstrip("r")
            target_pattern = f"/dev/{base_disk}* /dev/r{base_disk}*"

    script = f'do shell script "chmod o+r {target_pattern}" with administrator privileges'
    try:
        proc = subprocess.run(
            ["/usr/bin/osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=60
        )
        if proc.returncode != 0:
            err = proc.stderr.strip() or "Authorization cancelled by user"
            raise HTTPException(status_code=403, detail=f"Authorization failed: {err}")
        return {
            "status": "elevated",
            "message": f"Read permissions granted for {target_pattern}"
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Authorization request timed out")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))



# Mount static directory
static_dir = get_resource_path("static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def index():
    """Serve main single-page application."""
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>LinuxDiskReader</h1><p>UI loading...</p>")


def main():
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"===========================================================")
    print(f"   Linux SSD / Hard Disk Reader for macOS")
    print(f"   Web Dashboard: http://{host}:{port}")
    print(f"===========================================================")
    uvicorn.run("server:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()

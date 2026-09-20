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
import urllib.parse
from typing import Optional, Dict, Any

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from disk_detector import list_disks, scan_partitions, get_volume_info
from reader import LinuxFileSystem, format_bytes
from sample_generator import create_sample_disk

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


@app.get("/api/search")
def api_search(q: str = Query(..., description="Search query"), path: str = Query("/", description="Root search path")):
    """Search files recursively."""
    try:
        fs = get_current_fs()
        results = fs.search(q, root_path=path)
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
    case_sensitive: bool = Query(False, description="Case-sensitive match")
):
    """Search inside text files for a query string (grep)."""
    try:
        fs = get_current_fs()
        results = fs.grep_content(
            query=q,
            root_path=path,
            recursive=recursive,
            case_sensitive=case_sensitive
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
def api_search_stream(
    q: str = Query(..., description="Search query"),
    path: str = Query("/", description="Root search path")
):
    """Stream filename search progress and matches using Server-Sent Events (SSE)."""
    fs = get_current_fs()

    def event_generator():
        try:
            for event in fs.search_stream(query=q, root_path=path):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

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
def api_grep_stream(
    q: str = Query(..., description="Search query string to find inside files"),
    path: str = Query("/", description="Root search path"),
    recursive: bool = Query(False, description="Recursive directory scan"),
    case_sensitive: bool = Query(False, description="Case-sensitive match")
):
    """Stream grep search progress, scanned files count, and matches as SSE."""
    fs = get_current_fs()

    def event_generator():
        try:
            for event in fs.grep_content_stream(
                query=q,
                root_path=path,
                recursive=recursive,
                case_sensitive=case_sensitive
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


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

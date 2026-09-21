"""
Saved searches manager for Linux SSD Reader.
Persists search queries and results inside the app (~/.linux_ssd_reader/saved_searches.json).
Allows users to save, review, re-run, export, and manage past search results across app sessions.
"""

import os
import json
import time
import uuid
import threading
from typing import List, Dict, Any, Optional

def get_data_dir() -> str:
    """Return persistent data directory with safe fallback."""
    custom = os.environ.get("LINUX_SSD_DATA_DIR")
    if custom:
        os.makedirs(custom, exist_ok=True)
        return custom
    home_dir = os.path.expanduser("~/.linux_ssd_reader")
    try:
        os.makedirs(home_dir, exist_ok=True)
        test_file = os.path.join(home_dir, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        return home_dir
    except Exception:
        fallback = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".app_data")
        os.makedirs(fallback, exist_ok=True)
        return fallback


DATA_DIR = get_data_dir()
SAVED_SEARCHES_FILE = os.path.join(DATA_DIR, "saved_searches.json")

os.makedirs(DATA_DIR, exist_ok=True)
_file_lock = threading.Lock()



def _read_all_raw() -> List[Dict[str, Any]]:
    """Read saved searches list from disk."""
    if not os.path.exists(SAVED_SEARCHES_FILE):
        return []
    try:
        with open(SAVED_SEARCHES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def _write_all_raw(searches: List[Dict[str, Any]]) -> bool:
    """Safely write saved searches list atomically to disk."""
    temp_path = f"{SAVED_SEARCHES_FILE}.tmp.{os.getpid()}_{int(time.time()*1000)}"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(searches, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, SAVED_SEARCHES_FILE)
        return True
    except Exception:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        return False


def list_saved_searches() -> List[Dict[str, Any]]:
    """
    List all saved searches ordered by timestamp descending.
    Returns summary metadata (omitting bulky full results for fast list rendering).
    """
    with _file_lock:
        items = _read_all_raw()
    
    summaries = []
    for item in items:
        results = item.get("results", [])
        summaries.append({
            "id": item.get("id"),
            "name": item.get("name") or f"Search: {item.get('query', 'results')}",
            "query": item.get("query", ""),
            "mode": item.get("mode", "filename"),
            "root_path": item.get("root_path", "/"),
            "volume_name": item.get("volume_name") or "Linux Ext4",
            "volume_id": item.get("volume_id") or "unknown",
            "timestamp": item.get("timestamp") or time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "matches_count": item.get("matches_count", len(results)),
            "filters": item.get("filters", {}),
            "sample_matches": [r.get("path") or r.get("name") for r in results[:3]]
        })
    
    # Sort latest first
    summaries.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
    return summaries


def get_saved_search(search_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full saved search data including results array by ID."""
    with _file_lock:
        items = _read_all_raw()
    for item in items:
        if item.get("id") == search_id:
            return item
    return None


def save_search(
    query: str,
    results: List[Dict[str, Any]],
    mode: str = "filename",
    root_path: str = "/",
    volume_name: Optional[str] = None,
    volume_id: Optional[str] = None,
    name: Optional[str] = None,
    filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Save new search results in the app store with filter configuration.
    """
    now_iso = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    new_id = f"search_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    custom_name = (name or "").strip() or f"Search: \"{query}\" in {root_path}"

    entry = {
        "id": new_id,
        "name": custom_name,
        "query": query,
        "mode": mode,
        "root_path": root_path,
        "volume_name": volume_name or "Linux Ext4",
        "volume_id": volume_id or "unknown",
        "timestamp": now_iso,
        "matches_count": len(results),
        "filters": filters or {},
        "results": results
    }

    with _file_lock:
        items = _read_all_raw()
        # Prepend to list
        items.insert(0, entry)
        # Cap at 100 saved searches to keep storage bounded
        if len(items) > 100:
            items = items[:100]
        _write_all_raw(items)

    return entry


def delete_saved_search(search_id: str) -> bool:
    """Delete a saved search by ID."""
    with _file_lock:
        items = _read_all_raw()
        initial_len = len(items)
        items = [item for item in items if item.get("id") != search_id]
        if len(items) != initial_len:
            _write_all_raw(items)
            return True
        return False


def clear_saved_searches() -> bool:
    """Delete all saved searches from the app."""
    with _file_lock:
        return _write_all_raw([])


def rename_saved_search(search_id: str, new_name: str) -> Optional[Dict[str, Any]]:
    """Rename a saved search title."""
    cleaned = new_name.strip()
    if not cleaned:
        return None
    with _file_lock:
        items = _read_all_raw()
        target = None
        for item in items:
            if item.get("id") == search_id:
                item["name"] = cleaned
                target = item
                break
        if target:
            _write_all_raw(items)
            return target
        return None

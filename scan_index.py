"""
High-performance, lightweight disk scan index and cache for Linux SSD Reader.
Uses compact SQLite databases with FTS5 Trigram indexing (~40-60 bytes per file).
Speeds up subsequent filename and content searches by 10x-100x across app runs with minimal storage.
"""

import os
import re
import time
import sqlite3
from typing import List, Dict, Any, Optional, Generator, Set, Union

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
INDEXES_DIR = os.path.join(DATA_DIR, "indexes")
os.makedirs(INDEXES_DIR, exist_ok=True)


# Common binary extensions to skip during content grep to save I/O
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svgz",
    ".mp3", ".mp4", ".mkv", ".avi", ".mov", ".wav", ".flac",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".zst", ".iso", ".dmg",
    ".pyc", ".pyo", ".pyd", ".class", ".o", ".a", ".so", ".dylib", ".dll", ".exe",
    ".bin", ".dat", ".db", ".sqlite", ".sqlite3", ".wasm"
}


def sanitize_id(identifier: str) -> str:
    """Sanitize volume UUID or device identifier into a safe filename."""
    clean = re.sub(r'[^a-zA-Z0-9_-]', '_', identifier)
    return clean[:60] or "default_volume"


def format_bytes(size: int) -> str:
    """Format bytes into human-readable string."""
    if size is None or size < 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024.0
    return f"{size:.1f} PB"


def normalize_exts(exts: Any) -> Set[str]:
    """Normalize comma/space-separated string or list of extensions to a lowercase set without leading dots."""
    if not exts:
        return set()
    if isinstance(exts, str):
        cleaned = exts.replace(";", ",").replace(" ", ",")
        return {t.strip().lower().lstrip(".") for t in cleaned.split(",") if t.strip()}
    if isinstance(exts, (list, set, tuple)):
        result = set()
        for e in exts:
            if isinstance(e, str):
                for part in e.replace(";", ",").replace(" ", ",").split(","):
                    p = part.strip().lower().lstrip(".")
                    if p:
                        result.add(p)
        return result
    return set()


def parse_date_filter_to_mtime(date_filter: Optional[str]) -> Optional[str]:
    """Convert relative date filter ('24h', '7d', '30d', '1y') or ISO prefix into UTC mtime cutoff."""
    if not date_filter or date_filter in ("any", "all", "none"):
        return None
    now = time.time()
    seconds_map = {
        "24h": 86400,
        "7d": 7 * 86400,
        "30d": 30 * 86400,
        "1y": 365 * 86400
    }
    if str(date_filter).lower() in seconds_map:
        cutoff = now - seconds_map[str(date_filter).lower()]
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(cutoff))
    # If already formatted like YYYY-MM-DD
    if len(str(date_filter)) >= 10:
        return str(date_filter)
    return None


def entry_matches_filters(
    name: str,
    path: str,
    item_type: str,
    size: int,
    mtime: Optional[str],
    include_exts: Optional[Set[str]] = None,
    exclude_exts: Optional[Set[str]] = None,
    type_filter: str = "all",
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    mtime_after: Optional[str] = None
) -> bool:
    """Evaluate whether an indexed or scanned entry satisfies all active search filter criteria."""
    # 1. Item Type filter
    if type_filter and type_filter != "all":
        if type_filter == "file" and item_type != "file":
            return False
        elif type_filter == "directory" and item_type != "directory":
            return False
        elif type_filter == "symlink" and item_type != "symlink":
            return False

    # 2. Exclude patterns / extensions
    if exclude_exts:
        _, ext = os.path.splitext(name.lower())
        ext_clean = ext.lstrip(".")
        if ext_clean in exclude_exts or name.lower() in exclude_exts:
            return False
        path_parts = [p.lower() for p in path.strip("/").split("/")]
        if any(part in exclude_exts for part in path_parts):
            return False

    # 3. Include extensions / patterns
    if include_exts:
        if item_type == "file":
            _, ext = os.path.splitext(name.lower())
            ext_clean = ext.lstrip(".")
            if ext_clean not in include_exts and name.lower() not in include_exts:
                return False
        elif item_type != "file" and type_filter == "all":
            # If user asks specifically for include extensions, only return matching files
            return False

    # 4. Size bounds
    if item_type == "file":
        if min_size is not None and size < min_size:
            return False
        if max_size is not None and size > max_size:
            return False

    # 5. Date modified cutoff
    if mtime_after and mtime:
        if mtime < mtime_after:
            return False

    return True


def query_matches_text(
    text: str,
    query: str,
    case_sensitive: bool = False,
    whole_word: bool = False,
    use_regex: bool = False,
    compiled_regex: Optional[Any] = None
) -> bool:
    """Test if text matches query using normal substring, whole-word, or regular expression matching."""
    if not query:
        return True
    if compiled_regex:
        return bool(compiled_regex.search(text))
    if use_regex:
        try:
            flags = 0 if case_sensitive else re.IGNORECASE
            return bool(re.search(query, text, flags))
        except Exception:
            return False
    if whole_word:
        flags = 0 if case_sensitive else re.IGNORECASE
        pattern = r'(?:\b|_|^)' + re.escape(query) + r'(?:\b|_|$)'
        return bool(re.search(pattern, text, flags))
    if case_sensitive:
        return query in text
    return query.lower() in text.lower()


class DiskScanIndex:
    """Lightweight persistent SQLite index for a specific disk volume."""

    def __init__(self, volume_id: str, last_write_time: Optional[str] = None, volume_name: Optional[str] = None):
        self.volume_id = volume_id or "unknown"
        self.last_write_time = str(last_write_time or "")
        self.volume_name = volume_name or "Linux Ext4"
        self.db_path = os.path.join(INDEXES_DIR, f"{sanitize_id(self.volume_id)}.sqlite")
        self._fts_available = True
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA page_size = 4096")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    rowid INTEGER PRIMARY KEY,
                    path TEXT UNIQUE,
                    parent_path TEXT,
                    name TEXT,
                    type TEXT,
                    size INTEGER,
                    mode TEXT,
                    uid INTEGER,
                    gid INTEGER,
                    inode INTEGER,
                    mtime TEXT,
                    target TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_parent ON files(parent_path)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_name ON files(name COLLATE NOCASE)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_type ON files(type)")

            # Setup FTS5 Trigram table for instant sub-millisecond substring searching
            try:
                conn.execute("""
                    CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                        name,
                        content='files',
                        content_rowid='rowid',
                        tokenize='trigram'
                    )
                """)
                # Trigger for inserts
                conn.execute("""
                    CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                        INSERT INTO files_fts(rowid, name) VALUES (new.rowid, new.name);
                    END;
                """)
                # Trigger for deletes
                conn.execute("""
                    CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                        INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.rowid, old.name);
                    END;
                """)
                # Trigger for updates
                conn.execute("""
                    CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                        INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.rowid, old.name);
                        INSERT INTO files_fts(rowid, name) VALUES (new.rowid, new.name);
                    END;
                """)
                self._fts_available = True
            except Exception:
                self._fts_available = False

            # Check if volume last_write_time changed since last index
            c = conn.cursor()
            c.execute("SELECT value FROM meta WHERE key = 'last_write_time'")
            row = c.fetchone()
            if row:
                cached_wtime = row[0]
                if self.last_write_time and cached_wtime and self.last_write_time != cached_wtime:
                    # Disk was modified externally; clear stale file entries
                    conn.execute("DELETE FROM files")
                    if self._fts_available:
                        try:
                            conn.execute("DELETE FROM files_fts")
                        except Exception:
                            pass
                    conn.execute("DELETE FROM meta")

            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_write_time', ?)", (self.last_write_time,))
            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('volume_name', ?)", (self.volume_name,))
            conn.commit()

    def save_entries(self, entries: List[Dict[str, Any]], parent_path: str):
        """Bulk upsert directory entries into SQLite index."""
        if not entries:
            return

        norm_parent = "/" + "/".join([p for p in parent_path.strip("/").split("/") if p]) if parent_path != "/" else "/"
        rows = []
        for e in entries:
            p = e.get("path")
            if not p:
                continue
            rows.append((
                p,
                norm_parent,
                e.get("name"),
                e.get("type", "file"),
                e.get("size", 0),
                e.get("mode", "-rw-r--r--"),
                e.get("uid", 0),
                e.get("gid", 0),
                e.get("inode", 0),
                e.get("mtime"),
                e.get("target")
            ))

        try:
            with self._get_connection() as conn:
                conn.executemany("""
                    INSERT OR REPLACE INTO files 
                    (path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, rows)
                conn.commit()
        except Exception:
            pass

    def save_entries_batch(self, entries: List[Dict[str, Any]]):
        """High-throughput batch upsert for crawler without recalculating parent paths."""
        if not entries:
            return
        rows = []
        for e in entries:
            p = e.get("path")
            if not p:
                continue
            parent = e.get("parent_path")
            if not parent:
                parent = os.path.dirname(p) or "/"
            rows.append((
                p,
                parent,
                e.get("name"),
                e.get("type", "file"),
                e.get("size", 0),
                e.get("mode", "-rw-r--r--"),
                e.get("uid", 0),
                e.get("gid", 0),
                e.get("inode", 0),
                e.get("mtime"),
                e.get("target")
            ))

        try:
            with self._get_connection() as conn:
                conn.executemany("""
                    INSERT OR REPLACE INTO files 
                    (path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, rows)
                conn.commit()
        except Exception:
            pass

    def mark_scan_complete(self, root_path: str = "/"):
        """Mark a subtree or entire disk as completely indexed."""
        try:
            with self._get_connection() as conn:
                now_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
                conn.execute(
                    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                    (f"scan_complete_{root_path}", str(time.time()))
                )
                conn.execute(
                    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                    (f"scan_time_{root_path}", now_str)
                )
                # Rebuild/verify FTS index completeness if needed
                if self._fts_available:
                    try:
                        conn.execute("INSERT OR IGNORE INTO files_fts(rowid, name) SELECT rowid, name FROM files")
                    except Exception:
                        pass
                conn.commit()
        except Exception:
            pass

    def is_scan_complete(self, root_path: str = "/") -> bool:
        """Check if root_path scan was completed."""
        try:
            with self._get_connection() as conn:
                c = conn.cursor()
                c.execute("SELECT value FROM meta WHERE key = ?", (f"scan_complete_{root_path}",))
                return c.fetchone() is not None
        except Exception:
            return False

    def count_files(self, root_path: str = "/") -> int:
        """Count indexed entries under root_path."""
        try:
            with self._get_connection() as conn:
                c = conn.cursor()
                if root_path == "/":
                    c.execute("SELECT COUNT(*) FROM files")
                else:
                    c.execute("SELECT COUNT(*) FROM files WHERE path = ? OR path LIKE ?", (root_path, f"{root_path.rstrip('/')}/%"))
                row = c.fetchone()
                return row[0] if row else 0
        except Exception:
            return 0

    def search_names(
        self,
        query: str,
        root_path: str = "/",
        max_results: int = 300,
        include_exts: Optional[Any] = None,
        exclude_exts: Optional[Any] = None,
        type_filter: str = "all",
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        mtime_after: Optional[str] = None,
        case_sensitive: bool = False,
        whole_word: bool = False,
        use_regex: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Search indexed filenames with advanced filters.
        Uses FTS5 trigram inverted index for sub-millisecond candidate lookup,
        followed by high-performance filter evaluation.
        """
        clean_q = query.strip() if query else ""
        inc_set = normalize_exts(include_exts)
        exc_set = normalize_exts(exclude_exts)

        if not clean_q and not inc_set and not exc_set and type_filter == "all" and min_size is None and max_size is None and not mtime_after:
            return []

        compiled_rgx = None
        if use_regex and clean_q:
            try:
                flags = 0 if case_sensitive else re.IGNORECASE
                compiled_rgx = re.compile(clean_q, flags)
            except Exception:
                compiled_rgx = None

        results = []

        try:
            with self._get_connection() as conn:
                c = conn.cursor()
                used_fts = False
                fetch_limit = min(5000, max(max_results * 8, 800))

                if self._fts_available and len(clean_q) >= 3 and not use_regex and not whole_word:
                    safe_match = clean_q.replace('"', '""')
                    try:
                        if root_path == "/":
                            c.execute("""
                                SELECT f.path, f.parent_path, f.name, f.type, f.size, f.mode, f.uid, f.gid, f.inode, f.mtime, f.target
                                FROM files f
                                JOIN files_fts ON f.rowid = files_fts.rowid
                                WHERE files_fts MATCH ?
                                LIMIT ?
                            """, (f'"{safe_match}"', fetch_limit))
                        else:
                            scope_pattern = f"{root_path.rstrip('/')}/%"
                            c.execute("""
                                SELECT f.path, f.parent_path, f.name, f.type, f.size, f.mode, f.uid, f.gid, f.inode, f.mtime, f.target
                                FROM files f
                                JOIN files_fts ON f.rowid = files_fts.rowid
                                WHERE files_fts MATCH ? AND (f.path = ? OR f.path LIKE ?)
                                LIMIT ?
                            """, (f'"{safe_match}"', root_path, scope_pattern, fetch_limit))
                        rows = c.fetchall()
                        used_fts = True
                    except Exception:
                        used_fts = False

                if not used_fts:
                    if clean_q and not use_regex:
                        pattern = f"%{clean_q}%"
                        if root_path == "/":
                            c.execute("""
                                SELECT path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target
                                FROM files
                                WHERE name LIKE ?
                                LIMIT ?
                            """, (pattern, fetch_limit))
                        else:
                            scope_pattern = f"{root_path.rstrip('/')}/%"
                            c.execute("""
                                SELECT path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target
                                FROM files
                                WHERE name LIKE ? AND (path = ? OR path LIKE ?)
                                LIMIT ?
                            """, (pattern, root_path, scope_pattern, fetch_limit))
                    else:
                        # Query might be empty if filtering by extension or type only
                        if root_path == "/":
                            c.execute("""
                                SELECT path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target
                                FROM files
                                LIMIT ?
                            """, (fetch_limit,))
                        else:
                            scope_pattern = f"{root_path.rstrip('/')}/%"
                            c.execute("""
                                SELECT path, parent_path, name, type, size, mode, uid, gid, inode, mtime, target
                                FROM files
                                WHERE path = ? OR path LIKE ?
                                LIMIT ?
                            """, (root_path, scope_pattern, fetch_limit))
                    rows = c.fetchall()

                for row in rows:
                    name = row["name"]
                    p = row["path"]
                    t = row["type"]
                    sz = row["size"] or 0
                    mt = row["mtime"]

                    if clean_q:
                        if not query_matches_text(
                            name, clean_q,
                            case_sensitive=case_sensitive,
                            whole_word=whole_word,
                            use_regex=use_regex,
                            compiled_regex=compiled_rgx
                        ):
                            continue

                    if not entry_matches_filters(
                        name=name,
                        path=p,
                        item_type=t,
                        size=sz,
                        mtime=mt,
                        include_exts=inc_set,
                        exclude_exts=exc_set,
                        type_filter=type_filter,
                        min_size=min_size,
                        max_size=max_size,
                        mtime_after=mtime_after
                    ):
                        continue

                    results.append({
                        "path": p,
                        "name": name,
                        "type": t,
                        "size": sz,
                        "size_human": format_bytes(sz) if t != "directory" else "-",
                        "mode": row["mode"],
                        "uid": row["uid"],
                        "gid": row["gid"],
                        "inode": row["inode"],
                        "mtime": mt,
                        "target": row["target"]
                    })
                    if len(results) >= max_results:
                        break

                return results
        except Exception:
            return []

    def get_candidate_grep_files(
        self,
        root_path: str = "/",
        max_size: int = 5 * 1024 * 1024,
        min_size: Optional[int] = None,
        include_exts: Optional[Any] = None,
        exclude_exts: Optional[Any] = None,
        mtime_after: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch candidate regular files for grep search, filtered by size, extensions, and cutoff date."""
        inc_set = normalize_exts(include_exts)
        exc_set = normalize_exts(exclude_exts)

        try:
            with self._get_connection() as conn:
                c = conn.cursor()
                params = [max_size]
                where_clauses = ["type = 'file'", "size <= ?"]

                if min_size is not None and min_size > 0:
                    where_clauses.append("size >= ?")
                    params.append(min_size)

                if mtime_after:
                    where_clauses.append("mtime >= ?")
                    params.append(mtime_after)

                if root_path != "/":
                    scope_pattern = f"{root_path.rstrip('/')}/%"
                    where_clauses.append("(path = ? OR path LIKE ?)")
                    params.extend([root_path, scope_pattern])

                query_sql = f"""
                    SELECT path, name, size, mode, uid, gid, inode, mtime
                    FROM files
                    WHERE {' AND '.join(where_clauses)}
                """
                c.execute(query_sql, params)

                files = []
                for row in c.fetchall():
                    name = row["name"]
                    p = row["path"]
                    _, ext = os.path.splitext(name.lower())
                    ext_clean = ext.lstrip(".")

                    if not inc_set and ext in BINARY_EXTENSIONS:
                        continue

                    if not entry_matches_filters(
                        name=name,
                        path=p,
                        item_type="file",
                        size=row["size"] or 0,
                        mtime=row["mtime"],
                        include_exts=inc_set,
                        exclude_exts=exc_set,
                        type_filter="file",
                        min_size=min_size,
                        max_size=max_size,
                        mtime_after=mtime_after
                    ):
                        continue

                    sz = row["size"] or 0
                    files.append({
                        "path": p,
                        "name": name,
                        "type": "file",
                        "size": sz,
                        "size_human": format_bytes(sz),
                        "mode": row["mode"],
                        "uid": row["uid"],
                        "gid": row["gid"],
                        "inode": row["inode"],
                        "mtime": row["mtime"]
                    })
                return files
        except Exception:
            return []

    def optimize(self):
        """Optimize SQLite database footprint and index structures."""
        try:
            with self._get_connection() as conn:
                conn.execute("PRAGMA optimize")
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        except Exception:
            pass

    def get_stats(self) -> Dict[str, Any]:
        """Return index statistics, last scan date, and compact disk size."""
        total_files = self.count_files("/")
        db_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
        is_complete = self.is_scan_complete("/")
        last_scan = None
        try:
            with self._get_connection() as conn:
                c = conn.cursor()
                c.execute("SELECT value FROM meta WHERE key = 'scan_time_/'")
                row = c.fetchone()
                if row:
                    last_scan = row[0]
        except Exception:
            pass

        return {
            "volume_id": self.volume_id,
            "volume_name": self.volume_name,
            "indexed_files": total_files,
            "size_bytes": db_size,
            "size_human": format_bytes(db_size),
            "is_complete": is_complete,
            "last_scan": last_scan,
            "db_path": self.db_path,
            "fts_enabled": self._fts_available
        }

    def clear(self):
        """Clear all indexed data for this volume."""
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            self._init_db()
        except Exception:
            pass

#!/usr/bin/env python3
"""
Command-line interface to inspect, browse, and extract files from Linux hard disks on macOS.
"""

import sys
import os
import argparse
from disk_detector import list_disks, scan_partitions
from reader import LinuxFileSystem, format_bytes


def cmd_disks(args):
    disks = list_disks()
    print(f"\nDiscovered {len(disks)} Disks / Storage Devices:")
    print("=" * 80)
    for d in disks:
        is_ext = "[EXT4 LINUX]" if d.get("is_ext4") else ""
        readable = "Accessible" if d.get("is_readable") else "Restricted (Run with sudo)"
        print(f"Device: {d['identifier']:<15} Type: {d['type']:<10} Size: {format_bytes(d['size']):<10} {readable} {is_ext}")
        print(f"  Path: {d['device_path']}")
        partitions = d.get("partitions", [])
        if partitions:
            for p in partitions:
                p_ext = "[EXT4]" if p.get("is_ext4") else ""
                p_name = p.get("name", "Partition")
                p_off = p.get("offset", 0)
                p_size = format_bytes(p.get("size", 0)) if p.get("size") else ""
                print(f"    * {p_name:<30} Offset: {p_off:<12} {p_size:<10} {p_ext}")
        print("-" * 80)


def cmd_info(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        info = fs.get_info()
        print("\nLinux Filesystem Information:")
        print("=" * 50)
        print(f"Volume Label:       {info.get('volume_name')}")
        print(f"Filesystem UUID:    {info.get('uuid')}")
        print(f"Block Size:         {info.get('block_size')} bytes")
        print(f"Total Capacity:     {info.get('total_human')} ({info.get('total_bytes', 0):,} bytes)")
        print(f"Used Space:         {info.get('used_human')} ({info.get('percent_used', 0)}%)")
        print(f"Free Space:         {info.get('free_human')}")
        print(f"Inodes Total/Free:  {info.get('total_inodes', 0):,} / {info.get('free_inodes', 0):,}")
        print(f"Filesystem State:   {info.get('filesystem_state')}")
        print(f"Last Mount Time:    {info.get('last_mount_time') or 'N/A'}")
        print("=" * 50)


def cmd_ls(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        entries = fs.listdir(args.path)
        print(f"\nDirectory listing for '{args.path}': ({len(entries)} items)")
        print("=" * 80)
        print(f"{'Permissions':<12} {'Owner':<12} {'Size':>10}  {'Modified':<20} {'Name'}")
        print("-" * 80)
        for e in entries:
            owner = f"{e['uid']}:{e['gid']}"
            name = e['name'] + ("/" if e['type'] == 'directory' else "")
            if e.get("target"):
                name += f" -> {e['target']}"
            mtime = e['mtime'] or ""
            print(f"{e['mode']:<12} {owner:<12} {e['size_human']:>10}  {mtime:<20} {name}")
        print("=" * 80)


def cmd_cat(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        data = fs.read_file(args.path)
        try:
            sys.stdout.write(data.decode("utf-8"))
        except UnicodeDecodeError:
            sys.stdout.buffer.write(data)


def cmd_extract(args):
    os.makedirs(args.dest, exist_ok=True)
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        def extract_item(source_path, target_folder):
            try:
                entries = fs.listdir(source_path)
                # It's a directory
                dir_name = os.path.basename(source_path.rstrip("/")) or "root"
                dest_dir = os.path.join(target_folder, dir_name)
                os.makedirs(dest_dir, exist_ok=True)
                for e in entries:
                    if e["type"] == "directory":
                        extract_item(e["path"], dest_dir)
                    elif e["type"] == "file":
                        out_path = os.path.join(dest_dir, e["name"])
                        print(f"Extracting: {e['path']} -> {out_path}")
                        content = fs.read_file(e["path"])
                        with open(out_path, "wb") as f_out:
                            f_out.write(content)
            except NotADirectoryError:
                # It's a single file
                file_name = os.path.basename(source_path)
                out_path = os.path.join(target_folder, file_name)
                print(f"Extracting file: {source_path} -> {out_path}")
                content = fs.read_file(source_path)
                with open(out_path, "wb") as f_out:
                    f_out.write(content)

        extract_item(args.source, args.dest)
        print(f"\nExtraction complete to: {args.dest}")


def cmd_search(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        results = fs.search(
            args.query,
            root_path=args.path,
            include_exts=args.include_exts,
            exclude_exts=args.exclude_exts,
            type_filter=args.type_filter,
            min_size=args.min_size,
            max_size=args.max_size,
            date_filter=args.date_filter,
            case_sensitive=args.case_sensitive
        )
        print(f"\nSearch results for '{args.query}' in '{args.path}': ({len(results)} matches)")
        print("=" * 80)
        lines = []
        for r in results:
            line = f"{r['mode']:<12} {r['size_human']:>10}  {r.get('mtime', ''):<20} {r['path']}"
            print(line)
            lines.append(line)
        print("=" * 80)
        if args.save:
            with open(args.save, "w", encoding="utf-8") as f:
                f.write(f"Search Query : {args.query}\n")
                f.write(f"Search Scope : {args.path}\n")
                f.write(f"Total Matches: {len(results)}\n\n")
                f.write("\n".join(lines) + "\n")
            print(f"Results saved as text to: {args.save}")


def cmd_grep(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        results = fs.grep_content(
            args.query,
            root_path=args.path,
            recursive=args.recursive,
            case_sensitive=args.case_sensitive,
            include_exts=args.include_exts,
            exclude_exts=args.exclude_exts,
            min_size=args.min_size,
            max_size=args.max_size,
            date_filter=args.date_filter
        )
        total_occurrences = sum(len(r.get("matches", [])) for r in results)
        print(f"\nGrep results for '{args.query}' in '{args.path}': ({len(results)} files, {total_occurrences} occurrences)")
        print("=" * 80)
        out_lines = []
        for r in results:
            header = f"\nFile: {r['path']} ({len(r['matches'])} matches, {r['size_human']})"
            print(header)
            out_lines.append(header)
            for m in r["matches"]:
                m_str = f"  Line {m['line']}: {m['snippet']}"
                print(m_str)
                out_lines.append(m_str)
        print("=" * 80)
        if args.save:
            with open(args.save, "w", encoding="utf-8") as f:
                f.write(f"Grep Query   : {args.query}\n")
                f.write(f"Search Scope : {args.path}\n")
                f.write(f"Matches      : {len(results)} files with {total_occurrences} occurrences\n\n")
                f.write("\n".join(out_lines) + "\n")
            print(f"Results saved as text to: {args.save}")


def cmd_index(args):
    with LinuxFileSystem(args.device, offset=args.offset) as fs:
        print(f"\nIndexing disk '{args.device}' for high-speed searches...")
        for ev in fs.index_disk_stream(root_path=args.path):
            if ev.get("type") == "progress":
                print(f"\r  Scanned: {ev['scanned']:,} files | Speed: {ev['speed']:.0f} files/s | Size: {ev['db_size']} | {ev.get('current_file', '')[:30]}", end="", flush=True)
            elif ev.get("type") == "done":
                print(f"\n✓ Index complete: {ev['scanned']:,} files indexed in {ev['elapsed']:.2f}s ({ev['speed']:.0f} files/s)")
                stats = ev.get("stats", {})
                print(f"  Index database: {stats.get('db_path')} ({stats.get('size_human', '')})")
                print("  Subsequent filename and grep searches will now execute in <5ms without re-scanning disk.")
            elif ev.get("type") == "error":
                print(f"\nError indexing disk: {ev.get('error')}")


def main():
    parser = argparse.ArgumentParser(description="Linux SSD / Hard Disk Reader for macOS")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # disks
    p_disks = subparsers.add_parser("disks", help="Scan and list all detected storage devices and partitions")
    p_disks.set_defaults(func=cmd_disks)


    # info
    p_info = subparsers.add_parser("info", help="Show filesystem superblock details")
    p_info.add_argument("device", help="Path to disk device (/dev/rdiskX) or image file")
    p_info.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_info.set_defaults(func=cmd_info)

    # ls
    p_ls = subparsers.add_parser("ls", help="List directory contents")
    p_ls.add_argument("device", help="Path to disk device or image file")
    p_ls.add_argument("path", nargs="?", default="/", help="Filesystem directory path (default /)")
    p_ls.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_ls.set_defaults(func=cmd_ls)

    # cat
    p_cat = subparsers.add_parser("cat", help="Print file content to stdout")
    p_cat.add_argument("device", help="Path to disk device or image file")
    p_cat.add_argument("path", help="Path of the file to print")
    p_cat.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_cat.set_defaults(func=cmd_cat)

    # extract
    p_extract = subparsers.add_parser("extract", help="Extract file or directory to local Mac filesystem")
    p_extract.add_argument("device", help="Path to disk device or image file")
    p_extract.add_argument("source", help="Source path on the Linux filesystem")
    p_extract.add_argument("dest", help="Destination folder on macOS")
    p_extract.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_extract.set_defaults(func=cmd_extract)

    # search
    p_search = subparsers.add_parser("search", help="Search files by name")
    p_search.add_argument("device", help="Path to disk device or image file")
    p_search.add_argument("query", help="Search query string")
    p_search.add_argument("--path", default="/", help="Root path to search from (default /)")
    p_search.add_argument("--include-ext", dest="include_exts", help="Comma-separated extensions to include (e.g. 'txt,py,conf')")
    p_search.add_argument("--exclude-ext", dest="exclude_exts", help="Comma-separated extensions or folder names to exclude (e.g. 'iso,bin,node_modules')")
    p_search.add_argument("--type", dest="type_filter", default="all", choices=["all", "file", "directory", "symlink"], help="Filter by item type")
    p_search.add_argument("--min-size", type=int, help="Minimum file size in bytes")
    p_search.add_argument("--max-size", type=int, help="Maximum file size in bytes")
    p_search.add_argument("--date", dest="date_filter", help="Date cutoff: '24h', '7d', '30d', '1y' or ISO date")
    p_search.add_argument("-s", "--case-sensitive", action="store_true", default=False, help="Case-sensitive name match")
    p_search.add_argument("--save", help="Save search results to text file path")
    p_search.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_search.set_defaults(func=cmd_search)

    # grep
    p_grep = subparsers.add_parser("grep", help="Search inside text files (grep)")
    p_grep.add_argument("device", help="Path to disk device or image file")
    p_grep.add_argument("query", help="Text to search inside files")
    p_grep.add_argument("--path", default="/", help="Root path to search from (default /)")
    p_grep.add_argument("-r", "--recursive", action="store_true", help="Recursive search across all subdirectories")
    p_grep.add_argument("-i", "--ignore-case", dest="case_sensitive", action="store_false", default=True, help="Case-insensitive search")
    p_grep.add_argument("--include-ext", dest="include_exts", help="Comma-separated extensions to include (e.g. 'txt,py,conf')")
    p_grep.add_argument("--exclude-ext", dest="exclude_exts", help="Comma-separated extensions or folder names to exclude (e.g. 'iso,bin,node_modules')")
    p_grep.add_argument("--min-size", type=int, help="Minimum file size in bytes")
    p_grep.add_argument("--max-size", type=int, help="Maximum file size in bytes")
    p_grep.add_argument("--date", dest="date_filter", help="Date cutoff: '24h', '7d', '30d', '1y' or ISO date")
    p_grep.add_argument("--save", help="Save search results to text file path")
    p_grep.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_grep.set_defaults(func=cmd_grep)

    # index
    p_index = subparsers.add_parser("index", help="Index disk metadata to speed up subsequent searches")
    p_index.add_argument("device", help="Path to disk device or image file")
    p_index.add_argument("--path", default="/", help="Root path to index (default /)")
    p_index.add_argument("--offset", type=int, default=0, help="Partition byte offset (default 0)")
    p_index.set_defaults(func=cmd_index)

    # create-demo
    def cmd_create_demo(args):
        from sample_generator import create_sample_disk
        p = create_sample_disk()
        print(f"Created sample disk image: {p}")
    p_demo = subparsers.add_parser("create-demo", help="Create a sample ext4 disk image for testing")
    p_demo.set_defaults(func=cmd_create_demo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

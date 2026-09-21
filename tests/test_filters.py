import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server

async def run_async_tests():
    sample_img = os.path.abspath("sample_linux_disk.img")
    assert os.path.exists(sample_img), f"Sample image not found: {sample_img}"

    # 1. Mount disk
    print("[1] Mounting disk...")
    mount_resp = server.api_mount({"device_path": sample_img, "offset": 0})
    assert mount_resp.get("status") == "success"
    print("    Mounted successfully:", mount_resp.get("info", {}).get("volume_name", "Ext4"))

    # 2. Test search with include_exts='py'
    print("[2] Testing search with include_exts='py'...")
    search_resp = server.api_search(q="", path="/", include_exts="py")
    results = search_resp.get("results", [])
    paths = [r["path"] for r in results]
    print(f"    Matched paths: {paths}")
    assert any("app.py" in p for p in paths), "app.py should be matched"
    assert not any("README.md" in p for p in paths), "README.md should not be matched"

    # 3. Test search with exclude_exts='md'
    print("[3] Testing search with exclude_exts='md'...")
    search_resp = server.api_search(q="read", path="/", exclude_exts="md")
    results = search_resp.get("results", [])
    paths = [r["path"] for r in results]
    print(f"    Matched paths (excluding md): {paths}")
    assert not any("README.md" in p for p in paths), "README.md should be excluded"

    # 4. Test search with type_filter='directory'
    print("[4] Testing search with type_filter='directory'...")
    search_resp = server.api_search(q="", path="/", type_filter="directory")
    results = search_resp.get("results", [])
    assert len(results) > 0, "Should have directories"
    assert all(r.get("type") == "directory" for r in results), "All results must be directories"
    print(f"    Found {len(results)} directories")

    # 5. Test search with size bounds
    print("[5] Testing search with min_size=180 and max_size=250...")
    search_resp = server.api_search(q="", path="/", min_size=180, max_size=250)
    results = search_resp.get("results", [])
    paths = [r["path"] for r in results]
    print(f"    Files between 180B and 250B: {paths}")
    assert any("app.py" in p for p in paths), "app.py (199B) should be in range"
    assert not any("README.md" in p for p in paths), "README.md (170B) should not be in range"

    # 6. Test grep with include_exts='md'
    print("[6] Testing grep with include_exts='md'...")
    grep_resp = server.api_grep(q="Linux", path="/", recursive=True, include_exts="md")
    results = grep_resp.get("results", [])
    paths = [r["path"] for r in results]
    print(f"    Grep matches in md: {paths}")
    assert any("README.md" in p for p in paths), "README.md should match"
    assert not any("app.py" in p for p in paths), "app.py should not match when include_exts=md"

    # 7. Test grep with exclude_exts='md'
    print("[7] Testing grep with exclude_exts='md'...")
    grep_resp = server.api_grep(q="Linux", path="/", recursive=True, exclude_exts="md")
    results = grep_resp.get("results", [])
    paths = [r["path"] for r in results]
    print(f"    Grep matches excluding md: {paths}")
    assert not any("README.md" in p for p in paths), "README.md should be excluded"
    assert any("app.py" in p for p in paths), "app.py should match"

    # 8. Test export report endpoint with filters
    print("[8] Testing api_search_export with include_exts='py'...")
    export_resp = server.api_search_export(q="app", path="/", include_exts="py")
    body_text = export_resp.body.decode("utf-8")
    assert "app.py" in body_text
    print("    Export report generated successfully with filter output")

    # 9. Test saved searches with filter persistence
    print("[9] Testing saved search with filter persistence...")
    save_payload = {
        "query": "test_filter_save",
        "results": [{"name": "app.py", "path": "/home/developer/scripts/app.py", "size": 199, "type": "file"}],
        "mode": "filename",
        "root_path": "/",
        "volume_name": "Sample Disk",
        "volume_id": "test_disk",
        "filters": {
            "preset": "code",
            "includeExts": "py, js",
            "excludeExts": "bin, iso",
            "itemType": "file",
            "sizePreset": "small",
            "dateModified": "7d",
            "caseSensitive": True,
            "wholeWord": False,
            "regex": False
        }
    }
    save_resp = server.api_create_saved_search(save_payload)
    assert save_resp.get("status") == "saved"
    saved_item = save_resp.get("entry", {})
    saved_id = saved_item.get("id")
    assert saved_id, "Saved search ID should be returned"
    print(f"    Saved search created: {saved_id}")

    # Fetch detail
    detail = server.api_get_saved_search(saved_id)
    assert detail.get("filters", {}).get("preset") == "code"
    assert detail.get("filters", {}).get("includeExts") == "py, js"
    assert detail.get("filters", {}).get("caseSensitive") is True
    print("    Filter persistence verified in detail API")

    # Clean up test search
    server.api_delete_saved_search(saved_id)

    # 10. Test streaming search generator with filters
    print("[10] Testing streaming search generator with filters...")
    from starlette.requests import Request
    dummy_req = Request({"type": "http", "method": "GET", "path": "/api/search/stream"})
    stream_resp = await server.api_search_stream(request=dummy_req, q="", path="/", include_exts="py")
    events = []
    async for chunk in stream_resp.body_iterator:
        events.append(chunk)
    stream_content = "".join(events)
    assert "app.py" in stream_content
    print("    Streaming search with filters verified")

    print("\n✓ ALL 10 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_async_tests())

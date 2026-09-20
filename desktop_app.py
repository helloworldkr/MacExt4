"""
Linux SSD Reader - Native macOS Desktop Application Launcher.
Spawns background FastAPI server and opens a native WebKit window.
"""

import os
import sys
import time
import socket
import threading
import urllib.request
import uvicorn
import webview

from server import app


def find_free_port(start_port: int = 8080) -> int:
    for p in range(start_port, start_port + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return start_port


def run_server(port: int, server_holder: dict):
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server_holder["server"] = server
    server.run()


def main():
    port = find_free_port(8080)
    server_holder = {}

    # Start background FastAPI server thread
    server_thread = threading.Thread(target=run_server, args=(port, server_holder), daemon=True)
    server_thread.start()

    # Wait for server to become responsive
    url = f"http://127.0.0.1:{port}"
    for _ in range(60):
        try:
            req = urllib.request.Request(f"{url}/api/status")
            with urllib.request.urlopen(req, timeout=0.5) as res:
                if res.status == 200:
                    break
        except Exception:
            time.sleep(0.1)

    # Open native macOS Cocoa WebKit window
    window = webview.create_window(
        title="Linux SSD Explorer",
        url=url,
        width=1320,
        height=880,
        min_size=(1000, 680),
        text_select=True
    )

    # Start macOS GUI event loop
    webview.start(debug=False)

    # Clean shutdown on window close
    if "server" in server_holder:
        server_holder["server"].should_exit = True


if __name__ == "__main__":
    main()

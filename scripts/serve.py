#!/usr/bin/env python3
"""Development server for site/: no caching, and pages reload when a file changes.

    python3 scripts/serve.py [port]      # default 8000, on 127.0.0.1

The reload hook is added to each page as it is served; nothing in site/ changes. An address
with no file gets 404.html, as on Vercel, and Vercel's analytics scripts (_vercel/) are empty.
"""

import sys
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
RELOAD_PATH = "/__reload"
HOOK = b'<script>window.devServer = true; new EventSource("__reload").onmessage = () => location.reload();</script>'


def snapshot():
    return {p: p.stat().st_mtime_ns for p in SITE.rglob("*") if p.is_file()}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == RELOAD_PATH:
            return self.stream_changes()
        if path.startswith("/_vercel/"):
            return self.send_empty_script()
        file = Path(self.translate_path(path))
        if file.is_dir() and path.endswith("/"):
            file = file / "index.html"
        if file.suffix == ".html" and file.is_file():
            return self.send_page(file, 200)
        if not file.exists():
            return self.send_page(SITE / "404.html", 404)
        return super().do_GET()

    def send_page(self, file, status):
        body = file.read_bytes().replace(b"</body>", HOOK + b"\n</body>", 1)
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_empty_script(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def stream_changes(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        seen, idle = snapshot(), 0.0
        try:
            while True:
                time.sleep(0.3)
                idle += 0.3
                now = snapshot()
                if now != seen:
                    seen = now
                    self.wfile.write(b"data: reload\n\n")
                    self.wfile.flush()
                elif idle >= 15:
                    idle = 0.0
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, fmt, *args):
        if not self.path.startswith(RELOAD_PATH):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(SITE)))
    server.daemon_threads = True
    print(f"Serving {SITE} on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()

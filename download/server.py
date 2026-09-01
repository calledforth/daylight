#!/usr/bin/env python3
"""Serve the Daylight sideload pack so Preview can download the .xpi."""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 48765


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[%s] " % self.log_date_time_string() + (fmt % args), flush=True)

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path.endswith(".xpi"):
            self.send_header("Content-Type", "application/x-xpinstall")
            self.send_header("Content-Disposition", 'attachment; filename="daylight.xpi"')
        elif path.endswith(".zip"):
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", 'attachment; filename="daylight.zip"')
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    xpi = ROOT / "daylight.xpi"
    if not xpi.exists():
        raise SystemExit(f"missing {xpi}")
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Daylight download server on http://127.0.0.1:{PORT}/", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()

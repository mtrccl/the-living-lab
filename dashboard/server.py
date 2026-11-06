#!/usr/bin/env python3
"""Read-only localhost viewer for the isolated Genesis runner.

The VM API stays bound to 127.0.0.1:8095 inside the guest. On the host,
genesis-link.service forwards it to 127.0.0.1:18095 over SSH.
This viewer exposes only the static dashboard and the two GET endpoints,
and binds to localhost (access via an explicit SSH tunnel).
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

DASHBOARD = Path(__file__).with_name("index.html")
UPSTREAM = "http://127.0.0.1:18095"
MAX_RESPONSE = 16 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            try:
                payload = DASHBOARD.read_bytes()
            except OSError:
                self.respond(503, b"Dashboard file missing", "text/plain; charset=utf-8")
                return
            self.respond(200, payload, "text/html; charset=utf-8")
            return
        if self.path in ("/api/state", "/api/health"):
            endpoint = "/state" if self.path == "/api/state" else "/health"
            try:
                with urlopen(UPSTREAM + endpoint, timeout=4) as response:
                    payload = response.read(MAX_RESPONSE + 1)
                if len(payload) > MAX_RESPONSE:
                    raise ValueError("Upstream response exceeds limit")
            except (OSError, URLError, ValueError):
                self.respond(503, b'{"error":"unavailable"}', "application/json")
                return
            self.respond(200, payload, "application/json")
            return
        self.respond(404, b"Not found", "text/plain; charset=utf-8")

    def respond(self, status, payload, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 3000), Handler).serve_forever()

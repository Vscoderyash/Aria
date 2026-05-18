#!/usr/bin/env python3
"""
ARIA local runner.

This serves index.html only. The AI logic now runs in the browser through the
local ARIA brain, so no OpenAI, Anthropic, OpenRouter, Pollinations, or other
chat API is required.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 5000


class AriaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  ARIA Local")
    print("  Mode : Offline local brain, no API")
    print(f"  Open : http://{HOST}:{PORT}")
    print("=" * 50 + "\n")
    ThreadingHTTPServer((HOST, PORT), AriaHandler).serve_forever()

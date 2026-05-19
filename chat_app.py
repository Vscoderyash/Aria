#!/usr/bin/env python3
"""
ARIA local runner.

Serves index.html with the headers required for SharedArrayBuffer (needed by
WebLLM so the AI model can run in a background thread inside the browser).
No OpenAI, Anthropic, OpenRouter, Pollinations, or other cloud API is used.
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
        # Required for SharedArrayBuffer (WebLLM multi-thread inference)
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # suppress request noise


if __name__ == "__main__":
    print("\n" + "=" * 54)
    print("  ARIA  —  Local AI (no API, no cloud)")
    print(f"  Open : http://{HOST}:{PORT}")
    print("  Model runs fully inside your browser via WebLLM.")
    print("  First load downloads the model (~1–2.5 GB).")
    print("=" * 54 + "\n")
    ThreadingHTTPServer((HOST, PORT), AriaHandler).serve_forever()

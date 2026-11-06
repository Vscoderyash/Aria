"""Local link between this app and the JARVIS browser extension (127.0.0.1 only, extension-origin only)."""
import asyncio, json, threading


class Bridge:
    def __init__(self, port, on_say, log=print):
        self.port, self.on_say, self.log = port, on_say, log
        self.clients, self.loop = set(), None

    @property
    def connected(self):
        return bool(self.clients)

    def start(self):
        threading.Thread(target=lambda: asyncio.run(self._main()), daemon=True).start()

    async def _main(self):
        import websockets
        self.loop = asyncio.get_running_loop()
        try:
            async with websockets.serve(self._handler, "127.0.0.1", self.port):
                self.log(f"Browser bridge listening on ws://127.0.0.1:{self.port}")
                await asyncio.Future()
        except OSError as e:
            self.log(f"Browser bridge could not start (port {self.port} busy?): {e}")

    async def _handler(self, ws):
        try: origin = ws.request.headers.get("Origin", "")
        except AttributeError: origin = getattr(ws, "request_headers", {}).get("Origin", "")
        if not origin.startswith("chrome-extension://") and not origin.startswith("moz-extension://"):
            await ws.close(1008, "extensions only"); return
        self.clients.add(ws); self.log("Browser extension connected.")
        try:
            async for raw in ws:
                try: m = json.loads(raw)
                except ValueError: continue
                if m.get("type") == "say" and m.get("text"): self.on_say(str(m["text"])[:400])
        finally:
            self.clients.discard(ws); self.log("Browser extension disconnected.")

    def send_command(self, text):
        if not self.connected or not self.loop: return None
        async def go():
            for c in list(self.clients): await c.send(json.dumps({"type": "command", "text": text}))
        asyncio.run_coroutine_threadsafe(go(), self.loop)
        return "sent to the browser"

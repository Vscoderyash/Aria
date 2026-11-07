"""Speaking: a natural male neural voice (Microsoft Edge TTS), with an offline fallback."""
import asyncio, os, re, sys, tempfile, threading, queue, time


class Mouth:
    def __init__(self, cfg, log=print):
        self.cfg, self.log = cfg, log
        self.enabled = cfg.get("speak", True)
        self.q = queue.Queue()
        self.speaking = threading.Event()
        self._stop = threading.Event()
        self._mixer = None
        self._fallback = None
        self._no_edge = False
        threading.Thread(target=self._worker, daemon=True).start()

    def say(self, text):
        if self.enabled and text: self.q.put(str(text))

    def stop(self):
        while not self.q.empty():
            try: self.q.get_nowait()
            except queue.Empty: break
        self._stop.set()

    def busy(self):
        return self.speaking.is_set() or not self.q.empty()

    def _worker(self):
        while True:
            text = self.q.get()
            self.speaking.set(); self._stop.clear()
            try:
                for chunk in [c for c in re.split(r"(?<=[.!?])\s+", text) if c.strip()]:
                    if self._stop.is_set(): break
                    self._speak(chunk)
            except Exception as e:
                self.log(f"[voice] {e}")
            finally:
                if self.q.empty():
                    time.sleep(0.35)          # let the room echo die before the microphone listens again
                    self.speaking.clear()

    def _speak(self, text):
        if self._no_edge: return self._system_voice(text)
        try:
            import edge_tts
            path = os.path.join(tempfile.gettempdir(), f"jarvis_{os.getpid()}.mp3")
            asyncio.run(edge_tts.Communicate(text, self.cfg.get("voice", "en-GB-RyanNeural"), rate=self.cfg.get("speech_rate", "+0%")).save(path))
            self._play(path)
        except ImportError:
            self._no_edge = True; self.log("[voice] natural voice package not installed; using the Windows voice")
            self._system_voice(text)
        except Exception as e:                # offline or service unreachable: use the system voice
            self.log(f"[voice] neural voice unavailable ({e}); using system voice")
            self._system_voice(text)

    def _play(self, path):
        if sys.platform.startswith("win"):    # Windows plays mp3 natively: no extra package needed
            import ctypes
            mci = ctypes.windll.winmm.mciSendStringW
            mci("close jarvisvoice", None, 0, None)
            if mci(f'open "{path}" type mpegvideo alias jarvisvoice', None, 0, None): raise RuntimeError("cannot open audio")
            mci("play jarvisvoice", None, 0, None)
            buf, t0 = ctypes.create_unicode_buffer(64), time.time()
            while not self._stop.is_set():
                mci("status jarvisvoice mode", buf, 63, None)
                if buf.value not in ("playing", "") and time.time() - t0 > 0.3: break
                time.sleep(0.04)
            mci("stop jarvisvoice", None, 0, None); mci("close jarvisvoice", None, 0, None)
            return
        import pygame
        if self._mixer is None:
            pygame.mixer.init(); self._mixer = pygame.mixer
        self._mixer.music.load(path); self._mixer.music.play()
        while self._mixer.music.get_busy() and not self._stop.is_set(): time.sleep(0.04)
        self._mixer.music.stop(); self._mixer.music.unload()

    def _system_voice(self, text):
        import pyttsx3
        if self._fallback is None:
            self._fallback = pyttsx3.init()
            for v in self._fallback.getProperty("voices"):
                if re.search(r"david|mark|male|daniel|george", v.name, re.I): self._fallback.setProperty("voice", v.id); break
            self._fallback.setProperty("rate", int(self.cfg.get("system_speech_rate", 165)))
        self._fallback.say(text); self._fallback.runAndWait()

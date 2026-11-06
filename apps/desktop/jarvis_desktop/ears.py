"""Listening: always-on microphone, noise-adaptive voice detection, then Whisper (runs locally) for accurate speech-to-text."""
import json, time, queue, collections
import numpy as np

SR, FRAME = 16000, 480            # 16 kHz, 30 ms frames
JUNK = {"", ".", "the", "a", "huh", "you", "thank you", "thanks", "thanks for watching", "bye", "the end", "okay", "uh", "um", "hmm"}
PROMPT = "Jarvis. Open Chrome, open Notepad, click, scroll down, type, volume up, next tab, YouTube, Spotify, screenshot, remind me, set a timer."


class Ears:
    def __init__(self, cfg, is_speaking, log=print):
        self.cfg, self.is_speaking, self.log = cfg, is_speaking, log
        self.q = queue.Queue(maxsize=400)
        self.model = None
        self.threshold = 400.0
        self.stream = None
        self.engine = None
        self.vosk_model = None
        self.vocab = []                       # your own words (from what you taught JARVIS)

    def start(self):
        import sounddevice as sd
        self._load_engine()
        self.stream = sd.InputStream(samplerate=SR, channels=1, dtype="int16", blocksize=FRAME, device=self.cfg.get("mic_device"),
                                     callback=lambda d, f, t, s: self.q.put_nowait(d[:, 0].copy()) if not self.q.full() else None)
        self.stream.start()
        self.calibrate()

    def _load_engine(self):
        want = self.cfg.get("stt", "auto")
        if want in ("auto", "whisper"):
            try:
                from faster_whisper import WhisperModel
                self.log(f"Loading Whisper speech model '{self.cfg['whisper_model']}' (first run downloads it)...")
                self.model = WhisperModel(self.cfg["whisper_model"], device="cpu", compute_type="int8")
                self.engine = "whisper"; return
            except Exception as e:
                if want == "whisper": raise
                self.log(f"Whisper is not available on this Python ({type(e).__name__}); using the Vosk speech engine instead.")
        from vosk import Model, SetLogLevel
        SetLogLevel(-1)
        name = self.cfg.get("vosk_model", "vosk-model-en-us-0.22-lgraph")
        self.log(f"Loading Vosk speech model '{name}' (first run downloads it, about 130 MB)...")
        self.vosk_model = Model(model_name=name)
        self.engine = "vosk"

    def calibrate(self, seconds=1.5):
        self.log("Calibrating to room noise, stay quiet for a moment...")
        vals, end = [], time.time() + seconds
        while time.time() < end:
            try: vals.append(self._rms(self.q.get(timeout=0.5)))
            except queue.Empty: pass
        ambient = float(np.median(vals)) if vals else 100.0
        self.threshold = max(350.0, ambient * 3.2)
        self.log(f"Noise level {ambient:.0f}, speech threshold {self.threshold:.0f}")

    @staticmethod
    def _rms(frame):
        return float(np.sqrt(np.mean(frame.astype(np.float32) ** 2)))

    def _capture(self, timeout):
        pre = collections.deque(maxlen=10)           # keep 300 ms before speech starts so first words are not clipped
        voiced, silent, started, frames, t0 = 0, 0, False, [], time.time()
        while True:
            if timeout and not started and time.time() - t0 > timeout: return None
            try: f = self.q.get(timeout=0.3)
            except queue.Empty: continue
            if self.is_speaking():                   # never listen to ourselves
                pre.clear(); voiced = silent = 0; started = False; frames = []; continue
            loud = self._rms(f) > self.threshold
            if not started:
                pre.append(f)
                voiced = voiced + 1 if loud else 0
                if voiced >= 3: started, frames, silent = True, list(pre), 0
                else: self.threshold = max(300.0, self.threshold * 0.999 + self._rms(f) * 3.2 * 0.001)   # slowly follow room noise
            else:
                frames.append(f)
                silent = 0 if loud else silent + 1
                if silent >= 25 or len(frames) > 500:  # 750 ms of quiet ends the sentence, 15 s max
                    return np.concatenate(frames) if len(frames) > 14 else None

    def transcribe(self, audio):
        if self.engine == "vosk":
            from vosk import KaldiRecognizer
            rec = KaldiRecognizer(self.vosk_model, SR)
            data = audio.astype(np.int16).tobytes()
            for i in range(0, len(data), 8000): rec.AcceptWaveform(data[i:i + 8000])
            text = json.loads(rec.FinalResult()).get("text", "").strip()
            return "" if text.lower().strip(" .!?") in JUNK else text
        x = audio.astype(np.float32) / 32768.0
        segs, _ = self.model.transcribe(x, language=self.cfg.get("language") or None, beam_size=5, vad_filter=True,
                                        initial_prompt=PROMPT + (" " + ", ".join(self.vocab)[:300] if self.vocab else ""), condition_on_previous_text=False, temperature=0.0)
        parts = []
        for s in segs:
            if s.no_speech_prob > 0.6 or s.avg_logprob < -1.3: continue
            parts.append(s.text.strip())
        text = " ".join(parts).strip()
        return "" if text.lower().strip(" .!?") in JUNK else text

    def hear(self, timeout=None):
        audio = self._capture(timeout)
        return self.transcribe(audio) if audio is not None else ""

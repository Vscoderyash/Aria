"""What JARVIS has learned about you: shortcuts, voice fixes, facts, experience and lessons. Stored in ~/JARVIS/memory.json."""
import json, os, pathlib, re, tempfile, threading

PATH = pathlib.Path.home() / "JARVIS" / "memory.json"
SECRET = re.compile(r"password|passcode|\bpin\b|\botp\b|cvv|card number|credit card|aadhaar|\bssn\b", re.I)


def toks(s):
    return re.findall(r"[a-z0-9]+", str(s).lower())


def near(a, b):
    if a == b: return True
    if len(a) >= 3 and len(b) >= 3 and (a.startswith(b) or b.startswith(a)): return True
    if len(a) >= 5 and len(b) >= 5 and abs(len(a) - len(b)) <= 1:      # one typo / one letter different
        i = j = d = 0
        while i < len(a) and j < len(b):
            if a[i] == b[j]: i += 1; j += 1; continue
            d += 1
            if d > 1: return False
            if len(a) > len(b): i += 1
            elif len(a) < len(b): j += 1
            else: i += 1; j += 1
        return d + (len(a) - i) + (len(b) - j) <= 1
    return False


def score(label, q):
    L, Q = toks(label), toks(q)
    if not L or not Q: return 0.0
    s = sum(1 for t in Q if any(near(w, t) for w in L)) / len(Q)
    return s + (0.5 if " ".join(Q) in " ".join(L) else 0.0)


class Memory:
    def __init__(self, path=PATH):
        self.path, self.lock = pathlib.Path(path), threading.Lock()
        self.d = {"skills": {}, "aliases": {}, "facts": [], "exp": [], "lessons": []}
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            for k in self.d:
                if k in loaded: self.d[k] = loaded[k]
        except (OSError, ValueError):
            pass
        self.last_goal = ""

    def save(self):
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f: json.dump(self.d, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)

    # ---- teaching
    def teach(self, phrase, action):
        k = " ".join(toks(phrase))
        if not k: return False
        self.d["skills"][k] = action.strip(); self.save(); return True

    def alias(self, frm, to):
        self.d["aliases"][frm.lower().strip()] = to.strip(); self.save()

    def fact(self, text):
        if SECRET.search(text): return False
        self.d["facts"] = [text[:200]] + [f for f in self.d["facts"] if f != text][:29]; self.save(); return True

    def forget(self, q):
        q = q.lower().strip(); n = 0
        for k in [k for k in self.d["skills"] if score(k, q) >= 0.8]: del self.d["skills"][k]; n += 1
        if q in self.d["aliases"]: del self.d["aliases"][q]; n += 1
        keep = [f for f in self.d["facts"] if score(f, q) < 0.8]; n += len(self.d["facts"]) - len(keep); self.d["facts"] = keep
        self.save(); return n

    def forget_all(self):
        self.d = {"skills": {}, "aliases": {}, "facts": [], "exp": [], "lessons": []}; self.save()

    def listing(self):
        out = [f'"{k}" means {v}' for k, v in self.d["skills"].items()]
        out += [f"fact: {f}" for f in self.d["facts"]] + [f'I hear "{k}" as "{v}"' for k, v in self.d["aliases"].items()]
        return out

    # ---- using what was learned
    def fix(self, text):
        for frm, to in self.d["aliases"].items():
            text = re.sub(r"\b" + re.escape(frm) + r"\b", to, text, flags=re.I)
        return text

    def expand(self, text):
        k, Q = " ".join(toks(text)), toks(text)
        if not Q: return text
        if k in self.d["skills"]: return self.d["skills"][k]
        for phrase, action in self.d["skills"].items():
            P = phrase.split()
            if len(P) == len(Q) and all(near(p, q) for p, q in zip(P, Q)): return action
        return text

    def vocab(self):
        """Words to teach the speech recogniser so it hears your own vocabulary correctly."""
        words = list(self.d["aliases"].values()) + list(self.d["aliases"].keys()) + list(self.d["skills"].keys())
        return [w for w in dict.fromkeys(words) if len(w) < 40][:25]

    def recall(self, goal):
        sim = lambda g: score(g, goal) >= 0.6
        ex = sorted([e for e in self.d["exp"] if sim(e["goal"])], key=lambda e: not e.get("good"))[:2]
        return {"examples": [{"goal": e["goal"], "steps": e["steps"][-6:]} for e in ex],
                "lessons": [l["lesson"] for l in self.d["lessons"] if sim(l["goal"])][:3]}

    def add_experience(self, goal, steps):
        if not steps: return
        self.d["exp"] = ([{"goal": goal, "steps": steps[-8:], "good": False}] + self.d["exp"])[:40]; self.last_goal = goal; self.save()

    def mark_good(self):
        if self.d["exp"] and self.d["exp"][0]["goal"] == self.last_goal: self.d["exp"][0]["good"] = True; self.save()

    def add_lesson(self, lesson):
        self.d["lessons"] = ([{"goal": self.last_goal or "general", "lesson": lesson[:240]}] + self.d["lessons"])[:40]; self.save()

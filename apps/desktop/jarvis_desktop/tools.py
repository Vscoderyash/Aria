"""Things JARVIS can do on the computer. Every tool returns a short text result the planner can reason about."""
import os, sys, time, subprocess, threading, shutil, webbrowser, datetime, pathlib, re

HOME = pathlib.Path.home()
WIN, MAC = sys.platform.startswith("win"), sys.platform == "darwin"
APPS = {  # spoken name -> (windows, mac, linux)
    "notepad": ("notepad", "TextEdit", "gedit"), "calculator": ("calc", "Calculator", "gnome-calculator"), "calc": ("calc", "Calculator", "gnome-calculator"),
    "file explorer": ("explorer", "Finder", "xdg-open ."), "explorer": ("explorer", "Finder", "xdg-open ."), "files": ("explorer", "Finder", "xdg-open ."),
    "chrome": ("chrome", "Google Chrome", "google-chrome"), "google chrome": ("chrome", "Google Chrome", "google-chrome"), "edge": ("msedge", "Microsoft Edge", "microsoft-edge"),
    "firefox": ("firefox", "Firefox", "firefox"), "word": ("winword", "Microsoft Word", "libreoffice --writer"), "excel": ("excel", "Microsoft Excel", "libreoffice --calc"),
    "powerpoint": ("powerpnt", "Microsoft PowerPoint", "libreoffice --impress"), "paint": ("mspaint", "Preview", "gimp"), "settings": ("ms-settings:", "System Settings", "gnome-control-center"),
    "task manager": ("taskmgr", "Activity Monitor", "gnome-system-monitor"), "terminal": ("wt", "Terminal", "gnome-terminal"), "command prompt": ("cmd", "Terminal", "gnome-terminal"),
    "vs code": ("code", "Visual Studio Code", "code"), "visual studio code": ("code", "Visual Studio Code", "code"), "code": ("code", "Visual Studio Code", "code"),
    "spotify": ("spotify", "Spotify", "spotify"), "camera": ("microsoft.windows.camera:", "Photo Booth", "cheese"), "snipping tool": ("snippingtool", "Screenshot", "gnome-screenshot"),
}
FOLDERS = {"downloads": "Downloads", "documents": "Documents", "desktop": "Desktop", "pictures": "Pictures", "music": "Music", "videos": "Videos", "home": ""}
BLOCKED_COMBOS = [{"ctrl", "alt", "delete"}, {"ctrl", "shift", "esc"}]
CONFIRM_COMBOS = [{"alt", "f4"}]

TOOL_DOC = """- open_app {"name"}: open an application (e.g. notepad, chrome, spotify, word).
- open_url {"url"}: open a website in the browser.
- search_web {"query"}: search Google.
- browser {"text"}: give a command to the browser extension (click X, next tab, scroll to Y, summarize this page, play the second video...).
- type_text {"text"}: type text into the focused window.
- press_keys {"keys":["ctrl","s"]}: press a key or shortcut.
- scroll {"dir":"up|down"}
- media {"op":"playpause|next|prev"}
- volume {"op":"up|down|mute|set","n":0-100}
- screenshot {}
- lock_screen {}
- window {"op":"minimize|maximize|close|switch|desktop"}
- system_info {"what":"time|date|battery|cpu"}
- set_timer {"seconds":int,"label":"text"}
- take_note {"text"}
- find_file {"name"}
- open_folder {"name":"downloads|documents|desktop|pictures|music|videos|home"}
- clipboard_write {"text"}: put text on the clipboard.
- focus_window {"title"}: bring a window whose title contains this text to the front (Windows).
- list_windows {}: titles of open windows (Windows).
- open_file {"path"}: open a file inside the user's home folder.
- read_clipboard {}
- wait {"seconds":1-10}
- ask {"question"}: ask the user something and wait for the spoken answer.
- done {"summary"}: finish and tell the user the result."""


class Tools:
    def __init__(self, say, bridge=None, confirm=None, log=print):
        self.say, self.bridge, self.confirm, self.log = say, bridge, confirm or (lambda q: False), log
        self._pg = None

    @property
    def pg(self):
        if self._pg is None:
            import pyautogui
            pyautogui.FAILSAFE = True          # slam the mouse into a screen corner to abort any automation
            pyautogui.PAUSE = 0.05
            self._pg = pyautogui
        return self._pg

    def execute(self, tool, args):
        fn = getattr(self, "t_" + str(tool), None)
        if not fn:
            return f"unknown tool '{tool}'"
        try:
            return str(fn(**(args or {})))
        except TypeError as e:
            return f"bad arguments for {tool}: {e}"
        except Exception as e:  # never crash the assistant
            return f"{tool} failed: {e}"

    # ---- apps / web ----
    def t_open_app(self, name):
        key = name.lower().strip()
        spec = APPS.get(key)
        idx = 0 if WIN else 1 if MAC else 2
        if spec:
            target = spec[idx]
            if WIN:
                try: os.startfile(target); return f"opened {name}"
                except OSError: subprocess.Popen(["cmd", "/c", "start", "", target], shell=False); return f"opened {name}"
            if MAC: subprocess.Popen(["open", "-a", target]); return f"opened {name}"
            subprocess.Popen(target.split()); return f"opened {name}"
        if WIN:   # unknown app: use the Start menu search, like a person would
            self.pg.press("win"); time.sleep(0.6); self.pg.write(name, interval=0.02); time.sleep(0.8); self.pg.press("enter")
            return f"asked Windows to open '{name}'"
        if MAC: subprocess.Popen(["open", "-a", name]); return f"opened {name}"
        exe = shutil.which(name.replace(" ", "-")) or shutil.which(name)
        if exe: subprocess.Popen([exe]); return f"opened {name}"
        return f"I could not find an app called {name}"

    def t_open_url(self, url):
        if not re.match(r"^https?://", url): url = "https://" + url.strip().replace(" ", "")
        if self.bridge and self.bridge.connected: return self.bridge.send_command("go to " + url) or "sent to the browser extension"
        webbrowser.open(url); return f"opened {url}"

    def t_search_web(self, query):
        from urllib.parse import quote_plus
        return self.t_open_url("https://www.google.com/search?q=" + quote_plus(query))

    def t_browser(self, text):
        if self.bridge and self.bridge.connected: return self.bridge.send_command(text) or "sent to the browser extension"
        return "The browser extension is not connected. Open Chrome with the JARVIS extension, then try again."

    # ---- input ----
    def t_type_text(self, text):
        try:
            import pyperclip
            old = None
            try: old = pyperclip.paste()
            except Exception: pass
            pyperclip.copy(text); time.sleep(0.05); self.pg.hotkey("command" if MAC else "ctrl", "v"); time.sleep(0.1)
            if old is not None: pyperclip.copy(old)
        except Exception:
            self.pg.write(text, interval=0.01)
        return f"typed {len(text)} characters"

    def t_press_keys(self, keys):
        ks = [str(k).lower() for k in keys]
        combo = set(ks)
        if any(b <= combo for b in BLOCKED_COMBOS): return "that shortcut is blocked for safety"
        if any(c <= combo for c in CONFIRM_COMBOS) and not self.confirm("That will close the current window. Shall I go ahead?"): return "cancelled by the user"
        self.pg.hotkey(*ks) if len(ks) > 1 else self.pg.press(ks[0]); return "pressed " + "+".join(ks)

    def t_scroll(self, dir="down"):
        self.pg.scroll(-600 if dir == "down" else 600); return f"scrolled {dir}"

    def t_media(self, op):
        self.pg.press({"playpause": "playpause", "next": "nexttrack", "prev": "prevtrack"}[op]); return f"media {op}"

    def t_volume(self, op, n=None):
        if op == "mute": self.pg.press("volumemute"); return "toggled mute"
        if op == "set":   # keys move ~2% per press: go to zero, then up
            for _ in range(50): self.pg.press("volumedown")
            for _ in range(int((n or 0) / 2)): self.pg.press("volumeup")
            return f"volume about {n}%"
        for _ in range(5): self.pg.press("volumeup" if op == "up" else "volumedown")
        return f"volume {op}"

    def t_window(self, op):
        mod = "command" if MAC else "alt"
        if op == "close":
            if not self.confirm("Shall I close this window?"): return "cancelled by the user"
            self.pg.hotkey("command", "w") if MAC else self.pg.hotkey("alt", "f4"); return "closed the window"
        if op == "switch": self.pg.hotkey("command" if MAC else "alt", "tab"); return "switched window"
        if op == "desktop": self.pg.hotkey("command", "f3") if MAC else self.pg.hotkey("win", "d"); return "showed the desktop"
        if op == "minimize": self.pg.hotkey("command", "m") if MAC else self.pg.hotkey("win", "down"); return "minimized"
        if op == "maximize": self.pg.hotkey("ctrl", "command", "f") if MAC else self.pg.hotkey("win", "up"); return "maximized"
        return "unknown window action"

    def t_screenshot(self):
        d = HOME / "Pictures" / "JARVIS"; d.mkdir(parents=True, exist_ok=True)
        p = d / datetime.datetime.now().strftime("screenshot_%Y%m%d_%H%M%S.png"); self.pg.screenshot(str(p)); return f"saved screenshot to {p}"

    def t_lock_screen(self):
        if WIN: subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
        elif MAC: subprocess.Popen(["pmset", "displaysleepnow"])
        else: subprocess.Popen(["loginctl", "lock-session"])
        return "locked"

    # ---- information / memory ----
    def t_system_info(self, what):
        n = datetime.datetime.now()
        if what == "time": return n.strftime("It is %I:%M %p.").lstrip("0")
        if what == "date": return n.strftime("Today is %A, %d %B %Y.")
        import psutil
        if what == "battery":
            b = psutil.sensors_battery(); return "No battery found." if not b else f"Battery is at {int(b.percent)} percent, {'charging' if b.power_plugged else 'not charging'}."
        return f"CPU is at {psutil.cpu_percent(interval=0.5)} percent and memory is at {psutil.virtual_memory().percent} percent."

    def t_set_timer(self, seconds, label="Timer"):
        seconds = max(1, int(seconds))
        threading.Timer(seconds, lambda: self.say(f"{label} is up." if label.lower() == "timer" else f"Reminder: {label}.")).start()
        return f"timer set for {seconds} seconds"

    def t_take_note(self, text):
        d = HOME / "JARVIS"; d.mkdir(exist_ok=True)
        with open(d / "notes.txt", "a", encoding="utf-8") as f: f.write(f"[{datetime.datetime.now():%Y-%m-%d %H:%M}] {text}\n")
        return "note saved"

    def t_read_clipboard(self):
        import pyperclip; return pyperclip.paste()[:500] or "the clipboard is empty"

    def t_find_file(self, name):
        name = name.lower().strip(); t0 = time.time(); hits = []
        for root, dirs, files in os.walk(HOME):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("AppData", "node_modules", "Library")]
            hits += [os.path.join(root, f) for f in files if name in f.lower()]
            if len(hits) >= 5 or time.time() - t0 > 8: break
        if not hits: return f"no file matching '{name}' found"
        folder = os.path.dirname(hits[0])
        try: os.startfile(folder) if WIN else subprocess.Popen(["open" if MAC else "xdg-open", folder])
        except Exception: pass
        return "found: " + "; ".join(hits[:3])

    def t_open_folder(self, name):
        p = HOME / FOLDERS.get(name.lower(), name)
        os.startfile(p) if WIN else subprocess.Popen(["open" if MAC else "xdg-open", str(p)]); return f"opened {p.name or 'home'} folder"

    def t_clipboard_write(self, text):
        import pyperclip; pyperclip.copy(str(text)); return "copied to the clipboard"

    def t_list_windows(self):
        if not WIN: return "listing windows is only supported on Windows"
        import pygetwindow as gw
        return "; ".join(t for t in dict.fromkeys(w.title for w in gw.getAllWindows() if w.title.strip()))[:600] or "no windows found"

    def t_focus_window(self, title):
        if not WIN: return "focusing windows by title is only supported on Windows"
        import pygetwindow as gw
        ws = gw.getWindowsWithTitle(title)
        if not ws: return f"no window with '{title}' in its title"
        w = ws[0]
        try:
            if w.isMinimized: w.restore()
            w.activate()
        except Exception as e:
            self.pg.press("alt"); w.activate()
        return f"focused {w.title}"

    def t_open_file(self, path):
        p = pathlib.Path(os.path.expanduser(str(path))).resolve()
        if HOME.resolve() not in p.parents and p != HOME.resolve(): return "I only open files inside your home folder"
        if not p.exists(): return f"{p.name} does not exist"
        os.startfile(p) if WIN else subprocess.Popen(["open" if MAC else "xdg-open", str(p)]); return f"opened {p.name}"

    def t_wait(self, seconds=1):
        time.sleep(min(10, max(0, float(seconds)))); return "waited"

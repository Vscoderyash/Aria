JARVIS DESKTOP  (by Yash Raj)
Hears you anywhere on your computer, thinks, acts, and answers in a natural male voice.
Pairs with the JARVIS browser extension so one voice controls both your PC and Chrome.

INSTALL (Windows)
 1. You need Python 3.10 or newer (3.11 or 3.12 give the best speech accuracy; very new ones like 3.15 work too, with a lighter speech engine).
    If you have none, the installer offers to install Python 3.11 for you.
 2. Unzip this folder somewhere simple (like C:\JARVIS) and double-click start_jarvis.bat. If JARVIS is not installed yet it runs install_windows.bat for you
    (a few minutes, needs internet). You can also run install_windows.bat yourself first.
 3. Next time just double-click start_jarvis.bat. First run downloads the speech model (about 250 MB) once.
 Mac/Linux: run ./install_mac_linux.sh (needs python3.10-3.12), then  source venv/bin/activate && python jarvis_desktop/main.py
 (Mac needs microphone + accessibility permission for Terminal: System Settings > Privacy & Security.)

USE
 Say "Jarvis" then your command. After he answers you can keep talking for 12 seconds without repeating "Jarvis".
 Examples:
   "Jarvis, open Notepad and type hello then press enter"     "volume up" / "set volume to 40" / "mute"
   "open Chrome" / "open youtube" / "search for cheap flights" "pause" / "next song" / "take a screenshot"
   "set a timer for 10 minutes" / "remind me in 5 minutes to call mom" / "take a note buy milk"
   "what's the battery" / "what time is it" / "lock the screen" / "find file resume" / "open downloads folder"
   "click sign in" / "next tab" / "summarize this page"  (go to the browser extension when it is connected)
   Anything else ("plan my week", "write an email about...", "find me a recipe and open it") goes to the thinking brain:
   it works out what you want, makes a plan, does one step at a time, checks each result and changes tactics if something fails.
 The Codex-inspired Pip card stays on top: blue = listening/thinking, green = speaking. Drag to move it, double-click to stop a task, right-click to quit.
 Safety: slam the mouse into a screen corner to abort any automation. Closing windows (Alt+F4) asks you to say "yes" first.
 Ctrl+Alt+Del and Task Manager shortcuts are blocked. It never runs shell commands or deletes files.

TEACH IT  (it learns from you and remembers between sessions, saved in your JARVIS folder: memory.json)
 Shortcuts:   "Jarvis, when I say lunch time, open notepad then type eat lunch"   -> then just say "lunch time"
 Voice fixes: "when you hear nodepad I mean notepad"   (your words are also fed to the speech recogniser, so it hears them better)
 Facts:       "remember that my name is Yash"  (never passwords, PINs or card details)
 Feedback:    after a task say "good job" (it repeats that approach) or "that was wrong" and tell it what to do instead; it applies this to similar tasks
 Manage:      "what have you learned", "forget lunch time", "forget everything". Copy memory.json to move your training to another PC.
 Brain:       config.json  "brain": "fast" (quick) or "smart" (stronger model for every step; planning is always smart)
 New abilities: focus a window by title, list windows, open a file, write to the clipboard.

CONNECT THE BROWSER EXTENSION
 Install the JARVIS extension (jarvis-extension.zip), keep this app running. The extension popup will say
 "Desktop JARVIS: connected". From then on this app listens, the extension acts in the page, and the natural voice speaks for both.

SETTINGS  (jarvis_desktop/config.json)
 voice          en-GB-RyanNeural (British male, default)   en-US-GuyNeural   en-IN-PrabhatNeural   en-US-ChristopherNeural
 stt            auto (Whisper if it can be installed, otherwise Vosk)  whisper | vosk
 whisper_model  small.en (accurate, default)   base.en (faster, lighter)   medium.en (most accurate, needs a stronger PC)   "small" + language "" for Hindi/Hinglish
 wake_required  false = react to everything you say (only in a quiet room)
 ui_scale       0.5 to 2.5  makes the orb smaller or bigger        mic_device  a number if the wrong microphone is used
 api_url        your JARVIS website API (the same one the extension uses)

PRIVACY
 Your voice is converted to text on your own computer (nothing is uploaded). The text of what you ask is sent to your JARVIS
 website API to think, and the words JARVIS speaks are sent to Microsoft's free Edge voice service to make the natural voice.
 If the internet is down it falls back to your computer's own voice. The link to the browser only accepts the JARVIS extension.

TROUBLESHOOTING
 "Could not start the microphone": pick the right device with mic_device (run: python -c "import sounddevice;print(sounddevice.query_devices())").
 He answers himself / echo: use headphones or lower the speaker volume.  He misses words: use a better mic or the medium.en model.
 Voice sounds robotic: you are offline, or the natural-voice package is missing; the natural voice needs internet.
 Speech engine: Whisper (Python up to 3.13) is the most accurate. On newer Python JARVIS uses Vosk: good for commands, weaker for long sentences. Say "Jarvis" clearly with a short pause after it.

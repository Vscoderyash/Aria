"""A small always-on-top orb that shows what JARVIS is doing. Drag to move, double-click to stop a task, right-click to quit."""
import math, queue, time

COLORS = {"idle": "#7a5a1a", "listening": "#19d3ff", "thinking": "#ff3b2f", "speaking": "#37e08f", "busy": "#ffc247"}


class UI:
    def __init__(self, scale=1.0, on_stop=None, on_quit=None):
        import tkinter as tk
        self.tk, self.q, self.state, self.on_stop, self.on_quit = tk, queue.Queue(), "idle", on_stop, on_quit
        s = int(170 * max(0.5, min(2.5, scale)))
        self.s = s
        self.root = tk.Tk(); self.root.overrideredirect(True); self.root.attributes("-topmost", True)
        try: self.root.attributes("-alpha", 0.95)
        except Exception: pass
        self.root.geometry(f"{s}x{int(s * 1.45)}+{self.root.winfo_screenwidth() - s - 30}+{self.root.winfo_screenheight() - int(s * 1.45) - 80}")
        self.root.configure(bg="#0a0405")
        self.c = tk.Canvas(self.root, width=s, height=s, bg="#0a0405", highlightthickness=0); self.c.pack()
        self.label = tk.Label(self.root, text="JARVIS", fg="#ffc247", bg="#0a0405", font=("Segoe UI", max(8, int(9 * scale))), wraplength=s - 10, justify="center")
        self.label.pack(fill="both", expand=True)
        for w in (self.c, self.label, self.root):
            w.bind("<ButtonPress-1>", self._down); w.bind("<B1-Motion>", self._move); w.bind("<Double-Button-1>", lambda e: on_stop and on_stop()); w.bind("<Button-3>", lambda e: on_quit and on_quit())
        self._t0 = time.time(); self.root.after(50, self._tick)

    def _down(self, e): self._dx, self._dy = e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y()
    def _move(self, e): self.root.geometry(f"+{e.x_root - self._dx}+{e.y_root - self._dy}")
    def set_state(self, state, text=None): self.q.put((state, text))
    def close(self): self.root.after(0, self.root.destroy)

    def _tick(self):
        try:
            while True:
                st, tx = self.q.get_nowait(); self.state = st
                if tx is not None: self.label.config(text=str(tx)[:140])
        except queue.Empty: pass
        t = time.time() - self._t0; s = self.s; col = COLORS.get(self.state, COLORS["idle"])
        pulse = 0.5 + 0.5 * math.sin(t * (7 if self.state in ("thinking", "busy") else 3))
        self.c.delete("all"); cx = cy = s / 2; r = s * 0.28
        for i, k in enumerate((1.9, 1.45)):
            self.c.create_oval(cx - r * k, cy - r * k, cx + r * k, cy + r * k, outline=col, width=2, dash=(6, 8), dashoffset=int(t * (30 if i == 0 else -50)) % 14)
        rr = r * (0.85 + 0.25 * pulse)
        self.c.create_oval(cx - rr, cy - rr, cx + rr, cy + rr, fill=col, outline="")
        self.c.create_oval(cx - r * 0.35, cy - r * 0.35, cx + r * 0.35, cy + r * 0.35, fill="#ffffff", outline="")
        self.root.after(40, self._tick)

    def run(self): self.root.mainloop()

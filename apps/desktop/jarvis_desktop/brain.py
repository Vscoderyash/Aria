"""The thinking part: understand the goal, make a strategy, act one step at a time, check each result, adapt."""
import json, re
from tools import TOOL_DOC

PLAYBOOK = ("Windows: open_app opens apps (unknown names go through Start search). Typing goes to the focused window, so open or focus the app first and wait 1-2 seconds. "
            "Use browser for page actions in the extension, open_url for new sites. Save with ctrl+s. Messages, emails, payments and deletions are irreversible: ask first.")

PLAN_RULES = (
    "You are the planning brain of JARVIS, a personal computer assistant. Think logically and strategically before acting. "
    "Reply with ONLY one JSON object: {\"understanding\":\"what the user really wants\",\"assumptions\":[\"...\"],"
    "\"steps\":[\"short ordered steps, naming the tools to use\"],\"success\":\"how we will know it worked\",\"risks\":\"what could go wrong and the fallback\","
    "\"ask\":\"\"}. Use the fewest steps. If the request is truly ambiguous, put ONE short clarifying question in \"ask\"; otherwise leave it empty.")
STEP_RULES = (
    "You control the user's computer through tools. Study the plan and the history of results, reason about what is true now, "
    "then choose exactly ONE next tool. Reply with ONLY one JSON object: {\"thought\":\"brief reasoning\",\"tool\":\"name\",\"args\":{},\"say\":\"short sentence to speak, or empty\"}. "
    "Verify: if the last result shows failure or no progress, change strategy; never repeat a failed action more than once. "
    "Use the playbook, imitate successful examples when similar, strictly obey lessons (past mistakes) and use userFacts to personalise. Never do anything destructive or irreversible without using ask first. Finish with the done tool. Available tools:\n" + TOOL_DOC)


def extract_json(text):
    m = re.search(r"\{[\s\S]*\}", text or "")
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception:
        try: return json.loads(re.sub(r",\s*([}\]])", r"\1", m.group(0)))
        except Exception: return None


class Brain:
    def __init__(self, cfg, tools, say, ask_user, log=print, llm=None, memory=None):
        self.cfg, self.tools, self.say, self.ask_user, self.log, self.memory = cfg, tools, say, ask_user, log, memory
        self.smart = True
        self.llm = llm or self._http_llm
        self.cancelled = False

    def _http_llm(self, rules, payload):
        body = {"mode": "raw", "smart": self.smart, "system": rules, "messages": [{"role": "user", "content": rules + "\n\nINPUT:\n" + payload}]}
        import os
        import requests

        headers = {}
        access_token = os.environ.get("JARVIS_ACCESS_TOKEN", "").strip()
        if access_token:
            headers["Authorization"] = "Bearer " + access_token
        r = requests.post(self.cfg["api_url"], json=body, headers=headers, timeout=40)
        if r.status_code == 401:
            raise RuntimeError("The server rejected this Desktop request (401). Set the same JARVIS_ACCESS_TOKEN in this computer's environment as in Vercel, then restart JARVIS Desktop.")
        if r.status_code == 503:
            try:
                detail = r.json().get("error", "The server model provider is not configured.")
            except (ValueError, AttributeError):
                detail = "The server model provider is not configured."
            raise RuntimeError(detail)
        r.raise_for_status()
        return r.text

    def _context(self, goal):
        rc = self.memory.recall(goal) if self.memory else {"examples": [], "lessons": []}
        return {"playbook": PLAYBOOK, "userFacts": (self.memory.d["facts"][:15] if self.memory else []), **rc}

    def plan(self, goal):
        self.smart = True                                  # planning always uses the strongest model
        data = extract_json(self.llm(PLAN_RULES, json.dumps({"goal": goal, **self._context(goal)}))) or {}
        return {"understanding": data.get("understanding", goal), "steps": data.get("steps") or [], "success": data.get("success", ""),
                "risks": data.get("risks", ""), "ask": (data.get("ask") or "").strip()}

    def run(self, goal):
        """Returns a short spoken summary."""
        self.cancelled = False
        plan = self.plan(goal)
        if plan["ask"]:
            answer = self.ask_user(plan["ask"])
            if not answer: return "Cancelled."
            goal += f" (user clarified: {answer})"
            plan = self.plan(goal)
        if plan["steps"]: self.log("PLAN: " + " -> ".join(map(str, plan["steps"])))
        history, seen = [], []
        for step in range(int(self.cfg.get("max_steps", 12))):
            if self.cancelled: return "Stopped."
            hint = ""
            if len(seen) >= 3 and len(set(seen[-3:])) == 1:
                hint = "You repeated the same action 3 times without progress. Choose a different approach or use ask."
            self.smart = self.cfg.get("brain") == "smart"
            payload = json.dumps({"goal": goal, "plan": plan, "history": history[-8:], "hint": hint, "step": step + 1, **self._context(goal)})
            d = extract_json(self.llm(STEP_RULES, payload))
            if not d or "tool" not in d:
                history.append({"error": "reply was not valid JSON"}); seen.append("bad"); continue
            tool, args = d.get("tool"), d.get("args") or {}
            if d.get("thought"): self.log("THOUGHT: " + str(d["thought"]))
            if d.get("say"): self.say(str(d["say"]))
            if tool == "done":
                if self.memory and history: self.memory.add_experience(goal, [f"{h.get('tool')} {json.dumps(h.get('args', {}))[:60]} -> {str(h.get('result', h.get('answer', '')))[:40]}" for h in history if "tool" in h])
                return str(args.get("summary") or d.get("say") or "Done.")
            if tool == "ask":
                answer = self.ask_user(str(args.get("question", "Could you clarify?")))
                if not answer: return "Cancelled."
                history.append({"tool": "ask", "answer": answer}); seen.append("ask"); continue
            result = self.tools.execute(tool, args)
            self.log(f"{tool} {json.dumps(args)[:80]} -> {result[:100]}")
            history.append({"tool": tool, "args": args, "result": result[:300]})
            seen.append(tool + json.dumps(args, sort_keys=True))
        return "I ran out of steps before finishing. Tell me how to continue."

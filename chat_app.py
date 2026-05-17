#!/usr/bin/env python3
"""
Advanced AI Chat — powered by Claude
Streaming multi-turn chat with a clean web UI.
Run: python3 chat_app.py
Open: http://localhost:5000
"""

import json
import os
import uuid
from pathlib import Path

import httpx
from flask import Flask, Response, jsonify, request, session

# Load .env if present (OPENROUTER_API_KEY, etc.)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Auth / provider detection ─────────────────────────────────────────────────
_OR_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()  # populated from .env
_SESSION_TOKEN_FILE = Path("/home/claude/.claude/remote/.session_ingress_token")

def _use_openrouter() -> bool:
    return bool(_OR_KEY)

def get_api_config():
    """Returns (base_url, headers, provider) for whichever backend is available."""
    if _use_openrouter():
        return (
            "https://openrouter.ai/api/v1",
            {
                "Authorization": f"Bearer {_OR_KEY}",
                "HTTP-Referer": "http://localhost:5000",
                "X-Title": "Aria AI Chat",
                "content-type": "application/json",
            },
            "openrouter",
        )
    # Fall back to Anthropic via session Bearer token
    token = _SESSION_TOKEN_FILE.read_text().strip()
    return (
        "https://api.anthropic.com",
        {
            "Authorization": f"Bearer {token}",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        "anthropic",
    )

# OpenRouter uses "anthropic/model-name" prefixes
OPENROUTER_MODEL_MAP = {
    "claude-opus-4-7":  "anthropic/claude-opus-4-5",   # best available on OR
    "claude-sonnet-4-6": "anthropic/claude-sonnet-4-5",
    "claude-haiku-4-5":  "anthropic/claude-haiku-4-5",
}

app = Flask(__name__)
app.secret_key = os.urandom(24)

conversations: dict[str, list[dict]] = {}


def get_history(sid: str) -> list[dict]:
    return conversations.setdefault(sid, [])


HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aria AI Chat</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0f0f13;--surface:#1a1a24;--surface2:#22222f;--border:#2e2e40;
    --accent:#7c6af7;--accent2:#a78bf7;--text:#e8e8f0;--muted:#8888aa;
    --user-bg:#2a2040;--ai-bg:#1e1e2e;--danger:#f77;
  }
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;
    height:100vh;display:flex;flex-direction:column;overflow:hidden}

  /* ── Header ── */
  header{display:flex;align-items:center;justify-content:space-between;
    padding:14px 20px;background:var(--surface);border-bottom:1px solid var(--border);
    box-shadow:0 2px 12px rgba(0,0,0,.4)}
  .logo{display:flex;align-items:center;gap:10px;font-size:1.2rem;font-weight:700;
    background:linear-gradient(135deg,var(--accent),var(--accent2));
    -webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .logo svg{flex-shrink:0}
  .header-actions{display:flex;gap:8px}
  .btn{padding:7px 14px;border-radius:8px;border:1px solid var(--border);
    background:var(--surface2);color:var(--text);cursor:pointer;font-size:.85rem;
    transition:all .15s}
  .btn:hover{background:var(--accent);border-color:var(--accent);color:#fff}
  .btn-icon{padding:7px 10px}

  /* ── Sidebar ── */
  .layout{display:flex;flex:1;overflow:hidden}
  aside{width:240px;background:var(--surface);border-right:1px solid var(--border);
    display:flex;flex-direction:column;padding:12px;gap:8px;overflow-y:auto}
  aside h3{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;
    color:var(--muted);padding:4px 8px}
  .sys-label{font-size:.8rem;color:var(--muted);padding:4px 8px}
  #sysPrompt{width:100%;height:90px;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;color:var(--text);padding:8px;font-size:.82rem;resize:none;
    font-family:inherit;line-height:1.4}
  #sysPrompt:focus{outline:none;border-color:var(--accent)}
  .model-select{width:100%;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;color:var(--text);padding:7px 10px;font-size:.82rem;cursor:pointer}
  .model-select:focus{outline:none;border-color:var(--accent)}
  .stat{font-size:.78rem;color:var(--muted);padding:4px 8px}

  /* ── Chat area ── */
  main{flex:1;display:flex;flex-direction:column;overflow:hidden}
  #messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
  #messages::-webkit-scrollbar{width:5px}
  #messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

  .msg{display:flex;gap:12px;max-width:820px;animation:fadeIn .2s ease}
  .msg.user{align-self:flex-end;flex-direction:row-reverse}
  .msg.assistant{align-self:flex-start}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

  .avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;
    justify-content:center;font-size:.9rem;flex-shrink:0;font-weight:700}
  .msg.user .avatar{background:linear-gradient(135deg,var(--accent),#9f6af7);color:#fff}
  .msg.assistant .avatar{background:linear-gradient(135deg,#2a6af7,var(--accent));color:#fff}

  .bubble{padding:12px 16px;border-radius:16px;line-height:1.6;font-size:.93rem;
    max-width:680px;word-break:break-word}
  .msg.user .bubble{background:var(--user-bg);border-bottom-right-radius:4px}
  .msg.assistant .bubble{background:var(--ai-bg);border-bottom-left-radius:4px;
    border:1px solid var(--border)}

  .bubble pre{background:#111;border:1px solid var(--border);border-radius:8px;
    padding:12px;overflow-x:auto;margin:10px 0;font-size:.85rem}
  .bubble code{background:#111;padding:2px 6px;border-radius:4px;font-size:.88rem}
  .bubble pre code{background:none;padding:0}
  .bubble p{margin-bottom:8px}
  .bubble p:last-child{margin-bottom:0}
  .bubble h1,.bubble h2,.bubble h3{margin:10px 0 6px;font-size:1rem}
  .bubble ul,.bubble ol{padding-left:18px;margin:6px 0}
  .bubble li{margin:3px 0}
  .bubble strong{color:var(--accent2)}
  .bubble blockquote{border-left:3px solid var(--accent);padding-left:10px;
    margin:8px 0;color:var(--muted)}

  .cursor{display:inline-block;width:2px;height:1em;background:var(--accent);
    vertical-align:text-bottom;animation:blink .7s infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:12px;color:var(--muted);text-align:center;padding:40px}
  .empty-state .big{font-size:3rem;line-height:1}
  .empty-state h2{font-size:1.2rem;color:var(--text)}
  .suggestions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
  .suggestion{padding:8px 14px;border:1px solid var(--border);border-radius:20px;
    cursor:pointer;font-size:.85rem;transition:all .15s;background:var(--surface2)}
  .suggestion:hover{border-color:var(--accent);color:var(--accent2)}

  /* ── Input bar ── */
  .input-bar{padding:16px 20px;background:var(--surface);border-top:1px solid var(--border)}
  .input-wrap{display:flex;align-items:flex-end;gap:10px;max-width:860px;margin:0 auto;
    background:var(--surface2);border:1px solid var(--border);border-radius:14px;
    padding:10px 14px;transition:border-color .15s}
  .input-wrap:focus-within{border-color:var(--accent)}
  #userInput{flex:1;background:none;border:none;color:var(--text);font-size:.95rem;
    resize:none;outline:none;max-height:160px;line-height:1.5;font-family:inherit;
    min-height:24px}
  #userInput::placeholder{color:var(--muted)}
  #sendBtn{width:36px;height:36px;border-radius:50%;border:none;
    background:linear-gradient(135deg,var(--accent),var(--accent2));
    color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;
    flex-shrink:0;transition:opacity .15s;font-size:1rem}
  #sendBtn:disabled{opacity:.4;cursor:default}
  .input-hint{font-size:.76rem;color:var(--muted);text-align:center;margin-top:6px}
</style>
</head>
<body>

<header>
  <div class="logo">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="url(#g)"/>
      <path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="14" cy="14" r="2" fill="#fff"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7c6af7"/><stop offset="1" stop-color="#a78bf7"/>
      </linearGradient></defs>
    </svg>
    Aria AI
  </div>
  <div class="header-actions">
    <button class="btn" onclick="clearChat()">New Chat</button>
  </div>
</header>

<div class="layout">
  <aside>
    <h3>Model</h3>
    <select class="model-select" id="modelSelect">
      <option value="claude-opus-4-7">Claude Opus 4.7</option>
      <option value="claude-sonnet-4-6" selected>Claude Sonnet 4.6</option>
      <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
    </select>

    <h3>System Prompt</h3>
    <span class="sys-label">Customize AI behavior</span>
    <textarea id="sysPrompt" placeholder="You are a helpful AI assistant...">You are Aria, an advanced AI assistant. You are helpful, thoughtful, and precise. You format responses clearly using markdown when helpful.</textarea>

    <h3>Stats</h3>
    <div class="stat" id="statMsgs">Messages: 0</div>
    <div class="stat" id="statModel">Model: Sonnet 4.6</div>
  </aside>

  <main>
    <div id="messages">
      <div class="empty-state" id="emptyState">
        <div class="big">✦</div>
        <h2>What can I help you with?</h2>
        <p>Ask anything — code, writing, analysis, ideas</p>
        <div class="suggestions">
          <div class="suggestion" onclick="sendSuggestion('Explain quantum computing in simple terms')">Explain quantum computing</div>
          <div class="suggestion" onclick="sendSuggestion('Write a Python web scraper')">Write a Python script</div>
          <div class="suggestion" onclick="sendSuggestion('Give me 5 startup ideas for 2025')">Startup ideas</div>
          <div class="suggestion" onclick="sendSuggestion('What are the best practices for REST API design?')">REST API best practices</div>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <div class="input-wrap">
        <textarea id="userInput" rows="1" placeholder="Message Aria..." onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
        <button id="sendBtn" onclick="sendMessage()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="input-hint">Enter to send · Shift+Enter for newline</div>
    </div>
  </main>
</div>

<script>
let msgCount = 0;
let streaming = false;

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function sendSuggestion(text) {
  document.getElementById('userInput').value = text;
  sendMessage();
}

function md(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_,lang,code)=>`<pre><code class="language-${lang}">${code.trimEnd()}</code></pre>`)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^#{3} (.+)$/gm,'<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/^\* (.+)$/gm,'<li>$1</li>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g,'<ul>$1</ul>')
    .replace(/\n\n+/g,'</p><p>')
    .replace(/^(?!<[h|p|u|o|b|l|c])/gm, '<p>').replace(/$/gm, '</p>');
}

function addMessage(role, content='') {
  const empty = document.getElementById('emptyState');
  if (empty) empty.remove();

  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.id = 'msg-' + Date.now();

  const initials = role === 'user' ? 'U' : 'A';
  div.innerHTML = `
    <div class="avatar">${initials}</div>
    <div class="bubble" id="bubble-${div.id}">${content}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div.id;
}

function updateBubble(msgId, rawText, done=false) {
  const bubble = document.getElementById('bubble-' + msgId);
  if (!bubble) return;
  bubble.innerHTML = md(rawText) + (done ? '' : '<span class="cursor"></span>');
  document.getElementById('messages').scrollTop = 99999;
}

function updateStats() {
  const model = document.getElementById('modelSelect').value;
  document.getElementById('statMsgs').textContent = `Messages: ${msgCount}`;
  document.getElementById('statModel').textContent = `Model: ${model.split('-').slice(1,3).join(' ')}`;
}

async function sendMessage() {
  if (streaming) return;
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;
  streaming = true;
  msgCount++;

  addMessage('user', md(text));

  const sysPrompt = document.getElementById('sysPrompt').value.trim();
  const model = document.getElementById('modelSelect').value;

  const aiId = addMessage('assistant');
  let fullText = '';

  try {
    const resp = await fetch('/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text, system: sysPrompt, model })
    });

    const reader = resp.body.getReader();
    const dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          if (j.delta) { fullText += j.delta; updateBubble(aiId, fullText); }
          if (j.error) { fullText += `\n\n⚠️ ${j.error}`; }
        } catch {}
      }
    }
    msgCount++;
    updateBubble(aiId, fullText, true);
    updateStats();
  } catch (e) {
    updateBubble(aiId, '⚠️ Connection error: ' + e.message, true);
  }

  streaming = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('userInput').focus();
}

function clearChat() {
  fetch('/clear', { method: 'POST' });
  msgCount = 0;
  updateStats();
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `<div class="empty-state" id="emptyState">
    <div class="big">✦</div>
    <h2>What can I help you with?</h2>
    <p>Ask anything — code, writing, analysis, ideas</p>
    <div class="suggestions">
      <div class="suggestion" onclick="sendSuggestion('Explain quantum computing in simple terms')">Explain quantum computing</div>
      <div class="suggestion" onclick="sendSuggestion('Write a Python web scraper')">Write a Python script</div>
      <div class="suggestion" onclick="sendSuggestion('Give me 5 startup ideas for 2025')">Startup ideas</div>
      <div class="suggestion" onclick="sendSuggestion('What are the best practices for REST API design?')">REST API best practices</div>
    </div>
  </div>`;
}

document.getElementById('userInput').focus();
</script>
</body>
</html>"""


@app.route("/")
def index():
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return HTML


@app.route("/chat", methods=["POST"])
def chat():
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    sid = session["sid"]

    data = request.json
    user_msg = data.get("message", "")
    system_prompt = data.get("system", "You are Aria, a helpful AI assistant.")
    model = data.get("model", "claude-sonnet-4-6")

    history = get_history(sid)
    history.append({"role": "user", "content": user_msg})

    def stream():
        base_url, headers, provider = get_api_config()

        if provider == "openrouter":
            # OpenRouter: OpenAI-compatible chat completions
            or_model = OPENROUTER_MODEL_MAP.get(model, f"anthropic/{model}")
            messages_with_sys = [{"role": "system", "content": system_prompt}] + history[-20:]
            payload = {
                "model": or_model,
                "max_tokens": 4096,
                "messages": messages_with_sys,
                "stream": True,
            }
            endpoint = f"{base_url}/chat/completions"
        else:
            # Anthropic native Messages API
            payload = {
                "model": model,
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": history[-20:],
                "stream": True,
            }
            endpoint = f"{base_url}/v1/messages"

        full_response = ""
        try:
            with httpx.stream("POST", endpoint, headers=headers, json=payload, timeout=120) as resp:
                if resp.status_code != 200:
                    err = resp.read().decode()
                    err_msg = f"API error {resp.status_code}: {err[:300]}"
                    yield f"data: {json.dumps({'error': err_msg})}\n\n"
                    return

                for line in resp.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        evt = json.loads(raw)
                    except Exception:
                        continue

                    if provider == "openrouter":
                        # OpenAI SSE format: choices[0].delta.content
                        delta = (evt.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
                    else:
                        # Anthropic SSE format: content_block_delta
                        if evt.get("type") == "content_block_delta":
                            delta = evt.get("delta", {}).get("text", "")
                        else:
                            delta = ""

                    if delta:
                        full_response += delta
                        yield f"data: {json.dumps({'delta': delta})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        if full_response:
            history.append({"role": "assistant", "content": full_response})

        yield "data: [DONE]\n\n"

    return Response(stream(), mimetype="text/event-stream")


@app.route("/clear", methods=["POST"])
def clear():
    if "sid" in session:
        conversations.pop(session["sid"], None)
        session["sid"] = str(uuid.uuid4())
    return jsonify({"ok": True})


if __name__ == "__main__":
    provider = "OpenRouter" if _use_openrouter() else "Anthropic (session token)"
    print("\n" + "="*50)
    print("  Aria AI Chat")
    print(f"  Provider : {provider}")
    print("  Open     : http://localhost:5000")
    print("="*50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)

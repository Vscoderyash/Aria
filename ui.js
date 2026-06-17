const STORAGE_KEYS = {
  session: "aria.session",
  chats: "aria.chats",
  active: "aria.active",
  training: "aria.training",
  theme: "aria.theme",
};

const defaultChats = [
  {
    id: "welcome",
    title: "Welcome to ARIA",
    messages: [
      {
        role: "assistant",
        content: "ARIA Workspace is a clean JavaScript coding studio. Log in, write code, capture lessons, and turn mistakes into training notes.",
      },
    ],
  },
];

const defaultTraining = [
  {
    title: "Strong prompt",
    detail: "Ask for a specific component, file, or bug fix. The workspace responds best when the task is concrete.",
  },
  {
    title: "Record feedback",
    detail: "Every correction can be saved to training memory so the workspace gets better over time.",
  },
  {
    title: "Ship clean code",
    detail: "Keep the UI plain JavaScript, focused, and readable. Build the real workflow before decoration.",
  },
];

const state = {
  session: readJSON(STORAGE_KEYS.session, null),
  chats: readJSON(STORAGE_KEYS.chats, defaultChats),
  active: readJSON(STORAGE_KEYS.active, "welcome"),
  training: readJSON(STORAGE_KEYS.training, defaultTraining),
  query: "",
  output: "",
  status: "Ready",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function q(sel, root = document) {
  return root.querySelector(sel);
}

function qa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function currentChat() {
  return state.chats.find((chat) => chat.id === state.active) || state.chats[0];
}

function setSession(session) {
  state.session = session;
  save(STORAGE_KEYS.session, session);
}

function setChats(chats) {
  state.chats = chats;
  save(STORAGE_KEYS.chats, chats);
}

function setActive(id) {
  state.active = id;
  save(STORAGE_KEYS.active, id);
}

function setTraining(training) {
  state.training = training;
  save(STORAGE_KEYS.training, training);
}

function render() {
  const app = q("#app");
  if (!app) return;

  if (!state.session) {
    app.innerHTML = loginView();
    bindLogin();
    return;
  }

  const chat = currentChat();
  app.innerHTML = workspaceView(chat);
  bindWorkspace();
}

function loginView() {
  return `
    <div class="overlay">
      <section class="login">
        <div class="login-hero">
          <div class="brand">
            <div class="brand-mark">A</div>
            <div>
              <div class="brand-title">ARIA Workspace</div>
              <div class="brand-sub">Code, train, ship</div>
            </div>
          </div>
          <h1>Build like Claude and Codex, but in your own workspace.</h1>
          <p>
            A focused coding studio with a login gate, file-style editor, and a learning panel
            that records mistakes into training memory. Everything is plain JavaScript and easy
            to understand.
          </p>
          <div class="training-list">
            ${defaultTraining
              .map(
                (item) => `
                  <div class="train-item">
                    <strong>${escapeHTML(item.title)}</strong>
                    <small>${escapeHTML(item.detail)}</small>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="login-box">
          <div class="badge">Login</div>
          <div class="field">
            <label>Username</label>
            <input class="input" id="loginUser" placeholder="yash_owner" autocomplete="username">
          </div>
          <div class="field">
            <label>Password</label>
            <input class="input" id="loginPass" type="password" placeholder="owner_yash123" autocomplete="current-password">
          </div>
          <button class="cta" id="loginBtn">Enter workspace</button>
          <button class="cta secondary" id="demoBtn">Use demo session</button>
          <p class="muted">Owner login is local for now. You can wire it to the server later if needed.</p>
          <p class="muted" id="loginStatus"></p>
        </div>
      </section>
    </div>
  `;
}

function workspaceView(chat) {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">A</div>
          <div>
            <div class="brand-title">ARIA</div>
            <div class="brand-sub">Workspace</div>
          </div>
        </div>
        <div class="nav-group">
          <button class="side-btn primary" id="newChatBtn">+ New conversation</button>
          <button class="side-btn" id="trainBtn">Training memory</button>
          <button class="side-btn" id="exportBtn">Export session</button>
          <button class="side-btn" id="logoutBtn">Log out</button>
        </div>
        <div>
          <div class="brand-sub" style="margin-bottom:10px;">Conversations</div>
          <div class="chat-list" id="chatList">
            ${state.chats
              .map(
                (item) => `
                  <button class="chat-item ${item.id === chat.id ? "active" : ""}" data-chat="${item.id}">
                    <strong>${escapeHTML(item.title)}</strong>
                    <div class="muted">${item.messages.length} messages</div>
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
      </aside>

      <section class="main">
        <header class="topbar">
          <div>
            <div class="title">${escapeHTML(chat.title)}</div>
            <div class="subtitle">AI code workspace, training notes, and session memory</div>
          </div>
          <div class="status">
            <span class="dot"></span>
            <span>${escapeHTML(state.status)}</span>
          </div>
        </header>

        <div class="content">
          <article class="panel editor">
            <div class="editor-head">
              <div>
                <div class="title">Editor</div>
                <div class="subtitle">Write a prompt or paste code. The preview is live.</div>
              </div>
              <span class="badge">Plain JS</span>
            </div>
            <div class="code-area">
              <textarea id="promptBox" placeholder="Ask ARIA to design a feature, fix code, or explain a bug...">${escapeHTML(state.query)}</textarea>
              <pre id="previewBox">${escapeHTML(state.output || "Your generated response will appear here.")}</pre>
            </div>
            <div class="footer-bar">
              <div class="muted">Tip: be specific. Example: “Create a login page with training memory and clean code sections.”</div>
              <button class="cta" id="runBtn">Run prompt</button>
            </div>
          </article>

          <aside class="stack">
            <section class="panel">
              <div class="panel-head">
                <div>
                  <div class="title">Training model</div>
                  <div class="subtitle">Save corrections and useful lessons.</div>
                </div>
                <button class="tool-btn" id="addTrainingBtn">Add lesson</button>
              </div>
              <div style="padding:20px">
                <div class="field">
                  <label>What should ARIA remember?</label>
                  <textarea class="textarea" id="trainingInput" placeholder="Example: Prefer modular functions over giant handlers."></textarea>
                </div>
                <div class="field" style="margin-top:12px;">
                  <label>Correction or context</label>
                  <textarea class="textarea" id="trainingNote" placeholder="Explain the mistake, fix, or design rule."></textarea>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head">
                <div>
                  <div class="title">Memory</div>
                  <div class="subtitle">Recent lessons from this workspace.</div>
                </div>
              </div>
              <div style="padding:20px">
                <div class="training-list" id="trainingList">
                  ${state.training
                    .slice(0, 5)
                    .map(
                      (item) => `
                        <div class="train-item">
                          <strong>${escapeHTML(item.title)}</strong>
                          <small>${escapeHTML(item.detail)}</small>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  `;
}

function bindLogin() {
  const user = q("#loginUser");
  const pass = q("#loginPass");
  const status = q("#loginStatus");
  const loginBtn = q("#loginBtn");
  const demoBtn = q("#demoBtn");

  loginBtn?.addEventListener("click", () => {
    const username = String(user?.value || "").trim();
    const password = String(pass?.value || "");
    if ((username === "yash_owner" && password === "owner_yash123") || (username && password)) {
      setSession({ name: username || "Owner", role: "owner", loggedInAt: new Date().toISOString() });
      state.status = "Signed in";
      render();
      return;
    }
    if (status) status.textContent = "Enter the owner credentials or use the demo session.";
  });

  demoBtn?.addEventListener("click", () => {
    setSession({ name: "Demo Builder", role: "demo", loggedInAt: new Date().toISOString() });
    state.status = "Demo session active";
    render();
  });
}

function bindWorkspace() {
  q("#logoutBtn")?.addEventListener("click", () => {
    setSession(null);
    render();
  });

  q("#newChatBtn")?.addEventListener("click", () => {
    const id = `chat-${Date.now()}`;
    const chat = {
      id,
      title: "New code brief",
      messages: [{ role: "assistant", content: "Start by describing the feature or bug you want solved." }],
    };
    setChats([chat, ...state.chats]);
    setActive(id);
    state.status = "Conversation created";
    render();
  });

  q("#trainBtn")?.addEventListener("click", () => {
    q("#trainingInput")?.focus();
  });

  q("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ session: state.session, chats: state.chats, training: state.training }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aria-workspace-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  q("#runBtn")?.addEventListener("click", runPrompt);
  q("#promptBox")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    save(STORAGE_KEYS.active, state.active);
  });

  qa("[data-chat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActive(btn.dataset.chat);
      state.status = "Conversation switched";
      render();
    });
  });

  q("#addTrainingBtn")?.addEventListener("click", addTraining);
}

function runPrompt() {
  const prompt = String(q("#promptBox")?.value || "").trim();
  if (!prompt) return;
  state.query = prompt;
  const result = generateResponse(prompt);
  state.output = result;
  const chat = currentChat();
  chat.messages.push({ role: "user", content: prompt });
  chat.messages.push({ role: "assistant", content: result });
  setChats([...state.chats]);
  state.status = "Prompt processed";
  render();
}

function addTraining() {
  const title = String(q("#trainingInput")?.value || "").trim();
  const detail = String(q("#trainingNote")?.value || "").trim();
  if (!title && !detail) return;
  const next = [{ title: title || "New lesson", detail: detail || title }, ...state.training];
  setTraining(next.slice(0, 20));
  state.status = "Training memory updated";
  render();
}

function generateResponse(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("login")) {
    return [
      "Build notes:",
      "- Use a clean auth card with a clear CTA.",
      "- Keep the app shell dark, focused, and easy to scan.",
      "- Store session state locally first, then swap in a server session later.",
    ].join("\n");
  }
  if (lower.includes("training") || lower.includes("learn")) {
    return [
      "Training plan:",
      "- Capture mistakes as structured notes.",
      "- Add a correction field and a context field.",
      "- Reuse the notes in future prompts as memory.",
    ].join("\n");
  }
  if (lower.includes("code") || lower.includes("component")) {
    return [
      "Code structure:",
      "- Split the UI into login, workspace, and memory panels.",
      "- Keep functions small and composable.",
      "- Prefer plain JavaScript and browser storage for speed.",
    ].join("\n");
  }
  return `ARIA response:\n${prompt}\n\nNext step: turn that into a small, shippable UI before adding complexity.`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

render();

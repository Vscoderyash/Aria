'use strict';

let online = false;
let busy = false;
let atts = [];

// ── Status ──
function setStatus(state, label) {
  Q('#statusArea').className = 'status-area ' + state;
  Q('#sLabel').textContent = label;
}

// ── Cross-browser timeout ──
function tFetch(url, opts, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    fetch(url, opts).then(r => { clearTimeout(t); res(r); }).catch(e => { clearTimeout(t); rej(e); });
  });
}

// ── Quick ping ──
async function checkOnline() {
  setStatus('', 'Connecting…');
  try {
    await api('/api/health', null, 'GET');
    online = true;
    serverOnline = true;
    setStatus('online', 'ARIA Core');
    updateHint(true); renderChat();
  } catch (e) {
    online = false;
    serverOnline = false;
    setStatus('error', 'Offline');
    updateHint(false);
  }
}

/* ═══════════════════════════════════════════
   Store
═══════════════════════════════════════════ */
const K = {
  chats: 'aria4.chats',
  active: 'aria4.active',
  train: 'aria4.train',
  theme: 'aria4.theme',
  permissions: 'aria4.permissions',
  connections: 'aria4.connections'
};

const DEFAULT_PERMISSIONS = [
  { id: 'perm_web', name: 'Use server knowledge', scope: 'Use stored server memory when ARIA memory is not enough', status: 'approved' },
  { id: 'perm_code', name: 'Coding actions', scope: 'Suggest and generate code; ask before editing external systems', status: 'needs approval' },
  { id: 'perm_deploy', name: 'Deployment actions', scope: 'Deploy, change environment variables, or publish releases', status: 'needs approval' },
  { id: 'perm_connect', name: 'Connect apps', scope: 'Connect GitHub, Vercel, Drive, Slack, or other services', status: 'needs approval' }
];

const DEF = {
  personality: "You are ARIA, a smart, precise, and helpful AI assistant. Give complete, accurate, useful answers. Use markdown for code and structured responses. Be honest about uncertainty.",
  rules: [
    'Use the knowledge base and memories before generic answers.',
    'When writing code, give complete working implementations with explanations.',
    'Format with markdown — code blocks, headers, lists — for clarity.',
    'Be honest and say when you\'re not sure rather than guessing.'
  ],
  memories: {}, knowledge: [], examples: [],
  settings: { autoLearn: true }
};

const ld = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = t => String(t || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function normTrain(v) {
  return {
    ...DEF, ...(v || {}),
    memories: { ...(v?.memories || {}) },
    rules: Array.isArray(v?.rules) ? v.rules : DEF.rules.slice(),
    knowledge: Array.isArray(v?.knowledge) ? v.knowledge : [],
    examples: Array.isArray(v?.examples) ? v.examples : [],
    settings: { ...DEF.settings, ...(v?.settings || {}) }
  };
}

let train = normTrain(ld(K.train, DEF));
let chats = ld(K.chats, []);
let activeId = ld(K.active, null);
let serverOnline = false;
let currentUser = null;
let serverPlans = {};
let serverPlugins = [];
let serverSkills = [];
let serverAutomations = [];
let serverActions = [];
let permissionRequests = ld(K.permissions, DEFAULT_PERMISSIONS);
let connectionRequests = ld(K.connections, []);

const Q = s => document.querySelector(s);
const QQ = s => Array.from(document.querySelectorAll(s));
const on = (selector, event, handler) => { const el = Q(selector); if (el) el.addEventListener(event, handler); };
const delegate = (root, selector, handler) => {
  if (!root) return;
  root.onclick = e => {
    const target = e.target.closest(selector);
    if (!target || !root.contains(target)) return;
    handler(e, target);
  };
};

function saveTrain() { sv(K.train, train); }
function saveChats() { sv(K.chats, chats.slice(0, 120)); sv(K.active, activeId); }
function saveControls() { sv(K.permissions, permissionRequests); sv(K.connections, connectionRequests); }

async function api(path, body, method) {
  const endpoint = `/api/aria?path=${encodeURIComponent(path)}`;
  const opts = { method: method || (body ? 'POST' : 'GET'), headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(endpoint, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Server request failed');
  return data;
}

function serverChatsToLocal(serverChats) {
  if (!Array.isArray(serverChats) || !serverChats.length) return;
  chats = serverChats.map(c => ({
    id: c.id,
    title: c.title || 'New chat',
    ts: c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now(),
    msgs: (c.messages || []).map(m => ({
      role: m.role,
      content: m.content,
      ts: m.ts || Date.now(),
      source: m.source,
      links: m.links
    }))
  }));
  if (!chats.find(c => c.id === activeId)) activeId = chats[0]?.id || null;
  saveChats();
  renderSidebar();
  renderChat();
}

async function bootServerProfile() {
  try {
    const [plans, me] = await Promise.all([api('/api/plans'), api('/api/me')]);
    serverPlans = plans.plans || {};
    serverPlugins = plans.plugins || [];
    serverSkills = plans.skills || [];
    currentUser = me.user || null;
    serverChatsToLocal(me.chats);
    if (currentUser) await refreshServerActions();
    serverOnline = true;
  } catch {
    serverOnline = false;
    currentUser = null;
    serverActions = [];
  }
  renderServerPanels();
  updateHint(online || serverOnline);
}

async function refreshServerActions() {
  if (!currentUser) {
    serverActions = [];
    return;
  }
  try {
    const data = await api('/api/actions');
    serverActions = data.actions || [];
  } catch {}
}

async function refreshServerFeatures() {
  if (!currentUser) return;
  try {
    const data = await api('/api/plugins');
    serverPlugins = data.plugins || serverPlugins;
    serverSkills = data.skills || serverSkills;
    serverAutomations = data.automations || [];
    await refreshServerActions();
  } catch {}
  renderServerPanels();
}

async function serverAuth(mode) {
  const email = Q('#authEmail')?.value.trim();
  const password = Q('#authPass')?.value;
  const name = Q('#authName')?.value.trim() || email?.split('@')[0];
  if (!email || !password) return alert('Enter email and password.');
  try {
    const data = await api(mode === 'register' ? '/api/register' : '/api/login', { email, password, name });
    currentUser = data.user;
    serverOnline = true;
    serverChatsToLocal(data.chats);
    await refreshServerFeatures();
  } catch (error) {
    alert(error.message);
  }
  renderServerPanels();
}

async function serverLogout() {
  await api('/api/logout', {}, 'POST').catch(() => {});
  currentUser = null;
  serverActions = [];
  renderServerPanels();
  updateHint(online || serverOnline);
}

async function requestCheckout(planId) {
  alert('Payments are disabled. This app supports chat only with OpenAI.');
}

async function devUnlock(planId) {
  if (!currentUser) return alert('Log in first.');
  try {
    const data = await api('/api/dev/activate-plan', { plan: planId });
    currentUser = data.user;
    await refreshServerFeatures();
  } catch (error) {
    alert(error.message);
  }
}

function requestPermission(name, scope) {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    scope,
    status: 'needs approval',
    ts: Date.now()
  };
  permissionRequests.unshift(item);
  saveControls();
  renderServerPanels();
}

function updatePermission(id, status) {
  permissionRequests = permissionRequests.map(item => item.id === id ? { ...item, status } : item);
  saveControls();
  renderServerPanels();
}

async function updateServerAction(id, status) {
  if (!id) return;
  try {
    const data = await api('/api/actions', { actionId: id, status });
    serverActions = data.actions || serverActions;
    currentUser = data.user || currentUser;
    renderServerPanels();
  } catch (error) {
    alert(error.message);
  }
}

function requestConnection(name) {
  const clean = String(name || '').trim();
  if (!clean) return;
  connectionRequests.unshift({ id: Date.now().toString(36), name: clean, status: 'permission needed', ts: Date.now() });
  requestPermission(`Connect ${clean}`, `Allow ARIA to prepare a ${clean} connector setup. Credentials are still required before real access.`);
  Q('#connectionIn').value = '';
}

function activeChat() {
  let c = chats.find(c => c.id === activeId);
  if (!c) c = createChat();
  return c;
}
function createChat() {
  const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: 'New chat', ts: Date.now(), msgs: [] };
  chats.unshift(c); activeId = c.id; saveChats(); renderSidebar(); renderChat();
  return c;
}

/* ═══════════════════════════════════════════
   NLP helpers
═══════════════════════════════════════════ */
const STOP = new Set('the a an and or but if this that with from into about what when where who why how for you your are was were been have has had not can will should would could may might there they them their its i me my we our be do did'.split(' '));
const words = t => String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const score = (q, t) => { const qw = words(q), hay = String(t || '').toLowerCase(); return qw.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0); };

function snip(q, text, n = 3) {
  const sents = String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  return sents.map(s => ({ s, sc: score(q, s) })).sort((a, b) => b.sc - a.sc).slice(0, n).map(x => x.s).join(' ') || text.slice(0, 500);
}
function relDocs(q) {
  return [
    ...train.knowledge.map(k => ({ title: k.title, content: k.content })),
    ...Object.entries(train.memories).map(([k, v]) => ({ title: k, content: v.value })),
    ...atts.map(a => ({ title: a.name, content: a.content }))
  ].map(d => ({ ...d, sc: score(q, d.title + ' ' + d.content) })).filter(d => d.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 5);
}
function bestEx(q) {
  return train.examples.map(e => ({ ...e, sc: score(q, e.prompt + ' ' + e.answer) })).filter(e => e.sc > 0).sort((a, b) => b.sc - a.sc)[0] || null;
}

function learnUser(text) {
  if (!train.settings.autoLearn) return;
  const pats = [
    [/my name is\s+([a-z][a-z\s]{1,40})/i, 'user name'],
    [/call me\s+([a-z][a-z\s]{1,40})/i, 'preferred name'],
    [/i (?:am|work as)\s+(?:a|an)?\s*([a-z][a-z\s]{2,60})/i, 'user role'],
    [/i work (?:at|for|on)\s+([a-z0-9][a-z0-9\s.-]{1,60})/i, 'workplace'],
    [/my (?:project|app|product) is\s+([a-z0-9][a-z0-9\s.-]{1,80})/i, 'project'],
    [/remember (?:that\s+)?(.{6,200})/i, 'note']
  ];
  let changed = false;
  for (const [re, key] of pats) {
    const m = text.match(re);
    if (m?.[1]) { train.memories[key] = { value: m[1].trim(), ts: Date.now() }; changed = true; }
  }
  if (changed) saveTrain();
}
function learnPair(u, a) {
  if (!train.settings.autoLearn || u.length < 8 || a.length < 20) return;
  if (train.examples.some(e => e.auto && e.prompt === u)) return;
  train.examples.unshift({ prompt: u, answer: a, ts: Date.now(), auto: true });
  train.examples = [...train.examples.filter(e => !e.auto), ...train.examples.filter(e => e.auto).slice(0, 80)];
  saveTrain();
}

/* ═══════════════════════════════════════════
   System prompt
═══════════════════════════════════════════ */
function buildSys(q) {
  const docs = relDocs(q);
  const ex = bestEx(q);
  const mems = Object.entries(train.memories).slice(0, 12).map(([k, v]) => `- ${k}: ${v.value}`).join('\n') || '(none)';
  const rules = train.rules.slice(0, 8).map(r => `- ${r}`).join('\n') || '(none)';
  const ctx = docs.length ? '\n\n## Relevant knowledge\n' + docs.map(d => `### ${d.title}\n${snip(q, d.content, 2)}`).join('\n\n') : '';
  const exBlk = (ex && ex.sc >= 2) ? `\n\n## Example answer style\nUser: ${ex.prompt}\nARIA: ${ex.answer}` : '';
  return `${train.personality}\n\n## Behavior rules\n${rules}\n\n## What you know about the user\n${mems}${exBlk}${ctx}\n\nRespond directly to the user. Use markdown for code blocks, headers, and lists when it improves clarity. Be thorough when needed, concise when not.`;
}

/* ═══════════════════════════════════════════
   Markdown renderer
═══════════════════════════════════════════ */
function md(raw) {
  let t = String(raw || '');
  const blks = [];
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blks.length; blks.push({ lang, code: code.trimEnd() }); return `\x02B${i}\x03`;
  });
  t = t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  t = t.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  t = t.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  t = t.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  t = t.replace(/(<li>[\s\S]*?<\/li>)/g, m => `<ul>${m}</ul>`);
  t = t.replace(/<\/ul>\s*<ul>/g, '');
  t = '<p>' + t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  t = t.replace(/<p>\s*(<[hbul])/g, '$1').replace(/(<\/[^>]+>)\s*<\/p>/g, '$1');
  t = t.replace(/\x02B(\d+)\x03/g, (_, i) => {
    const { lang, code } = blks[+i];
    const ec = code.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ll = lang ? `<span style="font-size:11px;color:var(--tx3);font-family:var(--fm)">${lang}</span>` : '';
    return `<pre>${ll}<button class="cp-btn" onclick="cpCode(this)">Copy</button><code>${ec}</code></pre>`;
  });
  return t;
}
window.cpCode = btn => {
  navigator.clipboard.writeText(btn.nextElementSibling?.textContent || '').then(() => { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); });
};

function scrollBottom() {
  const a = Q('#chatArea'); if (a) a.scrollTop = a.scrollHeight;
}

// Escape text for display during streaming (no markdown overhead)
function escRaw(t) {
  return String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/\n/g, '<br>');
}

/* ═══════════════════════════════════════════
   Send — real streaming, tokens show instantly
═══════════════════════════════════════════ */
let streamProseEl = null;

function openStreamCard() {
  let inner = Q('#msgsInner');
  if (!inner) {
    Q('#chatArea').innerHTML = '<div class="msgs-inner" id="msgsInner"></div>';
    inner = Q('#msgsInner');
  }
  const div = document.createElement('div');
  div.className = 'msg assistant'; div.id = 'streamCard';
  div.innerHTML = `<div class="av">A</div><div class="mb"><div class="mname">ARIA</div><div class="prose" id="streamProse"><span class="cur">▊</span></div></div>`;
  inner.appendChild(div);
  streamProseEl = Q('#streamProse');
  scrollBottom();
}
function closeStreamCard() { Q('#streamCard')?.remove(); streamProseEl = null; }

async function go(text) {
  text = (text || Q('#msgin').value).trim();
  if (!text || busy) return;
  busy = true;
  Q('#msgin').value = '';
  Q('#msgin').style.height = 'auto';
  Q('#sendBtn').classList.remove('on');

  learnUser(text);
  const chat = activeChat();
  chat.msgs.push({ role: 'user', content: text, ts: Date.now() });
  if (chat.title === 'New chat') { chat.title = text.slice(0, 52); Q('#tbTitle').textContent = chat.title; }
  saveChats(); renderChat(); renderSidebar();

  openStreamCard();
  setStatus('thinking', 'Thinking…');

  if (serverOnline) {
    let final = '';
    try {
      if (streamProseEl) streamProseEl.innerHTML = 'Checking server memory<span class="cur">▊</span>';
      const data = await api('/api/chat', { chatId: chat.id, message: text });
      final = data.answer;
      currentUser = data.user || currentUser;
      serverActions = data.actions || serverActions;
      if (data.action && !serverActions.some(action => action.id === data.action.id)) serverActions.unshift(data.action);
      setStatus('online', `Server · ${data.source || 'memory'}`);
      if (streamProseEl) streamProseEl.innerHTML = md(final);
    } catch (e) {
      serverOnline = false;
      setStatus('error', 'Server offline');
      final = offlineMsg(text);
      if (streamProseEl) streamProseEl.innerHTML = md(final);
    }
    closeStreamCard();
    chat.msgs.push({ role: 'assistant', content: final, ts: Date.now() });
    saveChats();
    learnPair(text, final);
    renderServerPanels();
    updateHint(online || serverOnline);
    atts = []; renderAtts();
    busy = false;
    Q('#sendBtn').classList.toggle('on', !!Q('#msgin').value.trim());
    Q('#msgin').focus();
    renderChat();
    renderSidebar();
    return;
  }

  const final = offlineMsg(text);
  online = false;
  setStatus('error', 'Server offline');
  if (streamProseEl) streamProseEl.innerHTML = md(final);

  closeStreamCard();
  chat.msgs.push({ role: 'assistant', content: final, ts: Date.now() });
  saveChats();
  learnPair(text, final);
  atts = []; renderAtts();
  busy = false;
  Q('#sendBtn').classList.toggle('on', !!Q('#msgin').value.trim());
  Q('#msgin').focus();
  renderChat();
  renderSidebar();
}

function offlineMsg(q) {
  const ex = bestEx(q); if (ex && ex.sc >= 2) return ex.answer;
  const docs = relDocs(q);
  if (docs.length) return `**From ARIA memory:**\n\n${docs.map(d => `**${d.title}**\n${snip(q, d.content, 2)}`).join('\n\n')}\n\n*Start the ARIA server to use cached server knowledge.*`;
  return `**ARIA server is offline.**\n\nStart the server with \`npm start\`. ARIA answers from its own server, uses stored server knowledge, and saves useful answers for future fast replies.`;
}

/* ═══════════════════════════════════════════
   Render — sidebar
═══════════════════════════════════════════ */
function renderSidebar() {
  const root = Q('#sbScroll');
  if (!chats.length) {
    root.innerHTML = '<div style="padding:10px 8px;font-size:13px;color:var(--tx3)">No conversations yet.</div>';
    return;
  }
  const now = Date.now(), D = 86400000;
  const groups = { 'Today': [], 'Yesterday': [], 'Last 7 days': [], 'Older': [] };
  chats.forEach(c => {
    const age = now - (c.ts || 0);
    if (age < D) groups.Today.push(c);
    else if (age < 2 * D) groups.Yesterday.push(c);
    else if (age < 7 * D) groups['Last 7 days'].push(c);
    else groups.Older.push(c);
  });
  let html = '';
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    html += `<div class="sb-label">${label}</div>`;
    html += items.map(c => `
      <button class="chat-row ${c.id===activeId?'on':''}" data-cid="${c.id}">
        ${esc(c.title)}
        <span class="chat-del" data-del="${c.id}" title="Delete">✕</span>
      </button>`).join('');
  }
  root.innerHTML = html;
  delegate(root, '[data-cid], [data-del]', (e, target) => {
    if (target.dataset.del) {
      e.stopPropagation();
      chats = chats.filter(c => c.id !== target.dataset.del);
      if (activeId === target.dataset.del) activeId = chats[0]?.id || null;
      saveChats(); renderSidebar(); renderChat();
      return;
    }
    activeId = target.dataset.cid;
    if (activeId) {
      saveChats(); renderSidebar(); renderChat();
    }
  });
}

/* ═══════════════════════════════════════════
   Render — chat
═══════════════════════════════════════════ */
function renderChat() {
  if (busy) return;
  const chat = activeChat();
  Q('#tbTitle').textContent = chat.title === 'New chat' ? 'ARIA' : chat.title;
  const area = Q('#chatArea');
  if (!chat.msgs.length) {
    area.innerHTML = `
      <div class="welcome">
        <div class="w-icon">A</div>
        <h1>How can I help?</h1>
        <p>ARIA answers from its own server, uses stored knowledge, and saves useful answers for faster future replies.</p>
        <div class="powered">
          <span style="width:7px;height:7px;border-radius:50%;background:${online?'var(--gr)':'var(--tx3)'};display:inline-block;flex-shrink:0"></span>
          ${online ? 'Connected · ARIA Core' : 'Connecting to ARIA server…'}
        </div>
        <div class="starters">
          <button class="starter" data-p="Write a complete responsive landing page in HTML, CSS, and JavaScript with a hero section, features grid, pricing, and contact form.">
            <strong>Build a landing page</strong><span>Full HTML/CSS/JS from scratch</span>
          </button>
          <button class="starter" data-p="Explain how modern AI assistants work — transformers, attention, tokenization, alignment, and text generation.">
            <strong>How do AI models work?</strong><span>Transformers, training, generation</span>
          </button>
          <button class="starter" data-p="Design the full architecture for a SaaS web app: database, backend API, frontend framework, auth system, and AI features to add.">
            <strong>Architect a SaaS app</strong><span>Stack, structure, AI integration</span>
          </button>
          <button class="starter" data-p="Write a Python script that reads a CSV, cleans the data, computes statistics, and exports a formatted report with matplotlib charts.">
            <strong>Python data script</strong><span>CSV, statistics, charts</span>
          </button>
        </div>
      </div>`;
    QQ('.starter').forEach(b => b.addEventListener('click', () => go(b.dataset.p)));
    return;
  }
  const inner = document.createElement('div');
  inner.className = 'msgs-inner'; inner.id = 'msgsInner';
  chat.msgs.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.innerHTML = `
      <div class="av">${m.role==='user'?'U':'A'}</div>
      <div class="mb">
        <div class="mname">${m.role==='user'?'You':'ARIA'}</div>
        <div class="prose">${md(m.content)}</div>
      </div>`;
    inner.appendChild(div);
  });
  area.innerHTML = '';
  area.appendChild(inner);
  scrollBottom();
}

/* Attachments */
function renderAtts() {
  Q('#attBar').innerHTML = atts.map((a, i) => `
    <div class="att-chip">${esc(a.name)}<button data-rma="${i}">✕</button></div>`).join('');
  QQ('[data-rma]').forEach(b => b.addEventListener('click', () => { atts.splice(+b.dataset.rma, 1); renderAtts(); }));
}

function updateHint(isOnline) {
  if (currentUser) {
    Q('#iHint').textContent = `ARIA · ${currentUser.plan?.name || 'Account'} · profile chats saved · server memory on`;
    return;
  }
  Q('#iHint').textContent = isOnline
    ? 'ARIA · connected to own server'
    : 'ARIA · server offline · start npm start';
}

function renderServerPanels() {
  const status = Q('#serverStatus');
  if (status) {
    status.className = `server-pill ${serverOnline ? 'on' : 'off'}`;
    status.textContent = serverOnline ? 'Server connected' : 'ARIA server is offline — start `npm start` or `node server.js`';
  }

  const account = Q('#accountBox');
  if (account) {
    if (currentUser) {
      const sub = currentUser.subscription || {};
      const expires = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : 'Never';
      account.innerHTML = `
        <div class="account-card">
          <strong>${esc(currentUser.name || currentUser.email)}</strong>
          <div class="meta-line">${esc(currentUser.email)} · ${esc(currentUser.plan?.name || 'Free')}</div>
          <div class="meta-line">Messages: ${currentUser.usage?.messages || 0}/${currentUser.plan?.messageLimit || 0} · Searches: ${currentUser.usage?.webSearches || 0}/${currentUser.plan?.webSearches || 0}</div>
          <div class="meta-line">Subscription expires: ${esc(expires)}</div>
          <div class="auth-actions"><button class="add-btn" id="logoutBtn">Log out</button></div>
        </div>`;
      Q('#logoutBtn')?.addEventListener('click', serverLogout);
    } else {
      account.innerHTML = `
        <div class="account-card">
          <strong>Create your ARIA profile</strong>
          <div class="meta-line">Profile chats, subscription, training preference, and server memory stay on your account.</div>
          <div class="auth-row">
            <input class="f-in" id="authName" placeholder="Name">
            <input class="f-in" id="authEmail" placeholder="Email">
          </div>
          <input class="f-in mt-8" id="authPass" placeholder="Password" type="password" title="Password" aria-label="Password">
          <div class="auth-actions">
            <button class="add-btn" id="registerBtn">Sign up</button>
            <button class="add-btn" id="loginBtn">Log in</button>
          </div>
        </div>`;
      Q('#registerBtn')?.addEventListener('click', () => serverAuth('register'));
      Q('#loginBtn')?.addEventListener('click', () => serverAuth('login'));
    }
  }

  const pricing = Q('#pricingBox');
  if (pricing) {
    const plans = Object.values(serverPlans || {});
    pricing.innerHTML = (plans.length ? plans : [
      { id: 'free', name: 'Free', price: 0, features: ['Basic chat'] },
      { id: 'pro', name: 'Pro', price: 20, features: ['Profile chats', 'Plugins', 'Skills'] },
      { id: 'max5', name: 'Max 5x', price: 100, features: ['Coding workspace', 'Automations'] },
      { id: 'max20', name: 'Max 20x', price: 200, features: ['Highest limits', 'Premium connectors'] }
    ]).map(plan => `
      <div class="pricing-card">
        <strong>${esc(plan.name)}</strong>
        <div class="plan-price">${plan.price ? '$' + plan.price : 'Free'}<span class="meta-line"> / month</span></div>
        <div class="meta-line">${(plan.features || []).map(esc).join(' · ')}</div>
        ${plan.id === 'free'
          ? '<button class="add-btn" disabled>Included</button>'
          : '<button class="add-btn" disabled>Not available</button>'}
      </div>`).join('');
  }

  const permissions = Q('#permissionsBox');
  if (permissions) {
    const serverCards = serverActions.map(action => `
      <div class="account-card">
        <strong>${esc(action.title || 'ARIA action')}</strong>
        <div class="meta-line">${esc(action.summary || action.requestedText || '')}</div>
        <div class="meta-line">Status: ${esc(action.status || 'needs approval')}</div>
        ${action.status === 'needs approval' ? `
          <div class="auth-actions">
            <button class="add-btn" data-action-approve="${esc(action.id)}">Approve</button>
            <button class="add-btn" data-action-deny="${esc(action.id)}">Deny</button>
          </div>` : ''}
      </div>`).join('');
    const localCards = permissionRequests.map(item => `
      <div class="account-card">
        <strong>${esc(item.name)}</strong>
        <div class="meta-line">${esc(item.scope)}</div>
        <div class="meta-line">Status: ${esc(item.status)}</div>
        <div class="auth-actions">
          <button class="add-btn" data-approve="${esc(item.id)}">Approve</button>
          <button class="add-btn" data-deny="${esc(item.id)}">Deny</button>
        </div>
      </div>`).join('');
    permissions.innerHTML = serverCards + localCards || '<div class="meta-line">No pending permissions.</div>';
  }

  const settingsRoot = Q('#settingsOv');
  if (settingsRoot) {
    delegate(settingsRoot, '[data-action-approve], [data-action-deny], [data-approve], [data-deny], [data-checkout], [data-devunlock]', (e, target) => {
      if (target.dataset.checkout) return requestCheckout(target.dataset.checkout);
      if (target.dataset.devunlock) return devUnlock(target.dataset.devunlock);
      if (target.dataset.actionApprove) return updateServerAction(target.dataset.actionApprove, 'approved');
      if (target.dataset.actionDeny) return updateServerAction(target.dataset.actionDeny, 'denied');
      if (target.dataset.approve) return updatePermission(target.dataset.approve, 'approved');
      if (target.dataset.deny) return updatePermission(target.dataset.deny, 'denied');
    });
  }

  const features = Q('#featuresBox');
  if (features) {
    const rows = [
      ...serverPlugins.map(p => ({ name: p.name, desc: p.description, unlocked: p.unlocked ?? true, plan: p.plan })),
      ...serverSkills.map(s => ({ name: s.name, desc: 'Skill module', unlocked: s.unlocked ?? true, plan: s.plan })),
      { name: 'Automations', desc: `${serverAutomations.length} active automation(s)`, unlocked: !!currentUser?.enabledFeatures?.automations, plan: 'max5' }
    ];
    features.innerHTML = rows.map(item => `
      <div class="feature-card ${item.unlocked ? '' : 'locked'}">
        <strong>${esc(item.name)}</strong>
        <div class="meta-line">${esc(item.desc || '')}</div>
        <div class="meta-line">${item.unlocked ? 'Unlocked' : 'Requires ' + esc(item.plan)}</div>
      </div>`).join('');
  }

  const connections = Q('#connectionsBox');
  if (connections) {
    const base = [
      { name: 'GitHub', desc: 'Repositories, pull requests, code review' },
      { name: 'Vercel', desc: 'Deployments, environment variables, logs' },
      { name: 'Google Drive', desc: 'Docs and files selected by you' },
      { name: 'Slack', desc: 'Notifications and team updates' },
      { name: 'Notion', desc: 'Pages, notes, and project databases' },
      { name: 'Custom API', desc: 'Your own tools and private services' }
    ];
    const requested = new Set(connectionRequests.map(item => item.name.toLowerCase()));
    connections.innerHTML = base.map(item => `
      <div class="feature-card ${requested.has(item.name.toLowerCase()) ? '' : 'locked'}">
        <strong>${esc(item.name)}</strong>
        <div class="meta-line">${esc(item.desc)}</div>
        <div class="meta-line">${requested.has(item.name.toLowerCase()) ? 'Permission requested' : 'Ask permission to connect'}</div>
      </div>`).join('');
  }

  const permissions = Q('#permissionsBox');
  if (permissions) {
    const serverCards = serverActions.map(action => `
      <div class="account-card">
        <strong>${esc(action.title || 'ARIA action')}</strong>
        <div class="meta-line">${esc(action.summary || action.requestedText || '')}</div>
        <div class="meta-line">Status: ${esc(action.status || 'needs approval')}</div>
        ${action.status === 'needs approval' ? `
          <div class="auth-actions">
            <button class="add-btn" data-action-approve="${esc(action.id)}">Approve</button>
            <button class="add-btn" data-action-deny="${esc(action.id)}">Deny</button>
          </div>` : ''}
      </div>`).join('');
    const localCards = permissionRequests.map(item => `
      <div class="account-card">
        <strong>${esc(item.name)}</strong>
        <div class="meta-line">${esc(item.scope)}</div>
        <div class="meta-line">Status: ${esc(item.status)}</div>
        <div class="auth-actions">
          <button class="add-btn" data-approve="${esc(item.id)}">Approve</button>
          <button class="add-btn" data-deny="${esc(item.id)}">Deny</button>
        </div>
      </div>`).join('');
    permissions.innerHTML = serverCards + localCards || '<div class="meta-line">No pending permissions.</div>';
  }
}

/* Settings */
function renderSettings() {
  renderServerPanels();
  Q('#persFld').value = train.personality;
  Q('#autoLearn').checked = !!train.settings.autoLearn;
  Q('#rulesTags').innerHTML = train.rules.map((r, i) => `<div class="tag">${esc(r)}<button data-dr="${i}">✕</button></div>`).join('');
  QQ('[data-dr]').forEach(b => b.addEventListener('click', () => { train.rules.splice(+b.dataset.dr, 1); saveTrain(); renderSettings(); }));
  Q('#kbTags').innerHTML = train.knowledge.map((k, i) => `<div class="tag">${esc(k.title)}<button data-dk="${i}">✕</button></div>`).join('');
  QQ('[data-dk]').forEach(b => b.addEventListener('click', () => { train.knowledge.splice(+b.dataset.dk, 1); saveTrain(); renderSettings(); }));
}

/* Export */
function exportChat() {
  const chat = activeChat(); if (!chat.msgs.length) return;
  const content = chat.msgs.map(m => `## ${m.role==='user'?'You':'ARIA'}\n\n${m.content}`).join('\n\n---\n\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'text/markdown' })),
    download: `aria-${new Date().toISOString().slice(0, 10)}.md`
  }); a.click();
}

/* ═══════════════════════════════════════════
   Sidebar toggle
═══════════════════════════════════════════ */
let sbOpen = window.innerWidth > 720;
function setSB(open) {
  sbOpen = open;
  const sb = Q('#sidebar'), bk = Q('#sbBack');
  if (window.innerWidth <= 720) {
    sb?.classList.toggle('open', open);
    sb?.classList.remove('closed');
    bk?.classList.toggle('show', open);
  } else {
    sb?.classList.toggle('closed', !open);
    bk?.classList.remove('show');
  }
}
const closeOv = sel => Q(sel)?.classList.remove('open');

/* ═══════════════════════════════════════════
   Wire
═══════════════════════════════════════════ */
function boot() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem(K.theme) || 'light');
  setSB(sbOpen);

  on('#menuBtn', 'click', () => setSB(!sbOpen));
  on('#sbBack', 'click', () => setSB(false));
  on('#newBtn', 'click', () => { createChat(); if (window.innerWidth <= 720) setSB(false); });

  const inp = Q('#msgin');
  const sendBtn = Q('#sendBtn');
  if (inp) {
    inp.addEventListener('input', e => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
      sendBtn?.classList.toggle('on', !!e.target.value.trim() && !busy);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); }
      if (e.key === 'Escape') { e.target.value = ''; e.target.style.height = 'auto'; sendBtn?.classList.remove('on'); }
    });
  }
  sendBtn?.addEventListener('click', go);

  on('#fileIn', 'change', async e => {
    for (const f of e.target.files) { const text = await f.text(); atts.push({ name: f.name, content: text.slice(0, 22000) }); }
    renderAtts(); e.target.value = '';
  });

  on('#themeBtn', 'click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); localStorage.setItem(K.theme, next);
  });
  on('#clearBtn', 'click', () => { activeChat().msgs = []; saveChats(); renderChat(); });
  on('#exportBtn', 'click', exportChat);

  on('#settingsBtn', 'click', () => { renderSettings(); Q('#settingsOv')?.classList.add('open'); });
  on('#closeSettings', 'click', () => closeOv('#settingsOv'));
  on('#settingsOv', 'click', e => { if (e.target === Q('#settingsOv')) closeOv('#settingsOv'); });

  on('#persFld', 'input', e => { train.personality = e.target.value; saveTrain(); });
  on('#autoLearn', 'change', e => {
    train.settings.autoLearn = e.target.checked;
    saveTrain();
    if (currentUser) api('/api/settings', { settings: { trainFromChats: e.target.checked } }).then(d => { currentUser = d.user || currentUser; }).catch(() => {});
  });
  on('#addRule', 'click', () => {
    const v = Q('#ruleIn').value.trim(); if (!v) return;
    train.rules.push(v); Q('#ruleIn').value = ''; saveTrain(); renderSettings();
  });
  on('#ruleIn', 'keydown', e => { if (e.key === 'Enter') Q('#addRule')?.click(); });
  on('#addKb', 'click', () => {
    const title = Q('#kbTitle').value.trim(), content = Q('#kbText').value.trim();
    if (!title || !content) return;
    train.knowledge.push({ title, content, ts: Date.now() });
    Q('#kbTitle').value = ''; Q('#kbText').value = ''; saveTrain(); renderSettings();
  });
  on('#addConnection', 'click', () => requestConnection(Q('#connectionIn').value));
  on('#connectionIn', 'keydown', e => { if (e.key === 'Enter') Q('#addConnection')?.click(); });
  on('#addEx', 'click', () => {
    const prompt = Q('#exQ').value.trim(), answer = Q('#exA').value.trim();
    if (!prompt || !answer) return;
    train.examples.unshift({ prompt, answer, ts: Date.now() });
    Q('#exQ').value = ''; Q('#exA').value = ''; saveTrain();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOv('#settingsOv'); });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
      Q('#sbBack')?.classList.remove('show');
      Q('#sidebar')?.classList.remove('open');
    }
  });
}

window.addEventListener('error', event => {
  console.error('ARIA runtime error', event.error || event.message, event.filename, event.lineno, event.colno);
  setStatus('error', 'Client error');
});

/* ═══════════════════════════════════════════
   Init — auto-connect on load like Jarvis
═══════════════════════════════════════════ */
if (!chats.length) createChat();
if (!chats.find(c => c.id === activeId)) activeId = chats[0].id;
boot();
renderSidebar();
renderChat();
bootServerProfile();
checkOnline();
Q('#msgin')?.focus();

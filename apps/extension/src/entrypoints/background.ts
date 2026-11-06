export default defineBackground(() => {
const DEFAULT_API = 'https://jarvisv02.vercel.app/api/chat';
// The rules travel inside the message too, so the agent works even if the website's api/chat.js is an older version.
const STEP_RULES = 'You are JARVIS, a browser agent made by Yash Raj. Think like an expert operator. 1) OBSERVE: where am I, and what changed since my last action (see lastResult; READ: means text I asked to read)? 2) REASON: which single action moves me closest to the goal and the plan success criteria? 3) ACT with ONE action. 4) Next turn VERIFY. If nothing changed or an element was missing, try a different element, scroll, navigate to a more direct URL, or ask - never repeat the same action more than twice. Use playbook tips for this site, imitate successful examples when similar, strictly obey lessons (past mistakes), and use userFacts to personalise. Prefer the shortest path and direct URLs. Prefer reversible actions; use ask before anything irreversible (paying, sending, deleting, posting). Never type into password or payment fields; if a login is needed use ask. Reply with ONLY one JSON object, no other text: {"thought":"one short sentence of reasoning","say":"short sentence for the user","action":"click|type|select|key|read|wait|back|navigate|scroll|ask|done","id":<element id>,"text":"","key":"Enter","seconds":2,"submit":false,"url":"","dir":"down|up"}. Use read to get page text beyond the excerpt, select for dropdowns (text = option), key for Enter/Escape/Tab/ArrowDown. When the goal is complete use done and put the result or answer in say.\n\nPAGE STATE:\n';
const PLAN_RULES = 'You are the strategic planner of JARVIS, a browser agent. Reply with ONLY one JSON object: {"understanding":"what the user really wants","steps":["3 to 6 short concrete steps"],"success":"how to verify it is done","risks":"what could block us and the fallback"}. Use the page info provided.\n\nINPUT:\n';
const withRules = (ms, phase) => ms.map((m, i) => i === ms.length - 1 ? { ...m, content: (phase === 'plan' ? PLAN_RULES : STEP_RULES) + m.content } : m);
async function ask(messages, phase) {
  const settings = await chrome.storage.local.get(['apiUrl', 'brain']) as Record<string, unknown>;
  const apiUrl = typeof settings.apiUrl === 'string' ? settings.apiUrl : DEFAULT_API;
  const brain = typeof settings.brain === 'string' ? settings.brain : 'fast';
  try {
    const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'agent', smart: phase === 'plan' || brain === 'smart', messages: withRules(messages, phase) }) });
    const t = await r.text();
    if (!r.ok) { let e = t; try { e = JSON.parse(t).error; } catch {} return { error: e }; }
    return { text: t };
  } catch (e) { return { error: e.message }; }
}
chrome.runtime.onMessage.addListener((m, s, send) => {
  if (m.type === 'tabId') { send(s.tab && s.tab.id); return; }
  if (m.type === 'nav' && s.tab && /^https?:\/\//i.test(m.url)) { chrome.tabs.update(s.tab.id, { url: m.url }); send(true); return; }
  if (m.type === 'tabs') { tabsOp(m, s).then(send); return true; }
  if (m.type === 'say') { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'say', text: m.text })); send(true); return; }
  if (m.type === 'ask') { ask(m.messages, m.phase).then(send); return true; }
});
// The orb "flies in" whenever you switch to a tab.
const inject = id => chrome.scripting.executeScript({ target: { tabId: id }, files: ['content-scripts/content.js'] }).catch(() => {});
chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.sendMessage(tabId, { type: 'activated' }).catch(() => inject(tabId)));
chrome.runtime.onInstalled.addListener(async () => { for (const t of await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })) inject(t.id); });
async function tabsOp(m, s) {
  const all = await chrome.tabs.query({ currentWindow: true }), cur = all.findIndex(t => t.id === s.tab.id);
  if (m.op === 'next' || m.op === 'prev') { const t = all[(cur + (m.op === 'next' ? 1 : all.length - 1)) % all.length]; await chrome.tabs.update(t.id, { active: true }); return { say: 'Switched to ' + (t.title || t.url) }; }
  if (m.op === 'switch') { const q = String(m.q || '').toLowerCase(), i = /^\d+$/.test(q) ? Number(q) - 1 : -1; const t = i >= 0 ? all[i] : all.find(x => ((x.title || '') + ' ' + (x.url || '')).toLowerCase().includes(q)); if (!t) return { say: 'No tab matches "' + m.q + '".' }; await chrome.tabs.update(t.id, { active: true }); return { say: 'Switched to ' + t.title }; }
  if (m.op === 'new') { await chrome.tabs.create({ url: m.url && /^https?:\/\//i.test(m.url) ? m.url : undefined }); return { say: 'Opened a new tab.' }; }
  if (m.op === 'close') { chrome.tabs.remove(s.tab.id); return { say: 'Closing this tab.' }; }
  const me = all[cur];
  if (m.op === 'dup') { await chrome.tabs.duplicate(me.id); return { say: 'Duplicated this tab.' }; }
  if (m.op === 'pin') { await chrome.tabs.update(me.id, { pinned: !me.pinned }); return { say: me.pinned ? 'Unpinned.' : 'Pinned.' }; }
  if (m.op === 'mute') { const muted = !(me.mutedInfo && me.mutedInfo.muted); await chrome.tabs.update(me.id, { muted }); return { say: muted ? 'Tab muted.' : 'Tab unmuted.' }; }
  if (m.op === 'others') { await chrome.tabs.remove(all.filter(t => t.id !== me.id && !t.pinned).map(t => t.id)); return { say: 'Closed the other tabs.' }; }
  if (m.op === 'window') { await chrome.windows.create({}); return { say: 'New window.' }; }
  if (m.op === 'reopen') { try { await chrome.sessions.restore(); return { say: 'Reopened your last closed tab.' }; } catch { return { say: 'Nothing to reopen.' }; } }
  if (m.op === 'list') return { say: all.map((t, i) => (i + 1) + '. ' + t.title).join('\n') };
  return { say: 'Unknown tab command.' };
}

// ---- link to JARVIS Desktop (runs on your computer, hears you outside the browser, speaks in a natural voice) ----
let ws = null;
function connectDesktop() {
  try {
    ws = new WebSocket('ws://127.0.0.1:8765');
    ws.onopen = () => { chrome.storage.local.set({ companion: true }); ws.send(JSON.stringify({ type: 'hello' })); };
    ws.onmessage = async e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type !== 'command') return;
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!t) return;
      const send = () => chrome.tabs.sendMessage(t.id, { type: 'command', text: m.text });
      send().catch(async () => { await inject(t.id); setTimeout(() => send().catch(() => {}), 900); });
    };
    ws.onclose = ws.onerror = () => { chrome.storage.local.set({ companion: false }); ws = null; };
  } catch { ws = null; }
}
setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"type":"ping"}'); else if (!ws || ws.readyState > 1) connectDesktop(); }, 5000);   // also keeps the service worker awake while linked
connectDesktop();
chrome.runtime.onStartup.addListener(connectDesktop);

});

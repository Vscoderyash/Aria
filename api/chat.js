// POST /api/chat { messages:[{role,content}] } -> streamed plain text
const PREFERRED = ['meta/llama-3.3-70b-instruct','meta/llama-3.1-70b-instruct','nvidia/llama-3.3-nemotron-super-49b-v1.5','mistralai/mistral-large-2-instruct','qwen/qwen2.5-coder-32b-instruct','meta/llama-3.1-8b-instruct'];
const BASE = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const SYSTEM = `You are JARVIS (Just A Rather Very Intelligent System), a witty, loyal AI assistant and expert software engineer. You were created by Yash Raj. If asked who made, created, built or trained you, answer: Yash Raj. If asked who you are, say you are JARVIS, an AI assistant created by Yash Raj that writes code, debugs, explains and plans projects. Never name Meta, NVIDIA, OpenAI, Google or Mistral as your creator; if asked about the underlying model, say you run on a language model served through NVIDIA's API and know nothing more.
When writing code, put EVERY file in its own fenced block labelled with language and path, e.g. \`\`\`js src/app.js. For multi-file projects, list the file tree first, then give each file complete (no placeholders). If more files remain, end with "Say 'continue' for the next files." Otherwise keep answers concise, in Markdown.`;
const AGENT = `You are JARVIS, a browser agent created by Yash Raj. Each message is JSON: {goal,url,title,text,elements:[{id,tag,type,label,href,onScreen}],history}. Reply with ONLY one JSON object: {"say":"one short sentence for the user","action":"click|type|navigate|scroll|ask|done","id":<element id>,"text":"<text to type>","submit":<true to press Enter after typing>,"url":"<full https url>","dir":"down|up"}.
Rules: one action per reply. To open a site use navigate with a full https URL (for searches use e.g. https://www.google.com/search?q=...). Use element ids from the list only. Never type into password, card or other secret fields. If a login or any information from the user is needed, use ask and tell them what to do. When the goal is complete use done and summarise what you found. If the same step keeps failing, use done and explain.`;
const hits = new Map();
let cache = { at: 0, ids: null };
async function liveModels(key) {
  if (cache.ids && Date.now() - cache.at < 6e5) return cache.ids;
  try {
    const r = await fetch(BASE + '/models', { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(6000) });
    if (r.ok) { const ids = new Set(((await r.json()).data || []).map(m => m.id)); if (ids.size) return (cache = { at: Date.now(), ids }).ids; }
  } catch {}
  return null;
}
function pick(live, agent, smart) {
  const want = [...new Set([process.env.NVIDIA_MODEL, ...(agent && !smart ? ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct'] : []), ...PREFERRED].filter(Boolean))];
  if (!live) return want.slice(0, 6);
  const present = want.filter(m => live.has(m));
  const generic = [...live].filter(id => !present.includes(id) && /(instruct|chat|it$)/i.test(id) && /(llama|mistral|qwen|nemotron|gemma|phi|deepseek|granite)/i.test(id) && !/(embed|vision|vl|guard|reward|safety|rerank|parse|base|nv-)/i.test(id)).sort((a, b) => /llama-3/i.test(b) - /llama-3/i.test(a));
  return [...present, ...generic, ...want.filter(m => !live.has(m))].slice(0, 8);
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return res.status(500).json({ error: 'NVIDIA_API_KEY is not set on the server.' });
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim(), now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 6e4);
  if (recent.length >= 60) return res.status(429).json({ error: 'Slow down a little - try again in a minute.' });
  hits.set(ip, [...recent, now]);
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const messages = (Array.isArray(body && body.messages) ? body.messages : []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  const raw = Boolean(body && body.mode === 'raw' && typeof body.system === 'string'), agent = Boolean(body && body.mode === 'agent') || raw;
  if (!messages.length) return res.status(400).json({ error: 'No message.' });
  const errors = [], deadline = Date.now() + 26000;
  for (const model of pick(await liveModels(key), agent, Boolean(body && body.smart))) {
    const left = deadline - Date.now(); if (left < 3000) { errors.push('ran out of time'); break; }
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), Math.min(left, 14000));
      const r = await fetch(BASE + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: raw ? String(body.system).slice(0, 6000) : agent ? AGENT : SYSTEM }, ...messages], temperature: agent ? 0.2 : 0.5, max_tokens: agent ? 500 : 3500, stream: true }), signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) { errors.push(model + ' returned ' + r.status); if (r.status === 401 || r.status === 403) { cache = { at: 0, ids: null }; break; } continue; }
      res.status(200); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('X-Model', model);
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', wrote = false;
      try {
        for (;;) {
          const { done, value } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
            try { const d = JSON.parse(line.slice(5)).choices[0].delta.content; if (d) { res.write(d); wrote = true; } } catch {}
          }
        }
      } catch (e) { if (wrote) { res.write('\n\n[connection interrupted]'); return res.end(); } errors.push(model + ': ' + e.message); continue; }
      if (wrote) return res.end();
      errors.push(model + ': empty reply');
    } catch (e) { errors.push(model + ': ' + e.message); }
  }
  res.status(502).json({ error: 'NVIDIA API failed (' + errors.join('; ') + ')' });
};

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'aria-db.json');

loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 5000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'aria-dev-secret';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').trim();
  }
}

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    periodDays: 0,
    messageLimit: 40,
    webSearches: 5,
    features: ['Basic chat', 'Local memory', 'Limited knowledge cache']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 20,
    periodDays: 30,
    messageLimit: 600,
    webSearches: 100,
    features: ['Persistent profile chats', 'Web knowledge cache', 'Plugins', 'Skills', 'Projects']
  },
  max5: {
    id: 'max5',
    name: 'Max 5x',
    price: 100,
    periodDays: 30,
    messageLimit: 3000,
    webSearches: 600,
    features: ['Higher limits', 'Coding workspace', 'Automations', 'Priority knowledge cache']
  },
  max20: {
    id: 'max20',
    name: 'Max 20x',
    price: 200,
    periodDays: 30,
    messageLimit: 12000,
    webSearches: 2000,
    features: ['Highest limits', 'Advanced automations', 'Team-ready workspace', 'Premium connectors']
  }
};

const PLUGINS = [
  { id: 'web-knowledge', name: 'Web Knowledge', plan: 'free', enabled: true, description: 'Searches web sources when local knowledge is missing, then caches answers.' },
  { id: 'coder', name: 'Coder Workspace', plan: 'max5', enabled: true, description: 'Code planning, file reasoning, and implementation workflows.' },
  { id: 'designer', name: 'Design Studio', plan: 'pro', enabled: true, description: 'UI critique, layout planning, and component design.' },
  { id: 'automation', name: 'Automations', plan: 'max5', enabled: true, description: 'Scheduled follow-ups, monitors, reminders, and repeat checks.' },
  { id: 'connectors', name: 'Connections', plan: 'pro', enabled: false, description: 'Connect Google, GitHub, Vercel, Drive, Slack, and custom tools after credentials are configured.' }
];

const SKILLS = [
  { id: 'code-review', name: 'Code Review', plan: 'pro' },
  { id: 'ui-design', name: 'UI Design', plan: 'pro' },
  { id: 'research', name: 'Research Briefs', plan: 'free' },
  { id: 'agentic-coding', name: 'Agentic Coding', plan: 'max5' },
  { id: 'workflow-automation', name: 'Workflow Automation', plan: 'max5' }
];

const defaultDb = () => ({
  users: [],
  sessions: {},
  knowledge: [],
  training: [],
  automations: [],
  payments: [],
  createdAt: new Date().toISOString()
});

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb(defaultDb());
}
function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  return hashPassword(password, salt).split(':')[1] === hash;
}
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}
function makeToken() {
  const raw = id('sess');
  return `${raw}.${sign(raw)}`;
}
function verifyToken(token) {
  const [raw, sig] = String(token || '').split('.');
  if (!raw || !sig) return null;
  return sign(raw) === sig ? raw : null;
}
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const [k, ...rest] = part.trim().split('=');
    return [k, decodeURIComponent(rest.join('='))];
  }));
}
function send(res, status, body, headers = {}) {
  const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': data.length,
    ...headers
  });
  res.end(data);
}
function json(res, status, body, headers = {}) {
  send(res, status, body, headers);
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
  });
}
function publicUser(user) {
  const plan = getPlan(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    subscription: user.subscription,
    plan,
    usage: user.usage || { messages: 0, webSearches: 0 },
    enabledFeatures: featuresForPlan(plan.id)
  };
}
function planRank(planId) {
  return ['free', 'pro', 'max5', 'max20'].indexOf(planId);
}
function getPlan(user) {
  const sub = user.subscription || { plan: 'free' };
  if (sub.expiresAt && Date.now() > new Date(sub.expiresAt).getTime()) return PLANS.free;
  return PLANS[sub.plan] || PLANS.free;
}
function featuresForPlan(planId) {
  return {
    plugins: PLUGINS.filter(p => planRank(planId) >= planRank(p.plan)),
    skills: SKILLS.filter(s => planRank(planId) >= planRank(s.plan)),
    automations: planRank(planId) >= planRank('max5'),
    webKnowledge: planRank(planId) >= planRank('free'),
    codingWorkspace: planRank(planId) >= planRank('max5')
  };
}
function currentUser(req, db) {
  const raw = verifyToken(parseCookies(req).aria_session);
  const userId = raw && db.sessions[raw];
  return userId ? db.users.find(u => u.id === userId) : null;
}
function authRequired(req, res, db) {
  const user = currentUser(req, db);
  if (!user) json(res, 401, { error: 'Login required' });
  return user;
}
function normalizeQuestion(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}
function score(query, text) {
  const words = normalizeQuestion(query).split(' ').filter(w => w.length > 2);
  const hay = normalizeQuestion(text);
  return words.reduce((sum, w) => sum + (hay.includes(w) ? 1 : 0), 0);
}
function findKnowledge(db, user, message) {
  const key = normalizeQuestion(message);
  return db.knowledge
    .filter(k => k.ownerId === user.id || k.shared)
    .map(k => ({ ...k, score: Math.max(score(key, k.question), score(key, k.answer), score(key, k.type || '')) }))
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}
async function webKnowledge(message) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    return {
      source: 'local-fallback',
      answer: 'Web search is ready but not configured. Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to enable Google Custom Search.',
      links: []
    };
  }
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', message);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Google search failed: ${response.status}`);
  const data = await response.json();
  const items = (data.items || []).slice(0, 5);
  return {
    source: 'google-custom-search',
    answer: items.map((item, index) => `${index + 1}. ${item.title}: ${item.snippet}`).join('\n'),
    links: items.map(item => ({ title: item.title, url: item.link }))
  };
}
function localReply(message, hit, user) {
  const plan = getPlan(user);
  if (hit) {
    return `I found this in my saved knowledge, so I can answer faster without searching again.\n\n${hit.answer}`;
  }
  if (/\b(code|build|html|css|javascript|debug|component|app|website)\b/i.test(message)) {
    return `I can help code it.\n\nPlan:\n1. Understand exactly what you want.\n2. Break it into files, UI, state, and behavior.\n3. Write the full implementation.\n4. Keep it clean, responsive, and testable.\n\nYour current plan is ${plan.name}. Coding workspace features unlock on Max 5x and above.`;
  }
  if (/\b(design|ui|ux|screen|layout|claude|chatgpt)\b/i.test(message)) {
    return `I can design it like a clean Claude + ChatGPT style product.\n\nI will focus on:\n- simple chat-first layout\n- quiet side navigation\n- clear memory/settings panel\n- responsive spacing\n- strong code/design action buttons\n\nTell me the exact page or component and I will draft the UI structure.`;
  }
  return `I understand. Ask me naturally and I will reply here.\n\nI can help with code, design, planning, debugging, writing, and research. If I learn a useful answer, I will save it to your profile so next time I can respond faster without searching.`;
}
async function handleChat(db, user, body) {
  const message = String(body.message || '').trim();
  if (!message) return { error: 'Message required' };
  const plan = getPlan(user);
  user.usage = user.usage || { messages: 0, webSearches: 0 };
  if (user.usage.messages >= plan.messageLimit) {
    return { error: `Message limit reached for ${plan.name}. Upgrade to continue.` };
  }
  user.usage.messages += 1;

  const chatId = body.chatId || id('chat');
  let chat = user.chats.find(c => c.id === chatId);
  if (!chat) {
    chat = { id: chatId, title: message.slice(0, 60), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    user.chats.unshift(chat);
  }
  chat.messages.push({ role: 'user', content: message, ts: Date.now() });

  let hit = findKnowledge(db, user, message);
  let answer = localReply(message, hit, user);
  let source = hit ? 'knowledge-cache' : 'local';
  let links = [];

  if (!hit && body.useWeb !== false && user.usage.webSearches < plan.webSearches) {
    try {
      const web = await webKnowledge(message);
      user.usage.webSearches += 1;
      source = web.source;
      links = web.links;
      if (web.source !== 'local-fallback') {
        answer = `I checked web knowledge and saved this for faster future answers.\n\n${web.answer}`;
        db.knowledge.unshift({
          id: id('know'),
          ownerId: user.id,
          question: normalizeQuestion(message),
          type: /code|design|ui|app|debug/i.test(message) ? 'build' : 'general',
          answer,
          links,
          shared: false,
          createdAt: new Date().toISOString(),
          hits: 0
        });
      }
    } catch (error) {
      answer += `\n\nWeb knowledge failed safely: ${error.message}`;
    }
  }

  chat.messages.push({ role: 'assistant', content: answer, ts: Date.now(), source, links });
  chat.updatedAt = new Date().toISOString();

  if (user.settings.trainFromChats !== false) {
    db.training.unshift({
      id: id('train'),
      userId: user.id,
      question: normalizeQuestion(message),
      answer,
      source,
      createdAt: new Date().toISOString()
    });
  }
  return { chat, answer, source, links, user: publicUser(user) };
}
function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const file = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const safePath = path.normalize(path.join(ROOT, file));
  if (!safePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) return send(res, 404, 'Not found');
  const ext = path.extname(safePath).toLowerCase();
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  }[ext] || 'application/octet-stream';
  const data = fs.readFileSync(safePath);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(data);
}

async function route(req, res) {
  const db = readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, plans: PLANS });
    if (url.pathname === '/api/plans') return json(res, 200, { plans: PLANS, plugins: PLUGINS, skills: SKILLS });
    if (url.pathname === '/api/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || email.split('@')[0] || 'Aria User').trim();
      if (!email || password.length < 6) return json(res, 400, { error: 'Email and 6+ character password required' });
      if (db.users.some(u => u.email === email)) return json(res, 409, { error: 'Account already exists' });
      const user = {
        id: id('user'),
        email,
        name,
        passwordHash: hashPassword(password),
        subscription: { plan: 'free', status: 'active', startedAt: new Date().toISOString(), expiresAt: null },
        settings: { trainFromChats: true },
        usage: { messages: 0, webSearches: 0 },
        chats: [],
        connections: [],
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      const token = makeToken();
      db.sessions[token.split('.')[0]] = user.id;
      writeDb(db);
      return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': `aria_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const user = db.users.find(u => u.email === String(body.email || '').trim().toLowerCase());
      if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) return json(res, 401, { error: 'Invalid login' });
      const token = makeToken();
      db.sessions[token.split('.')[0]] = user.id;
      writeDb(db);
      return json(res, 200, { user: publicUser(user), chats: user.chats }, { 'Set-Cookie': `aria_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      const raw = verifyToken(parseCookies(req).aria_session);
      if (raw) delete db.sessions[raw];
      writeDb(db);
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'aria_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' });
    }
    if (url.pathname === '/api/me') {
      const user = currentUser(req, db);
      return json(res, 200, { user: user ? publicUser(user) : null, chats: user ? user.chats : [] });
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const user = authRequired(req, res, db);
      if (!user) return;
      const body = await parseBody(req);
      const result = await handleChat(db, user, body);
      writeDb(db);
      return json(res, result.error ? 400 : 200, result);
    }
    if (url.pathname === '/api/chats') {
      const user = authRequired(req, res, db);
      if (!user) return;
      return json(res, 200, { chats: user.chats });
    }
    if (url.pathname === '/api/settings' && req.method === 'POST') {
      const user = authRequired(req, res, db);
      if (!user) return;
      const body = await parseBody(req);
      user.settings = { ...user.settings, ...body.settings };
      writeDb(db);
      return json(res, 200, { user: publicUser(user) });
    }
    if (url.pathname === '/api/checkout' && req.method === 'POST') {
      const user = authRequired(req, res, db);
      if (!user) return;
      const body = await parseBody(req);
      const plan = PLANS[body.plan];
      if (!plan || plan.id === 'free') return json(res, 400, { error: 'Paid plan required' });
      const payment = { id: id('pay'), userId: user.id, plan: plan.id, status: 'requires_provider', amount: plan.price, createdAt: new Date().toISOString() };
      db.payments.push(payment);
      writeDb(db);
      return json(res, 200, {
        payment,
        message: 'Payment provider not configured yet. Connect Stripe or Razorpay, then replace this with a real checkout session.'
      });
    }
    if (url.pathname === '/api/dev/activate-plan' && req.method === 'POST') {
      const user = authRequired(req, res, db);
      if (!user) return;
      const body = await parseBody(req);
      const plan = PLANS[body.plan] || PLANS.pro;
      const now = Date.now();
      const expiresAt = plan.periodDays ? new Date(now + plan.periodDays * 86400000).toISOString() : null;
      user.subscription = { plan: plan.id, status: 'active', startedAt: new Date().toISOString(), expiresAt };
      writeDb(db);
      return json(res, 200, { user: publicUser(user) });
    }
    if (url.pathname === '/api/plugins') {
      const user = authRequired(req, res, db);
      if (!user) return;
      const plan = getPlan(user);
      return json(res, 200, {
        plugins: PLUGINS.map(p => ({ ...p, unlocked: planRank(plan.id) >= planRank(p.plan) })),
        skills: SKILLS.map(s => ({ ...s, unlocked: planRank(plan.id) >= planRank(s.plan) })),
        automations: db.automations.filter(a => a.userId === user.id)
      });
    }
    if (url.pathname === '/api/automations' && req.method === 'POST') {
      const user = authRequired(req, res, db);
      if (!user) return;
      if (planRank(getPlan(user).id) < planRank('max5')) return json(res, 402, { error: 'Automations require Max 5x or higher' });
      const body = await parseBody(req);
      const automation = { id: id('auto'), userId: user.id, name: body.name || 'Automation', prompt: body.prompt || '', schedule: body.schedule || 'manual', status: 'active', createdAt: new Date().toISOString() };
      db.automations.push(automation);
      writeDb(db);
      return json(res, 200, { automation });
    }
    serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}

ensureDb();
http.createServer(route).listen(PORT, () => {
  console.log(`ARIA server running on http://127.0.0.1:${PORT}`);
});

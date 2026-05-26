const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'aria-vercel-secret';

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

function defaultDb() {
  return {
    users: [],
    sessions: {},
    knowledge: [],
    training: [],
    automations: [],
    payments: [],
    createdAt: new Date().toISOString()
  };
}

function db() {
  globalThis.__ARIA_VERCEL_DB = globalThis.__ARIA_VERCEL_DB || defaultDb();
  return globalThis.__ARIA_VERCEL_DB;
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
    const [key, ...rest] = part.trim().split('=');
    return [key, decodeURIComponent(rest.join('='))];
  }));
}

function setCookie(res, token) {
  res.setHeader('Set-Cookie', `aria_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Secure`);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve, reject) => {
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
    plugins: PLUGINS.filter(plugin => planRank(planId) >= planRank(plugin.plan)),
    skills: SKILLS.filter(skill => planRank(planId) >= planRank(skill.plan)),
    automations: planRank(planId) >= planRank('max5'),
    webKnowledge: true,
    codingWorkspace: planRank(planId) >= planRank('max5')
  };
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

function currentUser(req, store) {
  const raw = verifyToken(parseCookies(req).aria_session);
  const userId = raw && store.sessions[raw];
  return userId ? store.users.find(user => user.id === userId) : null;
}

function createGuestUser(store) {
  const guestNumber = store.users.filter(user => user.email.startsWith('guest-')).length + 1;
  const user = {
    id: id('user'),
    email: `guest-${Date.now()}-${guestNumber}@aria.local`,
    name: 'Guest',
    passwordHash: '',
    subscription: { plan: 'free', status: 'active', startedAt: new Date().toISOString(), expiresAt: null },
    settings: { trainFromChats: true },
    usage: { messages: 0, webSearches: 0 },
    chats: [],
    connections: [],
    guest: true,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  return user;
}

function normalizeQuestion(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function score(query, text) {
  const words = normalizeQuestion(query).split(' ').filter(word => word.length > 2);
  const hay = normalizeQuestion(text);
  return words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
}

function findKnowledge(store, user, message) {
  const key = normalizeQuestion(message);
  const ownerMatches = item => item.ownerId === user.id || item.shared;
  return store.knowledge
    .filter(ownerMatches)
    .map(item => ({ ...item, score: Math.max(score(key, item.question), score(key, item.answer), score(key, item.type || '')) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

async function webKnowledge(message) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    return {
      source: 'local-fallback',
      answer: 'Google knowledge training is ready. Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in Vercel environment variables to let ARIA learn from Google results.',
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
  if (hit) return `I found this in ARIA memory, so I can answer faster without searching again.\n\n${hit.answer}`;
  if (/\b(code|build|html|css|javascript|debug|component|app|website)\b/i.test(message)) {
    return `I can help code it.\n\nPlan:\n1. Understand exactly what you want.\n2. Break it into files, UI, state, and behavior.\n3. Write the full implementation.\n4. Keep it clean, responsive, and testable.\n\nYour current plan is ${plan.name}. Coding workspace features unlock on Max 5x and above.`;
  }
  if (/\b(design|ui|ux|screen|layout|interface|website)\b/i.test(message)) {
    return `I can design it as a clean ARIA product experience.\n\nI will focus on:\n- simple chat-first layout\n- quiet side navigation\n- clear memory/settings panel\n- responsive spacing\n- strong code/design action buttons\n\nTell me the exact page or component and I will draft the UI structure.`;
  }
  return `I understand. Ask me naturally and I will reply here.\n\nARIA runs from its own server route. When Google knowledge is configured, I can search once, save the useful result, and answer similar questions faster from ARIA memory.`;
}

async function handleChat(store, user, body) {
  const message = String(body.message || '').trim();
  if (!message) return { error: 'Message required' };
  const plan = getPlan(user);
  user.usage = user.usage || { messages: 0, webSearches: 0 };
  if (user.usage.messages >= plan.messageLimit) return { error: `Message limit reached for ${plan.name}. Upgrade to continue.` };
  user.usage.messages += 1;

  const chatId = body.chatId || id('chat');
  let chat = user.chats.find(item => item.id === chatId);
  if (!chat) {
    chat = { id: chatId, title: message.slice(0, 60), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    user.chats.unshift(chat);
  }
  chat.messages.push({ role: 'user', content: message, ts: Date.now() });

  const hit = findKnowledge(store, user, message);
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
        answer = `I checked Google knowledge and saved this for faster future answers.\n\n${web.answer}`;
        store.knowledge.unshift({
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
      answer += `\n\nGoogle knowledge failed safely: ${error.message}`;
    }
  }

  chat.messages.push({ role: 'assistant', content: answer, ts: Date.now(), source, links });
  chat.updatedAt = new Date().toISOString();

  if (user.settings.trainFromChats !== false) {
    store.training.unshift({ id: id('train'), userId: user.id, question: normalizeQuestion(message), answer, source, createdAt: new Date().toISOString() });
  }
  return { chat, answer, source, links, user: publicUser(user) };
}

module.exports = async function handler(req, res) {
  const store = db();
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'aria.local'}`);
  const path = requestUrl.searchParams.get('path') || '/api/health';
  try {
    if (path === '/api/health') return json(res, 200, { ok: true, engine: 'aria-vercel', plans: PLANS });
    if (path === '/api/plans') return json(res, 200, { plans: PLANS, plugins: PLUGINS, skills: SKILLS });
    if (path === '/api/me') {
      const user = currentUser(req, store);
      return json(res, 200, { user: user ? publicUser(user) : null, chats: user ? user.chats : [] });
    }
    if (path === '/api/register' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || email.split('@')[0] || 'Aria User').trim();
      if (!email || password.length < 6) return json(res, 400, { error: 'Email and 6+ character password required' });
      if (store.users.some(user => user.email === email)) return json(res, 409, { error: 'Account already exists' });
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
      store.users.push(user);
      const token = makeToken();
      store.sessions[token.split('.')[0]] = user.id;
      setCookie(res, token);
      return json(res, 200, { user: publicUser(user), chats: user.chats });
    }
    if (path === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      const user = store.users.find(item => item.email === String(body.email || '').trim().toLowerCase());
      if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) return json(res, 401, { error: 'Invalid login' });
      const token = makeToken();
      store.sessions[token.split('.')[0]] = user.id;
      setCookie(res, token);
      return json(res, 200, { user: publicUser(user), chats: user.chats });
    }
    if (path === '/api/logout' && req.method === 'POST') {
      const raw = verifyToken(parseCookies(req).aria_session);
      if (raw) delete store.sessions[raw];
      res.setHeader('Set-Cookie', 'aria_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure');
      return json(res, 200, { ok: true });
    }
    if (path === '/api/chat' && req.method === 'POST') {
      let user = currentUser(req, store);
      if (!user) {
        user = createGuestUser(store);
        const token = makeToken();
        store.sessions[token.split('.')[0]] = user.id;
        setCookie(res, token);
      }
      const body = await readBody(req);
      const result = await handleChat(store, user, body);
      return json(res, result.error ? 400 : 200, result);
    }
    if (path === '/api/chats') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      return json(res, 200, { chats: user.chats });
    }
    if (path === '/api/settings' && req.method === 'POST') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      const body = await readBody(req);
      user.settings = { ...user.settings, ...body.settings };
      return json(res, 200, { user: publicUser(user) });
    }
    if (path === '/api/plugins') {
      const user = currentUser(req, store);
      const plan = user ? getPlan(user) : PLANS.free;
      return json(res, 200, {
        plugins: PLUGINS.map(plugin => ({ ...plugin, unlocked: planRank(plan.id) >= planRank(plugin.plan) })),
        skills: SKILLS.map(skill => ({ ...skill, unlocked: planRank(plan.id) >= planRank(skill.plan) })),
        automations: user ? store.automations.filter(item => item.userId === user.id) : []
      });
    }
    if (path === '/api/checkout' && req.method === 'POST') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      const body = await readBody(req);
      const plan = PLANS[body.plan];
      if (!plan || plan.id === 'free') return json(res, 400, { error: 'Paid plan required' });
      const payment = { id: id('pay'), userId: user.id, plan: plan.id, status: 'requires_provider', amount: plan.price, createdAt: new Date().toISOString() };
      store.payments.push(payment);
      return json(res, 200, { payment, message: 'Payment provider is not configured yet. Connect Stripe or Razorpay to create real checkout sessions.' });
    }
    if (path === '/api/dev/activate-plan' && req.method === 'POST') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      const body = await readBody(req);
      const plan = PLANS[body.plan] || PLANS.pro;
      const expiresAt = plan.periodDays ? new Date(Date.now() + plan.periodDays * 86400000).toISOString() : null;
      user.subscription = { plan: plan.id, status: 'active', startedAt: new Date().toISOString(), expiresAt };
      return json(res, 200, { user: publicUser(user) });
    }
    if (path === '/api/automations' && req.method === 'POST') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      if (planRank(getPlan(user).id) < planRank('max5')) return json(res, 402, { error: 'Automations require Max 5x or higher' });
      const body = await readBody(req);
      const automation = { id: id('auto'), userId: user.id, name: body.name || 'Automation', prompt: body.prompt || '', schedule: body.schedule || 'manual', status: 'active', createdAt: new Date().toISOString() };
      store.automations.push(automation);
      return json(res, 200, { automation });
    }
    return json(res, 404, { error: 'Unknown ARIA API route' });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};

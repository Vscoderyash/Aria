const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_SECRET = process.env.SESSION_SECRET || 'aria-vercel-secret';
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

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
    actions: [],
    payments: [],
    createdAt: new Date().toISOString()
  };
}

let knowledgeLibraryCache = null;

function parseKnowledgeFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  const meta = {};
  let content = raw;
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
    }
    content = match[2].trim();
  }
  return {
    id: meta.id || path.basename(filePath, '.md'),
    title: meta.title || path.basename(filePath, '.md'),
    kind: meta.kind || 'knowledge',
    tags: String(meta.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    content,
    sourcePath: path.relative(process.cwd(), filePath).replace(/\\/g, '/')
  };
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function loadKnowledgeLibrary() {
  if (knowledgeLibraryCache) return knowledgeLibraryCache;
  knowledgeLibraryCache = walkMarkdown(KNOWLEDGE_DIR).map(parseKnowledgeFile);
  return knowledgeLibraryCache;
}

function db() {
  globalThis.__ARIA_VERCEL_DB = globalThis.__ARIA_VERCEL_DB || defaultDb();
  globalThis.__ARIA_VERCEL_DB.actions = Array.isArray(globalThis.__ARIA_VERCEL_DB.actions) ? globalThis.__ARIA_VERCEL_DB.actions : [];
  globalThis.__ARIA_VERCEL_DB.knowledge = Array.isArray(globalThis.__ARIA_VERCEL_DB.knowledge) ? globalThis.__ARIA_VERCEL_DB.knowledge : [];
  globalThis.__ARIA_VERCEL_DB.training = Array.isArray(globalThis.__ARIA_VERCEL_DB.training) ? globalThis.__ARIA_VERCEL_DB.training : [];
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
  const library = loadKnowledgeLibrary().map(item => ({
    id: item.id,
    ownerId: 'aria-library',
    question: `${item.title} ${item.kind} ${item.tags.join(' ')}`,
    answer: item.content,
    type: item.kind,
    shared: true,
    library: true,
    sourcePath: item.sourcePath
  }));
  const ownerMatches = item => item.ownerId === user.id || item.shared;
  return [...store.knowledge, ...library]
    .filter(ownerMatches)
    .map(item => ({ ...item, score: Math.max(score(key, item.question), score(key, item.answer), score(key, item.type || '')) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function isSelfImproveRequest(message) {
  return /\b(add|create|save|write|learn|remember|update|improve|upgrade|make)\b[\s\S]{0,80}\b(file|files|knowledge|memory|brain|server|yourself|skill|plugin|connection|ability)\b/i.test(message);
}

function createSelfImproveAction(store, user, message) {
  const clean = String(message || '').replace(/\s+/g, ' ').trim();
  const title = clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
  const action = {
    id: id('act'),
    userId: user.id,
    type: 'self-improvement',
    status: 'needs approval',
    title: `Learn: ${title}`,
    summary: 'ARIA prepared a self-improvement knowledge update. Approve it before ARIA saves this into server memory.',
    requestedText: clean,
    draft: {
      question: normalizeQuestion(clean),
      type: 'self-improvement',
      answer: `Self-improvement note from user request:\n\n${clean}\n\nWorking rule: convert this into future ARIA behavior only after user approval. Ask permission before creating files, connecting services, deploying, purchasing, deleting, or changing external systems.`,
      tags: ['self-improvement', 'user-request', 'permission']
    },
    createdAt: new Date().toISOString()
  };
  store.actions.unshift(action);
  return action;
}

function applyAction(store, user, action) {
  if (action.type !== 'self-improvement' || action.appliedAt) return null;
  const knowledge = {
    id: id('know'),
    ownerId: user.id,
    question: action.draft.question,
    type: action.draft.type,
    answer: action.draft.answer,
    links: [],
    shared: false,
    createdAt: new Date().toISOString(),
    sourceActionId: action.id,
    hits: 0
  };
  store.knowledge.unshift(knowledge);
  action.appliedAt = new Date().toISOString();
  return knowledge;
}

function userActions(store, user) {
  return store.actions.filter(action => action.userId === user.id).slice(0, 50);
}

async function webKnowledge(message) {
  return {
    source: 'search-disabled',
    answer: 'Web search is disabled. ARIA is running in chat-only mode with server memory and OpenAI chat.',
    links: []
  };
}

function localReply(message, hit, user) {
  const plan = getPlan(user);
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  if (hit) {
    const place = hit.library ? 'ARIA working knowledge library' : 'my saved knowledge';
    return `I found this in ${place}, so I can answer faster without searching again.\n\n${hit.answer}`;
  }
  if (/^(hi|hello|hey|yo|sup|start|are you online)\b/i.test(lower)) {
    return `I am online as ARIA Core.\n\nI can help in four modes:\n\n1. **Answer**: ask a question and I will use server memory first.\n2. **Build**: ask for code, UI, API routes, files, or debugging.\n3. **Learn**: say "learn this..." and I will prepare a permission-gated memory update.\n4. **Connect**: ask for GitHub, Vercel, Drive, Slack, or custom plugins and I will request permission before setup.\n\nGive me a real task and I will work from my server brain instead of repeating a canned message.`;
  }
  if (/\b(who are you|what are you|what can you do|help)\b/i.test(lower)) {
    return `I am ARIA, a server-backed AI workspace.\n\nMy current abilities:\n- use built-in working knowledge files before web search\n- learn approved user instructions into server memory\n- keep profile chats and subscriptions on the account\n- plan code like an agent, including files, tests, and deployment steps\n- expose plugins, skills, connections, automations, and permission gates\n\nFor sensitive actions, I will ask permission first.`;
  }
  if (/\b(code|build|html|css|javascript|debug|component|app|website)\b/i.test(message)) {
    return `I can build it.\n\n**Implementation path**\n1. Define the target behavior and UI.\n2. Split it into files, state, server routes, and styling.\n3. Generate or patch the code.\n4. Run syntax/API checks.\n5. Ask permission before deploys, external writes, or repo changes.\n\nYour current plan is **${plan.name}**. Advanced coding workspace features unlock on Max 5x and above.`;
  }
  if (/\b(design|ui|ux|screen|layout|interface|website)\b/i.test(message)) {
    return `I can design it as a clean ARIA product experience.\n\nI will focus on:\n- simple chat-first layout\n- quiet side navigation\n- clear memory/settings panel\n- responsive spacing\n- strong code/design action buttons\n\nTell me the exact page or component and I will draft the UI structure.`;
  }
  return `I do not have a strong saved memory match for that yet, so I will handle it as a fresh task.\n\n**What I understood**\n${text}\n\n**How I will proceed**\n- If you want an answer, I will explain it directly.\n- If you want code, I will turn it into files and steps.\n- If you want me to remember it, say **learn this:** and I will ask permission before saving it.\n- If this needs current external knowledge, use the OpenAI chat key; ARIA will answer from server memory and the chat model.`;
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

  let action = null;
  let hit = null;
  let answer = '';
  let source = 'local';
  let links = [];

  if (isSelfImproveRequest(message)) {
    action = createSelfImproveAction(store, user, message);
    source = 'permission-required';
    answer = `I prepared a self-improvement update, but I need your permission before I save it into my server memory.\n\n**Pending action:** ${action.title}\n\nOpen **Settings > Permission Center** and approve it. After approval, I will store it as ARIA knowledge and use it for future answers.`;
  } else {
    hit = findKnowledge(store, user, message);
    answer = localReply(message, hit, user);
    source = hit ? 'knowledge-cache' : 'local';
  }

  // External web search is disabled. ARIA responds from local server memory only.

  chat.messages.push({ role: 'assistant', content: answer, ts: Date.now(), source, links });
  chat.updatedAt = new Date().toISOString();

  if (user.settings.trainFromChats !== false) {
    store.training.unshift({ id: id('train'), userId: user.id, question: normalizeQuestion(message), answer, source, createdAt: new Date().toISOString() });
  }
  return { chat, answer, source, links, action, actions: userActions(store, user), user: publicUser(user) };
}

module.exports = async function handler(req, res) {
  const store = db();
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'aria.local'}`);
  const path = requestUrl.searchParams.get('path') || '/api/health';
  try {
    if (path === '/api/health') return json(res, 200, { ok: true, engine: 'aria-vercel', plans: PLANS, knowledgeFiles: loadKnowledgeLibrary().length });
    if (path === '/api/library') {
      const files = loadKnowledgeLibrary().map(({ id, title, kind, tags, sourcePath }) => ({ id, title, kind, tags, sourcePath }));
      return json(res, 200, { count: files.length, files });
    }
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
    if (path === '/api/actions') {
      const user = currentUser(req, store);
      if (!user) return json(res, 401, { error: 'Login required' });
      if (req.method === 'GET') return json(res, 200, { actions: userActions(store, user) });
      if (req.method === 'POST') {
        const body = await readBody(req);
        const action = store.actions.find(item => item.id === body.actionId && item.userId === user.id);
        if (!action) return json(res, 404, { error: 'Action not found' });
        if (!['approved', 'denied'].includes(body.status)) return json(res, 400, { error: 'Use approved or denied' });
        action.status = body.status;
        action.decidedAt = new Date().toISOString();
        let knowledge = null;
        if (body.status === 'approved') knowledge = applyAction(store, user, action);
        return json(res, 200, { action, knowledge, actions: userActions(store, user), user: publicUser(user) });
      }
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
      return json(res, 400, { error: 'Payments are disabled. This app supports chat only with OpenAI.' });
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

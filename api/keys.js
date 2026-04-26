// api/keys.js - Generate & manage API keys
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function sb(method, path, body, headers = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      ...(method === 'POST' ? { 'Prefer': 'return=representation' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return readJson(r);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sk-aria-';
  for (let i = 0; i < 48; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });

  const url = new URL(req.url);
  const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

  // ── REGISTER ──
  if (req.method === 'POST' && url.pathname.includes('/register')) {
    const { name, email } = body;
    if (!email || !name) return json({ error: 'name and email required' }, 400);

    // Check existing
    const existing = await sb('GET', `users?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (existing?.length) return json({ error: 'Email already registered.' }, 409);

    // Create user with 100 free credits
    const users = await sb('POST', 'users', {
      name, email,
      credits: 100,
      plan: 'free',
      created_at: new Date().toISOString(),
    });
    const user = users[0];

    // Generate first key
    const key = generateKey();
    await sb('POST', 'api_keys', {
      user_id: user.id,
      key,
      name: 'Default Key',
      active: true,
      created_at: new Date().toISOString(),
    });

    return json({
      success: true,
      message: 'Account created! You have 100 free credits.',
      user_id: user.id,
      email: user.email,
      credits: 100,
      api_key: key,
    });
  }

  // ── GET KEYS (requires email) ──
  if (req.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return json({ error: 'email param required' }, 400);
    const users = await sb('GET', `users?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!users?.length) return json({ error: 'User not found' }, 404);
    const user = users[0];
    const keys = await sb('GET', `api_keys?user_id=eq.${user.id}&select=id,key,name,active,created_at`);
    return json({ user: { id: user.id, name: user.name, email: user.email, credits: user.credits, plan: user.plan }, keys });
  }

  // ── CREATE NEW KEY ──
  if (req.method === 'POST') {
    const { user_id, key_name } = body;
    if (!user_id) return json({ error: 'user_id required' }, 400);
    const key = generateKey();
    const rows = await sb('POST', 'api_keys', {
      user_id, key, name: key_name || 'New Key',
      active: true, created_at: new Date().toISOString(),
    });
    return json({ success: true, api_key: rows[0].key, id: rows[0].id });
  }

  // ── DELETE KEY ──
  if (req.method === 'DELETE') {
    const { key_id } = body;
    if (!key_id) return json({ error: 'key_id required' }, 400);
    await sb('DELETE', `api_keys?id=eq.${key_id}`);
    return json({ success: true });
  }

  return json({ error: 'Not found' }, 404);
}

// api/keys.js — User registration, key management, conversations
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk-aria-';
  for (let i = 0; i < 48; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    }});
  }

  const url = new URL(req.url);
  const body = ['POST','PATCH','DELETE'].includes(req.method) ? await req.json().catch(() => ({})) : {};

  // ── REGISTER ──
  if (req.method === 'POST' && url.pathname.includes('/register')) {
    const { name, email } = body;
    if (!name || !email) return json({ error: 'name and email required' }, 400);

    const existing = await sb('GET', `users?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (existing?.length) return json({ error: 'Email already registered.' }, 409);

    const users = await sb('POST', 'users', {
      name, email, credits: 100, plan: 'free',
      created_at: new Date().toISOString(),
    });
    const user = users[0];
    const key = generateKey();
    await sb('POST', 'api_keys', {
      user_id: user.id, key, name: 'Default Key',
      active: true, created_at: new Date().toISOString(),
    });

    return json({ success: true, message: 'Account created! 100 free credits added.', user_id: user.id, email: user.email, credits: 100, api_key: key });
  }

  // ── GET USER + KEYS + STATS ──
  if (req.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return json({ error: 'email param required' }, 400);

    const users = await sb('GET', `users?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!users?.length) return json({ error: 'User not found' }, 404);
    const user = users[0];

    const keys = await sb('GET', `api_keys?user_id=eq.${user.id}&select=id,key,name,active,created_at`);
    const logs = await sb('GET', `usage_logs?user_id=eq.${user.id}&order=created_at.desc&limit=50`);
    const convs = await sb('GET', `conversations?user_id=eq.${user.id}&order=updated_at.desc&limit=20`);

    // Stats
    const totalCalls = logs?.length || 0;
    const totalCreditsUsed = logs?.reduce((s, l) => s + (l.credits_used || 0), 0) || 0;
    const modelBreakdown = {};
    logs?.forEach(l => { modelBreakdown[l.model] = (modelBreakdown[l.model] || 0) + 1; });

    return json({
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits, plan: user.plan, created_at: user.created_at },
      keys: keys || [],
      stats: { total_calls: totalCalls, total_credits_used: totalCreditsUsed, model_breakdown: modelBreakdown },
      conversations: convs || [],
    });
  }

  // ── CREATE KEY ──
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

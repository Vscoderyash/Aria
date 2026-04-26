// api/v1/chat.js - ARIA API Chat Endpoint
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const MODELS = {
  'aria-fast':    { id: 'claude-haiku-4-5-20251001',  cost: 1 },
  'aria-smart':   { id: 'claude-sonnet-4-6',           cost: 4 },
  'aria-pro':     { id: 'claude-opus-4-6',             cost: 20 },
  // aliases
  'aria-1':       { id: 'claude-haiku-4-5-20251001',  cost: 1 },
  'aria-2':       { id: 'claude-sonnet-4-6',           cost: 4 },
  'aria-3':       { id: 'claude-opus-4-6',             cost: 20 },
};

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function supabase(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      ...(method === 'POST' ? { 'Prefer': 'return=representation' } : {}),
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

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ARIA-Key',
      },
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── AUTH ──
  const authHeader = req.headers.get('Authorization') || req.headers.get('X-ARIA-Key') || '';
  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey || !apiKey.startsWith('sk-aria-')) {
    return json({ error: { type: 'auth_error', message: 'Invalid or missing API key. Keys start with sk-aria-' } }, 401);
  }

  // Lookup key in Supabase
  const keys = await supabase('GET', `api_keys?key=eq.${apiKey}&select=*,users(*)&limit=1`);
  if (!keys?.length) {
    return json({ error: { type: 'auth_error', message: 'API key not found.' } }, 401);
  }

  const keyRow = keys[0];
  const user = keyRow.users;

  // Check if key is active
  if (!keyRow.active) {
    return json({ error: { type: 'auth_error', message: 'API key is disabled.' } }, 401);
  }

  // Check credits
  if (user.credits <= 0) {
    return json({ error: { type: 'credits_exhausted', message: 'No credits remaining. Top up at https://aria-sigma-gold.vercel.app/dashboard' } }, 402);
  }

  // ── PARSE BODY ──
  let body;
  try { body = await req.json(); } catch { return json({ error: { message: 'Invalid JSON body' } }, 400); }

  const modelKey = body.model || 'aria-smart';
  const model = MODELS[modelKey];
  if (!model) {
    return json({ error: { type: 'invalid_model', message: `Unknown model. Available: ${Object.keys(MODELS).join(', ')}` } }, 400);
  }

  if (!body.messages?.length) {
    return json({ error: { message: 'messages array is required' } }, 400);
  }

  // Check credits >= model cost
  if (user.credits < model.cost) {
    return json({ error: { type: 'credits_exhausted', message: `Need ${model.cost} credits for this model. You have ${user.credits}.` } }, 402);
  }

  // ── CALL ANTHROPIC ──
  const stream = body.stream === true;

  try {
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: body.max_tokens || 1024,
        system: body.system || 'You are ARIA, a helpful AI assistant.',
        messages: body.messages,
        stream,
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.json().catch(() => ({}));
      return json({ error: { message: err?.error?.message || `Upstream error ${anthropicResp.status}` } }, anthropicResp.status);
    }

    // Deduct credits (fire and forget)
    supabase('PATCH', `users?id=eq.${user.id}`, { credits: user.credits - model.cost });

    // Log usage
    supabase('POST', 'usage_logs', {
      user_id: user.id,
      api_key_id: keyRow.id,
      model: modelKey,
      credits_used: model.cost,
      created_at: new Date().toISOString(),
    });

    if (stream) {
      return new Response(anthropicResp.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      const data = await anthropicResp.json();
      return json(data);
    }

  } catch (err) {
    return json({ error: { message: err.message } }, 500);
  }
}

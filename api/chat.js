export const config = { runtime: 'edge' };

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODELS = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant':    'Llama 3.1 8B',
  'mixtral-8x7b-32768':      'Mixtral 8x7B',
  'gemma2-9b-it':            'Gemma 2 9B',
};

export default async function handler(req) {
  if (req.method === 'GET') {
    // Health check
    const ok = !!process.env.GROQ_API_KEY;
    return Response.json({ ok, models: Object.keys(MODELS) });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json(
      { error: 'GROQ_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' },
      { status: 500 }
    );
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response('Bad JSON', { status: 400 }); }

  const { messages, model = 'llama-3.3-70b-versatile', max_tokens = 1500, temperature = 0.7 } = body;

  if (!Array.isArray(messages) || !messages.length) {
    return new Response('messages array required', { status: 400 });
  }

  if (!MODELS[model]) {
    return new Response('Unknown model', { status: 400 });
  }

  const upstream = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens, temperature }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status, headers: { 'Content-Type': 'text/plain' } });
  }

  // Proxy the SSE stream straight through to the browser
  return new Response(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

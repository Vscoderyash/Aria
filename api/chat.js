export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: 'OPENROUTER_API_KEY not set in Vercel environment variables.' } }),
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const modelMap = {
      'claude-haiku-4-5-20251001': 'anthropic/claude-haiku-4-5',
      'claude-sonnet-4-6':         'anthropic/claude-sonnet-4-5',
      'claude-opus-4-6':           'anthropic/claude-opus-4-5',
    };

    const messages = [];
    if (body.system) messages.push({ role: 'system', content: body.system });

    for (const msg of (body.messages || [])) {
      if (typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const parts = msg.content.map(part => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'image') return { type: 'image_url', image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` } };
          return part;
        });
        messages.push({ role: msg.role, content: parts });
      }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://aria-sigma-gold.vercel.app',
        'X-Title': 'ARIA AI Assistant',
      },
      body: JSON.stringify({
        model: modelMap[body.model] || 'anthropic/claude-sonnet-4-5',
        max_tokens: body.max_tokens || 1024,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: { message: err?.error?.message || `HTTP ${response.status}` } }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500 });
  }
}

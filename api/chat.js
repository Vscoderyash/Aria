export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not set in Vercel environment variables.' } }), { status: 500 });
  }

  try {
    const body = await req.json();

    // Add streaming
    const payload = { ...body, stream: true };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      return new Response(JSON.stringify(err), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    // Stream the response back
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

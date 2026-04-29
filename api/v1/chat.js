// api/v1/chat.js — ARIA Multi-Agent Orchestrator (OpenRouter)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = {
  'aria-fast':  { id: 'anthropic/claude-haiku-4-5',  cost: 1  },
  'aria-smart': { id: 'anthropic/claude-sonnet-4-5',  cost: 4  },
  'aria-pro':   { id: 'anthropic/claude-opus-4-5',    cost: 20 },
  'aria-1':     { id: 'anthropic/claude-haiku-4-5',  cost: 1  },
  'aria-2':     { id: 'anthropic/claude-sonnet-4-5',  cost: 4  },
  'aria-3':     { id: 'anthropic/claude-opus-4-5',    cost: 20 },
};

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
  if (!r.ok) return null;
  return r.json();
}

function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: { message: msg } }), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function logAgent(convId, msgId, name, status, input, output, error, attempt, ms) {
  await sb('POST', 'agent_logs', {
    conversation_id: convId, message_id: msgId,
    agent_name: name, status, input, output, error,
    attempt, duration_ms: ms, created_at: new Date().toISOString(),
  });
}

// ── CALL OPENROUTER ──────────────────────────────────────────────────────────
async function callOR(modelId, system, messages, maxTokens = 1024, stream = false) {
  const orMessages = [];
  if (system) orMessages.push({ role: 'system', content: system });

  for (const m of messages) {
    if (typeof m.content === 'string') {
      orMessages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content)) {
      // Convert Anthropic image format → OpenAI format
      const parts = m.content.map(p => {
        if (p.type === 'text') return { type: 'text', text: p.text };
        if (p.type === 'image') return {
          type: 'image_url',
          image_url: { url: `data:${p.source.media_type};base64,${p.source.data}` }
        };
        return p;
      });
      orMessages.push({ role: m.role, content: parts });
    }
  }

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://aria-sigma-gold.vercel.app',
      'X-Title': 'ARIA AI',
    },
    body: JSON.stringify({ model: modelId, max_tokens: maxTokens, messages: orMessages, stream }),
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.error?.message || `OpenRouter error ${r.status}`);
  }

  if (stream) return r; // return raw response for streaming

  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── AGENTS ───────────────────────────────────────────────────────────────────

async function plannerAgent(modelId, userMsg) {
  const isComplex = userMsg.length > 200 ||
    /\b(build|create|design|analyze|compare|explain|write|research|plan)\b/i.test(userMsg);
  if (!isComplex) return null;
  try {
    const plan = await callOR(modelId,
      'You are a task planner. Output ONLY a JSON array of 2-4 concise steps. No explanation.',
      [{ role: 'user', content: userMsg }], 200
    );
    const steps = JSON.parse(plan.match(/\[[\s\S]*\]/)?.[0] || '[]');
    return steps.length > 0 ? steps : null;
  } catch { return null; }
}

async function executorAgent(modelId, system, messages) {
  return callOR(modelId, system, messages, 2048);
}

async function criticAgent(modelId, userMsg, response) {
  if (response.length < 80) return { score: 0.4, reason: 'Too brief', hint: 'Expand with more detail' };
  if (/i (cannot|can't|am unable)/i.test(response) && userMsg.length > 50)
    return { score: 0.5, reason: 'Unhelpful refusal', hint: 'Try harder to help' };
  if (userMsg.length > 150) {
    try {
      const result = await callOR(modelId,
        'Score this response 0.0-1.0. Output ONLY: {"score":0.X,"reason":"brief"}',
        [{ role: 'user', content: `Request: ${userMsg.slice(0,300)}\nResponse: ${response.slice(0,600)}` }], 100
      );
      const p = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}');
      return { score: p.score || 0.8, reason: p.reason || 'OK', hint: '' };
    } catch {}
  }
  return { score: 0.85, reason: 'Good', hint: '' };
}

function validatorAgent(response) {
  const violations = [];
  if (!response?.trim()) violations.push('Empty response');
  if (response.length < 20) violations.push('Too short');
  return { pass: violations.length === 0, violations };
}

async function retryAgent(modelId, system, messages, userMsg, attempt, hint) {
  const strategies = [
    () => callOR(modelId, `${system}\n\nIMPORTANT: ${hint || 'Be more helpful and thorough.'}`, messages, 2048),
    () => callOR(modelId, system, [...messages.slice(0,-1), { role:'user', content:`${userMsg}\n\nPlease be comprehensive.` }], 2048),
    () => callOR('anthropic/claude-haiku-4-5', 'You are a helpful assistant. Answer clearly.', messages, 1024),
  ];
  return strategies[Math.min(attempt - 1, 2)]();
}

function formatterAgent(response) {
  return response.trim().replace(/\n{3,}/g, '\n\n');
}

// ── MAIN ORCHESTRATOR ─────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ARIA-Key',
  }});

  if (req.method !== 'POST') return err('Method not allowed', 405);

  if (!OPENROUTER_KEY) return err('OPENROUTER_API_KEY not set in Vercel environment variables.', 500);

  // ── AUTH ──
  const authHeader = req.headers.get('Authorization') || req.headers.get('X-ARIA-Key') || '';
  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey?.startsWith('sk-aria-')) return err('Invalid API key. Keys start with sk-aria-', 401);

  const keys = await sb('GET', `api_keys?key=eq.${apiKey}&select=*,users(*)&limit=1`);
  if (!keys?.length) return err('API key not found', 401);

  const keyRow = keys[0];
  const user = keyRow.users;
  if (!keyRow.active) return err('API key disabled', 401);
  if (user.credits <= 0) return err('No credits remaining. Top up at https://aria-sigma-gold.vercel.app', 402);

  let body;
  try { body = await req.json(); } catch { return err('Invalid JSON'); }

  const modelKey = body.model || 'aria-smart';
  const model = MODELS[modelKey];
  if (!model) return err(`Unknown model. Use: aria-fast, aria-smart, aria-pro`);
  if (!body.messages?.length) return err('messages array required');
  if (user.credits < model.cost) return err(`Need ${model.cost} credits. You have ${user.credits}.`, 402);

  const userMessage = body.messages[body.messages.length - 1]?.content || '';
  const systemPrompt = body.system || 'You are ARIA, a helpful AI assistant created by Yash Raj.';
  const stream = body.stream === true;

  // Create conversation
  const conv = await sb('POST', 'conversations', {
    user_id: user.id, api_key_id: keyRow.id,
    model: modelKey, system_prompt: systemPrompt,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const convId = conv?.[0]?.id;

  const agentTrace = { agents: [], model: modelKey, attempts: 0 };
  let finalResponse = '';

  try {
    // 1. PLANNER
    const t0 = Date.now();
    const plan = await plannerAgent(model.id, typeof userMessage === 'string' ? userMessage : '');
    if (plan) {
      agentTrace.agents.push({ name: 'planner', status: 'success', plan });
      await logAgent(convId, null, 'planner', 'success', { userMessage }, { plan }, null, 1, Date.now() - t0);
    }

    // 2. EXECUTOR + CRITIC + VALIDATOR loop
    let response = '', criticResult = { score: 0, hint: '' }, attempts = 0;

    while (attempts < 3) {
      attempts++; agentTrace.attempts = attempts;
      const t1 = Date.now();
      try {
        response = attempts === 1
          ? await executorAgent(model.id, systemPrompt, body.messages)
          : await retryAgent(model.id, systemPrompt, body.messages, typeof userMessage === 'string' ? userMessage : '', attempts, criticResult.hint);
        await logAgent(convId, null, 'executor', 'success', { attempt: attempts }, { len: response.length }, null, attempts, Date.now() - t1);
      } catch(e) {
        await logAgent(convId, null, 'executor', 'failed', { attempt: attempts }, null, e.message, attempts, Date.now() - t1);
        if (attempts >= 3) throw e;
        continue;
      }

      // Critic
      criticResult = await criticAgent(model.id, typeof userMessage === 'string' ? userMessage : '', response);
      agentTrace.agents.push({ name: 'critic', status: 'success', score: criticResult.score, attempt: attempts });

      // Validator
      const valid = validatorAgent(response);
      agentTrace.agents.push({ name: 'validator', status: valid.pass ? 'success' : 'failed', attempt: attempts });

      if (valid.pass && criticResult.score >= 0.6) break;
    }

    // 3. FORMATTER
    finalResponse = formatterAgent(response);
    agentTrace.agents.push({ name: 'formatter', status: 'success' });

    // 4. SAVE + DEDUCT
    const saved = await sb('POST', 'messages', {
      conversation_id: convId, role: 'assistant',
      content: finalResponse, credits_used: model.cost,
      agent_trace: agentTrace, created_at: new Date().toISOString(),
    });

    await sb('PATCH', `users?id=eq.${user.id}`, { credits: user.credits - model.cost });
    await sb('POST', 'usage_logs', {
      user_id: user.id, api_key_id: keyRow.id,
      model: modelKey, credits_used: model.cost,
      created_at: new Date().toISOString(),
    });
    if (convId) await sb('PATCH', `conversations?id=eq.${convId}`, { updated_at: new Date().toISOString() });

  } catch(e) {
    await logAgent(convId, null, 'orchestrator', 'failed', { model: modelKey }, null, e.message, 1, 0);
    return err(`ARIA pipeline failed: ${e.message}`, 500);
  }

  // ── STREAM ──
  if (stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const chunks = finalResponse.match(/.{1,40}/g) || [finalResponse];
        let i = 0;
        const iv = setInterval(() => {
          if (i >= chunks.length) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close(); clearInterval(iv); return;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: chunks[i++] }
          })}\n\n`));
        }, 12);
      }
    });
    return new Response(readable, {
      headers: { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Access-Control-Allow-Origin':'*' }
    });
  }

  return new Response(JSON.stringify({
    id: `msg_${Date.now().toString(36)}`,
    type: 'message', role: 'assistant',
    content: [{ type: 'text', text: finalResponse }],
    model: modelKey, conversation_id: convId,
    usage: { credits_used: model.cost, credits_remaining: user.credits - model.cost, agent_trace: agentTrace }
  }), { headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' } });
}

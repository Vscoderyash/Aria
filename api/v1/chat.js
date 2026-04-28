// api/v1/chat.js — ARIA Multi-Agent Orchestrator
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const MODELS = {
  'aria-fast':  { id: 'claude-haiku-4-5-20251001', cost: 1,  label: 'ARIA Fast' },
  'aria-smart': { id: 'claude-sonnet-4-6',          cost: 4,  label: 'ARIA Smart' },
  'aria-pro':   { id: 'claude-opus-4-6',            cost: 20, label: 'ARIA Pro' },
  'aria-1':     { id: 'claude-haiku-4-5-20251001', cost: 1,  label: 'ARIA Fast' },
  'aria-2':     { id: 'claude-sonnet-4-6',          cost: 4,  label: 'ARIA Smart' },
  'aria-3':     { id: 'claude-opus-4-6',            cost: 20, label: 'ARIA Pro' },
};

// ── SUPABASE HELPER ──────────────────────────────────────────────────────────
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

function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// ── LOG AGENT STEP ────────────────────────────────────────────────────────────
async function logAgent(conversationId, messageId, agentName, status, input, output, error, attempt, durationMs) {
  await sb('POST', 'agent_logs', {
    conversation_id: conversationId,
    message_id: messageId,
    agent_name: agentName,
    status,
    input,
    output,
    error,
    attempt,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  });
}

// ── CALL CLAUDE ───────────────────────────────────────────────────────────────
async function callClaude(modelId, system, messages, maxTokens = 1024) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: modelId, max_tokens: maxTokens, system, messages }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Claude error ${r.status}`);
  return data.content?.[0]?.text || '';
}

// ════════════════════════════════════════════════════════════════════
// AGENTS
// ════════════════════════════════════════════════════════════════════

// 1. PLANNER — breaks complex tasks into steps
async function plannerAgent(modelId, userMessage, conversationHistory) {
  const isComplex = userMessage.length > 200 ||
    /\b(build|create|design|analyze|compare|explain|write|research|step by step|plan)\b/i.test(userMessage);
  if (!isComplex) return null; // skip for simple queries

  const plan = await callClaude(
    modelId,
    `You are a task planner. Given a user request, output a JSON array of 2-4 concise steps needed to answer it well.
Example: ["Understand the core question", "Gather relevant information", "Synthesize a clear answer"]
Output ONLY valid JSON array. No explanation.`,
    [{ role: 'user', content: userMessage }],
    256
  );
  try {
    const steps = JSON.parse(plan.match(/\[[\s\S]*\]/)?.[0] || '[]');
    return steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
}

// 2. EXECUTOR — generates the main response
async function executorAgent(modelId, system, messages) {
  return callClaude(modelId, system, messages, 2048);
}

// 3. CRITIC — scores the response quality
async function criticAgent(modelId, userMessage, response) {
  const tooShort = response.length < 80;
  const tooLong = response.length > 8000;
  const hasError = /i (cannot|can't|don't know|am unable)/i.test(response);

  if (tooShort) return { score: 0.4, reason: 'Response too brief', hint: 'Expand with more detail' };
  if (hasError && userMessage.length > 50) return { score: 0.5, reason: 'Unhelpful refusal', hint: 'Try to be more helpful' };
  if (tooLong) return { score: 0.7, reason: 'Response very long', hint: 'Consider trimming' };

  // For complex requests, use Claude to score
  if (userMessage.length > 150) {
    const result = await callClaude(
      modelId,
      `You are a quality critic. Score this response from 0.0 to 1.0.
Output ONLY: {"score": 0.X, "reason": "brief reason"}`,
      [{ role: 'user', content: `Request: ${userMessage.slice(0, 300)}\n\nResponse: ${response.slice(0, 600)}` }],
      128
    );
    try {
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}');
      return { score: parsed.score || 0.8, reason: parsed.reason || 'Acceptable', hint: '' };
    } catch { /* fall through */ }
  }

  return { score: 0.85, reason: 'Looks good', hint: '' };
}

// 4. VALIDATOR — hard rules check
function validatorAgent(response, constraints = {}) {
  const violations = [];
  if (!response || response.trim().length === 0) violations.push('Empty response');
  if (response.length < 20) violations.push('Response too short');
  if (constraints.maxLength && response.length > constraints.maxLength) violations.push('Exceeds max length');
  const pass = violations.length === 0;
  return { pass, violations };
}

// 5. RETRY — repair logic with 3 strategies
async function retryAgent(modelId, system, messages, userMessage, attempt, criticHint) {
  const strategies = [
    // attempt 1: add hint to system prompt
    () => callClaude(modelId, `${system}\n\nIMPORTANT: ${criticHint || 'Be more thorough and helpful.'}`, messages, 2048),
    // attempt 2: rephrase as more detailed request
    () => callClaude(modelId, system, [
      ...messages.slice(0, -1),
      { role: 'user', content: `${userMessage}\n\nPlease provide a comprehensive, detailed response.` }
    ], 2048),
    // attempt 3: simplify — just answer directly
    () => callClaude('claude-haiku-4-5-20251001', 'You are a helpful assistant. Answer directly and clearly.', messages, 1024),
  ];
  const strategy = strategies[Math.min(attempt - 1, 2)];
  return strategy();
}

// 6. FORMATTER — clean up response
function formatterAgent(response, format = 'text') {
  let out = response.trim();
  // Remove excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n');
  // Ensure proper ending
  if (out.length > 0 && !out.match(/[.!?`\n]$/)) out += '.';
  return out;
}

// ════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ARIA-Key',
    }});
  }

  if (req.method !== 'POST') return err('Method not allowed', 405);

  // ── AUTH ──
  const authHeader = req.headers.get('Authorization') || req.headers.get('X-ARIA-Key') || '';
  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey?.startsWith('sk-aria-')) {
    return err('Invalid or missing API key. Keys start with sk-aria-', 401);
  }

  const keys = await sb('GET', `api_keys?key=eq.${apiKey}&select=*,users(*)&limit=1`);
  if (!keys?.length) return err('API key not found', 401);

  const keyRow = keys[0];
  const user = keyRow.users;

  if (!keyRow.active) return err('API key is disabled', 401);
  if (user.credits <= 0) return err('No credits remaining. Top up at https://aria-sigma-gold.vercel.app', 402);

  // ── PARSE REQUEST ──
  let body;
  try { body = await req.json(); } catch { return err('Invalid JSON'); }

  const modelKey = body.model || 'aria-smart';
  const model = MODELS[modelKey];
  if (!model) return err(`Unknown model. Available: ${Object.keys(MODELS).filter(k=>!k.includes('-'+(1|2|3))).join(', ')}`);

  if (!body.messages?.length) return err('messages array required');
  if (user.credits < model.cost) return err(`Need ${model.cost} credits. You have ${user.credits}.`, 402);

  const userMessage = body.messages[body.messages.length - 1]?.content || '';
  const systemPrompt = body.system || 'You are ARIA, a helpful AI assistant created by Yash Raj.';
  const stream = body.stream === true;
  const conversationId = body.conversation_id || null;

  // ── CREATE CONVERSATION IF NOT EXISTS ──
  let convId = conversationId;
  if (!convId) {
    const conv = await sb('POST', 'conversations', {
      user_id: user.id,
      api_key_id: keyRow.id,
      model: modelKey,
      system_prompt: systemPrompt,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    convId = conv?.[0]?.id;
  }

  const agentTrace = { agents: [], model: modelKey, attempts: 0 };
  let finalResponse = '';
  let messageId = null;

  // ── AGENT PIPELINE ──
  try {

    // STEP 1: PLANNER
    const planStart = Date.now();
    const plan = await plannerAgent(model.id, userMessage, body.messages);
    if (plan) {
      agentTrace.agents.push({ name: 'planner', status: 'success', plan });
      await logAgent(convId, null, 'planner', 'success', { userMessage }, { plan }, null, 1, Date.now() - planStart);
    }

    // STEP 2: EXECUTOR (with retry loop)
    let response = '';
    let criticResult = { score: 0, reason: '', hint: '' };
    let validResult = { pass: false };
    let attempts = 0;

    while (attempts < 3) {
      attempts++;
      agentTrace.attempts = attempts;

      const execStart = Date.now();
      try {
        if (attempts === 1) {
          response = await executorAgent(model.id, systemPrompt, body.messages);
        } else {
          response = await retryAgent(model.id, systemPrompt, body.messages, userMessage, attempts, criticResult.hint);
        }
        await logAgent(convId, null, 'executor', 'success', { attempt: attempts }, { responseLength: response.length }, null, attempts, Date.now() - execStart);
      } catch (e) {
        await logAgent(convId, null, 'executor', 'failed', { attempt: attempts }, null, e.message, attempts, Date.now() - execStart);
        if (attempts >= 3) throw e;
        continue;
      }

      // STEP 3: CRITIC
      const criticStart = Date.now();
      criticResult = await criticAgent(model.id, userMessage, response);
      await logAgent(convId, null, 'critic', 'success', { responseLength: response.length }, criticResult, null, attempts, Date.now() - criticStart);
      agentTrace.agents.push({ name: 'critic', status: 'success', score: criticResult.score, attempt: attempts });

      // STEP 4: VALIDATOR
      validResult = validatorAgent(response);
      agentTrace.agents.push({ name: 'validator', status: validResult.pass ? 'success' : 'failed', violations: validResult.violations, attempt: attempts });
      await logAgent(convId, null, 'validator', validResult.pass ? 'success' : 'failed', { attempt: attempts }, validResult, null, attempts, 0);

      // Pass condition: validator passes AND critic score ≥ 0.6
      if (validResult.pass && criticResult.score >= 0.6) break;

      // Log retry
      await logAgent(convId, null, 'retry', 'retrying', { attempt: attempts, reason: criticResult.reason }, null, null, attempts, 0);
    }

    // STEP 5: FORMATTER
    finalResponse = formatterAgent(response);
    agentTrace.agents.push({ name: 'formatter', status: 'success' });

    // STEP 6: PERSIST message
    const savedMsg = await sb('POST', 'messages', {
      conversation_id: convId,
      role: 'assistant',
      content: finalResponse,
      credits_used: model.cost,
      agent_trace: agentTrace,
      created_at: new Date().toISOString(),
    });
    messageId = savedMsg?.[0]?.id;

    // STEP 7: DEDUCT CREDITS
    await sb('PATCH', `users?id=eq.${user.id}`, { credits: user.credits - model.cost });

    // STEP 8: LOG USAGE
    await sb('POST', 'usage_logs', {
      user_id: user.id,
      api_key_id: keyRow.id,
      model: modelKey,
      credits_used: model.cost,
      created_at: new Date().toISOString(),
    });

    // Update conversation timestamp
    if (convId) {
      await sb('PATCH', `conversations?id=eq.${convId}`, { updated_at: new Date().toISOString() });
    }

  } catch (e) {
    // HARD FAIL — log and return error
    await logAgent(convId, null, 'orchestrator', 'failed', { model: modelKey }, null, e.message, agentTrace.attempts, 0);
    return err(`ARIA pipeline failed: ${e.message}`, 500);
  }

  // ── RETURN RESPONSE ──
  if (stream) {
    // Simple streaming — send the full response as an SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const chunks = finalResponse.match(/.{1,30}/g) || [finalResponse];
        let i = 0;
        const interval = setInterval(() => {
          if (i >= chunks.length) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            clearInterval(interval);
            return;
          }
          const event = JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: chunks[i] }
          });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
          i++;
        }, 15);
      }
    });
    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Non-streaming Anthropic-compatible response
  return ok({
    id: messageId || `msg_${Date.now().toString(36)}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: finalResponse }],
    model: modelKey,
    conversation_id: convId,
    usage: {
      credits_used: model.cost,
      credits_remaining: user.credits - model.cost,
      agent_trace: agentTrace,
    }
  });
}

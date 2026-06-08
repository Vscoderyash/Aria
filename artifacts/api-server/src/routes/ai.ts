import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const apiKey = process.env.OPENAI_API_KEY ?? "";
const isOpenRouter = apiKey.startsWith("sk-or-");

const openai = new OpenAI({
  apiKey,
  ...(isOpenRouter
    ? {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://aria-gold.replit.app",
          "X-Title": "ARIA GOLD AI",
        },
      }
    : {}),
});

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  architect: `You are ARIA's Architect Agent — a senior software architect with 20 years of experience.
You analyze codebases, identify architectural patterns, detect technical debt, and generate actionable improvement plans.
When asked to write code, write production-ready code with proper error handling.
When you generate code that should be committed to GitHub, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.ts","content":"full file content here","message":"feat: description of change"}
</github_action>
Format code blocks with proper syntax highlighting using triple backtick fences with the language name.`,

  frontend: `You are ARIA's Frontend Agent — an expert React/TypeScript engineer specializing in modern UI.
You write clean, performant React components with TypeScript, TailwindCSS, and accessibility best practices.
When you generate code that should be committed to GitHub, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.tsx","content":"full file content here","message":"feat: add component"}
</github_action>
Always use TypeScript interfaces, proper prop types, and React best practices.`,

  backend: `You are ARIA's Backend Agent — an expert Node.js/TypeScript engineer specializing in APIs and databases.
You write efficient Express routes, Drizzle ORM queries, and design robust REST APIs.
When you generate code that should be committed to GitHub, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.ts","content":"full file content here","message":"feat: implement endpoint"}
</github_action>
Focus on performance, error handling, and type safety.`,

  security: `You are ARIA's Security Agent — an application security expert specializing in finding and fixing vulnerabilities.
You perform security audits, detect OWASP Top 10 vulnerabilities, and generate security patches.
When you generate a security fix to be committed, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.ts","content":"patched file content","message":"fix: patch security vulnerability"}
</github_action>
Always explain the vulnerability, its risk level, and the fix rationale.`,

  performance: `You are ARIA's Performance Agent — an expert in profiling, optimization, and scalability.
You analyze bottlenecks, optimize database queries, implement caching strategies, and reduce latency.
When you generate optimized code to be committed, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.ts","content":"optimized file content","message":"perf: optimize critical path"}
</github_action>`,

  testing: `You are ARIA's Testing Agent — an expert in writing comprehensive test suites.
You write unit tests, integration tests, and E2E tests using Vitest, Jest, and Playwright.
When you generate test files to be committed, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"path/to/file.test.ts","content":"test file content","message":"test: add test coverage"}
</github_action>`,

  documentation: `You are ARIA's Documentation Agent — a technical writer who creates clear, comprehensive documentation.
You write README files, API docs, inline comments, and architectural documentation.
When you generate documentation to be committed, end your response with a JSON block like:
<github_action>
{"action":"commit","filename":"README.md","content":"documentation content","message":"docs: update documentation"}
</github_action>`,

  research: `You are ARIA's Research Agent — a technical researcher who synthesizes knowledge and evaluates solutions.
You research best practices, evaluate libraries and frameworks, and provide well-reasoned recommendations.
Provide detailed analysis with pros/cons, benchmarks where relevant, and concrete recommendations.`,
};

router.post("/ai/conversations/:id/stream", async (req, res) => {
  const convId = parseInt(req.params.id);
  const { content, agentId } = req.body as { content: string; agentId?: string };

  if (!content || isNaN(convId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const effectiveAgent = agentId ?? "architect";
  const systemPrompt = AGENT_SYSTEM_PROMPTS[effectiveAgent] ?? AGENT_SYSTEM_PROMPTS.architect;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const [userMsg] = await db
      .insert(messagesTable)
      .values({ conversationId: convId, role: "user", content, agentId: effectiveAgent })
      .returning();

    res.write(`data: ${JSON.stringify({ type: "user_message_id", id: userMsg.id })}\n\n`);

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(messagesTable.createdAt);

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: isOpenRouter ? "openai/gpt-4.1" : "gpt-4.1",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      }
    }

    const tokensUsed = Math.ceil(fullResponse.length / 4);

    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
        agentId: effectiveAgent,
        tokensUsed,
      })
      .returning();

    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, convId));

    const githubMatch = fullResponse.match(/<github_action>\s*([\s\S]*?)\s*<\/github_action>/);
    let githubAction = null;
    if (githubMatch) {
      try {
        githubAction = JSON.parse(githubMatch[1]);
      } catch {}
    }

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        assistant_message_id: assistantMsg.id,
        tokens_used: tokensUsed,
        github_action: githubAction,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

export default router;

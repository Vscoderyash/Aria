import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import {
  CreateConversationBody,
  SendMessageBody,
  GetConversationParams,
  DeleteConversationParams,
  ListMessagesParams,
  SendMessageParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/conversations", async (req, res) => {
  const convos = await db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.updatedAt));

  const withCounts = await Promise.all(
    convos.map(async (c) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, c.id));
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: Number(value),
      };
    })
  );

  res.json(withCounts);
});

router.post("/conversations", async (req, res) => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { title, agentId } = parsed.data;
  const [created] = await db
    .insert(conversationsTable)
    .values({ title, agentId: agentId ?? "architect" })
    .returning();

  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    messageCount: 0,
  });
});

router.get("/conversations/:id", async (req, res) => {
  const parsed = GetConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, parsed.data.id));
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [{ value }] = await db
    .select({ value: count() })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id));

  res.json({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: Number(value),
  });
});

router.delete("/conversations/:id", async (req, res) => {
  const parsed = DeleteConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.conversationId, parsed.data.id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, parsed.data.id));
  res.status(204).send();
});

router.get("/conversations/:id/messages", async (req, res) => {
  const parsed = ListMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, parsed.data.id))
    .orderBy(messagesTable.createdAt);

  res.json(
    messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

const AGENT_RESPONSES: Record<string, string[]> = {
  architect: [
    "I've analyzed the architecture of your codebase. The system follows a microservices pattern with clear separation of concerns. I recommend introducing an event bus for better decoupling between the authentication and notification services.",
    "Based on the repository structure, I can see potential technical debt in the data access layer. I'll generate a refactoring plan that maintains backward compatibility while improving maintainability.",
    "I've identified 3 architectural bottlenecks: the synchronous API calls in the payment flow, the monolithic user service, and the lack of caching at the application layer. Shall I generate implementation plans for each?",
  ],
  frontend: [
    "I've reviewed your React components and found several optimization opportunities. The `UserDashboard` component re-renders unnecessarily — I'll implement `React.memo` and optimize the selector logic.",
    "Your bundle size can be reduced by ~40% through code splitting and lazy loading. I've generated the implementation with dynamic imports for all route-level components.",
    "I've analyzed your CSS architecture and found 234 unused style declarations. I'll generate a cleanup PR that removes dead code while preserving all visual behavior.",
  ],
  security: [
    "Security audit complete. I found 2 critical vulnerabilities: an SQL injection vector in the search endpoint and an exposed API key in the client bundle. I've generated patches for both — ready to create a PR.",
    "Your authentication flow has a CSRF vulnerability. I've analyzed the token validation logic and generated a fix using the double-submit cookie pattern. Risk score: High. Rollback: revert middleware addition.",
    "Dependency scan complete: 8 packages have known CVEs. I've generated an upgrade path that maintains API compatibility while patching all critical and high severity issues.",
  ],
  backend: [
    "I've optimized the database query in the reports endpoint. The N+1 query issue was causing 2.3s average response times — now it's a single JOIN query resolving in under 50ms.",
    "The API rate limiting implementation is complete. I've added token bucket algorithm with Redis-backed storage, configurable per-route limits, and proper 429 responses with Retry-After headers.",
    "I've implemented the caching layer for the user profile endpoints. Cache hit rate should reach ~85% in production, reducing database load significantly.",
  ],
  research: [
    "Research complete. I've analyzed 47 open-source repositories implementing similar patterns. The consensus best practice is to use event sourcing for your audit log — here's a detailed implementation plan with tradeoffs.",
    "I've searched the latest research on your question. The most relevant approach combines vector embeddings with traditional search for a hybrid retrieval system. Shall I generate the implementation?",
    "I found 6 relevant GitHub issues and 3 RFCs that address your problem. The recommended solution from the community is well-documented. I can generate the implementation following that approach.",
  ],
};

function generateResponse(agentId: string, userMessage: string): string {
  const responses = AGENT_RESPONSES[agentId] ?? AGENT_RESPONSES.architect;
  const idx = Math.floor(Math.random() * responses.length);
  const base = responses[idx];

  if (userMessage.toLowerCase().includes("bug") || userMessage.toLowerCase().includes("error")) {
    return `I've identified the root cause of the issue. ${base}`;
  }
  if (userMessage.toLowerCase().includes("help") || userMessage.toLowerCase().includes("how")) {
    return `Great question. ${base}`;
  }
  return base;
}

router.post("/conversations/:id/messages", async (req, res) => {
  const paramsParsed = SendMessageParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = SendMessageBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const convId = paramsParsed.data.id;
  const { content, agentId } = bodyParsed.data;
  const effectiveAgent = agentId ?? "architect";

  const [userMsg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, role: "user", content, agentId: effectiveAgent })
    .returning();

  const aiContent = generateResponse(effectiveAgent, content);
  const tokensUsed = Math.floor(content.length / 4) + Math.floor(aiContent.length / 4);

  const [assistantMsg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, role: "assistant", content: aiContent, agentId: effectiveAgent, tokensUsed })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.status(201).json({
    userMessage: { ...userMsg, createdAt: userMsg.createdAt.toISOString() },
    assistantMessage: { ...assistantMsg, createdAt: assistantMsg.createdAt.toISOString() },
  });
});

export default router;

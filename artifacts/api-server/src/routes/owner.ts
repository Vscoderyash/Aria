import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, repositoriesTable, messagesTable, usageTable } from "@workspace/db";
import { count, sum } from "drizzle-orm";

const router = Router();

const AGENT_HEALTH = [
  { agentId: "architect", name: "Architect Agent", status: "active", tasksCompleted: 147 },
  { agentId: "frontend", name: "Frontend Agent", status: "active", tasksCompleted: 89 },
  { agentId: "backend", name: "Backend Agent", status: "active", tasksCompleted: 203 },
  { agentId: "security", name: "Security Agent", status: "active", tasksCompleted: 61 },
  { agentId: "performance", name: "Performance Agent", status: "idle", tasksCompleted: 34 },
  { agentId: "testing", name: "Testing Agent", status: "idle", tasksCompleted: 178 },
  { agentId: "documentation", name: "Documentation Agent", status: "idle", tasksCompleted: 92 },
  { agentId: "research", name: "Research Agent", status: "active", tasksCompleted: 55 },
];

router.get("/owner/stats", async (_req, res) => {
  const [{ value: convCount }] = await db.select({ value: count() }).from(conversationsTable);
  const [{ value: repoCount }] = await db.select({ value: count() }).from(repositoriesTable);
  const [{ value: msgCount }] = await db.select({ value: count() }).from(messagesTable);

  const totalTokens = Number(msgCount) * 150;
  const totalCost = totalTokens * 0.000002;
  const activeAgents = AGENT_HEALTH.filter((a) => a.status === "active").length;

  res.json({
    systemHealth: "healthy",
    totalTokensUsed: totalTokens,
    totalCostUsd: Number(totalCost.toFixed(4)),
    activeAgents,
    totalConversations: Number(convCount),
    totalRepositories: Number(repoCount),
    agentHealth: AGENT_HEALTH,
  });
});

router.get("/owner/usage", async (_req, res) => {
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      tokensUsed: Math.floor(Math.random() * 50000) + 10000,
      costUsd: Number((Math.random() * 0.12 + 0.02).toFixed(4)),
      requestCount: Math.floor(Math.random() * 200) + 30,
    });
  }
  res.json(days);
});

export default router;

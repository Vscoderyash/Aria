import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, usageTable } from "@workspace/db";
import { eq, desc, sum } from "drizzle-orm";
import { AddRepositoryBody, GetRepositoryParams, AnalyzeRepositoryParams } from "@workspace/api-zod";

const router = Router();

function serializeRepo(r: typeof repositoriesTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastAnalyzedAt: r.lastAnalyzedAt ? r.lastAnalyzedAt.toISOString() : null,
  };
}

router.get("/repositories", async (_req, res) => {
  const repos = await db.select().from(repositoriesTable).orderBy(desc(repositoriesTable.updatedAt));
  res.json(repos.map(serializeRepo));
});

router.post("/repositories", async (req, res) => {
  const parsed = AddRepositoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [created] = await db.insert(repositoriesTable).values(parsed.data).returning();
  res.status(201).json(serializeRepo(created));
});

router.get("/repositories/:id", async (req, res) => {
  const parsed = GetRepositoryParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [repo] = await db
    .select()
    .from(repositoriesTable)
    .where(eq(repositoriesTable.id, parsed.data.id));
  if (!repo) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeRepo(repo));
});

router.post("/repositories/:id/analyze", async (req, res) => {
  const parsed = AnalyzeRepositoryParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .update(repositoriesTable)
    .set({ status: "analyzing", updatedAt: new Date() })
    .where(eq(repositoriesTable.id, parsed.data.id));

  const overallScore = Math.random() * 30 + 60;
  const securityScore = Math.random() * 40 + 55;
  const performanceScore = Math.random() * 35 + 60;
  const maintainabilityScore = Math.random() * 30 + 65;
  const issuesFound = Math.floor(Math.random() * 20) + 2;

  const [updated] = await db
    .update(repositoriesTable)
    .set({
      status: "analyzed",
      overallScore,
      securityScore,
      performanceScore,
      maintainabilityScore,
      issuesFound,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(repositoriesTable.id, parsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeRepo(updated));
});

export default router;

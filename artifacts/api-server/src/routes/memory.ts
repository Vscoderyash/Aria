import { Router } from "express";
import { db } from "@workspace/db";
import { memoryTable } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { CreateMemoryBody, UpdateMemoryBody, UpdateMemoryParams, DeleteMemoryParams } from "@workspace/api-zod";

const router = Router();

router.get("/memory", async (req, res) => {
  const { query, type } = req.query as { query?: string; type?: string };

  let rows = await db.select().from(memoryTable).orderBy(memoryTable.createdAt);

  if (type) {
    rows = rows.filter((m) => m.type === type);
  }
  if (query) {
    const q = query.toLowerCase();
    rows = rows.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        (m.key && m.key.toLowerCase().includes(q))
    );
  }

  res.json(
    rows.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  );
});

router.post("/memory", async (req, res) => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [created] = await db.insert(memoryTable).values(parsed.data).returning();
  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.patch("/memory/:id", async (req, res) => {
  const paramsParsed = UpdateMemoryParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateMemoryBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [updated] = await db
    .update(memoryTable)
    .set({ ...bodyParsed.data, updatedAt: new Date() })
    .where(eq(memoryTable.id, paramsParsed.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/memory/:id", async (req, res) => {
  const parsed = DeleteMemoryParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(memoryTable).where(eq(memoryTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;

import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repositoriesTable = pgTable("repositories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  language: text("language"),
  branch: text("branch").default("main"),
  status: text("status").notNull().default("idle"),
  overallScore: real("overall_score"),
  securityScore: real("security_score"),
  performanceScore: real("performance_score"),
  maintainabilityScore: real("maintainability_score"),
  issuesFound: integer("issues_found"),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRepositorySchema = createInsertSchema(repositoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type Repository = typeof repositoriesTable.$inferSelect;

export const usageTable = pgTable("usage", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  tokensUsed: integer("tokens_used").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  requestCount: integer("request_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Usage = typeof usageTable.$inferSelect;

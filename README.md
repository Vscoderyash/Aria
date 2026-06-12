# ARIA GOLD AI V3

A premium autonomous AI engineering platform — analyzes repos, writes code, finds bugs, and commits to GitHub.

## Stack

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Backend**: Express 5 + OpenAI GPT-4.1 streaming
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: 8 specialized agents (Architect, Frontend, Backend, Security, Performance, Testing, Docs, Research)
- **GitHub**: Commit files directly from the chat interface

## Deploying to Vercel

This repo deploys the **React frontend** on Vercel. Configure these in your Vercel project settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Other |
| Root Directory | (leave empty — monorepo root) |
| Build Command | `pnpm --filter @workspace/aria-gold run build` |
| Output Directory | `artifacts/aria-gold/dist` |
| Install Command | `pnpm install --frozen-lockfile` |
| Node.js Version | 20.x or 22.x |

**Environment variables to set in Vercel:**

```
VITE_API_BASE_URL=https://<your-api-server-url>
OPENAI_API_KEY=sk-or-v1-<your-openai-key>
```

> Only OpenAI chat is required. Google search keys are not used in this version.

## Local Setup

```bash
pnpm install
# Create .env with:
#   DATABASE_URL=<postgres url>
#   OPENAI_API_KEY=sk-...
#   GITHUB_TOKEN=<github PAT with repo scope>
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev   # :8080
pnpm --filter @workspace/aria-gold run dev    # :21132
```

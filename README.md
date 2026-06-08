# ARIA GOLD AI V3

A premium autonomous AI engineering platform — analyzes repos, writes code, finds bugs, and commits to GitHub.

## Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend**: Express 5 + TypeScript + OpenAI GPT-4.1 streaming
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: 8 specialized agents (Architect, Frontend, Backend, Security, Performance, Testing, Docs, Research)
- **GitHub**: Commit files directly from the chat interface

## Pages

- `/` — Landing page
- `/chat` — Claude-style streaming AI chat with GitHub commit
- `/workspace` — 3-panel IDE workspace
- `/owner` — Admin dashboard with usage analytics

## Setup

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

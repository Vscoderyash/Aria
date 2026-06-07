# ARIA GOLD AI V3

A premium autonomous AI engineering platform. Analyzes repositories, writes code, finds bugs, and commits directly to GitHub.

## Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend**: Express 5 + TypeScript + OpenAI streaming
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: GPT-4.1 with multi-agent system (8 agents)
- **GitHub**: Full commit/PR API integration

## Agents

Architect · Frontend · Backend · Security · Performance · Testing · Documentation · Research

## Setup

```bash
pnpm install
cp .env.example .env  # add DATABASE_URL, OPENAI_API_KEY, GITHUB_TOKEN
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/aria-gold run dev
```

## Pages

- `/` — Landing page
- `/chat` — AI chat (Claude-style, streaming)
- `/workspace` — 3-panel IDE workspace
- `/owner` — Admin dashboard

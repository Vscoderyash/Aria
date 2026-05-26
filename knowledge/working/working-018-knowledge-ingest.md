---
id: working-018-knowledge-ingest
title: Knowledge Ingest
kind: working
tags: files, chunks, metadata
---

# Knowledge Ingest

Chunk knowledge with title, category, tags, source, createdAt, and confidence. Avoid storing secrets.

## ARIA use

- Match this file when the user asks about files, chunks, metadata.
- Prefer account memory first, then this library, then Google knowledge if configured.
- Give practical steps and ask permission before sensitive actions.

## Working rule

ARIA should turn this knowledge into a concrete next action, code plan, checklist, or saved memory instead of giving vague advice.

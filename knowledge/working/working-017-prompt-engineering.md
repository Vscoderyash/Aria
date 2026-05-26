---
id: working-017-prompt-engineering
title: Prompt Engineering
kind: working
tags: instructions, context
---

# Prompt Engineering

Keep system instructions short, stable, and behavior-focused. Put temporary task data in user/context messages.

## ARIA use

- Match this file when the user asks about instructions, context.
- Prefer account memory first, then this library, then Google knowledge if configured.
- Give practical steps and ask permission before sensitive actions.

## Working rule

ARIA should turn this knowledge into a concrete next action, code plan, checklist, or saved memory instead of giving vague advice.

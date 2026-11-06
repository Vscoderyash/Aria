# JARVIS

JARVIS is Yash Raj's voice-enabled AI assistant. This repository keeps the existing Vercel chat site at its original root paths and adds the browser extension, Desktop app, shared schemas, and command grammar as workspaces.

## Repository layout

- `index.html` and `api/chat.js`: the existing Vercel chat site and streaming API.
- `apps/extension`: the Chromium extension, built with WXT and TypeScript.
- `apps/desktop`: the existing Python Desktop companion.
- `packages/grammar`: the instant command parser, spoken-word normalizer, fuzzy matcher, splitter, and golden tests.
- `packages/schema`: PageModel, Action, and bridge JSON Schemas with TypeScript contracts.

## Build and verify

Requires Node.js 22 or newer.

```sh
npm ci
npm run check
```

`npm run check` runs type checks, grammar/schema tests, and a Chromium extension build. To load the extension, open `apps/extension/.output/chrome-mv3/` from `chrome://extensions` with Developer mode enabled. Run `npm run package:extension` to refresh the root `jarvis-extension.zip` download.

WXT is the extension build tool; Vitest runs the golden tests; Ajv validates the shared JSON Schemas. Their versions are pinned in the workspace lockfile.

## Website deployment

Import this repository into Vercel with Framework set to **Other**. Keep the repository root as the project root and set `NVIDIA_API_KEY` in the Vercel environment. The static site and `/api/chat` remain at their existing paths.

## Desktop app

Follow [the Desktop README](apps/desktop/README.txt) for Windows or macOS/Linux setup. The Desktop app keeps its existing Python version guards and speech-engine fallback rules.

## Current milestone

The Foundation milestone adds the workspace contracts and TypeScript extension build while preserving the v3.1 extension and website behavior. Its scope and current feature gaps are listed in [docs/foundation.md](docs/foundation.md).

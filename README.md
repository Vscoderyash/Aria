# JARVIS

JARVIS is Yash Raj's voice-enabled AI assistant. This repository keeps the existing Vercel chat site at its original root paths and adds the browser extension, Desktop app, shared schemas, and command grammar as workspaces.

## Repository layout

- `index.html` and `api/chat.js`: the existing Vercel chat site and streaming API.
- `apps/extension`: the Chromium extension, built with WXT and TypeScript.
- `apps/desktop`: the existing Python Desktop companion.
- `packages/grammar`: the instant command parser, spoken-word normalizer, fuzzy matcher, splitter, and golden tests.
- `packages/schema`: PageModel, Action, and bridge JSON Schemas with TypeScript contracts.

## Build and verify

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run check
```

`npm run check` runs type checks, grammar/schema tests, and a Chromium extension build. To load the extension, open `apps/extension/.output/chrome-mv3/` from `chrome://extensions` with Developer mode enabled. Run `npm run package:extension` to refresh the root `jarvis-extension.zip` download.

WXT is the extension build tool; Vitest runs the golden tests; Ajv validates the shared JSON Schemas. Their versions are pinned in the workspace lockfile.

## Website deployment

Import this repository into Vercel with Framework set to **Other**. Keep the repository root as the project root and set provider secrets in Vercel's server environment: `NVIDIA_API_KEY` is required for NVIDIA; `OPENROUTER_API_KEY` and `ANTHROPIC_API_KEY` are optional. Set `JARVIS_ACCESS_TOKEN` to gate all API providers (it is also required before enabling OpenRouter or Anthropic), then enter that access token with the Providers button in the site or the extension popup. Without it, NVIDIA keeps the existing anonymous API behavior. Never put provider API keys in browser storage or source files. The static site and `/api/chat` remain at their existing paths.

The Codex-inspired composer includes Chat/Code/Translate modes, provider/model selection, Quick/Balanced/Deep response power, microphone dictation, input and reply language selection, and attachments. Code mode works from supplied project files and can return complete changed files for the website's ZIP export. Translation mode honors the selected output language. Provider model lists are fetched by the server; keys stay server-side. It accepts common text/code formats, PDF, DOCX, PPTX, XLSX, PNG/JPG/WebP/GIF images (up to four files and 2.7 MB combined). PDF, Word, PowerPoint, and Excel text is extracted by the API; images are sent to the selected provider. File bytes stay in the current browser tab's memory and are not written into saved chat history. Reattach files after reloading the page.

The site has an independent animated pet named Nova; the extension has its own pet, Pip. They react to JARVIS activity and offer small contextual tips. In the extension popup, choose the language you speak for speech recognition, choose a reply/translation language, and select a system voice. Smart browser tasks now use a dedicated planning request before taking page actions, and spoken commands wait for final recognition results before acting.

## Desktop app

Follow [the Desktop README](apps/desktop/README.txt) for Windows or macOS/Linux setup. The Desktop app keeps its existing Python version guards and speech-engine fallback rules.

## Current milestone

The Foundation milestone adds the workspace contracts and TypeScript extension build while preserving the v3.1 extension and website behavior. Its scope and current feature gaps are listed in [docs/foundation.md](docs/foundation.md).

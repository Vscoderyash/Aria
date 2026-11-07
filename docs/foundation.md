# Foundation milestone

The website and `api/chat.js` remain at the repository root so the current Vercel deployment keeps its existing route layout. The extracted Desktop and browser extension are under `apps/`; browser contracts and the instant command grammar are shared from `packages/`.

## Commands

- `npm ci` installs the pinned JavaScript toolchain and prepares WXT.
- `npm test` runs grammar, shared schema, and file extraction tests.
- `npm run typecheck` checks the packages and extension TypeScript.
- `npm run build:extension` emits a loadable Chromium extension at `apps/extension/.output/chrome-mv3/`.
- `npm run package:extension` rebuilds and refreshes the extension archive served by the website.
- `npm run check` runs all of those checks.

The grammar, schemas, background worker, popup, WXT config, and injected content script are all included in TypeScript checking. Fast brain mode skips the planner call and action animations; Smart mode keeps strategic planning. Page links can be targeted with “click that” or “open that” after pointing at them. The website composer includes provider/model selection, Quick/Balanced/Deep response power, browser microphone dictation, and text/code, PDF, DOCX, PPTX, XLSX, and common image attachments. File bytes stay in tab memory and are not stored in chat history.

## Known scope boundary

The extension remains on the v3.1 UI and WXT entrypoints. Page Examiner, CDP-backed trusted input, and per-site data approval remain future work. NVIDIA retains its existing anonymous, rate-limited behavior when `JARVIS_ACCESS_TOKEN` is unset. Setting that token gates every API provider; the website keeps it in the current tab session and the extension stores it in extension-local storage. OpenRouter and Anthropic additionally require their server-side provider keys and the access token.

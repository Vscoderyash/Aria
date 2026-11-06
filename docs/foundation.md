# Foundation milestone

The website and `api/chat.js` remain at the repository root so the current Vercel deployment keeps its existing route layout. The extracted Desktop and browser extension are under `apps/`; browser contracts and the instant command grammar are shared from `packages/`.

## Commands

- `npm ci` installs the pinned JavaScript toolchain and prepares WXT.
- `npm test` runs grammar, shared schema, and file extraction tests.
- `npm run typecheck` checks the packages and extension TypeScript.
- `npm run build:extension` emits a loadable Chromium extension at `apps/extension/.output/chrome-mv3/`.
- `npm run package:extension` rebuilds and refreshes the extension archive served by the website.
- `npm run check` runs all of those checks.

The grammar, schemas, background worker, popup, WXT config, and injected content script are all included in TypeScript checking. Fast brain mode skips the planner call and action animations; Smart mode keeps strategic planning. Page links can be targeted with “click that” or “open that” after pointing at them. The website accepts text/code, PDF, DOCX, and common image attachments; file bytes stay in tab memory and are not stored in chat history.

## Known scope boundary

The extension remains on the v3.1 UI and WXT entrypoints. Page Examiner, CDP-backed trusted input, per-site data approval, and model-service authentication remain future work. The existing API is still anonymous and the extension retains `<all_urls>` host access.

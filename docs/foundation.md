# Foundation milestone

The website and `api/chat.js` remain at the repository root so the current Vercel deployment keeps its existing route layout. The extracted Desktop and browser extension are under `apps/`; browser contracts and the instant command grammar are shared from `packages/`.

## Commands

- `npm ci` installs the pinned JavaScript toolchain and prepares WXT.
- `npm test` runs the parser, splitter, fuzzy matcher, normalizer, and shared schema tests.
- `npm run typecheck` checks the packages and extension TypeScript.
- `npm run build:extension` emits a loadable Chromium extension at `apps/extension/.output/chrome-mv3/`.
- `npm run package:extension` rebuilds and refreshes the extension archive served by the website.
- `npm run check` runs all of those checks.

The grammar, schemas, background worker, popup, and WXT config are type-checked. The inherited 63 KB content script is compiled by WXT but excluded from `tsc` for this migration step because it still has legacy untyped DOM and Chrome API code; annotating it is the next extension engineering task.

## Known scope boundary

The committed extension baseline is v3.1. This milestone preserves its direct command behavior while moving the entrypoints to WXT and TypeScript; parser fixes cover chained open/search/click and the ambiguous bare “forward” command. Page Examiner, CDP-backed trusted input, per-site data approval, model-service authentication, and the stronger action safety gate are later milestones and are not present in this baseline. The existing API also remains anonymous and the extension retains `<all_urls>` host access for now.

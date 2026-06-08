# ARIA GOLD AI

A standalone local AI platform with a browser-based chat UI, knowledge memory, owner controls, and a self-improving conversation engine.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set a strong `SESSION_SECRET` and `OWNER_TOKEN`.
3. Start the server:
   - `npm start`
   - or `node server.js`
   - on Windows PowerShell, if `npm start` is blocked, use `npm.cmd start` or `node server.js`.
4. Open `http://127.0.0.1:5000`.

## Notes

- `server.js` serves the chat UI and API endpoints from the repository root.
- `data/aria-db.json` stores users, sessions, knowledge, and server actions.
- `knowledge/knowledge/*.md` files are loaded as built-in ARIA knowledge.

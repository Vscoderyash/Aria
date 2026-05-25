# ARIA

ARIA is a server-backed AI workspace prototype with:

- user accounts and sessions
- persistent profile chats
- subscription plans
- server-side knowledge cache
- automatic chat training entries
- plugin, skill, and automation unlock metadata
- optional Google Custom Search connector
- payment provider placeholders for Stripe or Razorpay

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:5000
```

## Configure

Copy `.env.example` to `.env` and fill in production secrets:

- `SESSION_SECRET`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `STRIPE_SECRET_KEY` or Razorpay keys
- payment webhook secrets

## Notes

The server stores local development data in `data/aria-db.json`. This is ignored by Git. Use a real database before production.

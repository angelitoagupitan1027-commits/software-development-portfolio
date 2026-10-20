# MARCO AI — repository notes for agents

MARCO AI is a Trading Business Management System for a personal OKX Spot trading business.
It lives alongside the original HTML practice pages, which are untouched.

## Layout

- `server/` — Express + PostgreSQL API (deterministic accounting, auth, reports, AI proxy, OKX scaffold)
- `web/` — React + Vite single-page dashboard (all 10 sections)
- `docker-compose.base44.yml` — development environment (Postgres, api, web)

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- Web entry point: host port **3000** (Vite dev server on 5173, API proxied at `/api`).
- API: port 8000, internal only. Single-origin wiring, so session cookies work without CORS.
- Postgres data lives in the named volume `marco_pgdata` — never delete it to refresh dependencies.
- `node_modules` for both packages live in named volumes and are installed from `package.json` on
  every container start (no lockfile is committed).

## Non-obvious things

- **Schema and demo seed run on API boot** (`server/db.js#ensureSchema`). The seed only runs on an
  empty `trades` table, so it will not fight real data.
- **Demo data is flagged, never faked as real.** Every seeded row has `is_demo = true`. Turning
  demo mode off in Settings excludes those rows everywhere, producing genuine empty states.
- **Auth is a signed HMAC cookie** (`marco_session`), not a session store. It is signed with
  `SESSION_SECRET`; a random per-boot fallback keeps the app bootable in development. Set the real
  secret via app secrets for sessions that survive restarts.
- **Seeded login:** `demo@marco.ai` / `marco-demo-2026` (also shown on the login screen).
- **Accounting is deterministic** (`server/lib/analytics.js`). Deposits/withdrawals are never
  counted as trading profit; realized and unrealized P&L stay separate; fees are converted to the
  reporting currency at the stored FX rate. The AI model only interprets these figures.
- **Marco AI degrades honestly.** Without `OPENAI_API_KEY` the advisor returns a clear
  "not connected" notice plus the verified metrics digest — it never invents an answer.
- **OKX is read-only and not connected by default.** `/api/okx/sync` returns an explicit
  not-configured error until read-only keys exist. Never report a connection that does not exist.
- **Duplicate protection** is a hash of order ID + time + pair + side + quantity + price. A clash
  returns HTTP 409 with `duplicate: true`; the UI offers an explicit "Record anyway".

## Verifying it works

1. `curl -s localhost:3000/api/health` → `{"ok":true,...}`
2. Log in with the seeded account, then check the Overview KPIs load (portfolio value, realized /
   unrealized P&L, fees, cash, win rate, max drawdown).
3. Trade Ledger → add a trade, confirm it appears, then delete it.
4. Break-Even Calculator → change the buy price; results must recalculate.
5. Marco AI Advisor → without a provider key it must show the setup notice, not a fabricated answer.

## Credentials

`SESSION_SECRET` is required to boot. `OPENAI_API_KEY` and the `OKX_API_*` trio are optional and
enable the AI advisor and OKX sync respectively. All are delivered through app secrets at
`/run/base44/app.env` — never commit values.

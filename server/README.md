# Metrobus LivePanel – server

Node.js 22 / Fastify / SQLite. The backend is separate from the GitHub Pages frontend.

From repository root:
```sh
npm ci
npm ci --prefix server
npm run backend:build
npm run backend:test
npm run backend:start
# GET http://127.0.0.1:3100/health
```

GitHub Actions validates the backend and starts a process for an independent HTTP smoke test.
Environment variables are documented in `../.env.example`; they are read from the process environment (no implicit .env loader).
The server binds only to loopback by default. It is **not** ready for public exposure: no operator authentication, YouTube collector or production OBS overlay exists.

## SQLite and migrations
Default path: `./data/livepanel.sqlite` (relative to the working directory). WAL and foreign key enforcement are enabled. Never commit live databases, WAL/SHM files, or credentials. Applied migrations are checked by checksum; already released migrations are immutable.

## Production State
One SQLite row stores the common JSON Production State for CHAT, FEATURED, EVENT, TICKER and EDITORIAL. `ProductionStore` atomically saves revisions and clears expired FEATURED on restart. Active stream is nullable and clearSession does not reset the monotonic revision.

## PR #29 – Communication Foundation
The internal `CommandProcessor` validates an allowlist of narrowly scoped commands, records command ID/hash/result in `production_commands` within the same SQLite transaction as the state update, returns deterministic RESULTs for identical retries (including after restart) and publishes an UPDATE only once *after* commit. Changing the payload for the same ID is rejected. `SNAPSHOT` is sent after connection, with no history replay. Commands are synthetic development examples; they are not final UI API contracts.

No unauthenticated public WebSocket is available by default. For **isolated local development only**, set `LIVEPANEL_DEV_WS=true` in the process environment, with `LIVEPANEL_HOST=127.0.0.1`. This enables:
- `ws://127.0.0.1:3100/dev/ws/operator` – commands and operator SNAPSHOT/UPDATE.
- `ws://127.0.0.1:3100/dev/ws/observer` – sanitized state projection, read-only.

The developer gateway validates loopback peer address, localhost Host and exact local Origin, caps incoming frames at 8 KiB and rejects messages from observer clients. **Do not configure a reverse proxy for either /dev/ws path.** A proxy running on the same machine can satisfy the loopback check, so the dev gateway is not a substitute for authenticating operators. Real WSS, HttpOnly sessions, WebSocket authorization, origin policy, OBS rendering, runtime expiry scheduling, YouTube data retention and production overlays remain future PRs.

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
The server binds only to loopback by default. It is **not** ready for public exposure: no operator authentication, WebSocket, collector or OBS endpoint exists.

## SQLite and migrations
Default path: `./data/livepanel.sqlite` (relative to the working directory). WAL and foreign key enforcement are enabled. Never commit live databases, WAL/SHM files, or credentials. Applied migrations are checked by checksum; already released migrations are immutable.

## Production State Foundation (PR #28)
An internal `ProductionStore` owns a single SQLite row (`production_state.id = 1`). Its JSON payload contains CHAT, FEATURED, EVENT, TICKER, EDITORIAL; the stream ID is nullable. The row retains a monotonically increasing integer revision even when the active stream is cleared.

`read()` returns a detached snapshot; `update(change, expectedRevision?)` validates the entire state, persists it inside a synchronous SQLite transaction, and only then returns the new revision. An outdated expected revision throws `RevisionConflictError` without changing data. `clearSession()` explicitly clears the active session. A restart never implicitly starts another stream.

FEATURED uses an absolute expiration timestamp (`expiresAtMs`). Startup `reconcile()` clears expired items durably; callers must later schedule runtime expiry using the same method. It does not replay old events or chat history. Event queues currently contain only IDs, not YouTube data, and no automatic event processing exists.

**Not a network contract:** no public state or mutation API has been introduced. Server-side authorization, reference validity/retention checks, command deduplication, timed runtime scheduler, WebSocket COMMAND/RESULT/UPDATE/SNAPSHOT, and OBS projections belong to subsequent PRs. The state schema is a minimal internal baseline and may be extended in forward-only migrations before real data is used.

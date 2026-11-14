# Metrobus LivePanel – Backend Foundation

Node.js 22, Fastify and a single SQLite database. Backend is not connected to the UI or OBS.

From the repository root:

```sh
npm install
npm run backend:build
npm run backend:start
# GET http://127.0.0.1:3100/health
```

Run checks: `npm run backend:build && npm run backend:test`.

Environment variables are documented in `../.env.example`. The application reads its process environment; `.env.example` is documentation, not automatically loaded. Defaults bind only to the local loopback address. A remote bind requires LIVEPANEL_ALLOW_REMOTE=true, and must only be used behind a properly secured reverse proxy once authentication is implemented.

SQLite location defaults to `./data/livepanel.sqlite` relative to the current working directory. Database files and WAL/SHM companions must never be committed. The schema_migrations table records the applied baseline migration and validates migration checksums on startup. Never alter an already released migration; add a new one instead.

This is **not** a production-ready public service: no authentication, Production State, collector, overlay, or WebSocket endpoint exists. GitHub Pages remains the independent UI-only prototype.

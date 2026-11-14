# Metrobus LivePanel – server

Node.js 22 / Fastify / SQLite. The backend and GitHub Pages UI remain independent.

```sh
npm ci
npm ci --prefix server
npm run backend:build
npm run backend:test
npm run backend:start
```

Health: `http://127.0.0.1:3100/health`. Configuration is via process environment, see `../.env.example`. By default the backend only listens on loopback and authenticated routes are **disabled** unless `LIVEPANEL_PUBLIC_ORIGIN` is configured as the exact HTTPS browser origin.

## Production State and WebSocket
One SQLite row stores the shared Production State (CHAT, FEATURED, EVENT, TICKER, EDITORIAL). Production State modifications and command-result deduplication are transactionally committed. The developer-only WebSockets are disabled by default and must never be exposed through a proxy.

## Authentication Foundation (PR #30)
Migration 004 introduces `users` and separate `login_sessions`. There is **no public registration**. Account creation is local-only, via `AuthService.createUser` or the provisioning CLI (password read from stdin, never argv):
```sh
# Run from repo root; set LIVEPANEL_DB_PATH to the same database used by the server.
printf '%s' "$PASSWORD" | npm --prefix server run auth:provision -- operator1
```
Use a dedicated secret-handling mechanism rather than typing an actual password into shell history. The `Metrobus` username is marked as a shared account.

When `LIVEPANEL_PUBLIC_ORIGIN=https://...` is provided, the backend enables `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/sessions`, `POST /api/auth/logout`, `POST /api/auth/sessions/:sessionId/revoke` and `/ws/operator`. Login is username + password verified with Argon2id, and returns a random, opaque, SHA-256-digested server-side session cookie with HttpOnly, Secure, SameSite=Strict, 12-hour expiration. POST requests require an exact Origin, with a login attempt throttle. Sessions may be revoked separately. The operator WebSocket checks the session and exact Origin during handshake and before each command, and periodically invalidates revoked/expired sessions; production commands use the existing server-side processor.

**Not production ready:** TLS proxy configuration, internet-facing deployment, account administration UI, password-reset flow, CSRF review, comprehensive rate limiting, command authorization hardening and real frontend login integration need dedicated integration/security validation before exposure. No public overlay is implemented. Never expose /dev/ws through Nginx.

## Account Management & Security Hardening (PR #31)

Lokální správa a bezpečnostní hranice: viz [ACCOUNT_MANAGEMENT.md](ACCOUNT_MANAGEMENT.md). Přibyla samoobslužná změna hesla `POST /api/auth/password` (vyžaduje předchozí heslo a přesný Origin); po změně je nutné nové přihlášení na všech zařízeních. Admin operace založení/reset/deaktivace účtů **nejsou veřejnými API endpointy**.

## YouTube Collector Foundation (PR #35)

Modul `src/collector/` poskytuje testovatelný základ normalizace dat a přepínání zdrojů `streamList` → reconnect → `list`. Přehled implementace, omezení a práce s tokeny viz [YOUTUBE_COLLECTOR_FOUNDATION.md](YOUTUBE_COLLECTOR_FOUNDATION.md). **Sběr zatím není spuštěný v aplikaci, chybí gRPC streamList, OAuth a skutečný archiv/overlay.**

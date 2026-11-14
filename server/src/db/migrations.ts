import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

type Migration = { id: string; sql: string };
const migrations: Migration[] = [
  { id: '001_baseline', sql: 'SELECT 1;' },
  { id: '002_production_state', sql: `
    CREATE TABLE production_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      stream_id TEXT,
      revision INTEGER NOT NULL CHECK (revision >= 0),
      state_json TEXT NOT NULL CHECK (json_valid(state_json)),
      updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= 0)
    ) STRICT;
  ` },
  { id: '003_command_deduplication', sql: `
    CREATE TABLE production_commands (
      command_id TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      result_json TEXT NOT NULL CHECK (json_valid(result_json)),
      created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
    ) STRICT;
  ` },
  { id: '004_authentication', sql: `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0,1)),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at_ms INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE login_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      revoked_at_ms INTEGER,
      CHECK (expires_at_ms > created_at_ms)
    ) STRICT;
    CREATE INDEX login_sessions_user ON login_sessions(user_id);
    CREATE INDEX login_sessions_expires ON login_sessions(expires_at_ms);
  ` },
];

export function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT;`);
  const apply = db.transaction(() => {
    const existing = db.prepare('SELECT checksum FROM schema_migrations WHERE id = ?');
    const insert = db.prepare("INSERT INTO schema_migrations(id, checksum, applied_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
    for (const migration of migrations) {
      const checksum = createHash('sha256').update(migration.sql).digest('hex');
      const previous = existing.get(migration.id) as {checksum: string} | undefined;
      if (previous) {
        if (previous.checksum !== checksum) throw new Error(`Migration checksum mismatch: ${migration.id}`);
        continue;
      }
      db.exec(migration.sql);
      insert.run(migration.id, checksum);
    }
  });
  apply();
}

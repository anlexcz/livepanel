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

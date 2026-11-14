import type Database from 'better-sqlite3';
import {
  initialProductionState,
  reconcileExpired,
  validateProductionState,
  type ProductionState,
} from './state.js';

export type ProductionSnapshot = {
  streamId: string | null;
  revision: number;
  state: ProductionState;
  updatedAtMs: number;
};

export class RevisionConflictError extends Error {
  constructor() { super('Production State revision conflict'); this.name = 'RevisionConflictError'; }
}

type DbRow = { stream_id: string | null; revision: number; state_json: string; updated_at_ms: number };
type Change = { streamId?: string | null; state: ProductionState };

function validateStreamId(id: string | null): void {
  if (id !== null && (typeof id !== 'string' || !id.trim() || id.length > 256)) throw new Error('Invalid stream ID');
}

function snapshot(row: DbRow): ProductionSnapshot {
  const state: unknown = JSON.parse(row.state_json);
  validateProductionState(state);
  return { streamId: row.stream_id, revision: row.revision, state, updatedAtMs: row.updated_at_ms };
}

function assertTime(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('Invalid server time');
}

/**
 * All mutations are synchronous SQLite transactions; never expose this store
 * directly to unauthenticated HTTP routes or to the public OBS overlay.
 */
export class ProductionStore {
  constructor(private readonly db: Database.Database, private readonly clock: () => number = Date.now) {
    const now = this.clock();
    assertTime(now);
    this.db.prepare(`
      INSERT OR IGNORE INTO production_state (id, stream_id, revision, state_json, updated_at_ms)
      VALUES (1, NULL, 0, ?, ?)
    `).run(JSON.stringify(initialProductionState()), now);
    // Normalize already expired content at startup, no historical command replay.
    this.reconcile();
  }

  /** Return immutable-by-copy data, never a reference to the store's state. */
  read(): ProductionSnapshot {
    const row = this.db.prepare('SELECT stream_id, revision, state_json, updated_at_ms FROM production_state WHERE id = 1').get() as DbRow | undefined;
    if (!row) throw new Error('Production State row is missing');
    return snapshot(row);
  }

  /** Internal trusted transition API; full validation and optional optimistic revision guard. */
  update(
    change: (current: Readonly<ProductionSnapshot>) => Change,
    expectedRevision?: number,
  ): ProductionSnapshot {
    const tx = this.db.transaction(() => {
      const current = this.read();
      if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new RevisionConflictError();
      const proposed = change(structuredClone(current));
      validateProductionState(proposed.state);
      const nextStreamId = proposed.streamId === undefined ? current.streamId : proposed.streamId;
      validateStreamId(nextStreamId);
      const now = this.clock();
      assertTime(now);
      if (current.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Production State revision exhausted');
      const changed = this.db.prepare(`
        UPDATE production_state SET stream_id = ?, revision = ?, state_json = ?, updated_at_ms = ?
        WHERE id = 1 AND revision = ?
      `).run(nextStreamId, current.revision + 1, JSON.stringify(proposed.state), now, current.revision);
      if (changed.changes !== 1) throw new RevisionConflictError();
      return this.read();
    });
    return tx();
  }

  /** Apply overdue expirations once, including after process restart. */
  reconcile(): ProductionSnapshot {
    const tx = this.db.transaction(() => {
      const current = this.read();
      const now = this.clock();
      assertTime(now);
      const state = reconcileExpired(current.state, now);
      if (state === current.state) return current;
      return this.update(() => ({ state }), current.revision);
    });
    return tx();
  }

  /** Stop/clear an active session atomically. Never implicitly start a new stream on reboot. */
  clearSession(expectedRevision?: number): ProductionSnapshot {
    return this.update(() => ({ streamId: null, state: initialProductionState() }), expectedRevision);
  }
}

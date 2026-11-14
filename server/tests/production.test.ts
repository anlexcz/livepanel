import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { ProductionStore, RevisionConflictError } from '../src/production/store.js';
import { initialProductionState } from '../src/production/state.js';

function fixture(run: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'livepanel-state-'));
  try { run(join(dir, 'state.sqlite')); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('initial singleton state is valid, idle, and migration is idempotent', () => fixture(path => {
  const db = openDatabase(path);
  try {
    const store = new ProductionStore(db, () => 1000);
    assert.deepEqual(store.read().state, initialProductionState());
    assert.equal(store.read().revision, 0);
    assert.equal(store.read().streamId, null);
    assert.equal((db.prepare('SELECT count(*) n FROM production_state').get() as {n: number}).n, 1);
    assert.equal((db.prepare('SELECT count(*) n FROM schema_migrations').get() as {n: number}).n, 3);
    new ProductionStore(db, () => 1000);
    assert.equal((db.prepare('SELECT count(*) n FROM production_state').get() as {n: number}).n, 1);
  } finally { db.close(); }
}));

test('atomic updates increment revision and survive restart', () => fixture(path => {
  let db = openDatabase(path);
  try {
    let store = new ProductionStore(db, () => 2000);
    const next = store.update(current => ({
      streamId: 'synthetic-stream',
      state: { ...current.state, chat: { mode: 'enabled' }, editorial: { itemId: 'title-1' } },
    }), 0);
    assert.equal(next.revision, 1);
    assert.equal(next.streamId, 'synthetic-stream');
    db.close();
    db = openDatabase(path);
    store = new ProductionStore(db, () => 3000);
    assert.equal(store.read().revision, 1);
    assert.equal(store.read().state.editorial.itemId, 'title-1');
  } finally { if (db.open) db.close(); }
}));

test('conflict prevents stale writes and invalid state rolls back without revision increase', () => fixture(path => {
  const db = openDatabase(path);
  try {
    const store = new ProductionStore(db, () => 2000);
    store.update(c => ({streamId:'synthetic', state: {...c.state, chat: { mode: 'enabled' }}}), 0);
    assert.throws(() => store.update(c => ({state: {...c.state, chat: { mode: 'paused' }}}), 0), RevisionConflictError);
    assert.throws(() => store.update(() => ({state: {invalid: true} as never})), /Production State/);
    assert.equal(store.read().revision, 1);
    assert.equal(store.read().state.chat.mode, 'enabled');
    assert.throws(() => store.update(c => ({streamId:null, state:c.state})), /Inactive stream/);
  } finally { db.close(); }
}));

test('featured expiry is removed on restart, but nonexpired item survives; no replay', () => fixture(path => {
  let now = 1000;
  let db = openDatabase(path);
  try {
    let store = new ProductionStore(db, () => now);
    store.update(c => ({streamId:'synthetic', state: {...c.state, featured: {messageId:'msg-1', expiresAtMs: 2000}}}));
    db.close();
    now = 1500;
    db = openDatabase(path);
    store = new ProductionStore(db, () => now);
    assert.equal(store.read().state.featured.messageId, 'msg-1');
    const before = store.read().revision;
    db.close();
    now = 2100;
    db = openDatabase(path);
    store = new ProductionStore(db, () => now);
    assert.equal(store.read().state.featured.messageId, null);
    assert.equal(store.read().revision, before + 1);
    const stable = store.reconcile();
    assert.equal(stable.revision, before + 1);
  } finally { if (db.open) db.close(); }
}));

test('a read snapshot cannot mutate persisted data; clearSession is explicit and persistent', () => fixture(path => {
  const db = openDatabase(path);
  try {
    const store = new ProductionStore(db, () => 3000);
    store.update(c => ({streamId: 'synthetic', state: {...c.state, event: {queue:['event-1'], paused:true}}}));
    const copy = store.read();
    copy.state.event.queue.push('event-2');
    assert.deepEqual(store.read().state.event.queue, ['event-1']);
    const cleared = store.clearSession();
    assert.equal(cleared.streamId, null);
    assert.deepEqual(cleared.state, initialProductionState());
    assert.equal(cleared.revision, 2);
    assert.throws(() => store.update(c => ({state: {...c.state, chat: { mode: 'paused' }}})), /Inactive stream/);
  } finally { db.close(); }
}));

test('failed persistence does not return a successful state transition', () => fixture(path => {
  const db = openDatabase(path);
  const store = new ProductionStore(db, () => 1000);
  db.close();
  assert.throws(() => store.update(c => ({ state: c.state })));
}));

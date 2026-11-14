import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

test('config validates port and restricts remote exposure', () => {
  assert.equal(loadConfig({}).port, 3100);
  assert.throws(() => loadConfig({ LIVEPANEL_PORT: 'not-a-port' }), /Invalid LIVEPANEL_PORT/);
  assert.throws(() => loadConfig({ LIVEPANEL_HOST: '0.0.0.0' }), /Non-loopback/);
});

test('database migrations are repeatable and survive reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'livepanel-'));
  const path = join(dir, 'database.sqlite');
  try {
    let db = openDatabase(path);
    assert.equal((db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as {n: number}).n, 4);
    db.close();
    db = openDatabase(path);
    assert.equal((db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as {n: number}).n, 4);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('health endpoint returns readiness, unknown endpoints return 404', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'livepanel-'));
  const db = openDatabase(join(dir, 'database.sqlite'));
  const app = createApp(db, 'silent');
  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: 'ok', service: 'metrobus-livepanel' });
    const unknown = await app.inject({ method: 'GET', url: '/admin' });
    assert.equal(unknown.statusCode, 404);
    assert.deepEqual(unknown.json(), { error: 'not_found' });
  } finally {
    await app.close(); db.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('health becomes unavailable when database is closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'livepanel-'));
  const db = openDatabase(join(dir, 'database.sqlite'));
  const app = createApp(db, 'silent');
  try {
    db.close();
    const response = await app.inject({method: 'GET', url: '/health'});
    assert.equal(response.statusCode, 503);
  } finally {
    await app.close(); rmSync(dir, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../' + file,import.meta.url),'utf8');

test('GitHub Pages remains mock UI unless explicitly enabled with production build flag',()=>{
  const app=source('src/App.tsx');
  assert.match(app,/import\.meta\.env\.VITE_LIVEPANEL_AUTH==='enabled'/);
  assert.match(app,/return <DemoApplication\/>;/);
  assert.match(app,/return <AuthGate>\{\(\)=>\<DemoApplication production\/>\}<\/AuthGate>/);
});

test('real auth client uses same-origin cookies without localStorage and never handles session token',()=>{
  const client=source('src/auth/client.ts');
  const gate=source('src/auth/AuthGate.tsx');
  assert.match(client,/credentials: 'same-origin'/);
  assert.match(client,/cache: 'no-store'/);
  assert.doesNotMatch(client,/localStorage|sessionStorage|document\.cookie|Authorization/);
  assert.doesNotMatch(gate,/localStorage|sessionStorage|document\.cookie/);
  assert.match(gate,/setStatus\('authenticated'\)/);
  assert.match(gate,/status==='unavailable'/);
  assert.match(client,/\/api\/auth\/password/);
  assert.match(gate,/authClient\.changePassword/);
});

test('authentication integration does not replace the mock directing state and actions',()=>{
  const sourceCode=source('src/App.tsx');
  assert.match(sourceCode,/function Directing\(\)/);
  assert.match(sourceCode,/Testovací zpráva/);
  assert.match(sourceCode,/function DemoApplication\(/);
});

test('authenticated build renders server state rather than mock directing',()=>{
  const app=source('src/App.tsx');
  const prod=source('src/production/ProductionLive.tsx');
  assert.match(app,/production \? <ProductionLive\/> : <Directing\/>/);
  assert.match(prod,/client\.send\(name,payload\)/);
  assert.match(prod,/chat\.setMode/);
  assert.doesNotMatch(prod,/initialMessages|addDemoMessage|setChatPaused/);
});

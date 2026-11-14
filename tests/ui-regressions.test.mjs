import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('shared accent color is defined exactly once without a circular reference', () => {
  const css = read('src/styles.css');
  const definitions = [...css.matchAll(/--lp-accent\s*:\s*([^;}]+)/g)];
  assert.equal(definitions.length, 1, 'There must be exactly one accent declaration');
  assert.equal(definitions[0][1].trim().toLowerCase(), '#87cefa');
  const selfReferences = [...css.matchAll(/(--lp-[\w-]+)\s*:\s*var\(\s*(--lp-[\w-]+)\s*\)/g)];
  assert.deepEqual(selfReferences.filter(match => match[1] === match[2]), []);
});

test('critical layout declarations are present after CSS cleanup', () => {
  const css = read('src/styles.css');
  assert.match(css, /\.app-shell\s*\{[^}]*display:grid;[^}]*grid-template-columns:/);
  assert.match(css, /\.nav-rail\s*\{[^}]*grid-row:1\s*\/\s*3;/);
  assert.match(css, /\.topbar\s*\{[^}]*grid-column:2;/);
  assert.match(css, /\.message\s*\{[^}]*padding:/);
  assert.match(css, /\.panel-toggle\s*\{[^}]*background:/);
});

test('OUTRO editor uses actual line breaks for both splitting and joining', () => {
  const source = read('src/pages/Scenes.tsx');
  assert.ok(source.includes("value.split('\\n')"), 'Split must use a real line break');
  assert.equal(source.split("value.join('\\n')").length - 1, 2, 'Both joins must use real line breaks');
  assert.ok(!source.includes(String.raw`value.join('\\n')`), 'Literal backslash-n in joins is invalid');
  const examples = ['První', 'Druhá', 'Třetí'];
  assert.deepEqual(examples.join('\n').split('\n'), examples);
});

test('TICKER keeps a snapshot of the active batch independent of its library', () => {
  const source = read('src/features/DirectingPanels.tsx');
  assert.match(source, /const \[tickerBatchItems,setTickerBatchItems\]=useState<TickerItem\[\]>\(\[\]\)/);
  assert.match(source, /setTickerBatchItems\(enabled\.map\(item=>\(\{\.\.\.item\}\)\)\)/);
  assert.match(source, /const index=tickerBatchItems\.findIndex/);
  assert.ok(!source.includes('const index=enabled.findIndex(t=>t.id===tickerCurrent)'));
});

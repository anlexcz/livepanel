import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { openDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';

function incoming(ws: WebSocket) {
  const queued: unknown[] = [];
  const waiting: Array<(value: unknown) => void> = [];
  ws.on('message', data => {
    const value: unknown = JSON.parse(data.toString());
    const resolve = waiting.shift();
    if (resolve) resolve(value);
    else queued.push(value);
  });
  return {
    next: (): Promise<Record<string, unknown>> => queued.length
      ? Promise.resolve(queued.shift() as Record<string, unknown>)
      : new Promise(resolve => waiting.push(resolve as (v: unknown) => void)),
  };
}

async function connect(url: string) {
  const ws = new WebSocket(url, { origin: new URL(url.replace('ws:','http:')).origin });
  const messages = incoming(ws);
  await new Promise<void>((resolve,reject) => { ws.once('open',resolve);ws.once('error',reject); });
  return {ws,messages};
}

test('WebSocket synchronizes two local operators; observer cannot command or access secret fields', async () => {
  const dir = mkdtempSync(join(tmpdir(),'mb-ws-'));
  const db = openDatabase(join(dir,'ws.sqlite'));
  const app = createApp(db,'silent',{devSockets:true});
  const clients: WebSocket[]=[];
  try {
    const address = await app.listen({host:'127.0.0.1',port:0});
    const base = address.replace('http:','ws:');
    const op1=await connect(base+'/dev/ws/operator');clients.push(op1.ws);
    const op2=await connect(base+'/dev/ws/operator');clients.push(op2.ws);
    const obs=await connect(base+'/dev/ws/observer');clients.push(obs.ws);
    assert.equal((await op1.messages.next()).type,'SNAPSHOT');
    assert.equal((await op2.messages.next()).type,'SNAPSHOT');
    const init=await obs.messages.next();
    assert.equal(init.type,'SNAPSHOT');
    assert.equal((init as Record<string,unknown>).streamId,undefined);

    op1.ws.send(JSON.stringify({type:'COMMAND',commandId:'command-ws-001',action:'session.start',payload:{streamId:'secretstream'}}));
    assert.equal((await op1.messages.next()).type,'UPDATE');
    assert.equal((await op2.messages.next()).type,'UPDATE');
    const updated=await obs.messages.next();
    assert.equal(updated.type,'UPDATE');
    assert.equal(JSON.stringify(updated).includes('secretstream'),false);
    const result=await op1.messages.next();
    assert.equal(result.type,'RESULT');assert.equal(result.ok,true);assert.equal(result.revision,1);

    op2.ws.send(JSON.stringify({type:'COMMAND',commandId:'command-ws-002',action:'chat.setMode',payload:{mode:'enabled'},expectedRevision:1}));
    assert.equal((await op1.messages.next()).revision,2);
    assert.equal((await op2.messages.next()).revision,2);
    assert.equal((await obs.messages.next()).revision,2);
    assert.equal((await op2.messages.next()).ok,true);

    obs.ws.send(JSON.stringify({type:'COMMAND',commandId:'command-ws-003',action:'session.stop',payload:{}}));
    await new Promise<void>(resolve=>obs.ws.once('close',()=>resolve()));
    assert.equal(db.prepare('SELECT revision FROM production_state').get() !== undefined,true);
    assert.equal((db.prepare('SELECT revision FROM production_state').get() as {revision:number}).revision,2);
  } finally {
    for(const ws of clients) ws.terminate();
    await app.close();db.close();rmSync(dir,{recursive:true,force:true});
  }
});

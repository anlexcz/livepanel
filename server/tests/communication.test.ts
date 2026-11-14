import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { ProductionStore } from '../src/production/store.js';
import { CommandProcessor } from '../src/communication/processor.js';
import { decodeCommand, publicProjection } from '../src/communication/protocol.js';

const command = (id:string,action:string,payload:Record<string,unknown>={},expectedRevision?:number) =>
  ({type:'COMMAND',commandId:id,action,payload,...(expectedRevision===undefined?{}:{expectedRevision})});

function fixture(run:(db:ReturnType<typeof openDatabase>,store:ProductionStore,processor:CommandProcessor)=>void) {
  const dir=mkdtempSync(join(tmpdir(),'mb-commands-'));
  const db=openDatabase(join(dir,'commands.sqlite'));
  try {
    const store=new ProductionStore(db,()=>1000);
    run(db,store,new CommandProcessor(db,store,()=>1000));
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
}

test('decoding rejects extra fields, malformed IDs and invalid command shape',()=>{
  assert.equal(decodeCommand(command('command-0001','session.start',{streamId:'synthetic'}))?.action,'session.start');
  assert.equal(decodeCommand({...command('command-0001','session.start',{streamId:'synthetic'}),role:'admin'}),null);
  assert.equal(decodeCommand(command('bad','session.start',{streamId:'synthetic'})),null);
  assert.equal(decodeCommand(command('command-0002','chat.setMode',{mode:'dangerous'})),null);
  assert.equal(decodeCommand(command('command-0003','unknown',{})),null);
});

test('two operators see committed revisions and duplicate retries never reapply changes',()=>fixture((db,store,processor)=>{
  const updates:number[]=[];
  processor.subscribe(update=>updates.push(update.revision));
  const start=command('command-1000','session.start',{streamId:'synthetic'},0);
  assert.deepEqual(processor.execute(start),{type:'RESULT',commandId:'command-1000',ok:true,revision:1});
  assert.equal(processor.execute(start).revision,1);
  assert.deepEqual(updates,[1]);
  const setMode=command('command-1001','chat.setMode',{mode:'enabled'},1);
  assert.equal(processor.execute(setMode).revision,2);
  assert.equal(store.read().state.chat.mode,'enabled');
  assert.deepEqual(updates,[1,2]);
  assert.equal(processor.execute(command('command-1001','chat.setMode',{mode:'paused'},1)).error,'COMMAND_ID_REUSED');
  assert.equal(store.read().revision,2);
  assert.equal((db.prepare('SELECT count(*) AS n FROM production_commands').get() as {n:number}).n,2);
}));

test('stale expectedRevision and invalid actions do not mutate state',()=>fixture((_db,store,processor)=>{
  assert.equal(processor.execute(command('command-2000','chat.setMode',{mode:'enabled'})).error,'INVALID_STATE');
  processor.execute(command('command-2001','session.start',{streamId:'synthetic'}));
  const rev=store.read().revision;
  assert.equal(processor.execute(command('command-2002','chat.setMode',{mode:'paused'},0)).error,'REVISION_CONFLICT');
  assert.equal(processor.execute(command('command-2003','session.start',{streamId:'second'})).error,'INVALID_STATE');
  assert.equal(processor.execute(command('command-2004','featured.show',{messageId:'msg',expiresAtMs:999})).error,'INVALID_STATE');
  assert.equal(store.read().revision,rev);
  assert.equal(store.read().streamId,'synthetic');
}));

test('deduplication is durable across processor restart',()=>fixture((db,store,processor)=>{
  const begin=command('command-3000','session.start',{streamId:'synthetic'});
  const first=processor.execute(begin);
  const newProcessor=new CommandProcessor(db,new ProductionStore(db,()=>1000),()=>1000);
  assert.deepEqual(newProcessor.execute(begin),first);
  assert.equal(store.read().revision,1);
  assert.equal(newProcessor.execute(command('command-3001','session.stop')).ok,true);
  assert.equal(newProcessor.execute(command('command-3002','chat.setMode',{mode:'enabled'})).error,'INVALID_STATE');
}));

test('public projection excludes stream and message/event identifiers',()=>fixture((_db,store,processor)=>{
  processor.execute(command('command-4000','session.start',{streamId:'secret_stream'}));
  store.update(c=>({state:{...c.state,featured:{messageId:'private-message',expiresAtMs:999999},event:{queue:['private-event'],paused:true},editorial:{itemId:'private-editorial'}}}));
  const projection=publicProjection(store.read());
  const serialized=JSON.stringify(projection);
  for(const secret of ['secret_stream','private-message','private-event','private-editorial']) assert.ok(!serialized.includes(secret));
  assert.equal(projection.state.featured.active,true);
  assert.equal(projection.state.event.paused,true);
}));

test('dedup survives reopening the SQLite file (a process restart)',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mb-command-restart-'));
  const path=join(dir,'state.sqlite');
  let db=openDatabase(path);
  const start=command('command-restart-0001','session.start',{streamId:'synthetic'},0);
  try {
    let store=new ProductionStore(db,()=>1000);
    const original=new CommandProcessor(db,store,()=>1000).execute(start);
    assert.equal(original.revision,1);
    db.close();
    db=openDatabase(path);
    store=new ProductionStore(db,()=>2000);
    const processor=new CommandProcessor(db,store,()=>2000);
    assert.deepEqual(processor.execute(start),original);
    assert.equal(store.read().revision,1);
    assert.equal(processor.execute(command('command-restart-0001','session.start',{streamId:'other'},0)).error,'COMMAND_ID_REUSED');
    assert.equal(store.read().streamId,'synthetic');
  } finally {
    if(db.open) db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('incidental FEATURED expiry produces one full-state UPDATE at one revision',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mb-command-expiry-'));
  const db=openDatabase(join(dir,'state.sqlite'));
  let now=1000;
  try {
    const store=new ProductionStore(db,()=>now);
    const processor=new CommandProcessor(db,store,()=>now);
    const updates:Array<{category:string;revision:number}>=[];
    processor.subscribe(update=>updates.push({category:update.category,revision:update.revision}));
    processor.execute(command('command-expiry-0001','session.start',{streamId:'synthetic'}));
    processor.execute(command('command-expiry-0002','featured.show',{messageId:'msg',expiresAtMs:1500}));
    now=2000;
    processor.execute(command('command-expiry-0003','chat.setMode',{mode:'enabled'}));
    assert.equal(store.read().state.featured.messageId,null);
    assert.deepEqual(updates,[{category:'session',revision:1},{category:'featured',revision:2},{category:'session',revision:3}]);
  } finally {
    db.close();rmSync(dir,{recursive:true,force:true});
  }
});

test('database failure never returns an acknowledged command',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mb-command-failure-'));
  const db=openDatabase(join(dir,'state.sqlite'));
  const store=new ProductionStore(db,()=>1000);
  const processor=new CommandProcessor(db,store,()=>1000);
  db.close();
  const result=processor.execute(command('command-failure-0001','session.start',{streamId:'synthetic'}));
  assert.equal(result.ok,false);
  assert.equal(result.error,'PERSISTENCE_ERROR');
  rmSync(dir,{recursive:true,force:true});
});

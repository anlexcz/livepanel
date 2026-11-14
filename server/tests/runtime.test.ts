import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db/database.js';
import {ProductionStore} from '../src/production/store.js';
import {CommandProcessor} from '../src/communication/processor.js';
import {ProductionRuntime} from '../src/production/runtime.js';

const cmd=(id:string,action:string,payload:Record<string,unknown>={},expectedRevision?:number)=>({
  type:'COMMAND',commandId:id,action,payload,
  ...(expectedRevision===undefined?{}:{expectedRevision}),
});
function context(run:(env:{
  db:ReturnType<typeof openDatabase>;
  store:ProductionStore;processor:CommandProcessor;
  now:()=>number;advance:(ms:number)=>void;
})=>void) {
  const dir=mkdtempSync(join(tmpdir(),'mb-runtime-'));
  const db=openDatabase(join(dir,'test.sqlite'));
  let time=1000;
  const now=()=>time;
  try {
    const store=new ProductionStore(db,now);
    const processor=new CommandProcessor(db,store,now);
    run({db,store,processor,now,advance:ms=>{time+=ms;}});
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
}

test('FEATURED timeout is committed and broadcast once, without a new command row',()=>context(({db,store,processor,now,advance})=>{
  type FakeTimer={callback:()=>void;delay:number;unref:()=>void};
  const active:{timer:FakeTimer|null}={timer:null};
  const seen:Array<{revision:number;category:string}>=[];
  processor.subscribe(u=>seen.push({revision:u.revision,category:u.category}));
  const runtime=new ProductionRuntime(store,processor,now,
    (callback,delay)=>{active.timer={callback,delay,unref:()=>{}};return active.timer as unknown as ReturnType<typeof setTimeout>;},
    (timer)=>{if(active.timer===timer as unknown as FakeTimer)active.timer=null;});
  runtime.start();
  assert.equal(active.timer,null);
  processor.execute(cmd('runtime-0001','session.start',{streamId:'stream_1'}));
  processor.execute(cmd('runtime-0002','featured.show',{messageId:'msg_1',expiresAtMs:2000}));
  assert.equal((active.timer as FakeTimer|null)?.delay,1000);
  assert.equal(store.read().revision,2);
  advance(1000);
  const callback=(active.timer as FakeTimer).callback;
  callback();
  assert.equal(store.read().state.featured.messageId,null);
  assert.equal(store.read().revision,3);
  assert.deepEqual(seen.map(u=>u.revision),[1,2,3]);
  assert.equal(seen[2].category,'featured');
  assert.equal(active,null);
  assert.equal((db.prepare('SELECT count(*) AS n FROM production_commands').get() as {n:number}).n,2);
  runtime.stop();
}));

test('FEATURED timer re-arms on replacement and pauses safely on session stop',()=>context(({store,processor,now,advance})=>{
  let next=0;
  const tasks=new Map<number,{callback:()=>void;delay:number}>();
  const runtime=new ProductionRuntime(store,processor,now,
    (callback,delay)=>{const id=++next;tasks.set(id,{callback,delay});return {id,unref:()=>{}} as unknown as ReturnType<typeof setTimeout>;},
    timer=>{tasks.delete((timer as unknown as {id:number}).id);});
  runtime.start();
  processor.execute(cmd('runtime-1001','session.start',{streamId:'stream_2'}));
  processor.execute(cmd('runtime-1002','featured.show',{messageId:'a',expiresAtMs:3000}));
  assert.equal(tasks.size,1);
  processor.execute(cmd('runtime-1003','featured.show',{messageId:'b',expiresAtMs:6000}));
  assert.equal(tasks.size,1);
  assert.equal([...tasks.values()][0].delay,5000);
  advance(3000);
  assert.equal(store.read().state.featured.messageId,'b');
  processor.execute(cmd('runtime-1004','session.stop'));
  assert.equal(tasks.size,0);
  runtime.stop();
}));

test('EVENT pause/resume is persisted and queue remains FIFO across reopen',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mb-runtime-event-'));
  const path=join(dir,'event.sqlite');
  let db=openDatabase(path);
  try {
    let store=new ProductionStore(db,()=>1000);
    let processor=new CommandProcessor(db,store,()=>1000);
    const seen:string[]=[];
    processor.subscribe(u=>seen.push(u.category));
    processor.execute(cmd('runtime-2001','session.start',{streamId:'event_stream'}));
    assert.equal(processor.enqueueEvent('event_01'),true);
    assert.equal(processor.enqueueEvent('event_01'),false);
    assert.equal(processor.enqueueEvent('event_02'),true);
    const pause=processor.execute(cmd('runtime-2002','event.pause'));
    assert.equal(pause.ok,true);
    assert.deepEqual(store.read().state.event,{queue:['event_01','event_02'],paused:true});
    assert.equal(processor.execute(cmd('runtime-2003','event.pause')).error,'INVALID_STATE');
    assert.deepEqual(seen,['session','event','event','event']);
    db.close();
    db=openDatabase(path);
    store=new ProductionStore(db,()=>2000);
    processor=new CommandProcessor(db,store,()=>2000);
    assert.deepEqual(store.read().state.event,{queue:['event_01','event_02'],paused:true});
    assert.equal(processor.execute(cmd('runtime-2004','event.resume')).ok,true);
    assert.deepEqual(store.read().state.event,{queue:['event_01','event_02'],paused:false});
    assert.equal(processor.enqueueEvent('event_01'),false);
    assert.equal(processor.execute(cmd('runtime-2004','event.resume')).ok,true);
    assert.equal(store.read().state.event.queue.length,2);
  } finally {if(db.open)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('invalid EVENT requests do not write or modify state',()=>context(({store,processor})=>{
  processor.execute(cmd('runtime-3001','session.start',{streamId:'stream_3'}));
  const rev=store.read().revision;
  assert.equal(processor.execute(cmd('runtime-3002','event.pause',{force:true})).error,'INVALID_COMMAND');
  assert.equal(processor.execute(cmd('runtime-3003','event.resume')).error,'INVALID_STATE');
  assert.throws(()=>processor.enqueueEvent('with spaces'),/Invalid event reference/);
  assert.equal(store.read().revision,rev);
}));

test('runtime retry does not broadcast a false success after persistence failure',()=>context(({db,store,processor,now,advance})=>{
  const pending:{timer:{callback:()=>void;delay:number;unref:()=>void}|null}={timer:null};
  const errors:unknown[]=[];
  const seen:number[]=[];
  processor.subscribe(u=>seen.push(u.revision));
  const runtime=new ProductionRuntime(store,processor,now,
    (callback,delay)=>{pending.timer={callback,delay,unref:()=>{}};return pending.timer as unknown as ReturnType<typeof setTimeout>;},
    ()=>{pending.timer=null;},error=>errors.push(error));
  processor.execute(cmd('runtime-4001','session.start',{streamId:'stream_4'}));
  processor.execute(cmd('runtime-4002','featured.show',{messageId:'a',expiresAtMs:2000}));
  runtime.start();
  advance(1000);
  db.close();
  pending.timer!.callback();
  assert.equal(errors.length,1);
  assert.deepEqual(seen,[1,2]);
  assert.equal(pending.timer?.delay,1000);
  runtime.stop();
}));

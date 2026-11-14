import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../src/production/client.ts',import.meta.url),'utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
}}).outputText;
const {ProductionClient,parseSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));

const emptyState=()=>({
  chat:{mode:'disabled'},featured:{messageId:null,expiresAtMs:null},
  event:{queue:[],paused:false},ticker:{status:'stopped',position:0},
  editorial:{itemId:null},
});
const snap=(revision,streamId=null,state=emptyState())=>({type:'SNAPSHOT',revision,
  state:{revision,streamId,state,updatedAtMs:1000}});
class Socket {
  static OPEN=1;
  static instances=[];
  readyState=Socket.OPEN;
  sent=[];
  onmessage=null;
  onclose=null;
  onerror=null;
  constructor(url){this.url=url;Socket.instances.push(this);}
  send(message){this.sent.push(JSON.parse(message));}
  emit(frame){this.onmessage?.({data:JSON.stringify(frame)});}
  close(){this.readyState=3;this.onclose?.();}
}
function mockSockets(){
  const before=globalThis.WebSocket;
  Socket.instances=[];
  globalThis.WebSocket=Socket;
  return ()=>{globalThis.WebSocket=before;};
}

test('malformed snapshots and invalid state fields are rejected',()=>{
  assert.equal(parseSnapshot({streamId:null,revision:-1,state:emptyState(),updatedAtMs:10}),null);
  assert.equal(parseSnapshot({streamId:null,revision:0,state:{...emptyState(),chat:{mode:'nonsense'}},updatedAtMs:10}),null);
  assert.ok(parseSnapshot({streamId:null,revision:0,state:emptyState(),updatedAtMs:10}));
});

test('waits for SNAPSHOT, rejects gaps and stale updates, and resets on reconnect',()=>{
  const restore=mockSockets();
  try {
    const client=new ProductionClient('wss://example.test/ws/operator');
    client.start();
    const ws=Socket.instances.at(-1);
    assert.equal(client.current().snapshot,null);
    ws.emit({type:'UPDATE',revision:1,category:'chat',value:{mode:'enabled'}});
    assert.equal(client.current().snapshot,null);
    ws.emit(snap(0));
    assert.equal(client.current().status,'connected');
    ws.emit({type:'UPDATE',revision:1,category:'chat',value:{mode:'enabled'}});
    assert.equal(client.current().snapshot.revision,1);
    ws.emit({type:'UPDATE',revision:1,category:'chat',value:{mode:'paused'}});
    assert.equal(client.current().snapshot.state.chat.mode,'enabled');
    ws.emit({type:'UPDATE',revision:3,category:'chat',value:{mode:'paused'}});
    assert.equal(client.current().snapshot,null);
    assert.equal(client.current().status,'reconnecting');
    client.stop();
    client.start(); // StrictMode effect re-setup must establish a new connection.
    assert.equal(Socket.instances.length,2);
    Socket.instances.at(-1).emit(snap(7,'resumed'));
    assert.equal(client.current().snapshot.revision,7);
    client.stop();
  } finally {restore();}
});

test('COMMAND cannot be sent before SNAPSHOT; RESULT requires confirmed UPDATE',async()=>{
  const restore=mockSockets();
  try {
    const client=new ProductionClient('wss://example.test/ws/operator');
    client.start();
    const ws=Socket.instances.at(-1);
    await assert.rejects(client.send('session.start',{streamId:'synthetic'}),error=>error.code==='NOT_READY');
    ws.emit(snap(0));
    const promise=client.send('session.start',{streamId:'synthetic'});
    const sent=ws.sent.at(-1);
    assert.equal(sent.type,'COMMAND');
    assert.equal(sent.expectedRevision,0);
    assert.match(sent.commandId,/^[0-9a-f-]{36}$/);
    let resolved=false;
    void promise.then(()=>{resolved=true;});
    ws.emit({type:'RESULT',commandId:sent.commandId,ok:true,revision:1});
    await Promise.resolve();
    assert.equal(resolved,false,'A successful RESULT alone must not change confirmed state');
    ws.emit({type:'UPDATE',revision:1,category:'session',value:{streamId:'synthetic',state:emptyState()}});
    await promise;
    assert.equal(client.current().snapshot.streamId,'synthetic');
    assert.equal(client.current().pending,false);
    client.stop();
  } finally {restore();}
});

test('server rejection and disconnect fail in-flight command without optimistic mutation',async()=>{
  const restore=mockSockets();
  try {
    const client=new ProductionClient('wss://example.test/ws/operator');
    client.start();
    const ws=Socket.instances.at(-1);
    ws.emit(snap(2,'session_1'));
    const command=client.send('chat.setMode',{mode:'paused'});
    const id=ws.sent.at(-1).commandId;
    ws.emit({type:'RESULT',commandId:id,ok:false,error:'REVISION_CONFLICT',revision:3});
    await assert.rejects(command,error=>error.code==='REVISION_CONFLICT');
    assert.equal(client.current().snapshot.state.chat.mode,'disabled');
    const interrupted=client.send('chat.setMode',{mode:'enabled'});
    ws.close();
    await assert.rejects(interrupted,error=>error.code==='DISCONNECTED');
    assert.equal(client.current().snapshot,null);
    client.stop();
  }finally{restore();}
});

test('EVENT UPDATE keeps the client synchronized with operator pause/resume',()=>{
  const restore=mockSockets();
  try {
    const client=new ProductionClient('wss://example.test/ws/operator');
    client.start();
    const ws=Socket.instances.at(-1);
    ws.emit(snap(2,'synthetic'));
    const event={queue:['event_01'],paused:true};
    ws.emit({type:'UPDATE',revision:3,category:'event',value:event});
    assert.equal(client.current().status,'connected');
    assert.deepEqual(client.current().snapshot.state.event,event);
    client.stop();
  }finally{restore();}
});

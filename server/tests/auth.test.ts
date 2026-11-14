import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { openDatabase } from '../src/db/database.js';
import { AuthService, cookieToken, SESSION_TTL_MS } from '../src/auth/service.js';
import { createApp } from '../src/app.js';

function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'lp-auth-'));
  const db=openDatabase(join(dir,'auth.sqlite'));
  return {db,cleanup:()=>{db.close();rmSync(dir,{recursive:true,force:true});}};
}
const origin='https://example.test';

test('password hashes, unknown credentials, disabled accounts and separate durable device sessions',async()=>{
  const f=fixture();
  let now=1_000;
  try {
    const auth=new AuthService(f.db,()=>now);
    const id=await auth.createUser('operator1','synthetic-passphrase-1234');
    const stored=f.db.prepare('SELECT password_hash FROM users WHERE id=?').get(id) as {password_hash:string};
    assert.ok(stored.password_hash.startsWith('$argon2id$'));
    assert.ok(!stored.password_hash.includes('synthetic-passphrase'));
    assert.equal(await auth.login('operator1','wrong'),null);
    assert.equal(await auth.login('missing','wrong'),null);
    const a=await auth.login('operator1','synthetic-passphrase-1234');
    const b=await auth.login('operator1','synthetic-passphrase-1234');
    assert.ok(a && b);
    assert.notEqual(a.token,b.token);
    assert.equal(auth.authenticate(a.token)?.sessionId,a.operator.sessionId);
    assert.equal(auth.sessions(a.operator).length,2);
    assert.equal(auth.revokeSession(a.operator,b.operator.sessionId),true);
    assert.equal(auth.authenticate(b.token),null);
    assert.ok(auth.authenticate(a.token));
    now+=SESSION_TTL_MS;
    assert.equal(auth.authenticate(a.token),null);
    f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(id);
    assert.equal(await auth.login('operator1','synthetic-passphrase-1234'),null);
  } finally {f.cleanup();}
});

test('HTTP session cookie, origin guard, logout and no registration',async()=>{
  const f=fixture();
  const auth=new AuthService(f.db);
  const id=await auth.createUser('metrobus','synthetic-passphrase-1234',true);
  assert.ok(id>0);
  const app=createApp(f.db,'silent',{publicOrigin:origin});
  try {
    const denied=await app.inject({method:'POST',url:'/api/auth/login',payload:{username:'metrobus',password:'synthetic-passphrase-1234'}});
    assert.equal(denied.statusCode,403);
    const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{username:'metrobus',password:'synthetic-passphrase-1234'}});
    assert.equal(login.statusCode,200);
    assert.equal(login.json().user.shared,true);
    const header=login.headers['set-cookie'] as string;
    assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);
    const cookie=header.split(';')[0];
    assert.equal(cookieToken(cookie)?.length,43);
    const me=await app.inject({method:'GET',url:'/api/auth/me',headers:{cookie}});
    assert.equal(me.statusCode,200);
    const sessions=await app.inject({method:'GET',url:'/api/auth/sessions',headers:{cookie}});
    assert.equal(sessions.statusCode,200);
    assert.equal(sessions.json().sessions.length,1);
    const badLogout=await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie,origin:'https://evil.test'}});
    assert.equal(badLogout.statusCode,403);
    const logout=await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie,origin}});
    assert.equal(logout.statusCode,200);
    assert.equal((await app.inject({method:'GET',url:'/api/auth/me',headers:{cookie}})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/api/auth/register',headers:{origin}})).statusCode,404);
  }finally{await app.close();f.cleanup();}
});

test('operator WebSocket rejects missing session/origin and accepts valid cookie only',async()=>{
  const f=fixture();
  const auth=new AuthService(f.db);
  await auth.createUser('operator1','synthetic-passphrase-1234');
  const login=await auth.login('operator1','synthetic-passphrase-1234');
  assert.ok(login);
  const app=createApp(f.db,'silent',{publicOrigin:origin});
  const clients:WebSocket[]=[];
  const attempt=(url:string,headers:Record<string,string>)=>new Promise<boolean>(resolve=>{
    const ws=new WebSocket(url,{headers});
    clients.push(ws);
    ws.once('open',()=>resolve(true));
    ws.once('error',()=>resolve(false));
  });
  try {
    const addr=await app.listen({host:'127.0.0.1',port:0});
    const url=addr.replace('http:','ws:')+'/ws/operator';
    assert.equal(await attempt(url,{origin}),false);
    assert.equal(await attempt(url,{origin:'https://evil.test',cookie:'mb_lp_session='+login.token}),false);
    const ws=new WebSocket(url,{headers:{origin,cookie:'mb_lp_session='+login.token}});
    clients.push(ws);
    const first=await new Promise<Record<string,unknown>>((resolve,reject)=>{
      ws.once('message',data=>resolve(JSON.parse(data.toString())));
      ws.once('error',reject);
    });
    assert.equal(first.type,'SNAPSHOT');
    auth.revoke(login.token);
    ws.send(JSON.stringify({type:'COMMAND',commandId:'command-auth-001',action:'session.start',payload:{streamId:'synthetic'}}));
    await new Promise<void>(resolve=>ws.once('close',()=>resolve()));
    assert.equal((f.db.prepare('SELECT revision FROM production_state').get() as {revision:number}).revision,0);
  }finally{
    for(const ws of clients) ws.terminate();
    await app.close();f.cleanup();
  }
});

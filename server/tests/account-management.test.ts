import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { AuthService } from '../src/auth/service.js';
import { createApp } from '../src/app.js';

test('local management resets credentials and revokes all sessions without exposing hashes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lp-management-'));
  const db=openDatabase(join(dir,'test.sqlite'));
  let now=1000;
  try {
    const auth=new AuthService(db,()=>now);
    const id=await auth.createUser('operator1','old-synthetic-passphrase');
    const first=await auth.login('operator1','old-synthetic-passphrase');
    const second=await auth.login('operator1','old-synthetic-passphrase');
    assert.ok(first&&second);
    const listed=auth.listUsers();
    assert.deepEqual(listed.map(u=>u.username),['operator1']);
    assert.equal(JSON.stringify(listed).includes('password_hash'),false);
    assert.equal(auth.setActive(id,false),true);
    assert.equal(auth.authenticate(first.token),null);
    assert.equal(auth.authenticate(second.token),null);
    assert.equal(await auth.login('operator1','old-synthetic-passphrase'),null);
    assert.equal(auth.setActive(id,true),true);
    const restored=await auth.login('operator1','old-synthetic-passphrase');
    assert.ok(restored);
    assert.equal(await auth.resetPassword(id,'new-synthetic-passphrase'),true);
    assert.equal(auth.authenticate(restored.token),null);
    assert.equal(await auth.login('operator1','old-synthetic-passphrase'),null);
    assert.ok(await auth.login('operator1','new-synthetic-passphrase'));
    assert.equal(await auth.resetPassword(999,'valid-synthetic-passphrase'),false);
    assert.equal(auth.setActive(999,false),false);
    assert.equal(auth.listUsers()[0].active,true);
    now++;
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});

test('self-service password change needs original secret and expires all device sessions',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lp-password-'));
  const db=openDatabase(join(dir,'test.sqlite'));
  const origin='https://panel.example.test';
  try {
    const auth=new AuthService(db);
    await auth.createUser('operator2','old-synthetic-passphrase');
    const app=createApp(db,'silent',{publicOrigin:origin});
    try {
      async function login(password:string) {
        return app.inject({method:'POST',url:'/api/auth/login',headers:{origin},
          payload:{username:'operator2',password}});
      }
      const a=await login('old-synthetic-passphrase');
      const b=await login('old-synthetic-passphrase');
      assert.equal(a.statusCode,200);
      assert.equal(b.statusCode,200);
      const cookie=(a.headers['set-cookie'] as string).split(';')[0];
      const otherCookie=(b.headers['set-cookie'] as string).split(';')[0];
      const noOrigin=await app.inject({method:'POST',url:'/api/auth/password',headers:{cookie},
        payload:{currentPassword:'old-synthetic-passphrase',newPassword:'new-synthetic-passphrase'}});
      assert.equal(noOrigin.statusCode,403);
      const wrong=await app.inject({method:'POST',url:'/api/auth/password',headers:{origin,cookie},
        payload:{currentPassword:'incorrect-secret',newPassword:'new-synthetic-passphrase'}});
      assert.equal(wrong.statusCode,403);
      assert.equal((await app.inject({method:'GET',url:'/api/auth/me',headers:{cookie}})).statusCode,200);
      const changed=await app.inject({method:'POST',url:'/api/auth/password',headers:{origin,cookie},
        payload:{currentPassword:'old-synthetic-passphrase',newPassword:'new-synthetic-passphrase'}});
      assert.equal(changed.statusCode,200);
      assert.equal(changed.json().reauthenticate,true);
      assert.equal((await app.inject({method:'GET',url:'/api/auth/me',headers:{cookie}})).statusCode,401);
      assert.equal((await app.inject({method:'GET',url:'/api/auth/me',headers:{cookie:otherCookie}})).statusCode,401);
      assert.equal((await login('old-synthetic-passphrase')).statusCode,401);
      assert.equal((await login('new-synthetic-passphrase')).statusCode,200);
    } finally {await app.close();}
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});

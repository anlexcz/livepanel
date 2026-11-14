import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import argon2 from 'argon2';

export const COOKIE_NAME = 'mb_lp_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export type Operator = { id: number; username: string; shared: boolean; sessionId: string };
type UserRow = { id:number; username:string; password_hash:string; shared:number; active:number };
type SessionRow = { id:string; user_id:number; username:string; shared:number; active:number; expires_at_ms:number; revoked_at_ms:number|null };
const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const tokenDigest = (token:string) => createHash('sha256').update(token).digest('hex');
function validPassword(password:unknown):password is string {
  return typeof password==='string' && password.length>=12 && password.length<=256;
}
export type ManagedUser = {id:number;username:string;shared:boolean;active:boolean;createdAtMs:number};

let dummyHashPromise:Promise<string>|undefined;

export class AuthService {
  constructor(private readonly db: Database.Database, private readonly clock:()=>number=Date.now) {}

  /** Operator provisioning is internal only; never exposed as public registration. */
  async createUser(username:string,password:string,shared=false):Promise<number> {
    if (!/^[A-Za-z0-9._-]{3,48}$/.test(username) || typeof password !== 'string' ||
      !validPassword(password)) throw new Error('Invalid account credentials');
    const hash = await argon2.hash(password,passwordOptions);
    const result = this.db.prepare('INSERT INTO users(username,password_hash,shared,created_at_ms) VALUES(?,?,?,?)')
      .run(username,hash,shared?1:0,this.clock());
    return Number(result.lastInsertRowid);
  }

  async login(username:string,password:string):Promise<{operator:Operator;token:string}|null> {
    if(typeof username !== 'string' || typeof password !== 'string' || username.length>48 || password.length>256) return null;
    const row=this.db.prepare('SELECT id,username,password_hash,shared,active FROM users WHERE username=?')
      .get(username) as UserRow|undefined;
    // Do comparable password hashing work even for unknown users to reduce enumeration signals.
    dummyHashPromise??=argon2.hash('synthetic-nonaccount-password',passwordOptions);
    const valid=await argon2.verify(row?.password_hash??await dummyHashPromise,password).catch(()=>false);
    if(!row || !row.active || !valid) return null;
    const token=randomBytes(32).toString('base64url');
    const id=randomUUID();
    const now=this.clock();
    this.db.prepare('INSERT INTO login_sessions(id,user_id,token_hash,created_at_ms,expires_at_ms) VALUES(?,?,?,?,?)')
      .run(id,row.id,tokenDigest(token),now,now+SESSION_TTL_MS);
    return {token,operator:{id:row.id,username:row.username,shared:row.shared===1,sessionId:id}};
  }

  authenticate(token:string|undefined):Operator|null {
    if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const row=this.db.prepare(`
      SELECT s.id,s.user_id,u.username,u.shared,u.active,s.expires_at_ms,s.revoked_at_ms
      FROM login_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?
    `).get(tokenDigest(token)) as SessionRow|undefined;
    if(!row || !row.active || row.revoked_at_ms!==null || row.expires_at_ms<=this.clock()) return null;
    return {id:row.user_id,username:row.username,shared:row.shared===1,sessionId:row.id};
  }

  revoke(token:string|undefined):void {
    if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    this.db.prepare('UPDATE login_sessions SET revoked_at_ms=? WHERE token_hash=? AND revoked_at_ms IS NULL')
      .run(this.clock(),tokenDigest(token));
  }

  revokeSession(actor:Operator,sessionId:string):boolean {
    const result=this.db.prepare('UPDATE login_sessions SET revoked_at_ms=? WHERE id=? AND user_id=? AND revoked_at_ms IS NULL')
      .run(this.clock(),sessionId,actor.id);
    return result.changes===1;
  }

  sessions(actor:Operator) {
    return this.db.prepare(`
      SELECT id,created_at_ms AS createdAtMs,expires_at_ms AS expiresAtMs
      FROM login_sessions WHERE user_id=? AND revoked_at_ms IS NULL AND expires_at_ms>?
      ORDER BY created_at_ms DESC
    `).all(actor.id,this.clock()) as Array<{id:string;createdAtMs:number;expiresAtMs:number}>;
  }
  /** List accounts without password hashes. This is NOT exposed to ordinary operator HTTP clients. */
  listUsers():ManagedUser[] {
    const rows=this.db.prepare('SELECT id,username,shared,active,created_at_ms FROM users ORDER BY id')
      .all() as Array<{id:number;username:string;shared:number;active:number;created_at_ms:number}>;
    return rows.map(row=>({id:row.id,username:row.username,shared:row.shared===1,
      active:row.active===1,createdAtMs:row.created_at_ms}));
  }

  /** Trusted, server-side administrative operation. Always revoke sessions on reset. */
  async resetPassword(userId:number,newPassword:string):Promise<boolean> {
    if(!Number.isSafeInteger(userId)||userId<1||!validPassword(newPassword))
      throw new Error('Invalid account credentials');
    const hash=await argon2.hash(newPassword,passwordOptions);
    const now=this.clock();
    return this.db.transaction(()=>{
      const updated=this.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,userId);
      if(updated.changes!==1) return false;
      this.db.prepare('UPDATE login_sessions SET revoked_at_ms=? WHERE user_id=? AND revoked_at_ms IS NULL')
        .run(now,userId);
      return true;
    })();
  }

  /** Trusted, server-side administrative operation. Deactivation revokes every session. */
  setActive(userId:number,active:boolean):boolean {
    if(!Number.isSafeInteger(userId)||userId<1||typeof active!=='boolean')
      throw new Error('Invalid account state');
    const now=this.clock();
    return this.db.transaction(()=>{
      const updated=this.db.prepare('UPDATE users SET active=? WHERE id=?').run(active?1:0,userId);
      if(updated.changes!==1) return false;
      if(!active) this.db.prepare('UPDATE login_sessions SET revoked_at_ms=? WHERE user_id=? AND revoked_at_ms IS NULL')
        .run(now,userId);
      return true;
    })();
  }

  /** Self-service password change: current password required and all device sessions invalidated. */
  async changeOwnPassword(actor:Operator,currentPassword:string,newPassword:string):Promise<boolean> {
    if(typeof currentPassword!=='string'||currentPassword.length>256||!validPassword(newPassword))
      return false;
    const row=this.db.prepare('SELECT password_hash,active FROM users WHERE id=?')
      .get(actor.id) as {password_hash:string;active:number}|undefined;
    if(!row || !row.active) return false;
    if(!await argon2.verify(row.password_hash,currentPassword).catch(()=>false)) return false;
    const hash=await argon2.hash(newPassword,passwordOptions);
    const now=this.clock();
    return this.db.transaction(()=>{
      // Reject racing password changes rather than overwriting a newer password.
      const updated=this.db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=? AND active=1')
        .run(hash,actor.id,row.password_hash);
      if(updated.changes!==1) return false;
      this.db.prepare('UPDATE login_sessions SET revoked_at_ms=? WHERE user_id=? AND revoked_at_ms IS NULL')
        .run(now,actor.id);
      return true;
    })();
  }

}

export function cookieToken(cookieHeader:string|undefined):string|undefined {
  if(!cookieHeader) return undefined;
  const matches=cookieHeader.split(';').map(part=>part.trim()).filter(part=>part.startsWith(COOKIE_NAME+'='));
  return matches.length===1 ? matches[0].slice(COOKIE_NAME.length+1) : undefined;
}

export function sessionCookie(token:string,maxAgeSeconds:number):string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie():string {
  return sessionCookie('',0);
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, clearSessionCookie, cookieToken, sessionCookie, SESSION_TTL_MS } from './service.js';

function sameOrigin(request:FastifyRequest,origin:string):boolean {
  return request.headers.origin===origin;
}
function noStore(reply:FastifyReply):void {
  reply.header('Cache-Control','no-store');
}

export function registerAuthHttp(app:FastifyInstance,auth:AuthService,expectedOrigin:string):void {
  const failures=new Map<string,{count:number;until:number}>();
  app.addHook('onRequest',async (request,reply)=>{
    if (request.url.startsWith('/api/auth/')) {
      noStore(reply);
      reply.header('X-Content-Type-Options','nosniff');
      reply.header('Referrer-Policy','no-referrer');
    }
  });

  app.post('/api/auth/login',async(request,reply)=>{
    if (!sameOrigin(request,expectedOrigin)) return reply.code(403).send({error:'forbidden_origin'});
    const body=request.body;
    if(!body || typeof body!=='object' || Array.isArray(body)) return reply.code(400).send({error:'invalid_request'});
    const {username,password}=body as Record<string,unknown>;
    if(typeof username!=='string'||typeof password!=='string'||username.length>48||password.length>256)
      return reply.code(400).send({error:'invalid_request'});
    const key=request.ip+':'+username.toLowerCase();
    const now=Date.now();
    const state=failures.get(key);
    if(state && state.until>now && state.count>=5) return reply.code(429).send({error:'rate_limited'});
    const found=await auth.login(username,password);
    if(!found){
      const previous=state && state.until>now?state.count:0;
      failures.set(key,{count:previous+1,until:now+15*60*1000});
      return reply.code(401).send({error:'invalid_credentials'});
    }
    failures.delete(key);
    reply.header('Set-Cookie',sessionCookie(found.token,SESSION_TTL_MS/1000));
    return {user:{id:found.operator.id,username:found.operator.username,shared:found.operator.shared}};
  });

  app.post('/api/auth/password',async(request,reply)=>{
    if(!sameOrigin(request,expectedOrigin)) return reply.code(403).send({error:'forbidden_origin'});
    const token=cookieToken(request.headers.cookie);
    const actor=auth.authenticate(token);
    if(!actor) return reply.code(401).send({error:'unauthorized'});
    const body=request.body;
    if(!body||typeof body!=='object'||Array.isArray(body)) return reply.code(400).send({error:'invalid_request'});
    const {currentPassword,newPassword}=body as Record<string,unknown>;
    if(typeof currentPassword!=='string'||typeof newPassword!=='string'||
      currentPassword.length>256||newPassword.length<12||newPassword.length>256)
      return reply.code(400).send({error:'invalid_request'});
    if(!await auth.changeOwnPassword(actor,currentPassword,newPassword))
      return reply.code(403).send({error:'invalid_credentials'});
    reply.header('Set-Cookie',clearSessionCookie());
    return {ok:true,reauthenticate:true};
  });

  app.get('/api/auth/me',async(request,reply)=>{
    const operator=auth.authenticate(cookieToken(request.headers.cookie));
    if(!operator) return reply.code(401).send({error:'unauthorized'});
    return {user:{id:operator.id,username:operator.username,shared:operator.shared,sessionId:operator.sessionId}};
  });

  app.get('/api/auth/sessions',async(request,reply)=>{
    const operator=auth.authenticate(cookieToken(request.headers.cookie));
    if(!operator) return reply.code(401).send({error:'unauthorized'});
    return {sessions:auth.sessions(operator)};
  });

  app.post('/api/auth/logout',async(request,reply)=>{
    if(!sameOrigin(request,expectedOrigin)) return reply.code(403).send({error:'forbidden_origin'});
    const token=cookieToken(request.headers.cookie);
    if(!auth.authenticate(token)) return reply.code(401).send({error:'unauthorized'});
    auth.revoke(token);
    reply.header('Set-Cookie',clearSessionCookie());
    return {ok:true};
  });

  app.post<{Params:{sessionId:string}}>('/api/auth/sessions/:sessionId/revoke',async(request,reply)=>{
    if(!sameOrigin(request,expectedOrigin)) return reply.code(403).send({error:'forbidden_origin'});
    const actor=auth.authenticate(cookieToken(request.headers.cookie));
    if(!actor) return reply.code(401).send({error:'unauthorized'});
    const {sessionId}=request.params;
    if(!/^[0-9a-f-]{36}$/.test(sessionId)) return reply.code(400).send({error:'invalid_request'});
    if(!auth.revokeSession(actor,sessionId)) return reply.code(404).send({error:'not_found'});
    if(actor.sessionId===sessionId) reply.header('Set-Cookie',clearSessionCookie());
    return {ok:true};
  });
}

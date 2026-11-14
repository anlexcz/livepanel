import Fastify from 'fastify';
import type Database from 'better-sqlite3';
import { ProductionStore } from './production/store.js';
import { CommandProcessor } from './communication/processor.js';
import { registerDevSockets } from './communication/socket.js';
import { registerOperatorSocket } from './communication/operatorSocket.js';
import { AuthService } from './auth/service.js';
import { registerAuthHttp } from './auth/http.js';

export type AppOptions = { devSockets?:boolean; publicOrigin?:string };

export function createApp(db:Database.Database,logLevel='info',options:AppOptions={}) {
  const app=Fastify({
    logger:{level:logLevel,redact:['req.headers.authorization','req.headers.cookie','res.headers.set-cookie','req.body.password']},
    bodyLimit:64*1024,
    trustProxy:false,
  });
  app.get('/health',async(_request,reply)=>{
    try {db.prepare('SELECT 1').get();return {status:'ok',service:'metrobus-livepanel'};}
    catch {reply.code(503);return {status:'unavailable',service:'metrobus-livepanel'};}
  });

  if(options.devSockets&&options.publicOrigin) throw new Error('Unsafe WebSocket configuration');
  const store=new ProductionStore(db);
  const processor=new CommandProcessor(db,store);
  if(options.devSockets) registerDevSockets(app,store,processor);
  if(options.publicOrigin) {
    const auth=new AuthService(db);
    registerAuthHttp(app,auth,options.publicOrigin);
    registerOperatorSocket(app,store,processor,auth,options.publicOrigin);
  }

  app.setNotFoundHandler((_request,reply)=>{reply.code(404).send({error:'not_found'});});
  app.setErrorHandler((error,_request,reply)=>{
    app.log.error({err:error},'HTTP request failed');
    const status=typeof error==='object'&&error!==null&&'statusCode' in error&&typeof error.statusCode==='number'?error.statusCode:500;
    reply.code(status>=400&&status<500?status:500).send({error:'request_failed'});
  });
  return app;
}

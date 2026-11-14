import type { IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { WebSocket, WebSocketServer } from 'ws';
import type { ProductionStore } from '../production/store.js';
import type { CommandProcessor } from './processor.js';
import { AuthService, cookieToken } from '../auth/service.js';

export function registerOperatorSocket(app:FastifyInstance,store:ProductionStore,
  processor:CommandProcessor,auth:AuthService,origin:string):void {
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  const clients=new Map<WebSocket,string>();
  const send=(ws:WebSocket,message:unknown)=>{
    if(ws.readyState!==WebSocket.OPEN) return;
    if(ws.bufferedAmount>1024*1024){ws.close(1013,'Backpressure');return;}
    ws.send(JSON.stringify(message));
  };
  const unsubscribe=processor.subscribe(update=>{
    for(const [ws,token] of clients) {
      if(auth.authenticate(token)) send(ws,update);
      else ws.close(1008,'Session expired');
    }
  });
  const onUpgrade=(req:IncomingMessage,socket:import('node:stream').Duplex,head:Buffer)=>{
    const pathname=new URL(req.url??'/','http://localhost').pathname;
    if(pathname!=='/ws/operator') return;
    const token=cookieToken(req.headers.cookie);
    // Origin is mandatory; cookie alone is not WebSocket CSRF protection.
    const operator=req.headers.origin===origin?auth.authenticate(token):null;
    if(!operator||!token) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>{
      clients.set(ws,token);
      send(ws,{type:'SNAPSHOT',revision:store.read().revision,state:store.read()});
      ws.on('message',bytes=>{
        if(!auth.authenticate(token)){ws.close(1008,'Session expired');return;}
        try {
          const input:unknown=JSON.parse(bytes.toString());
          send(ws,processor.execute(input));
        } catch {
          send(ws,{type:'RESULT',commandId:'',ok:false,revision:store.read().revision,error:'INVALID_COMMAND'});
        }
      });
      ws.on('close',()=>clients.delete(ws));
      ws.on('error',()=>clients.delete(ws));
    });
  };
  const recheck=setInterval(()=>{
    for(const [ws,token] of clients) if(!auth.authenticate(token)) ws.close(1008,'Session expired');
  },30_000);
  recheck.unref();
  app.server.on('upgrade',onUpgrade);
  app.addHook('onClose',async()=>{
    clearInterval(recheck);
    unsubscribe();
    app.server.off('upgrade',onUpgrade);
    for(const ws of clients.keys()) ws.terminate();
    await new Promise<void>(resolve=>wss.close(()=>resolve()));
  });
}

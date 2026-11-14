import type { IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { WebSocket, WebSocketServer } from 'ws';
import type { CommandProcessor } from './processor.js';
import { publicProjection } from './protocol.js';
import type { ProductionStore } from '../production/store.js';

function isLoopback(ip: string | undefined): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

/**
 * DEVELOPMENT ONLY. Disabled by default. No production operator WebSocket until
 * session auth + origin/CSRF protections are implemented.
 */
export function registerDevSockets(app: FastifyInstance, store: ProductionStore, processor: CommandProcessor): void {
  const wss = new WebSocketServer({ noServer:true, maxPayload:8192, perMessageDeflate:false });
  const clients = new Map<WebSocket, 'operator'|'observer'>();
  function send(ws:WebSocket, message:unknown) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024*1024) { ws.close(1013, 'Backpressure'); return; }
    ws.send(JSON.stringify(message));
  }
  const unsubscribe = processor.subscribe(update => {
    for (const [ws,role] of clients) {
      if (role === 'operator') send(ws,update);
      else send(ws,{type:'UPDATE',...publicProjection(store.read())});
    }
  });
  const onUpgrade = (req: IncomingMessage, socket:import('node:stream').Duplex, head:Buffer) => {
    const host = req.headers.host ?? '';
    const origin = req.headers.origin;
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const role = pathname === '/dev/ws/operator' ? 'operator'
      : pathname === '/dev/ws/observer' ? 'observer' : null;
    if (!role || !isLoopback(req.socket.remoteAddress) ||
      !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) ||
      (origin !== undefined && origin !== 'http://' + host)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req,socket,head,ws => {
      clients.set(ws,role);
      if (role === 'operator') send(ws,{type:'SNAPSHOT',...{revision:store.read().revision,state:store.read()}});
      else send(ws,{type:'SNAPSHOT',...publicProjection(store.read())});
      ws.on('message',data => {
        if (role !== 'operator') { ws.close(1008,'Read only'); return; }
        try {
          const candidate:unknown = JSON.parse(data.toString());
          send(ws,processor.execute(candidate));
        } catch {
          send(ws,{type:'RESULT',commandId:'',ok:false,revision:store.read().revision,error:'INVALID_COMMAND'});
        }
      });
      ws.on('close',()=>clients.delete(ws));
      ws.on('error',()=>clients.delete(ws));
    });
  };
  app.server.on('upgrade',onUpgrade);
  app.addHook('onClose',async () => {
    unsubscribe();
    app.server.off('upgrade',onUpgrade);
    for(const ws of clients.keys()) ws.terminate();
    await new Promise<void>(resolve=>wss.close(()=>resolve()));
  });
}

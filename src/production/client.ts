/**
 * Browser-side operator state client. Server SNAPSHOT/UPDATE is the only authority.
 * Commands are never treated as successful before RESULT + confirmed state.
 */
export type ProductionState = {
  chat:{mode:'enabled'|'paused'|'disabled'};
  featured:{messageId:string|null;expiresAtMs:number|null};
  event:{queue:string[];paused:boolean};
  ticker:{status:'stopped'|'running'|'paused';position:number};
  editorial:{itemId:string|null};
};
export type ProductionSnapshot = {
  streamId:string|null;revision:number;state:ProductionState;updatedAtMs:number;
};
export type ConnectionStatus = 'connecting'|'connected'|'reconnecting'|'disconnected';
export type ProductionView = {
  status:ConnectionStatus; snapshot:ProductionSnapshot|null; pending:boolean;notice:string|null;
};
export type ProductionAction =
  |'session.start'|'session.stop'|'chat.setMode'
  |'featured.hide'|'editorial.hide'|'event.pause'|'event.resume';
export class ProductionCommandError extends Error {
  constructor(public readonly code:string) { super(code); }
}
type Pending = {reject:(error:Error)=>void;resolve:()=>void;timer:ReturnType<typeof setTimeout>;confirmedRevision?:number};

const record=(value:unknown):value is Record<string,unknown> =>
  typeof value==='object'&&value!==null&&!Array.isArray(value);
const isRevision=(v:unknown):v is number => typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const isStringOrNull=(v:unknown):v is string|null => v===null||typeof v==='string';

export function parseSnapshot(value:unknown):ProductionSnapshot|null {
  if(!record(value)||!isRevision(value.revision)||!isRevision(value.updatedAtMs)||
    !isStringOrNull(value.streamId)||!record(value.state))return null;
  const s=value.state;
  if(!record(s.chat)||(typeof s.chat.mode!=='string'||!['enabled','paused','disabled'].includes(s.chat.mode))||
    !record(s.featured)||!isStringOrNull(s.featured.messageId)||
    !(s.featured.expiresAtMs===null||isRevision(s.featured.expiresAtMs))||
    !record(s.event)||!Array.isArray(s.event.queue)||
    s.event.queue.some((id:unknown)=>typeof id!=='string')||typeof s.event.paused!=='boolean'||
    !record(s.ticker)||(typeof s.ticker.status!=='string'||!['stopped','running','paused'].includes(s.ticker.status))||
    !isRevision(s.ticker.position)||!record(s.editorial)||
    !isStringOrNull(s.editorial.itemId))return null;
  return value as unknown as ProductionSnapshot;
}
const socketUrl=()=>`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws/operator`;
export class ProductionClient {
  private socket:WebSocket|null=null;
  private listeners=new Set<(view:ProductionView)=>void>();
  private state:ProductionView={status:'connecting',snapshot:null,pending:false,notice:null};
  private pending=new Map<string,Pending>();
  private reconnectTimer:ReturnType<typeof setTimeout>|null=null;
  private retries=0;
  private stopped=false;
  private epoch=0;
  private awaitingSnapshot=true;

  constructor(private readonly url:string=socketUrl()) {}
  subscribe(callback:(view:ProductionView)=>void):()=>void {
    this.listeners.add(callback);
    callback(this.current());
    return ()=>this.listeners.delete(callback);
  }
  current():ProductionView { return {...this.state}; }
  private publish(patch:Partial<ProductionView>):void {
    this.state={...this.state,...patch};
    for(const listener of this.listeners)listener(this.current());
  }
  start():void {
    // React StrictMode runs effect setup/cleanup twice during development.
    if(this.socket||this.reconnectTimer!==null)return;
    this.stopped=false;
    this.retries=0;
    this.connect();
  }
  stop():void {
    this.stopped=true;this.epoch++;
    if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);
    this.reconnectTimer=null;
    this.failPending('DISCONNECTED');
    const socket=this.socket;this.socket=null;
    if(socket) {socket.onclose=null;socket.onerror=null;socket.onmessage=null;socket.close();}
    this.publish({status:'disconnected',snapshot:null,notice:null});
  }
  private failPending(code:string):void {
    for(const [id,request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(new ProductionCommandError(code));
      this.pending.delete(id);
    }
    this.publish({pending:false});
  }
  private connect():void {
    if(this.stopped)return;
    this.awaitingSnapshot=true;
    const currentEpoch=++this.epoch;
    this.publish({status:this.retries?'reconnecting':'connecting',snapshot:null});
    let ws:WebSocket;
    try {ws=new WebSocket(this.url);} catch {this.scheduleReconnect(currentEpoch);return;}
    this.socket=ws;
    ws.onmessage=event=>{
      if(this.stopped||currentEpoch!==this.epoch)return;
      try {this.receive(JSON.parse(String(event.data)) as unknown);}
      catch {this.resync('Neplatná zpráva ze serveru.');}
    };
    ws.onclose=()=>{
      if(this.stopped||currentEpoch!==this.epoch)return;
      this.failPending('DISCONNECTED');
      this.scheduleReconnect(currentEpoch);
    };
    ws.onerror=()=>{ /* onclose schedules reconnect */ };
  }
  private scheduleReconnect(epoch:number):void {
    if(this.stopped||epoch!==this.epoch)return;
    this.socket=null;
    const delay=Math.min(8000,500*2**Math.min(this.retries++,4));
    this.publish({status:'reconnecting',snapshot:null});
    this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.connect();},delay);
  }
  private resync(reason:string):void {
    this.publish({notice:reason,snapshot:null});
    this.failPending('RESYNC_REQUIRED');
    this.socket?.close(1000,'Resync');
  }
  private settleConfirmed():void {
    const revision=this.state.snapshot?.revision;
    for(const [id,request] of this.pending) {
      if(request.confirmedRevision===undefined||revision===undefined||revision<request.confirmedRevision)continue;
      clearTimeout(request.timer);
      this.pending.delete(id);
      request.resolve();
    }
    this.publish({pending:this.pending.size!==0});
  }
  private receive(raw:unknown):void {
    if(!record(raw)||typeof raw.type!=='string') {this.resync('Neplatný formát zprávy.');return;}
    if(raw.type==='SNAPSHOT') {
      if(!record(raw.state)) {this.resync('Neplatný snímek stavu.');return;}
      const snapshot=parseSnapshot(raw.state);
      if(!snapshot||raw.revision!==snapshot.revision) {this.resync('Neplatný snímek stavu.');return;}
      this.awaitingSnapshot=false;this.retries=0;
      this.publish({status:'connected',snapshot,notice:null});
      return;
    }
    if(this.awaitingSnapshot)return; // Never apply updates until authoritative snapshot.
    if(raw.type==='RESULT') {
      if(typeof raw.commandId!=='string')return;
      const pending=this.pending.get(raw.commandId);
      if(!pending)return;
      if(raw.ok===true&&isRevision(raw.revision)) {
        pending.confirmedRevision=raw.revision;
        // RESULT alone is not sufficient; wait until the state revision is observed.
        this.settleConfirmed();
      } else {
        this.pending.delete(raw.commandId);clearTimeout(pending.timer);
        this.publish({pending:this.pending.size!==0});
        pending.reject(new ProductionCommandError(typeof raw.error==='string'?raw.error:'COMMAND_REJECTED'));
      }
      return;
    }
    if(raw.type!=='UPDATE')return;
    const current=this.state.snapshot;
    if(!current||!isRevision(raw.revision)||typeof raw.category!=='string') {this.resync('Chybná aktualizace.');return;}
    if(raw.revision<=current.revision)return; // Duplicate or stale frame.
    if(raw.revision!==current.revision+1) {this.resync('Chybí revize. Načítám aktuální stav.');return;}
    let next:ProductionSnapshot|null=null;
    if(raw.category==='session'&&record(raw.value)) {
      next=parseSnapshot({...current,streamId:raw.value.streamId,state:raw.value.state,revision:raw.revision});
    } else if(['chat','featured','editorial','event'].includes(raw.category)&&record(raw.value)) {
      next=parseSnapshot({...current,revision:raw.revision,
        state:{...current.state,[raw.category]:raw.value}});
    }
    if(!next){this.resync('Neplatná aktualizace.');return;}
    this.publish({snapshot:next});
    this.settleConfirmed();
  }
  /** No optimistic mutation and no automatic resend of ambiguous commands. */
  send(action:ProductionAction,payload:Record<string,unknown>={}):Promise<void> {
    const snapshot=this.state.snapshot;
    const socket=this.socket;
    if(!snapshot||this.awaitingSnapshot||this.pending.size!==0||
      socket?.readyState!==WebSocket.OPEN||this.state.status!=='connected')
      return Promise.reject(new ProductionCommandError('NOT_READY'));
    const commandId=crypto.randomUUID();
    return new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{
        if(!this.pending.has(commandId))return;
        this.pending.delete(commandId);
        reject(new ProductionCommandError('TIMEOUT'));
        this.publish({pending:false});
        this.resync('Potvrzení příkazu nedorazilo. Ověřuji aktuální stav.');
      },10000);
      this.pending.set(commandId,{resolve,reject,timer});
      this.publish({pending:true,notice:null});
      try {socket.send(JSON.stringify({type:'COMMAND',commandId,action,payload,expectedRevision:snapshot.revision}));}
      catch {
        clearTimeout(timer);this.pending.delete(commandId);
        this.publish({pending:false});
        reject(new ProductionCommandError('SEND_FAILED'));
        this.resync('Odeslání se nezdařilo.');
      }
    });
  }
}

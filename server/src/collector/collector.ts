import {normalizeYouTubeMessage,type NormalizedMessage} from './model.js';
import {abortableDelay,classifyError,type CollectorBatch,type CollectorMethod,
  type ListSource,type StreamSource} from './source.js';

export type CollectorStatus='stopped'|'connecting'|'streaming'|'reconnecting'|'fallback'|'error';
export type CollectorDiagnostics={
  status:CollectorStatus;method:CollectorMethod|null;liveChatId:string|null;
  lastSuccessfulAtMs:number|null;lastMessageAtMs:number|null;
  reconnectCount:number;duplicateCount:number;receivedCount:number;reason:string|null;
};
export type DeliveredMessage={message:NormalizedMessage;recovered:boolean;liveEligible:boolean};
export type CollectorOptions={
  stream:StreamSource;
  list:ListSource;
  onMessage:(delivery:DeliveredMessage)=>Promise<void>|void;
  onStatus?:(status:CollectorDiagnostics)=>void;
  clock?:()=>number;
  delay?:(ms:number,signal:AbortSignal)=>Promise<void>;
  streamFailuresBeforeFallback?:number;
  fallbackPollsBeforeRetry?:number;
  /** Upper limit for one chat's in-memory dedup window (not an archive). */
  dedupCapacity?:number;
};
const checkId=(s:string)=>/^[A-Za-z0-9_-]{1,256}$/.test(s);
const safeToken=(token:unknown):token is string=>typeof token==='string'&&token.length>0&&token.length<=2048;
export class YouTubeCollector {
  private running:Promise<void>|null=null;
  private controller:AbortController|null=null;
  private current:CollectorDiagnostics={
    status:'stopped',method:null,liveChatId:null,lastSuccessfulAtMs:null,
    lastMessageAtMs:null,reconnectCount:0,duplicateCount:0,receivedCount:0,reason:null,
  };
  private seen=new Set<string>();
  constructor(private readonly options:CollectorOptions) {}
  diagnostics():CollectorDiagnostics{return {...this.current};}
  private report(update:Partial<CollectorDiagnostics>){
    this.current={...this.current,...update};
    this.options.onStatus?.(this.diagnostics());
  }
  start(liveChatId:string):void {
    if(!checkId(liveChatId))throw new Error('Invalid liveChatId');
    if(this.controller)throw new Error('Collector is already running');
    this.seen.clear();
    this.report({status:'connecting',method:'streamList',liveChatId,reason:null,
      lastSuccessfulAtMs:null,lastMessageAtMs:null,reconnectCount:0,
      duplicateCount:0,receivedCount:0});
    const controller=new AbortController();
    this.controller=controller;
    this.running=this.run(liveChatId,controller.signal).catch(error=>{
      if(!controller.signal.aborted)this.report({status:'error',reason:classifyError(error).reason});
    });
  }
  async stop():Promise<void>{
    const controller=this.controller;
    controller?.abort();
    try{await this.running;}finally{
      if(this.controller===controller){
        this.controller=null;this.running=null;this.seen.clear();
        this.report({status:'stopped',method:null,liveChatId:null,reason:null});
      }
    }
  }
  private async ingest(batch:CollectorBatch,liveChatId:string,recovered:boolean,signal:AbortSignal) {
    if(!batch||!Array.isArray(batch.items))throw new Error('Invalid collector batch');
    const now=this.options.clock??Date.now;
    for(const item of batch.items) {
      if(signal.aborted)return;
      const normalized=normalizeYouTubeMessage(item,liveChatId,now());
      if(!normalized)continue;
      const key=liveChatId+'\u0000'+normalized.externalId;
      if(this.seen.has(key)){this.report({duplicateCount:this.current.duplicateCount+1});continue;}
      await this.options.onMessage({message:normalized,recovered,liveEligible:!recovered});
      // Do not dedup or advance checkpoint until downstream accepted the item.
      this.seen.add(key);
      if(this.seen.size>(this.options.dedupCapacity??10000)) {
        const first=this.seen.values().next().value;
        if(first)this.seen.delete(first);
      }
      this.report({lastMessageAtMs:now(),receivedCount:this.current.receivedCount+1});
    }
    this.report({lastSuccessfulAtMs:now()});
  }
  private async run(liveChatId:string,signal:AbortSignal):Promise<void> {
    const pause=this.options.delay??abortableDelay;
    const threshold=Math.max(1,this.options.streamFailuresBeforeFallback??3);
    const retryPolls=Math.max(1,this.options.fallbackPollsBeforeRetry??5);
    let method:CollectorMethod='streamList';
    let failures=0;
    let streamToken:string|undefined;
    let listToken:string|undefined;
    // Each API method retains its own token. Transferability is not assumed.
    while(!signal.aborted) {
      if(method==='streamList') {
        try {
          this.report({status:failures?'reconnecting':'connecting',method,reason:null});
          let initial=true;
          for await(const batch of this.options.stream({liveChatId,pageToken:streamToken,signal})) {
            if(signal.aborted)return;
            this.report({status:'streaming',method,reason:null});
            await this.ingest(batch,liveChatId,initial,signal);
            if(safeToken(batch.nextPageToken))streamToken=batch.nextPageToken;
            initial=false;
            failures=0;
            if(batch.offlineAt)throw new Error('YOUTUBE_CHAT_ENDED');
          }
          if(signal.aborted)return;
          throw new Error('stream disconnected');
        }catch(raw){
          if(signal.aborted)return;
          if(raw instanceof Error&&raw.message==='YOUTUBE_CHAT_ENDED') {
            this.report({status:'error',method,reason:'ended'});return;
          }
          const categorized=classifyError(raw);
          if(categorized.reason!=='transient') {
            this.report({status:'error',method,reason:categorized.reason});return;
          }
          failures++;
          this.report({status:'reconnecting',method,reason:categorized.reason,reconnectCount:this.current.reconnectCount+1});
          if(failures>=threshold){method='list';listToken=undefined;continue;}
          await pause(Math.min(30000,1000*2**Math.min(failures-1,5)),signal);
        }
      }else{
        this.report({status:'fallback',method:'list',reason:'streamList unavailable'});
        let polls=0;
        let initial=true;
        try{
          while(!signal.aborted&&polls<retryPolls){
            const batch=await this.options.list({liveChatId,pageToken:listToken,signal});
            if(signal.aborted)return;
            await this.ingest(batch,liveChatId,initial,signal);
            if(safeToken(batch.nextPageToken))listToken=batch.nextPageToken;
            initial=false;
            polls++;
            if(batch.offlineAt){this.report({status:'error',method:'list',reason:'ended'});return;}
            // YouTube determines minimum polling cadence; do not set a faster local rate.
            const interval=Math.max(1000,batch.pollingIntervalMillis??5000);
            await pause(interval,signal);
          }
          if(signal.aborted)return;
          method='streamList';failures=0;streamToken=undefined;
        }catch(raw){
          if(signal.aborted)return;
          const err=classifyError(raw);
          if(err.reason!=='transient') {this.report({status:'error',method:'list',reason:err.reason});return;}
          this.report({status:'fallback',method:'list',reason:err.reason,reconnectCount:this.current.reconnectCount+1});
          await pause(Math.max(5000,err.retryAfterMs??5000),signal);
        }
      }
    }
  }
}

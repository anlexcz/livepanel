/** Network adapters are injected; no API secrets or token persistence here. */
export type CollectorMethod='streamList'|'list';
export type CollectorBatch={
  items:unknown[];
  nextPageToken?:string;
  pollingIntervalMillis?:number;
  offlineAt?:string;
};
export type Request={liveChatId:string;pageToken?:string;signal:AbortSignal};
export type StreamSource=(request:Request)=>AsyncIterable<CollectorBatch>;
export type ListSource=(request:Request)=>Promise<CollectorBatch>;
export class CollectorSourceError extends Error {
  constructor(public readonly reason:'auth'|'quota'|'ended'|'disabled'|'invalid'|'transient',
    message:string,public readonly retryAfterMs?:number){super(message);this.name='CollectorSourceError';}
}
/** Only retry transport errors. Do not attempt to bypass API authorization or quotas. */
export function classifyError(error:unknown):CollectorSourceError {
  if(error instanceof CollectorSourceError)return error;
  return new CollectorSourceError('transient','YouTube transport unavailable');
}
export function abortableDelay(ms:number,signal:AbortSignal):Promise<void> {
  if(signal.aborted)return Promise.resolve();
  return new Promise(resolve=>{
    const timer=setTimeout(done,ms);
    function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}
    signal.addEventListener('abort',done,{once:true});
  });
}

import {CollectorSourceError,type CollectorBatch,type ListSource} from './source.js';
export type AccessTokenProvider=()=>Promise<string>;
/** Official list REST fallback. No bearer token is logged, stored or exposed. */
export function createYouTubeListSource(getAccessToken:AccessTokenProvider,transport:typeof fetch=fetch):ListSource {
  return async ({liveChatId,pageToken,signal}):Promise<CollectorBatch>=>{
    const token=await getAccessToken();
    if(!token||typeof token!=='string')throw new CollectorSourceError('auth','YouTube authorization missing');
    const url=new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
    url.searchParams.set('liveChatId',liveChatId);
    url.searchParams.set('part','id,snippet,authorDetails');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    let response:Response;
    try {
      response=await transport(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal});
    } catch(error) {
      if(signal.aborted)throw error;
      throw new CollectorSourceError('transient','YouTube transport unavailable');
    }
    if(!response.ok){
      let reason='';
      try{
        const data=await response.json() as unknown;
        const body=data && typeof data==='object'?data as Record<string,unknown>:{};
        const details=body.error && typeof body.error==='object'?body.error as Record<string,unknown>:{};
        const errors=Array.isArray(details.errors)?details.errors:[];
        const first=errors[0]&&typeof errors[0]==='object'?errors[0] as Record<string,unknown>:{};
        reason=typeof first.reason==='string'?first.reason:'';
      }catch{ /* non-JSON error response */ }
      const kind:CollectorSourceError['reason']=
        reason==='liveChatEnded'?'ended':reason==='liveChatDisabled'?'disabled':
        reason==='quotaExceeded'||reason==='rateLimitExceeded'||response.status===429?'quota':
        reason==='forbidden'||response.status===401||response.status===403?'auth':
        response.status===400||response.status===404?'invalid':'transient';
      const retryHeader=response.headers.get('Retry-After');
      const seconds=retryHeader!==null?Number(retryHeader):NaN;
      const retryAfterMs=Number.isFinite(seconds)&&seconds>=0?Math.min(seconds*1000,300000):undefined;
      throw new CollectorSourceError(kind,`YouTube list request failed (${response.status})`,retryAfterMs);
    }
    let raw:unknown;
    try{raw=await response.json();}catch{throw new CollectorSourceError('transient','Invalid YouTube JSON');}
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CollectorSourceError('transient','Invalid YouTube payload');
    const data=raw as Record<string,unknown>;
    if(!Array.isArray(data.items))throw new CollectorSourceError('transient','Missing YouTube messages array');
    const nextPageToken=typeof data.nextPageToken==='string'?data.nextPageToken:undefined;
    const pollingIntervalMillis=typeof data.pollingIntervalMillis==='number'
      && Number.isFinite(data.pollingIntervalMillis)&&data.pollingIntervalMillis>=0
      ?data.pollingIntervalMillis:undefined;
    return {items:data.items,nextPageToken,pollingIntervalMillis,
      offlineAt:typeof data.offlineAt==='string'?data.offlineAt:undefined};
  };
}

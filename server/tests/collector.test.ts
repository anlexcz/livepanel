import test from 'node:test';
import assert from 'node:assert/strict';
import {YouTubeCollector,type DeliveredMessage} from '../src/collector/collector.js';
import {normalizeYouTubeMessage} from '../src/collector/model.js';
import {CollectorSourceError,type CollectorBatch} from '../src/collector/source.js';
import {createYouTubeListSource} from '../src/collector/listSource.js';

const message=(id:string,type='textMessageEvent')=>({
  id,snippet:{type,publishedAt:'2026-11-14T12:00:00Z',displayMessage:'synthetic text',
    ...(type==='superChatEvent'?{superChatDetails:{amountMicros:'2000000',currency:'CZK',amountDisplayString:'20 Kč'}}:{})},
  authorDetails:{channelId:'channel',displayName:'Viewer',profileImageUrl:'https://example.test/avatar.png',
    isChatModerator:false,isChatOwner:false,isChatSponsor:true},
});
const batch=(items:unknown[],nextPageToken?:string,pollingIntervalMillis?:number):CollectorBatch=>({
  items,nextPageToken,pollingIntervalMillis,
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('normalizes chat, special EVENT, moderation and rejects malformed records',()=>{
  const chat=normalizeYouTubeMessage(message('m1'),'chat_1',2000);
  assert.equal(chat?.kind,'chat');
  assert.equal(chat?.author.member,true);
  assert.equal(chat?.publishedAtMs,Date.parse('2026-11-14T12:00:00Z'));
  assert.equal(chat?.receivedAtMs,2000);
  const event=normalizeYouTubeMessage(message('super_1','superChatEvent'),'chat_1',2000);
  assert.equal(event?.kind,'event');
  assert.deepEqual(event?.amount,{currency:'CZK',micros:'2000000',display:'20 Kč'});
  const removed=normalizeYouTubeMessage({
    id:'removed',snippet:{type:'messageDeletedEvent',publishedAt:'2026-11-14T12:01:00Z',
      messageDeletedDetails:{deletedMessageId:'m1'}},
  },'chat_1',2000);
  assert.equal(removed?.kind,'moderation');
  assert.equal(removed?.targetMessageId,'m1');
  assert.equal(normalizeYouTubeMessage({id:'bad'},'chat_1',2000),null);
});

test('fallback list HTTP honors exact official endpoint and returned pollingIntervalMillis',async()=>{
  let seen='';
  const transport=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input));seen=url.toString();
    assert.equal(url.hostname,'www.googleapis.com');
    assert.equal(url.pathname,'/youtube/v3/liveChat/messages');
    assert.equal(url.searchParams.get('part'),'id,snippet,authorDetails');
    assert.equal(url.searchParams.get('liveChatId'),'chat_1');
    assert.equal(url.searchParams.get('pageToken'),'page_1');
    assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer sample-token');
    return new Response(JSON.stringify({
      items:[message('m1')],nextPageToken:'page_2',pollingIntervalMillis:6700,
    }),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const source=createYouTubeListSource(async()=> 'sample-token',transport as typeof fetch);
  const response=await source({liveChatId:'chat_1',pageToken:'page_1',signal:new AbortController().signal});
  assert.match(seen,/pageToken=page_1/);
  assert.equal(response.pollingIntervalMillis,6700);
  assert.equal(response.nextPageToken,'page_2');
});

test('list 403 quota is not mistaken for a transient transport error',async()=>{
  const transport=async()=>new Response(JSON.stringify({
    error:{errors:[{reason:'quotaExceeded'}]},
  }),{status:403});
  const source=createYouTubeListSource(async()=> 'sample-token',transport as typeof fetch);
  await assert.rejects(source({liveChatId:'chat_1',signal:new AbortController().signal}),
    (error:unknown)=>error instanceof CollectorSourceError&&error.reason==='quota');
});

test('normal stream: first history batch is recovered, subsequent messages live, duplicates deduped',async()=>{
  const deliveries:DeliveredMessage[]=[];
  let streamCalls=0;
  const collector=new YouTubeCollector({
    stream:async function*({signal}){
      streamCalls++;
      yield batch([message('history_1')],'cursor_a');
      yield batch([message('history_1'),message('live_2')],'cursor_b');
      await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
    },
    list:async()=>{throw new Error('list must not run');},
    onMessage:item=>{deliveries.push(item);},
  });
  collector.start('chat_1');
  await flush();
  await flush();
  assert.equal(streamCalls,1);
  assert.deepEqual(deliveries.map(item=>[item.message.externalId,item.liveEligible]),
    [['history_1',false],['live_2',true]]);
  assert.equal(collector.diagnostics().duplicateCount,1);
  assert.equal(collector.diagnostics().status,'streaming');
  await collector.stop();
  assert.equal(collector.diagnostics().status,'stopped');
});

test('repeated stream failures switch to sequential list fallback and use server polling cadence',async()=>{
  const deliveries:DeliveredMessage[]=[];
  const delays:number[]=[];
  const methods:string[]=[];
  let streamCalls=0;
  let listCalls=0;
  const collector=new YouTubeCollector({
    stream:async function*({pageToken}){
      streamCalls++;
      methods.push('stream:'+(pageToken??'none'));
      throw new CollectorSourceError('transient','lost');
      yield batch([]);
    },
    list:async({pageToken,signal})=>{
      listCalls++;
      methods.push('list:'+(pageToken??'none'));
      if(listCalls===2)signal.throwIfAborted();
      return batch([message(listCalls===1?'old':'new')],listCalls===1?'list-page':'list-next',7500);
    },
    onMessage:item=>{deliveries.push(item);},
    delay:async(ms)=>{delays.push(ms);await new Promise(resolve=>setImmediate(resolve));},
    streamFailuresBeforeFallback:2,fallbackPollsBeforeRetry:2,
  });
  collector.start('chat_1');
  for(let i=0;i<20&&listCalls<2;i++)await flush();
  assert.equal(streamCalls>=2,true);
  assert.equal(listCalls>=2,true);
  assert.deepEqual(methods.slice(0,4),['stream:none','stream:none','list:none','list:list-page']);
  assert.ok(delays.includes(7500));
  assert.deepEqual(deliveries.slice(0,2).map(x=>x.liveEligible),[false,true]);
  await collector.stop();
});

test('permission errors stop immediately without quota-burning fallback attempts',async()=>{
  let streams=0;
  let lists=0;
  const collector=new YouTubeCollector({
    stream:async function*(){streams++;throw new CollectorSourceError('auth','no permission');yield batch([]);},
    list:async()=>{lists++;return batch([]);},
    onMessage:()=>{},
  });
  collector.start('chat_1');
  await flush();
  assert.equal(collector.diagnostics().status,'error');
  assert.equal(collector.diagnostics().reason,'auth');
  assert.equal(streams,1);
  assert.equal(lists,0);
  await collector.stop();
});

test('downstream processing failure does not acknowledge message or advance continuation',async()=>{
  const requests:Array<string|undefined>=[];
  let attempts=0;
  const collector=new YouTubeCollector({
    stream:async function*({pageToken,signal}){
      requests.push(pageToken);
      yield batch([message('not_committed')],'cursor_after');
      await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
    },
    list:async()=>batch([]),
    onMessage:()=>{attempts++;throw new Error('downstream storage unavailable');},
    delay:async()=>{await new Promise(resolve=>setImmediate(resolve));},
    streamFailuresBeforeFallback:100,
  });
  collector.start('chat_1');
  for(let i=0;i<10&&attempts<2;i++)await flush();
  assert.ok(attempts>=2);
  assert.deepEqual(requests.slice(0,2),[undefined,undefined]);
  assert.equal(collector.diagnostics().receivedCount,0);
  await collector.stop();
});

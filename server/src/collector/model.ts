/** Collector-only normalized data. Source payload is never archived verbatim. */
export type CollectorKind = 'chat' | 'event' | 'moderation' | 'system';
export type NormalizedMessage = {
  source: 'youtube';
  liveChatId: string;
  externalId: string;
  kind: CollectorKind;
  subtype: string;
  author: {channelId: string | null; name: string; avatarUrl: string | null; moderator: boolean; owner: boolean; member: boolean};
  text: string;
  publishedAtMs: number;
  receivedAtMs: number;
  amount?: {currency:string; micros:string; display:string};
  targetMessageId?: string;
};
const obj=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const str=(v:unknown,max=4000):string|null=>typeof v==='string'&&v.length<=max?v:null;
const url=(v:unknown):string|null=>{
  const value=str(v,2048);
  if(!value)return null;
  try {const parsed=new URL(value);return parsed.protocol==='https:'?value:null;} catch{return null;}
};
const time=(value:unknown):number|null=>{
  if(typeof value!=='string')return null;
  const n=Date.parse(value);
  return Number.isSafeInteger(n)&&n>=0?n:null;
};
export function normalizeYouTubeMessage(raw:unknown,liveChatId:string,receivedAtMs:number):NormalizedMessage|null {
  const item=obj(raw);
  if(!item||!liveChatId||!Number.isSafeInteger(receivedAtMs)||receivedAtMs<0)return null;
  const id=str(item.id,256);const snippet=obj(item.snippet);
  const author=obj(item.authorDetails);
  if(!id||!snippet)return null;
  const type=str(snippet.type,80)??'unknown';
  const published=time(snippet.publishedAt);
  if(published===null)return null;
  const moderation=['messageDeletedEvent','userBannedEvent'].includes(type);
  const event=['superChatEvent','superStickerEvent','newSponsorEvent','memberMilestoneChatEvent','membershipGiftingEvent','giftMembershipReceivedEvent'].includes(type);
  const amountDetails=obj(snippet.superChatDetails)??obj(snippet.superStickerDetails);
  const amount=amountDetails && str(amountDetails.currency,12)&&str(amountDetails.amountMicros,32)
    ?{currency:amountDetails.currency as string,micros:amountDetails.amountMicros as string,
      display:str(amountDetails.amountDisplayString,100)??''}:undefined;
  const deleteDetails=obj(snippet.messageDeletedDetails);
  const targetMessageId=str(deleteDetails?.deletedMessageId,256)??undefined;
  return {
    source:'youtube',liveChatId,externalId:id,
    kind:moderation?'moderation':event?'event':type==='textMessageEvent'?'chat':'system',
    subtype:type,
    author:{
      channelId:str(author?.channelId,256),
      name:str(author?.displayName,256)??'',
      avatarUrl:url(author?.profileImageUrl),
      moderator:author?.isChatModerator===true,
      owner:author?.isChatOwner===true,
      member:author?.isChatSponsor===true,
    },
    text:str(snippet.displayMessage,8000)??str(obj(snippet.textMessageDetails)?.messageText,8000)??'',
    publishedAtMs:published,receivedAtMs,
    ...(amount?{amount}:{}),...(targetMessageId?{targetMessageId}:{}),
  };
}

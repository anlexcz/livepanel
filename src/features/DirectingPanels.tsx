import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock3, EyeOff, List, Pause, Pencil, Play, Plus, SkipForward, Star, Trash2, Type, X, Zap } from 'lucide-react';
import { Buttons, Empty, PanelButton, Status } from '../components/Ui';
import { initialEditorial, initialEvents, initialTicker, type EditorialItem, type EventItem, type TickerItem } from '../mock/directing';
import type { Category, Message } from '../mock/data';

type Props={
  messages:Message[]; favorites:Message[]; shownMessages:Message[]; featuredId:string|null; onFeature:(id:string|null)=>void;
  collapsed:Record<Category,boolean>; toggle:(category:Category)=>void;
};
function Module({name,status,collapsed,onToggle,children}:{name:Category;status:string;collapsed:boolean;onToggle:()=>void;children:React.ReactNode}){
  const Icon={FEATURED:Star,EVENT:Zap,TICKER:List,EDITORIAL:Type}[name];
  return <section className="panel director-panel">
    <button type="button" className="panel-toggle" aria-expanded={!collapsed} onClick={onToggle}><span className="panel-heading"><Icon size={18}/>{name}</span><span className="panel-summary">{status}</span><ChevronDown size={18} className={'lp-collapse-chevron '+(collapsed?'':'is-open')}/></button>
    <div className={'lp-module-disclosure '+(collapsed?'':'is-open')} inert={collapsed} aria-hidden={collapsed}>
      <div className="lp-module-disclosure-inner"><div className="panel-body">{children}</div></div>
    </div>
  </section>;
}
export default function DirectingPanels({messages,favorites,shownMessages,featuredId,onFeature,collapsed,toggle}:Props){
  const [featuredTab,setFeaturedTab]=useState<'favorites'|'shown'>('favorites');
  const [events,setEvents]=useState<EventItem[]>(initialEvents);
  const [activeEvent,setActiveEvent]=useState<EventItem|null>(null);
  const [eventPaused,setEventPaused]=useState(false);
  const [eventTab,setEventTab]=useState<'waiting'|'history'>('waiting');
  const [eventHistory,setEventHistory]=useState<EventItem[]>([]);
  const [recentSave,setRecentSave]=useState<{kind:'ticker'|'editorial';id:string}|null>(null);
  useEffect(()=>{
    if(!recentSave)return;
    const timer=window.setTimeout(()=>setRecentSave(null),450);
    return ()=>window.clearTimeout(timer);
  },[recentSave]);

  const [featuredDeadline,setFeaturedDeadline]=useState<number|null>(null);
  const [featuredRemaining,setFeaturedRemaining]=useState(0);
  // The browser timer is for this demo only; the server will own production expiry.
  useEffect(()=>{
    if(!featuredId){setFeaturedDeadline(null);setFeaturedRemaining(0);return;}
    const deadline=Date.now()+60000;setFeaturedDeadline(deadline);setFeaturedRemaining(60);
  },[featuredId]);
  useEffect(()=>{
    if(featuredDeadline===null)return;
    const interval=window.setInterval(()=>{
      const remaining=Math.max(0,Math.ceil((featuredDeadline-Date.now())/1000));
      setFeaturedRemaining(remaining);
      if(remaining===0){window.clearInterval(interval);onFeature(null);}
    },250);
    return ()=>window.clearInterval(interval);
  },[featuredDeadline,onFeature]);
  function extendFeatured(){
    if(!featuredId)return;
    setFeaturedDeadline(value=>Math.max(Date.now(),value??Date.now())+30000);
    setFeaturedRemaining(v=>v+30);
  }
  function featureMessage(id:string){onFeature(id);}
  function finishEvent(){
    if(!activeEvent)return;
    setEventHistory(previous=>[...previous,activeEvent]);
    setActiveEvent(null);
  }

  const [tickerItems,setTickerItems]=useState<TickerItem[]>(initialTicker);
  // Snapshot of the current batch: editing the library affects only future batches.
  const [tickerBatchItems,setTickerBatchItems]=useState<TickerItem[]>([]);
  const [tickerRunning,setTickerRunning]=useState(false);
  const [tickerCurrent,setTickerCurrent]=useState<string|null>(null);
  const [tickerCurrentText,setTickerCurrentText]=useState('');
  const [tickerEdit,setTickerEdit]=useState<string|null>(null);
  const [tickerDraft,setTickerDraft]=useState('');
  const [tickerLibraryOpen,setTickerLibraryOpen]=useState(false);
  const [tickerTimingOpen,setTickerTimingOpen]=useState(false);
  const [tickerDuration,setTickerDuration]=useState(20);
  const [tickerInterval,setTickerInterval]=useState(5);
  const [tickerDurationCustom,setTickerDurationCustom]=useState(false);
  const [tickerIntervalCustom,setTickerIntervalCustom]=useState(false);
  const [tickerDurationInput,setTickerDurationInput]=useState('');
  const [tickerIntervalInput,setTickerIntervalInput]=useState('');
  const [tickerPhase,setTickerPhase]=useState<'idle'|'show'|'between'>('idle');
  const [tickerBatchStart,setTickerBatchStart]=useState<number|null>(null);
  const [tickerPauseTime,setTickerPauseTime]=useState<number|null>(null);
  const [tickerNextAt,setTickerNextAt]=useState<number|null>(null);
  const [tickerEffectiveDuration,setTickerEffectiveDuration]=useState(20);
  const [tickerEffectiveInterval,setTickerEffectiveInterval]=useState(300);
  const [tickerCountdown,setTickerCountdown]=useState(20);
  function updateCustomTime(value:string,kind:'duration'|'interval'){
    if(!/^\d*$/.test(value))return;
    const number=Number(value),max=kind==='duration'?3600:1440;
    if(kind==='duration')setTickerDurationInput(value);else setTickerIntervalInput(value);
    if(value.trim()!=='' && Number.isInteger(number) && number>=1 && number<=max){
      if(kind==='duration'){setTickerDuration(number);setTickerDurationCustom(true);}
      else{setTickerInterval(number);setTickerIntervalCustom(true);}
    }
  }
  const [editorial,setEditorial]=useState<EditorialItem[]>(initialEditorial);
  const [editorialCurrent,setEditorialCurrent]=useState<EditorialItem|null>(null);
  const [editorialEdit,setEditorialEdit]=useState<string|null>(null);
  const [editorialDraft,setEditorialDraft]=useState({heading:'',subheading:''});
  const [showEditorialLibrary,setShowEditorialLibrary]=useState(false);
  const featured=messages.find(m=>m.id===featuredId);
  function nextEvent(){
    if(eventPaused||!events.length)return;
    // The existing item is completed before the next queued item starts.
    if(activeEvent)setEventHistory(previous=>[...previous,activeEvent]);
    setActiveEvent(events[0]);
    setEvents(previous=>previous.slice(1));
  }
  // Local demo only. Each interval is measured between starts of batches.
  function stopTicker(){
    setTickerRunning(false);setTickerCurrent(null);setTickerCurrentText('');setTickerPhase('idle');
    setTickerBatchStart(null);setTickerNextAt(null);setTickerPauseTime(null);
    setTickerBatchItems([]);
  }
  function beginTickerBatch(){
    const enabled=tickerItems.filter(t=>t.enabled);
    if(!enabled.length){stopTicker();return;}
    const now=Date.now(),duration=Math.max(1,Math.round(tickerDuration));
    const interval=Math.max(10,Math.round(tickerInterval*60));
    setTickerEffectiveDuration(duration);setTickerEffectiveInterval(interval);
    setTickerBatchItems(enabled.map(item=>({...item})));
    setTickerBatchStart(now);setTickerPhase('show');setTickerCurrent(enabled[0].id);setTickerCurrentText(enabled[0].text);
    setTickerNextAt(now+duration*1000);setTickerCountdown(duration);
    setTickerRunning(true);setTickerPauseTime(null);
  }
  function pauseTicker(){
    if(tickerRunning){setTickerRunning(false);setTickerPauseTime(Date.now());}
    else if(tickerPhase!=='idle'){
      const elapsed=Date.now()-(tickerPauseTime||Date.now());
      if(tickerNextAt!==null)setTickerNextAt(tickerNextAt+elapsed);
      if(tickerBatchStart!==null)setTickerBatchStart(tickerBatchStart+elapsed);
      setTickerRunning(true);setTickerPauseTime(null);
    }
  }
  function advanceTicker(){
    // Continue the original batch even if an item was edited, unchecked or deleted.
    const index=tickerBatchItems.findIndex(t=>t.id===tickerCurrent),now=Date.now();
    if(index>=0&&index+1<tickerBatchItems.length){
      setTickerCurrent(tickerBatchItems[index+1].id);setTickerCurrentText(tickerBatchItems[index+1].text);setTickerNextAt(now+tickerEffectiveDuration*1000);
      setTickerCountdown(tickerEffectiveDuration);return;
    }
    setTickerCurrent(null);setTickerCurrentText('');setTickerBatchItems([]);setTickerPhase('between');
    const wait=Math.max(now,(tickerBatchStart||now)+tickerEffectiveInterval*1000);
    setTickerNextAt(wait);setTickerCountdown(Math.ceil((wait-now)/1000));
  }
  useEffect(()=>{
    if(!tickerRunning||tickerNextAt===null)return;
    const timer=window.setInterval(()=>{
      setTickerCountdown(Math.max(0,Math.ceil((tickerNextAt-Date.now())/1000)));
      if(Date.now()>=tickerNextAt){
        if(tickerPhase==='between')beginTickerBatch();
        else if(tickerPhase==='show')advanceTicker();
      }
    },250);
    return ()=>window.clearInterval(timer);
  },[tickerRunning,tickerNextAt,tickerPhase,tickerCurrent,tickerBatchItems,tickerItems,tickerDuration,tickerInterval,tickerEffectiveDuration,tickerEffectiveInterval,tickerBatchStart]);
  function sendTicker(){
    if(tickerPhase==='idle'||tickerPhase==='between')beginTickerBatch();
    else advanceTicker();
  }
  function startTickerEdit(item?:TickerItem){
    setTickerLibraryOpen(true);
    setTickerEdit(item?.id||'new');
    setTickerDraft(item?.text||'');
  }
  function deleteTicker(id:string){
    const item=tickerItems.find(entry=>entry.id===id);
    if(!item || !window.confirm('Smazat zprávu z knihovny? Aktuálně vysílaná zpráva zůstane do konce svého zobrazení.'))return;
    // Keep the on-screen snapshot separate from library contents.
    setTickerItems(items=>items.filter(entry=>entry.id!==id));
    if(tickerEdit===id)setTickerEdit(null);
  }
  function saveTicker(){
    const txt=tickerDraft.trim();if(!txt)return;
    const savedId=tickerEdit==='new'?'tick-'+crypto.randomUUID():tickerEdit;
    setTickerItems(items=>tickerEdit==='new'?[...items,{id:savedId||'tick-new',text:txt,enabled:true}]:items.map(item=>item.id===tickerEdit?{...item,text:txt}:item));
    if(savedId)setRecentSave({kind:'ticker',id:savedId});
    setTickerEdit(null);
  }
  function startEditorialEdit(item?:EditorialItem){
    setShowEditorialLibrary(true);
    setEditorialEdit(item?.id||'new');
    setEditorialDraft({heading:item?.heading||'',subheading:item?.subheading||''});
  }
  function hideEditorial(){setEditorialCurrent(null);}
  function saveEditorial(){
    if(!editorialDraft.heading.trim())return;
    const item={id:editorialEdit==='new'?'edit-'+crypto.randomUUID():editorialEdit||'edit',heading:editorialDraft.heading.trim(),subheading:editorialDraft.subheading.trim()};
    setEditorial(items=>editorialEdit==='new'?[...items,item]:items.map(x=>x.id===editorialEdit?item:x));
    setRecentSave({kind:'editorial',id:item.id});
    setEditorialEdit(null);
  }
  return <>
    <div className="directing-live-column">
    <Module name="FEATURED" status={featured?'Zvýrazněn komentář':'Žádný aktivní komentář'} collapsed={collapsed.FEATURED} onToggle={()=>toggle('FEATURED')}>
      <div className="panel-state lp-featured-state">
        <div className="lp-live-state-top">
          <Status type={featured?'good':'neutral'}>{featured?'Zvýrazněno':'Bez zvýraznění'}</Status>
          {featured&&<span className="lp-live-countdown" title="Zbývající čas lokálního náhledu"><Clock3 size={13}/>{featuredRemaining} s</span>}
        </div>
        <p key={featured?.id||'featured-empty'} className="lp-content-change">{featured?<><strong>{featured.author}</strong> · {featured.text}</>:'Žádný zvýrazněný komentář.'}</p>
      </div>
      <div className="lp-live-controls">
        <Buttons>
          <PanelButton onClick={extendFeatured} disabled={!featured}><Clock3 size={15}/> +30 s</PanelButton>
          <PanelButton danger onClick={()=>onFeature(null)} disabled={!featured}><EyeOff size={15}/> Skrýt</PanelButton>
        </Buttons>
      </div>
      <div className="featured-tabs lp-motion-tabs" data-tab={featuredTab} role="tablist" aria-label="Zásobník FEATURED">
        <button type="button" role="tab" aria-selected={featuredTab==='favorites'} className={featuredTab==='favorites'?'selected':''} onClick={()=>setFeaturedTab('favorites')}>Oblíbené ({favorites.length})</button>
        <button type="button" role="tab" aria-selected={featuredTab==='shown'} className={featuredTab==='shown'?'selected':''} onClick={()=>setFeaturedTab('shown')}>Zobrazeno ({shownMessages.length})</button>
      </div>
      <div className="featured-list" role="tabpanel" aria-label={featuredTab==='favorites'?'Dosud nezobrazené oblíbené':'Zobrazené komentáře'}>
        <div className="lp-tab-content" key={featuredTab}>{(featuredTab==='favorites'?favorites:shownMessages).map(m=><div className={'compact-item '+(featuredId===m.id?'picked':'')} key={m.id}>
          <span className="featured-comment"><strong>{m.author}</strong><span>{m.text}</span></span>
          <button type="button" className="small-button featured-action" onClick={()=>featureMessage(m.id)}>Zvýraznit</button>
        </div>)}
        {(featuredTab==='favorites'?favorites:shownMessages).length===0&&<Empty>{featuredTab==='favorites'?'Žádné oblíbené komentáře čekající na zobrazení.':'Zatím nebyl zobrazen žádný komentář.'}</Empty>}</div>
      </div>
    </Module>
    <Module name="EVENT" status={(eventPaused?'Pozastaveno · ':'')+'Fronta: '+events.length} collapsed={collapsed.EVENT} onToggle={()=>toggle('EVENT')}>
      <div className="panel-state lp-event-state">
        <div className="lp-live-state-top"><Status type={eventPaused?'warn':activeEvent?'good':'neutral'}>{eventPaused?'Pozastaveno':activeEvent?'Aktuální událost':'Čeká na událost'}</Status></div>
        <p key={activeEvent?.id||'event-empty'} className="lp-content-change">{activeEvent?<><strong>{activeEvent.type} · {activeEvent.author}</strong><span>{activeEvent.detail}</span></>:'Žádná aktuální událost.'}</p>
      </div>
      <div className="lp-live-controls lp-event-controls">
        <Buttons>
          <PanelButton onClick={()=>setEventPaused(x=>!x)}>{eventPaused?<Play size={15}/>:<Pause size={15}/>} {eventPaused?'Pokračovat':'Pozastavit'}</PanelButton>
          <PanelButton primary onClick={nextEvent} disabled={eventPaused||!events.length}><Play size={15}/> Odbavit další</PanelButton>
          <PanelButton onClick={finishEvent} disabled={!activeEvent}><SkipForward size={15}/> Ukončit</PanelButton>
        </Buttons>
      </div>
      <div className="lp-event-tabs lp-motion-tabs" data-tab={eventTab} role="tablist" aria-label="Zásobník EVENT">
        <button type="button" role="tab" aria-selected={eventTab==='waiting'} className={eventTab==='waiting'?'selected':''} onClick={()=>setEventTab('waiting')}>Čekající ({events.length})</button>
        <button type="button" role="tab" aria-selected={eventTab==='history'} className={eventTab==='history'?'selected':''} onClick={()=>setEventTab('history')}>Historie ({eventHistory.length})</button>
      </div>
      <div className="lp-event-list" role="tabpanel" aria-label={eventTab==='waiting'?'Čekající události':'Historie odbavených událostí'}>
        <div className="lp-tab-content" key={eventTab}>{(eventTab==='waiting'?events:eventHistory).map(e=><div className="compact-item" key={e.id}>
          <span className="lp-event-entry"><strong>{e.type} · {e.author}</strong><span>{e.detail}</span></span>
        </div>)}
        {(eventTab==='waiting'?events:eventHistory).length===0&&<Empty>{eventTab==='waiting'?'Fronta je prázdná.':'Dosud nebyla dokončena žádná událost.'}</Empty>}</div>
      </div>
      <div className="lp-add-action"><PanelButton onClick={()=>setEvents(list=>[...list,{id:'evt-'+crypto.randomUUID(),type:'Super Sticker',author:'Testovací divák',detail:'Ukázková událost'}])}><Plus size={15}/> Přidat testovací událost</PanelButton></div>
    </Module>
    </div>
    <div className="directing-content-column">
    <Module name="TICKER" status={tickerPhase==='idle'?'Automatika zastavena':tickerRunning?'Dávka běží':'Pozastaveno'} collapsed={collapsed.TICKER} onToggle={()=>toggle('TICKER')}>
      <div className="panel-state lp-ticker-state">
        <div className="lp-ticker-state-heading">
          <Status type={tickerRunning?'good':tickerPhase==='idle'?'neutral':'warn'}>{tickerPhase==='idle'?'Automatika neběží':tickerRunning?'Dávka běží':'Pozastaveno'}</Status>
          {tickerPhase!=='idle'&&<span className="lp-ticker-countdown" aria-label={tickerPhase==='show'?'Zbývající čas zprávy':'Čas do další dávky'} title={tickerPhase==='show'?'Do konce zprávy':'Do další dávky'}><Clock3 size={13}/>{tickerCountdown} s</span>}
        </div>
        <p key={tickerCurrent||tickerPhase} className="lp-content-change">{tickerCurrent?tickerCurrentText:'Žádná aktuálně vysílaná zpráva.'}</p>
      </div>
      <div className="lp-ticker-controls"><Buttons>
        <PanelButton primary onClick={sendTicker} disabled={!tickerItems.some(t=>t.enabled)}><Play size={15}/> {tickerPhase==='idle'?'Spustit dávku':tickerPhase==='between'?'Spustit nyní':'Další zpráva'}</PanelButton>
        <PanelButton onClick={pauseTicker} disabled={tickerPhase==='idle'}>{tickerRunning?<Pause size={15}/>:<Play size={15}/>} {tickerRunning?'Pozastavit':'Pokračovat'}</PanelButton>
        <PanelButton onClick={stopTicker}>Zastavit</PanelButton>
      </Buttons></div>
      <div className="lp-disclosure-block">
        <button type="button" className="lp-inline-disclosure" aria-expanded={tickerTimingOpen} onClick={()=>setTickerTimingOpen(v=>!v)}>
          <span><Clock3 size={15}/> Zpráva {tickerDuration} s · Dávka každých {tickerInterval} min</span>
          {tickerTimingOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        </button>
        <div className={'lp-animated-disclosure '+(tickerTimingOpen?'is-open':'')} inert={!tickerTimingOpen}>
          <div className="lp-animated-disclosure-inner">
            <div className="lp-timing-options">
              <label>Délka jedné zprávy</label>
              <div className="lp-timing-choices">
                {[10,20,30].map(value=><button key={value} type="button" className={!tickerDurationCustom&&tickerDuration===value?'selected':''} onClick={()=>{setTickerDuration(value);setTickerDurationCustom(false)}}>{value} s</button>)}
                <label className={'lp-timing-inline-custom '+(tickerDurationCustom?'selected':'')}>
                  <input type="number" min="1" max="3600" aria-label="Vlastní délka zprávy v sekundách" placeholder="Vlastní" value={tickerDurationInput} onChange={e=>updateCustomTime(e.target.value,'duration')}/><span>s</span>
                </label>
              </div>
              <label>Interval mezi dávkami</label>
              <div className="lp-timing-choices">
                {[2,5,10].map(value=><button key={value} type="button" className={!tickerIntervalCustom&&tickerInterval===value?'selected':''} onClick={()=>{setTickerInterval(value);setTickerIntervalCustom(false)}}>{value} min</button>)}
                <label className={'lp-timing-inline-custom '+(tickerIntervalCustom?'selected':'')}>
                  <input type="number" min="1" max="1440" aria-label="Vlastní interval mezi dávkami v minutách" placeholder="Vlastní" value={tickerIntervalInput} onChange={e=>updateCustomTime(e.target.value,'interval')}/><span>min</span>
                </label>
              </div>

            </div>
          </div>
        </div>
      </div>
      <div className="lp-disclosure-block">
        <button type="button" className="lp-inline-disclosure" aria-expanded={tickerLibraryOpen} onClick={()=>setTickerLibraryOpen(v=>!v)}>
          <span>Knihovna zpráv ({tickerItems.filter(i=>i.enabled).length} aktivní)</span>
          {tickerLibraryOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        </button>
        <div className={'lp-animated-disclosure '+(tickerLibraryOpen?'is-open':'')} inert={!tickerLibraryOpen}>
          <div className="lp-animated-disclosure-inner">
            {tickerItems.map(item=><div className={'lp-library-row lp-ticker-row '+(tickerCurrent===item.id?'lp-row-active ':'')+(recentSave?.kind==='ticker'&&recentSave.id===item.id?'lp-save-flash':'')} key={item.id}>
              <label className="lp-checkbox-line lp-ticker-checkbox"><input type="checkbox" checked={item.enabled} onChange={e=>setTickerItems(rows=>rows.map(row=>row.id===item.id?{...row,enabled:e.target.checked}:row))} aria-label={'Zahrnout zprávu: '+item.text}/></label>
              {tickerEdit===item.id?
                <input className="lp-inline-text" autoFocus aria-label="Upravit text zprávy" value={tickerDraft}
                  onChange={e=>setTickerDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveTicker()}else if(e.key==='Escape'){setTickerEdit(null)}}}/>:
                <span className="lp-inline-content">{item.text}</span>}
              <div className="lp-row-actions">
                {tickerEdit===item.id?<><button type="button" className="lp-icon-action" title="Uložit (Enter)" aria-label="Uložit úpravu" disabled={!tickerDraft.trim()} onClick={saveTicker}><Check size={17}/></button><button type="button" className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit úpravu" onClick={()=>setTickerEdit(null)}><X size={17}/></button></>:
                <><button type="button" className="lp-icon-action" title="Upravit zprávu" aria-label="Upravit zprávu" onClick={()=>startTickerEdit(item)}><Pencil size={17}/></button><button type="button" className="lp-icon-action lp-delete" title="Smazat zprávu" aria-label="Smazat zprávu" onClick={()=>deleteTicker(item.id)}><Trash2 size={17}/></button></>}
              </div>
            </div>)}
            {tickerEdit==='new'&&<div className="lp-library-row lp-new-row">
              <input autoFocus className="lp-inline-text" aria-label="Nová zpráva" placeholder="Nová zpráva" value={tickerDraft}
                onChange={e=>setTickerDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveTicker()}else if(e.key==='Escape')setTickerEdit(null)}}/>
              <div className="lp-row-actions"><button type="button" className="lp-icon-action" title="Přidat (Enter)" aria-label="Přidat zprávu" disabled={!tickerDraft.trim()} onClick={saveTicker}><Check size={17}/></button><button type="button" className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit přidání" onClick={()=>setTickerEdit(null)}><X size={17}/></button></div>
            </div>}
            <div className="lp-add-action"><PanelButton onClick={()=>startTickerEdit()}><Plus size={15}/> Přidat zprávu</PanelButton></div>
          </div>
        </div>
      </div>
      
    </Module>
    <Module name="EDITORIAL" status={editorialCurrent?'Aktivní titulek':'Žádný aktivní titulek'} collapsed={collapsed.EDITORIAL} onToggle={()=>toggle('EDITORIAL')}>
      <div className="panel-state lp-editorial-status">
        <div className="lp-editorial-status-copy" key={editorialCurrent?.id||'editorial-empty'}>
          {editorialCurrent?<><strong>{editorialCurrent.heading}</strong><span>{editorialCurrent.subheading}</span></>:<span className="lp-editorial-empty">Momentálně není zobrazen žádný titulek.</span>}
        </div>
        <button type="button" className="lp-icon-action lp-editorial-quick-hide" title="Skrýt aktivní titulek" aria-label="Skrýt aktivní titulek" disabled={!editorialCurrent} onClick={hideEditorial}><EyeOff size={18}/></button>
      </div>
      <div className="lp-disclosure-block">
        <button type="button" className="lp-inline-disclosure" aria-expanded={showEditorialLibrary} onClick={()=>setShowEditorialLibrary(v=>!v)}>
          <span>Knihovna titulků ({editorial.length})</span>
          {showEditorialLibrary?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        </button>
        <div className={'lp-animated-disclosure '+(showEditorialLibrary?'is-open':'')} inert={!showEditorialLibrary}>
          <div className="lp-animated-disclosure-inner">
            {editorial.map(item=><div className={'lp-library-row lp-editorial-row '+(editorialCurrent?.id===item.id?'lp-row-active ':'')+(recentSave?.kind==='editorial'&&recentSave.id===item.id?'lp-save-flash':'')} key={item.id}>
              {editorialEdit===item.id?
                <div className="lp-inline-editorial-fields">
                  <input autoFocus aria-label="Nadpis titulku" value={editorialDraft.heading}
                    onChange={e=>setEditorialDraft(v=>({...v,heading:e.target.value}))}
                    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
                  <input aria-label="Podtitulek titulku" value={editorialDraft.subheading}
                    onChange={e=>setEditorialDraft(v=>({...v,subheading:e.target.value}))}
                    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
                </div>:
                <div className="lp-library-text"><strong>{item.heading}</strong><small>{item.subheading}</small></div>}
              <div className="lp-row-actions">
                {editorialEdit===item.id?<><button type="button" className="lp-icon-action" title="Uložit (Enter)" aria-label="Uložit titulek" disabled={!editorialDraft.heading.trim()} onClick={saveEditorial}><Check size={17}/></button><button type="button" className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit úpravu titulku" onClick={()=>setEditorialEdit(null)}><X size={17}/></button></>:
                <><PanelButton primary={editorialCurrent?.id!==item.id} onClick={()=>editorialCurrent?.id===item.id?hideEditorial():setEditorialCurrent({...item})}>{editorialCurrent?.id===item.id?'Skrýt':'Zobrazit'}</PanelButton><button type="button" className="lp-icon-action" title="Upravit titulek" aria-label="Upravit titulek" onClick={()=>startEditorialEdit(item)}><Pencil size={17}/></button><button type="button" className="lp-icon-action lp-delete" title="Smazat titulek" aria-label="Smazat titulek" onClick={()=>{if(window.confirm('Odstranit položku z ukázkové knihovny? Aktivní titulek zůstane zobrazen.'))setEditorial(rows=>rows.filter(x=>x.id!==item.id))}}><Trash2 size={17}/></button></>}
              </div>
            </div>)}
            {editorialEdit==='new'&&<div className="lp-library-row lp-new-row">
              <div className="lp-inline-editorial-fields">
                <input autoFocus placeholder="Nadpis" aria-label="Nový nadpis" value={editorialDraft.heading} onChange={e=>setEditorialDraft(v=>({...v,heading:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
                <input placeholder="Podtitulek" aria-label="Nový podtitulek" value={editorialDraft.subheading} onChange={e=>setEditorialDraft(v=>({...v,subheading:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
              </div>
              <div className="lp-row-actions"><button type="button" className="lp-icon-action" title="Přidat (Enter)" aria-label="Přidat titulek" disabled={!editorialDraft.heading.trim()} onClick={saveEditorial}><Check size={17}/></button><button type="button" className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit přidání titulku" onClick={()=>setEditorialEdit(null)}><X size={17}/></button></div>
            </div>}
            <div className="lp-add-action"><PanelButton onClick={()=>startEditorialEdit()}><Plus size={15}/> Přidat titulek</PanelButton></div>
          </div>
        </div>
      </div>
    </Module>
    </div>
  </>;
}

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock3, EyeOff, List, Pause, Pencil, Play, Plus, RotateCcw, SkipForward, Star, Trash2, Type, X, Zap } from 'lucide-react';
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
    <button className="panel-toggle" aria-expanded={!collapsed} onClick={onToggle}><span className="panel-heading"><Icon size={18}/>{name}</span><span className="panel-summary">{status}</span>{collapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>
    {!collapsed&&<div className="panel-body">{children}</div>}
  </section>;
}
export default function DirectingPanels({messages,favorites,shownMessages,featuredId,onFeature,collapsed,toggle}:Props){
  const [featuredTab,setFeaturedTab]=useState<'favorites'|'shown'>('favorites');
  const [events,setEvents]=useState<EventItem[]>(initialEvents);
  const [activeEvent,setActiveEvent]=useState<EventItem|null>(null);
  const [eventPaused,setEventPaused]=useState(false);
  const [eventExpanded,setEventExpanded]=useState(false);
  const [tickerItems,setTickerItems]=useState<TickerItem[]>(initialTicker);
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
    if(eventPaused)return;
    setEvents(previous=>previous.slice(1));
    setActiveEvent(events[0]||null);
  }
  // Local demo only. Each interval is measured between starts of batches.
  function stopTicker(){
    setTickerRunning(false);setTickerCurrent(null);setTickerCurrentText('');setTickerPhase('idle');
    setTickerBatchStart(null);setTickerNextAt(null);setTickerPauseTime(null);
  }
  function beginTickerBatch(){
    const enabled=tickerItems.filter(t=>t.enabled);
    if(!enabled.length){stopTicker();return;}
    const now=Date.now(),duration=Math.max(1,Math.round(tickerDuration));
    const interval=Math.max(10,Math.round(tickerInterval*60));
    setTickerEffectiveDuration(duration);setTickerEffectiveInterval(interval);
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
    const enabled=tickerItems.filter(t=>t.enabled);
    const index=enabled.findIndex(t=>t.id===tickerCurrent),now=Date.now();
    if(index>=0&&index+1<enabled.length){
      setTickerCurrent(enabled[index+1].id);setTickerCurrentText(enabled[index+1].text);setTickerNextAt(now+tickerEffectiveDuration*1000);
      setTickerCountdown(tickerEffectiveDuration);return;
    }
    setTickerCurrent(null);setTickerCurrentText('');setTickerPhase('between');
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
  },[tickerRunning,tickerNextAt,tickerPhase,tickerCurrent,tickerItems,tickerDuration,tickerInterval,tickerEffectiveDuration,tickerEffectiveInterval,tickerBatchStart]);
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
    setTickerItems(items=>tickerEdit==='new'?[...items,{id:'tick-'+Date.now(),text:txt,enabled:true}]:items.map(item=>item.id===tickerEdit?{...item,text:txt}:item));
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
    const item={id:editorialEdit==='new'?'edit-'+Date.now():editorialEdit||'edit',heading:editorialDraft.heading.trim(),subheading:editorialDraft.subheading.trim()};
    setEditorial(items=>editorialEdit==='new'?[...items,item]:items.map(x=>x.id===editorialEdit?item:x));
    setEditorialEdit(null);
  }
  return <>
    <div className="directing-live-column">
    <Module name="FEATURED" status={featured?'Zvýrazněn komentář':'Žádný aktivní komentář'} collapsed={collapsed.FEATURED} onToggle={()=>toggle('FEATURED')}>
      <div className="panel-state">{featured?<><Status type="good">Zvýrazněno</Status><p><strong>{featured.author}</strong> · {featured.text}</p></>:<span>Žádný zvýrazněný komentář.</span>}</div>
      <div className="featured-tabs" role="tablist" aria-label="Zásobník FEATURED">
        <button role="tab" aria-selected={featuredTab==='favorites'} className={featuredTab==='favorites'?'selected':''} onClick={()=>setFeaturedTab('favorites')}>Oblíbené ({favorites.length})</button>
        <button role="tab" aria-selected={featuredTab==='shown'} className={featuredTab==='shown'?'selected':''} onClick={()=>setFeaturedTab('shown')}>Zobrazeno ({shownMessages.length})</button>
      </div>
      <div className="featured-list" role="tabpanel" aria-label={featuredTab==='favorites'?'Dosud nezobrazené oblíbené':'Zobrazené komentáře'}>
        {(featuredTab==='favorites'?favorites:shownMessages).map(m=><div className={'compact-item '+(featuredId===m.id?'picked':'')} key={m.id}>
          <span className="featured-comment"><strong>{m.author}</strong><span>{m.text}</span></span>
          <button className="small-button featured-action" onClick={()=>onFeature(m.id)}>Zvýraznit</button>
        </div>)}
        {(featuredTab==='favorites'?favorites:shownMessages).length===0&&<Empty>{featuredTab==='favorites'?'Žádné oblíbené komentáře čekající na zobrazení.':'Zatím nebyl zobrazen žádný komentář.'}</Empty>}
      </div>
      {featured&&<Buttons><PanelButton danger onClick={()=>onFeature(null)}><EyeOff size={15}/> Skrýt</PanelButton><PanelButton onClick={()=>onFeature(featured.id)}><RotateCcw size={15}/> Prodloužit</PanelButton></Buttons>}
    </Module>
    <Module name="EVENT" status={(eventPaused?'Pozastaveno · ':'')+'Fronta: '+events.length} collapsed={collapsed.EVENT} onToggle={()=>toggle('EVENT')}>
      <div className="panel-state"><Status type={eventPaused?'warn':activeEvent?'good':'neutral'}>{eventPaused?'Čeká – pozastaveno':activeEvent?'Aktuální událost':'Čeká na událost'}</Status>{activeEvent&&<p><strong>{activeEvent.type} · {activeEvent.author}</strong><br/>{activeEvent.detail}</p>}</div>
      <Buttons><PanelButton onClick={()=>setEventPaused(x=>!x)}>{eventPaused?<Play size={15}/>:<Pause size={15}/>} {eventPaused?'Pokračovat':'Pozastavit'}</PanelButton><PanelButton primary onClick={nextEvent} disabled={eventPaused||!events.length}><Play size={15}/> Odbavit další</PanelButton>{activeEvent&&<PanelButton onClick={()=>setActiveEvent(null)}><SkipForward size={15}/> Ukončit</PanelButton>}</Buttons>
      <div className="lp-subsection">
        <button className="lp-inline-disclosure" onClick={()=>setEventExpanded(v=>!v)} aria-expanded={eventExpanded}>Čekající události ({events.length}) {eventExpanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
        {eventExpanded&&<>{events.map(e=><div className="compact-item" key={e.id}><span><strong>{e.type}</strong> · {e.author}<br/><small>{e.detail}</small></span><PanelButton onClick={()=>{setEvents(list=>list.filter(x=>x.id!==e.id));setActiveEvent(e)}}>Předřadit</PanelButton></div>)}{!events.length&&<Empty>Fronta je prázdná.</Empty>}</>}
      </div>
      <div className="lp-add-action"><PanelButton onClick={()=>setEvents(list=>[...list,{id:'evt-'+Date.now(),type:'Super Sticker',author:'Testovací divák',detail:'Ukázková událost'}])}><Plus size={15}/> Přidat testovací událost</PanelButton></div>
    </Module>
    </div>
    <div className="directing-content-column">
    <Module name="TICKER" status={tickerPhase==='idle'?'Automatika zastavena':tickerRunning?'Dávka běží':'Pozastaveno'} collapsed={collapsed.TICKER} onToggle={()=>toggle('TICKER')}>
      <div className="panel-state"><Status type={tickerRunning?'good':tickerPhase==='idle'?'neutral':'warn'}>{tickerPhase==='idle'?'Automatika neběží':tickerRunning?'Dávka běží':'Pozastaveno'}</Status><p>{tickerCurrent?tickerCurrentText:'Žádná aktuálně vysílaná zpráva.'}</p></div>
      <Buttons>
        <PanelButton primary onClick={sendTicker} disabled={!tickerItems.some(t=>t.enabled)}><Play size={15}/> {tickerPhase==='idle'?'Spustit dávku':tickerPhase==='between'?'Spustit nyní':'Další zpráva'}</PanelButton>
        <PanelButton onClick={pauseTicker} disabled={tickerPhase==='idle'}>{tickerRunning?<Pause size={15}/>:<Play size={15}/>} {tickerRunning?'Pozastavit':'Pokračovat'}</PanelButton>
        <PanelButton onClick={stopTicker}>Zastavit</PanelButton>
      </Buttons>
      {tickerPhase!=='idle'&&<p className="lp-muted">{tickerPhase==='show'?'Aktuální zpráva':'Do další dávky'} · {tickerCountdown} s {tickerRunning?'':'(pozastaveno)'}</p>}
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
            {tickerItems.map(item=><div className={'lp-library-row lp-ticker-row '+(tickerCurrent===item.id?'lp-row-active':'')} key={item.id}>
              <label className="lp-checkbox-line lp-ticker-checkbox"><input type="checkbox" checked={item.enabled} onChange={e=>setTickerItems(rows=>rows.map(row=>row.id===item.id?{...row,enabled:e.target.checked}:row))} aria-label={'Zahrnout zprávu: '+item.text}/></label>
              {tickerEdit===item.id?
                <input className="lp-inline-text" autoFocus aria-label="Upravit text zprávy" value={tickerDraft}
                  onChange={e=>setTickerDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveTicker()}else if(e.key==='Escape'){setTickerEdit(null)}}}/>:
                <span className="lp-inline-content">{item.text}</span>}
              <div className="lp-row-actions">
                {tickerEdit===item.id?<><button className="lp-icon-action" title="Uložit (Enter)" aria-label="Uložit úpravu" disabled={!tickerDraft.trim()} onClick={saveTicker}><Check size={17}/></button><button className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit úpravu" onClick={()=>setTickerEdit(null)}><X size={17}/></button></>:
                <><button className="lp-icon-action" title="Upravit zprávu" aria-label="Upravit zprávu" onClick={()=>startTickerEdit(item)}><Pencil size={17}/></button><button className="lp-icon-action lp-delete" title="Smazat zprávu" aria-label="Smazat zprávu" onClick={()=>deleteTicker(item.id)}><Trash2 size={17}/></button></>}
              </div>
            </div>)}
            {tickerEdit==='new'&&<div className="lp-library-row lp-new-row">
              <input autoFocus className="lp-inline-text" aria-label="Nová zpráva" placeholder="Nová zpráva" value={tickerDraft}
                onChange={e=>setTickerDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveTicker()}else if(e.key==='Escape')setTickerEdit(null)}}/>
              <div className="lp-row-actions"><button className="lp-icon-action" title="Přidat (Enter)" aria-label="Přidat zprávu" disabled={!tickerDraft.trim()} onClick={saveTicker}><Check size={17}/></button><button className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit přidání" onClick={()=>setTickerEdit(null)}><X size={17}/></button></div>
            </div>}
            <div className="lp-add-action"><PanelButton onClick={()=>startTickerEdit()}><Plus size={15}/> Přidat zprávu</PanelButton></div>
          </div>
        </div>
      </div>
      
    </Module>
    <Module name="EDITORIAL" status={editorialCurrent?'Aktivní titulek':'Žádný aktivní titulek'} collapsed={collapsed.EDITORIAL} onToggle={()=>toggle('EDITORIAL')}>
      <div className="panel-state lp-editorial-status">
        <div className="lp-editorial-status-copy">
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
            {editorial.map(item=><div className={'lp-library-row lp-editorial-row '+(editorialCurrent?.id===item.id?'lp-row-active':'')} key={item.id}>
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
                {editorialEdit===item.id?<><button className="lp-icon-action" title="Uložit (Enter)" aria-label="Uložit titulek" disabled={!editorialDraft.heading.trim()} onClick={saveEditorial}><Check size={17}/></button><button className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit úpravu titulku" onClick={()=>setEditorialEdit(null)}><X size={17}/></button></>:
                <><PanelButton primary={editorialCurrent?.id!==item.id} onClick={()=>editorialCurrent?.id===item.id?hideEditorial():setEditorialCurrent({...item})}>{editorialCurrent?.id===item.id?'Skrýt':'Zobrazit'}</PanelButton><button className="lp-icon-action" title="Upravit titulek" aria-label="Upravit titulek" onClick={()=>startEditorialEdit(item)}><Pencil size={17}/></button><button className="lp-icon-action lp-delete" title="Smazat titulek" aria-label="Smazat titulek" onClick={()=>{if(window.confirm('Odstranit položku z ukázkové knihovny? Aktivní titulek zůstane zobrazen.'))setEditorial(rows=>rows.filter(x=>x.id!==item.id))}}><Trash2 size={17}/></button></>}
              </div>
            </div>)}
            {editorialEdit==='new'&&<div className="lp-library-row lp-new-row">
              <div className="lp-inline-editorial-fields">
                <input autoFocus placeholder="Nadpis" aria-label="Nový nadpis" value={editorialDraft.heading} onChange={e=>setEditorialDraft(v=>({...v,heading:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
                <input placeholder="Podtitulek" aria-label="Nový podtitulek" value={editorialDraft.subheading} onChange={e=>setEditorialDraft(v=>({...v,subheading:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEditorial()}else if(e.key==='Escape')setEditorialEdit(null)}}/>
              </div>
              <div className="lp-row-actions"><button className="lp-icon-action" title="Přidat (Enter)" aria-label="Přidat titulek" disabled={!editorialDraft.heading.trim()} onClick={saveEditorial}><Check size={17}/></button><button className="lp-icon-action" title="Zrušit (Esc)" aria-label="Zrušit přidání titulku" onClick={()=>setEditorialEdit(null)}><X size={17}/></button></div>
            </div>}
            <div className="lp-add-action"><PanelButton onClick={()=>startEditorialEdit()}><Plus size={15}/> Přidat titulek</PanelButton></div>
          </div>
        </div>
      </div>
    </Module>
    </div>
  </>;
}

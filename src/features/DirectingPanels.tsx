import { useState } from 'react';
import { ChevronDown, ChevronUp, EyeOff, List, Pause, Play, Plus, RotateCcw, SkipForward, Star, Type, Zap } from 'lucide-react';
import { Buttons, Empty, PanelButton, Status } from '../components/Ui';
import { initialEditorial, initialEvents, initialTicker, type EditorialItem, type EventItem, type TickerItem } from '../mock/directing';
import type { Category, Message } from '../mock/data';

type Props={
  favorites:Message[]; featuredId:string|null; onFeature:(id:string|null)=>void;
  collapsed:Record<Category,boolean>; toggle:(category:Category)=>void;
};
function Module({name,status,collapsed,onToggle,children}:{name:Category;status:string;collapsed:boolean;onToggle:()=>void;children:React.ReactNode}){
  const Icon={FEATURED:Star,EVENT:Zap,TICKER:List,EDITORIAL:Type}[name];
  return <section className="panel director-panel">
    <button className="panel-toggle" aria-expanded={!collapsed} onClick={onToggle}><span className="panel-heading"><Icon size={18}/>{name}</span><span className="panel-summary">{status}</span>{collapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>
    {!collapsed&&<div className="panel-body">{children}</div>}
  </section>;
}
export default function DirectingPanels({favorites,featuredId,onFeature,collapsed,toggle}:Props){
  const [events,setEvents]=useState<EventItem[]>(initialEvents);
  const [activeEvent,setActiveEvent]=useState<EventItem|null>(null);
  const [eventPaused,setEventPaused]=useState(false);
  const [eventExpanded,setEventExpanded]=useState(false);
  const [tickerItems,setTickerItems]=useState<TickerItem[]>(initialTicker);
  const [tickerRunning,setTickerRunning]=useState(false);
  const [tickerCurrent,setTickerCurrent]=useState<string|null>(null);
  const [tickerEdit,setTickerEdit]=useState<string|null>(null);
  const [tickerDraft,setTickerDraft]=useState('');
  const [editorial,setEditorial]=useState<EditorialItem[]>(initialEditorial);
  const [editorialCurrent,setEditorialCurrent]=useState<EditorialItem|null>(null);
  const [editorialEdit,setEditorialEdit]=useState<string|null>(null);
  const [editorialDraft,setEditorialDraft]=useState({heading:'',subheading:''});
  const [showEditorialLibrary,setShowEditorialLibrary]=useState(false);
  const featured=favorites.find(m=>m.id===featuredId);
  function nextEvent(){
    if(eventPaused)return;
    setEvents(previous=>previous.slice(1));
    setActiveEvent(events[0]||null);
  }
  function sendTicker(){
    const enabled=tickerItems.filter(t=>t.enabled);
    if(!enabled.length){setTickerRunning(false);setTickerCurrent(null);return;}
    const nextIndex=Math.max(-1,enabled.findIndex(t=>t.id===tickerCurrent))+1;
    if(nextIndex>=enabled.length){setTickerRunning(false);setTickerCurrent(null);return;}
    setTickerCurrent(enabled[nextIndex].id);
    setTickerRunning(true);
  }
  function startTickerEdit(item?:TickerItem){
    setTickerEdit(item?.id||'new');
    setTickerDraft(item?.text||'');
  }
  function saveTicker(){
    const txt=tickerDraft.trim();if(!txt)return;
    setTickerItems(items=>tickerEdit==='new'?[...items,{id:'tick-'+Date.now(),text:txt,enabled:true}]:items.map(item=>item.id===tickerEdit?{...item,text:txt}:item));
    setTickerEdit(null);
  }
  function startEditorialEdit(item?:EditorialItem){
    setEditorialEdit(item?.id||'new');
    setEditorialDraft({heading:item?.heading||'',subheading:item?.subheading||''});
  }
  function saveEditorial(){
    if(!editorialDraft.heading.trim())return;
    const item={id:editorialEdit==='new'?'edit-'+Date.now():editorialEdit||'edit',heading:editorialDraft.heading.trim(),subheading:editorialDraft.subheading.trim()};
    setEditorial(items=>editorialEdit==='new'?[...items,item]:items.map(x=>x.id===editorialEdit?item:x));
    setEditorialEdit(null);
  }
  return <>
    <Module name="FEATURED" status={featured?'Zvýrazněn komentář':'Žádný aktivní komentář'} collapsed={collapsed.FEATURED} onToggle={()=>toggle('FEATURED')}>
      <div className="panel-state">{featured?<><Status type="good">Zvýraznění (demo)</Status><p><strong>{featured.author}</strong> · {featured.text}</p></>:<span>Žádný zvýrazněný komentář.</span>}</div>
      <div className="section-label">Oblíbené komentáře ({favorites.length})</div>
      {favorites.length?favorites.map(m=><div className={'compact-item '+(featuredId===m.id?'picked':'')} key={m.id}>
        <span className="featured-comment"><strong>{m.author}</strong><span>{m.text}</span></span>
        <button className="small-button featured-action" onClick={()=>onFeature(m.id)}>Zvýraznit</button>
      </div>):<Empty>Žádné oblíbené komentáře.</Empty>}
      {featured&&<Buttons><PanelButton danger onClick={()=>onFeature(null)}><EyeOff size={15}/> Skrýt</PanelButton><PanelButton onClick={()=>onFeature(featured.id)}><RotateCcw size={15}/> Prodloužit (demo)</PanelButton></Buttons>}
    </Module>
    <Module name="EVENT" status={(eventPaused?'Pozastaveno · ':'')+'Fronta: '+events.length} collapsed={collapsed.EVENT} onToggle={()=>toggle('EVENT')}>
      <div className="panel-state"><Status type={eventPaused?'warn':activeEvent?'good':'neutral'}>{eventPaused?'Čeká – pozastaveno':activeEvent?'Aktuální událost (demo)':'Čeká na událost'}</Status>{activeEvent&&<p><strong>{activeEvent.type} · {activeEvent.author}</strong><br/>{activeEvent.detail}</p>}</div>
      <Buttons><PanelButton onClick={()=>setEventPaused(x=>!x)}>{eventPaused?<Play size={15}/>:<Pause size={15}/>} {eventPaused?'Pokračovat':'Pozastavit'}</PanelButton><PanelButton primary onClick={nextEvent} disabled={eventPaused||!events.length}><Play size={15}/> Odbavit další</PanelButton>{activeEvent&&<PanelButton onClick={()=>setActiveEvent(null)}><SkipForward size={15}/> Ukončit</PanelButton>}</Buttons>
      <div className="lp-subsection">
        <button className="lp-inline-disclosure" onClick={()=>setEventExpanded(v=>!v)} aria-expanded={eventExpanded}>Čekající události ({events.length}) {eventExpanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
        {eventExpanded&&<>{events.map(e=><div className="compact-item" key={e.id}><span><strong>{e.type}</strong> · {e.author}<br/><small>{e.detail}</small></span><PanelButton onClick={()=>{setEvents(list=>list.filter(x=>x.id!==e.id));setActiveEvent(e)}}>Předřadit</PanelButton></div>)}{!events.length&&<Empty>Fronta je prázdná.</Empty>}</>}
      </div>
      <PanelButton onClick={()=>setEvents(list=>[...list,{id:'evt-'+Date.now(),type:'Super Sticker',author:'Testovací divák',detail:'Ukázková událost'}])}><Plus size={15}/> Přidat testovací událost</PanelButton>
    </Module>
    <Module name="TICKER" status={tickerRunning?'Testovací dávka běží':'Automatika zastavena'} collapsed={collapsed.TICKER} onToggle={()=>toggle('TICKER')}>
      <div className="panel-state"><Status type={tickerRunning?'good':'neutral'}>{tickerRunning?'Dávka běží (demo)':'Automatika neběží'}</Status><p>{tickerCurrent?tickerItems.find(t=>t.id===tickerCurrent)?.text:'Žádná aktuálně vysílaná zpráva.'}</p></div>
      <Buttons><PanelButton primary onClick={sendTicker} disabled={!tickerItems.some(t=>t.enabled)}><Play size={15}/> {tickerRunning?'Další zpráva':'Spustit dávku'}</PanelButton><PanelButton onClick={()=>setTickerRunning(v=>!v)} disabled={!tickerCurrent}>{tickerRunning?<Pause size={15}/>:<Play size={15}/>} {tickerRunning?'Pauza':'Pokračovat'}</PanelButton><PanelButton onClick={()=>{setTickerRunning(false);setTickerCurrent(null)}}>Zastavit</PanelButton></Buttons>
      <div className="section-label">Knihovna zpráv ({tickerItems.filter(i=>i.enabled).length} aktivní)</div>
      {tickerItems.map(item=><div className="lp-library-row" key={item.id}>
        <label className="lp-checkbox-line"><input type="checkbox" checked={item.enabled} onChange={e=>setTickerItems(rows=>rows.map(row=>row.id===item.id?{...row,enabled:e.target.checked}:row))}/><span>{item.text}</span></label>
        <button className="lp-text-action" onClick={()=>startTickerEdit(item)}>Upravit</button>
      </div>)}
      {tickerEdit&&<div className="lp-inline-editor"><label>Text zprávy<textarea rows={2} value={tickerDraft} onChange={e=>setTickerDraft(e.target.value)}/></label><Buttons><PanelButton primary onClick={saveTicker} disabled={!tickerDraft.trim()}>Uložit (demo)</PanelButton><PanelButton onClick={()=>setTickerEdit(null)}>Zrušit</PanelButton></Buttons></div>}
      <PanelButton onClick={()=>startTickerEdit()}><Plus size={15}/> Přidat zprávu</PanelButton>
      <p className="lp-muted">Automatické dávkování a serverové časování nejsou implementovány; položky se v demo režimu posouvají ručně.</p>
    </Module>
    <Module name="EDITORIAL" status={editorialCurrent?'Aktivní titulek':'Žádný aktivní titulek'} collapsed={collapsed.EDITORIAL} onToggle={()=>toggle('EDITORIAL')}>
      <div className="panel-state">{editorialCurrent?<><Status type="good">Titulek aktivní (demo)</Status><p><strong>{editorialCurrent.heading}</strong><br/>{editorialCurrent.subheading}</p></>:'Momentálně není zobrazen žádný titulek.'}</div>
      <Buttons><PanelButton onClick={()=>setShowEditorialLibrary(x=>!x)}>{showEditorialLibrary?'Skrýt knihovnu':'Vybrat titulek'}</PanelButton>{editorialCurrent&&<PanelButton danger onClick={()=>setEditorialCurrent(null)}><EyeOff size={15}/> Skrýt titulek</PanelButton>}</Buttons>
      {showEditorialLibrary&&<div className="lp-subsection">
        <div className="section-label">Knihovna titulků ({editorial.length})</div>
        {editorial.map(item=><div className="lp-library-row" key={item.id}><div className="lp-library-text"><strong>{item.heading}</strong><small>{item.subheading}</small></div><Buttons><PanelButton primary onClick={()=>setEditorialCurrent({...item})}>Zobrazit</PanelButton><PanelButton onClick={()=>startEditorialEdit(item)}>Upravit</PanelButton><button title="Smazat z knihovny" className="lp-text-action" onClick={()=>{if(window.confirm('Odstranit položku z ukázkové knihovny? Aktivní titulek zůstane zobrazen.'))setEditorial(rows=>rows.filter(x=>x.id!==item.id))}}>Smazat</button></Buttons></div>)}
        {editorialEdit&&<div className="lp-inline-editor"><label>Nadpis<input value={editorialDraft.heading} onChange={e=>setEditorialDraft(v=>({...v,heading:e.target.value}))}/></label><label>Podtitulek<input value={editorialDraft.subheading} onChange={e=>setEditorialDraft(v=>({...v,subheading:e.target.value}))}/></label><Buttons><PanelButton primary onClick={saveEditorial} disabled={!editorialDraft.heading.trim()}>Uložit (demo)</PanelButton><PanelButton onClick={()=>setEditorialEdit(null)}>Zrušit</PanelButton></Buttons></div>}
        <PanelButton onClick={()=>startEditorialEdit()}><Plus size={15}/> Přidat titulek</PanelButton>
      </div>}
    </Module>
  </>;
}

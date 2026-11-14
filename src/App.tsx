import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Eye, EyeOff, MessageSquare, Pause, Play, RotateCcw, Star, Trash2 } from 'lucide-react';
import Shell from './components/Shell';
import { initialMessages, type Category, type Message } from './mock/data';
import DirectingPanels from './features/DirectingPanels';
import SceneEditor from './pages/Scenes';
import ArchivePage from './pages/Archive';
import DiagnosticsPage from './pages/Diagnostics';
import SettingsPage from './pages/Settings';

type Filter = 'all' | 'favorites';
type ActivePage = 'chat' | 'directing';
function Directing() {
  const [messages, setMessages] = useState<Message[]>(() => {
    let shown: string[] = [];
    try { const value=JSON.parse(sessionStorage.getItem('livepanel:demo-featured-shown') || '[]'); if (Array.isArray(value)) shown=value.filter((id): id is string => typeof id==='string'); } catch { /* fresh demo session */ }
    return initialMessages.map(m=>({...m,featuredShown:shown.includes(m.id)}));
  });
  useEffect(()=>{
    try { sessionStorage.setItem('livepanel:demo-featured-shown',JSON.stringify(messages.filter(m=>m.featuredShown).map(m=>m.id))); }
    catch { /* temporary simulation only */ }
  },[messages]);
  const [filter, setFilter] = useState<Filter>('all');
  const [mobilePage, setMobilePage] = useState<ActivePage>('chat');
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({ FEATURED: false, EVENT: false, TICKER: false, EDITORIAL: false });
  const [chatPaused, setChatPaused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeFeatured, setActiveFeatured] = useState<string | null>(null);
  type LayoutPreference = 'auto' | 'two' | 'three';
  type ResizeTarget = 'two' | 'first' | 'second';
  const [wide,setWide]=useState(()=>window.matchMedia('(min-width: 1380px)').matches);
  const [layoutPreference,setLayoutPreference]=useState<LayoutPreference>(()=>{
    const value=window.localStorage.getItem('livepanel:layout-mode');
    return value==='two'||value==='three'?value:'auto';
  });
  const [directingWidth,setDirectingWidth]=useState(()=>{
    const value=Number(window.localStorage.getItem('livepanel:two-width'));
    return value>=30&&value<=70?value:60;
  });
  const [threeWidths,setThreeWidths]=useState(()=>{
    const raw=window.localStorage.getItem('livepanel:three-widths');
    try {
      const value=JSON.parse(raw||'null') as {left:number;middle:number}|null;
      if(value && value.left>=20 && value.middle>=20 && value.left+value.middle<=70)return value;
    } catch { /* preference not available */ }
    return {left:25,middle:35};
  });
  const isThree=wide&&layoutPreference!=='two';
  const workArea=useRef<HTMLDivElement>(null);
  const [resizing,setResizing]=useState<ResizeTarget|null>(null);
  useEffect(()=>{
    const query=window.matchMedia('(min-width: 1380px)');
    const update=()=>setWide(query.matches);
    query.addEventListener('change',update);
    return ()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{window.localStorage.setItem('livepanel:layout-mode',layoutPreference);},[layoutPreference]);
  useEffect(()=>{window.localStorage.setItem('livepanel:two-width',String(directingWidth));},[directingWidth]);
  useEffect(()=>{window.localStorage.setItem('livepanel:three-widths',JSON.stringify(threeWidths));},[threeWidths]);
  const updateResize=(target:ResizeTarget,raw:number,width:number)=>{
    if(target==='two'){
      const minimum=Math.max(30,Math.min(42,330/width*100));
      setDirectingWidth(Math.round(Math.max(minimum,Math.min(100-minimum,raw))));
      return;
    }
    const minLeft=235/width*100,minMid=285/width*100,minChat=330/width*100;
    setThreeWidths(previous=>{
      if(target==='first'){
        const boundary=previous.left+previous.middle;
        const left=Math.round(Math.max(minLeft,Math.min(boundary-minMid,raw))*10)/10;
        return {...previous,left,middle:Math.round((boundary-left)*10)/10};
      }
      const boundary=Math.max(previous.left+minMid,Math.min(100-minChat,raw));
      return {...previous,middle:Math.round((boundary-previous.left)*10)/10};
    });
  };
  useEffect(()=>{
    if(!resizing)return;
    const move=(event:PointerEvent)=>{
      const rect=workArea.current?.getBoundingClientRect();
      if(!rect||rect.width<1)return;
      updateResize(resizing,((event.clientX-rect.left)/rect.width)*100,rect.width);
    };
    const done=()=>setResizing(null);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',done);
    window.addEventListener('pointercancel',done);
    return ()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',done);
      window.removeEventListener('pointercancel',done);
    };
  },[resizing]);
  function resetWidths(){setDirectingWidth(60);setThreeWidths({left:25,middle:35});}
  function keyResize(event:React.KeyboardEvent<HTMLDivElement>,target:ResizeTarget){
    if(event.key==='Home'){event.preventDefault();resetWidths();return;}
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    const rect=workArea.current?.getBoundingClientRect();if(!rect)return;
    event.preventDefault();
    const delta=event.key==='ArrowLeft'?-2:2;
    const value=target==='two'?directingWidth:target==='first'?threeWidths.left:threeWidths.left+threeWidths.middle;
    updateResize(target,value+delta,rect.width);
  }
  const chatScroll = useRef<HTMLDivElement>(null);
  // Freeze the set and order of visible messages while an operator reads or acts.
  // Unlike scroll-offset compensation this also works when the list is shorter than its viewport.
  const [frozenChatIds,setFrozenChatIds]=useState<string[]|null>(null);
  // A hover lock is temporary; manually scrolling into history stays locked until returning to newest.
  const chatHistoryLock=useRef(false);
  const filtered = useMemo(() => messages.filter(m => filter === 'all' || m.favorite).reverse(), [messages, filter]);
  const visibleMessages=useMemo(()=>{
    if(frozenChatIds===null)return filtered;
    const byId=new Map(filtered.map(m=>[m.id,m]));
    return frozenChatIds.map(id=>byId.get(id)).filter((m):m is Message=>Boolean(m));
  },[filtered,frozenChatIds]);
  const unseenCount=frozenChatIds===null?0:filtered.filter(m=>!frozenChatIds.includes(m.id)).length;
  const freezeChat=()=>setFrozenChatIds(previous=>previous??filtered.map(m=>m.id));
  const returnToNewest=()=>{
    chatHistoryLock.current=false;
    setFrozenChatIds(null);
    // Releasing the frozen snapshot may prepend rows: reset before paint.
  };
  const leaveChatHover=(pointerType:string)=>{
    if(pointerType==='touch'||chatHistoryLock.current)return;
    // Hover alone is not a persistent reading pause: resume live updates on mouse exit.
    setFrozenChatIds(null);
  };
  const scrollChat=(scrollTop:number)=>{
    if(scrollTop>8){
      chatHistoryLock.current=true;
      freezeChat();
    }
  };
  useEffect(()=>{if(frozenChatIds===null&&chatScroll.current)chatScroll.current.scrollTop=0;},[frozenChatIds,filtered]);
  const chatFavorites = messages.filter(m=>m.favorite);
  const favorites = messages.filter(m => m.favorite && !m.featuredShown);
  const shownMessages = messages.filter(m => m.featuredShown);
  function showFeatured(id: string | null) {
    if (id !== null && !messages.some(m=>m.id===id)) return;
    // Demo: the actual overlay display begins immediately after the local show command.
    // Production must set featuredShown only after the server confirms display start.
    if (id !== null) setMessages(previous=>previous.map(m=>m.id===id?{...m,featuredShown:true}:m));
    setActiveFeatured(id);
  }
  function toggleFavorite(id: string) { setMessages(previous => previous.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m)); }
  function addDemoMessage() { setMessages(previous => { const next=previous.length+1;return [...previous,{id:'m'+next,author:'Testovací divák',text:'Nová ukázková zpráva číslo '+next+'. Pouze test, bez YouTube API.',time:'19:'+String(next).padStart(2,'0'),favorite:false}]; }); }
  return <div className="live-view" style={{'--directing-width':directingWidth+'%','--first-width':threeWidths.left+'%','--middle-width':threeWidths.middle+'%'} as CSSProperties}>
    
    <div className="page-toolbar"><h1>Živá režie</h1>
      <button type="button" className="small-button demo-message-action" onClick={addDemoMessage} title="Přidat ukázkový komentář do lokálního chatu">+ Testovací zpráva</button><div className="layout-switch" role="group" aria-label="Rozložení hlavní režie">
        <button type="button" aria-pressed={!isThree} className={!isThree?'selected':''} onClick={()=>setLayoutPreference('two')}>2 sloupce</button>
        <button type="button" aria-pressed={isThree} className={isThree?'selected':''} disabled={!wide} title={!wide?'Tři sloupce jsou dostupné na široké obrazovce':undefined} onClick={()=>setLayoutPreference('three')}>3 sloupce</button>
      </div>
    </div>
    <div className="mobile-tabs" role="tablist" aria-label="Část režie"><button role="tab" aria-selected={mobilePage === 'chat'} className={mobilePage === 'chat' ? 'selected' : ''} onClick={() => setMobilePage('chat')}>CHAT</button><button role="tab" aria-selected={mobilePage === 'directing'} className={mobilePage === 'directing' ? 'selected' : ''} onClick={() => setMobilePage('directing')}>REŽIE</button></div>
    <div className={'work-area '+(isThree?'mode-three':'mode-two')+(resizing?' is-resizing':'')} ref={workArea}>
      <div className="column-resizer resizer-first" role="separator" aria-label={isThree?'Šířka levého sloupce':'Šířka režijního sloupce'} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={70} aria-valuenow={isThree?threeWidths.left:directingWidth} tabIndex={0} title="Tažením změnit šířku · dvojklik obnoví výchozí poměr" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();setResizing(isThree?'first':'two');}} onDoubleClick={resetWidths} onKeyDown={event=>keyResize(event,isThree?'first':'two')}><span className="resize-grip"/></div>
      {isThree&&<div className="column-resizer resizer-second" role="separator" aria-label="Šířka středního sloupce a chatu" aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={threeWidths.left+threeWidths.middle} tabIndex={0} title="Tažením změnit šířku · dvojklik obnoví 25/35/40" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();setResizing('second');}} onDoubleClick={resetWidths} onKeyDown={event=>keyResize(event,'second')}><span className="resize-grip"/></div>}
      <section className={'panel chat-panel ' + (mobilePage !== 'chat' ? 'mobile-hidden' : '')} aria-label="Živý chat"><div className="chat-head"><h2><MessageSquare size={19}/> CHAT</h2><div className="toolbar-actions"><button title={chatPaused ? 'Pokračovat' : 'Pozastavit'} aria-label={chatPaused ? 'Pokračovat' : 'Pozastavit'} className="icon-button" onClick={() => setChatPaused(!chatPaused)}>{chatPaused ? <Play size={17}/> : <Pause size={17}/>}</button><button title="Vyčistit grafiku" aria-label="Vyčistit grafiku – simulace" className="icon-button" disabled><Trash2 size={17}/></button><button title={chatVisible ? 'Skrýt CHAT v grafice' : 'Zobrazit CHAT v grafice'} aria-label="Přepnout viditelnost chatu" className="icon-button" onClick={() => setChatVisible(!chatVisible)}>{chatVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div></div>
      <div className="chat-state"><span className={'state-dot ' + (chatVisible && !chatPaused ? 'ok' : 'warn')}/>{!chatVisible ? 'Grafika CHAT skryta' : chatPaused ? 'Grafika CHAT pozastavena' : 'Automatika CHAT aktivní'}</div>
      <div className="filter-row"><button className={filter === 'all' ? 'selected' : ''} onClick={() => {setFilter('all');returnToNewest();}}>Vše ({messages.length})</button><button className={filter === 'favorites' ? 'selected' : ''} onClick={() => {setFilter('favorites');returnToNewest();}}>Oblíbené ({chatFavorites.length})</button></div>
      <div className="messages" ref={chatScroll} role="log" aria-label="Zprávy chatu od nejnovějších" onScroll={event=>scrollChat(event.currentTarget.scrollTop)} onFocusCapture={freezeChat} onPointerLeave={event=>leaveChatHover(event.pointerType)}>{visibleMessages.map(m => <article className="message" key={m.id} onPointerEnter={event=>{if(event.pointerType!=='touch')freezeChat();}} onPointerDown={freezeChat}><span className="avatar" aria-hidden="true">{m.author.slice(0,1)}</span><div className="message-content"><div className="message-meta"><strong>{m.author}</strong><time>{m.time}</time>{m.role && <span className="role">Člen</span>}</div><p>{m.text}</p></div><div className="message-actions" role="group" aria-label={`Akce komentáře od ${m.author}`}>{m.featuredShown&&<span className="message-shown-indicator" title="Už zobrazeno ve FEATURED" aria-label="Už zobrazeno ve FEATURED"><Check size={15}/></span>}<button className={m.favorite ? 'is-active' : ''} aria-pressed={m.favorite} aria-label={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} title={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} onClick={() => toggleFavorite(m.id)}><Star size={17} fill={m.favorite ? 'currentColor' : 'none'}/></button><button className={activeFeatured === m.id ? 'is-active' : ''} aria-pressed={activeFeatured === m.id} aria-label="Zvýraznit komentář" onClick={() => { showFeatured(m.id); }} title="Zvýraznit komentář (demo)"><Eye size={17}/></button></div></article>)}{visibleMessages.length === 0 && <p className="empty">Žádné zprávy v tomto filtru.</p>}</div>
      <div className="chat-foot"><span>{messages.length} testovacích zpráv{unseenCount>0&&<strong className="chat-unread" role="status"> · {unseenCount} nových</strong>}</span><button onClick={returnToNewest} title="Zobrazit nejnovější zprávy nahoře"><RotateCcw size={14}/> Na začátek</button></div></section>
      <div className={'directing-column ' + (mobilePage !== 'directing' ? 'mobile-hidden' : '')}>
        <DirectingPanels messages={messages} favorites={favorites} shownMessages={shownMessages} featuredId={activeFeatured} onFeature={showFeatured} collapsed={collapsed} toggle={category=>setCollapsed(v=>({...v,[category]:!v[category]}))}/>
      </div>
    </div>
  </div>;
}
export default function App() {
  return <Shell>{section => {
    if (section === 'live') return <Directing/>;
    if (section === 'intro' || section === 'break' || section === 'outro') return <SceneEditor key={section} kind={section}/>;
    if (section === 'archive') return <ArchivePage/>;
    if (section === 'diagnostics') return <DiagnosticsPage/>;
    return <SettingsPage/>;
  }}</Shell>;
}

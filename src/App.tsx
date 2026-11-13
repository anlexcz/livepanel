import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, Eye, EyeOff, MessageSquare, Pause, Play, RotateCcw, Star, Trash2 } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [filter, setFilter] = useState<Filter>('all');
  const [mobilePage, setMobilePage] = useState<ActivePage>('chat');
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({ FEATURED: false, EVENT: false, TICKER: false, EDITORIAL: false });
  const [chatPaused, setChatPaused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeFeatured, setActiveFeatured] = useState<string | null>(null);
  const [directingWidth, setDirectingWidth] = useState(60);
  const workArea = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return;
    const resize = (event: PointerEvent) => {
      const rect = workArea.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      setDirectingWidth(Math.max(30, Math.min(70, Math.round(percent))));
    };
    const stop = () => setResizing(false);
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [resizing]);
  const chatScroll = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => messages.filter(m => filter === 'all' || m.favorite), [messages, filter]);
  const favorites = messages.filter(m => m.favorite);
  function toggleFavorite(id: string) { setMessages(previous => previous.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m)); }
  function addDemoMessage() { const next = messages.length + 1; setMessages(previous => [...previous, { id: 'm' + next, author: 'Testovací divák', text: 'Nová ukázková zpráva číslo ' + next + '. Pouze test, bez YouTube API.', time: '19:' + String(next).padStart(2, '0'), favorite: false }]); requestAnimationFrame(() => { if (chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }); }
  return <div className="live-view" style={{ '--directing-width': directingWidth + '%' } as CSSProperties}>
    <div className="demo-banner"><span><AlertTriangle size={16}/> DEMO REŽIM – žádné spojení s YouTube ani OBS. Všechny akce jsou jen lokální simulace.</span><button onClick={addDemoMessage} className="small-button">+ Testovací zpráva</button></div>
    <div className="page-toolbar"><h1>Živá režie</h1><span className="muted">Ukázkové vysílání · simulace</span></div>
    <div className="mobile-tabs" role="tablist" aria-label="Část režie"><button role="tab" aria-selected={mobilePage === 'chat'} className={mobilePage === 'chat' ? 'selected' : ''} onClick={() => setMobilePage('chat')}>CHAT</button><button role="tab" aria-selected={mobilePage === 'directing'} className={mobilePage === 'directing' ? 'selected' : ''} onClick={() => setMobilePage('directing')}>REŽIE</button></div>
    <div className={'work-area' + (resizing ? ' is-resizing' : '')} ref={workArea}>
      <div className="column-resizer" role="separator" aria-label="Šířka režijního sloupce" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={directingWidth} aria-valuetext={`Režie ${directingWidth} %, chat ${100 - directingWidth} %`} tabIndex={0} title="Tažením změnit šířku · dvojklik obnoví 60:40" onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); setResizing(true); }} onDoubleClick={() => setDirectingWidth(60)} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); setDirectingWidth(width => Math.max(30, width - 2)); } if (event.key === 'ArrowRight') { event.preventDefault(); setDirectingWidth(width => Math.min(70, width + 2)); } if (event.key === 'Home') { event.preventDefault(); setDirectingWidth(30); } if (event.key === 'End') { event.preventDefault(); setDirectingWidth(70); } }}><span className="resize-grip" /></div>
      <section className={'panel chat-panel ' + (mobilePage !== 'chat' ? 'mobile-hidden' : '')} aria-label="Živý chat"><div className="chat-head"><h2><MessageSquare size={19}/> CHAT</h2><div className="toolbar-actions"><button title={chatPaused ? 'Pokračovat' : 'Pozastavit'} aria-label={chatPaused ? 'Pokračovat' : 'Pozastavit'} className="icon-button" onClick={() => setChatPaused(!chatPaused)}>{chatPaused ? <Play size={17}/> : <Pause size={17}/>}</button><button title="Vyčistit grafiku – simulace" aria-label="Vyčistit grafiku – simulace" className="icon-button" disabled><Trash2 size={17}/></button><button title={chatVisible ? 'Skrýt CHAT v grafice – simulace' : 'Zobrazit CHAT v grafice – simulace'} aria-label="Přepnout viditelnost chatu" className="icon-button" onClick={() => setChatVisible(!chatVisible)}>{chatVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div></div>
      <div className="chat-state"><span className={'state-dot ' + (chatVisible && !chatPaused ? 'ok' : 'warn')}/>{!chatVisible ? 'Grafika CHAT skryta (demo)' : chatPaused ? 'Grafika CHAT pozastavena (demo)' : 'Automatika CHAT aktivní (demo)'}</div>
      <div className="filter-row"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Vše ({messages.length})</button><button className={filter === 'favorites' ? 'selected' : ''} onClick={() => setFilter('favorites')}>Oblíbené ({favorites.length})</button></div>
      <div className="messages" ref={chatScroll} role="log" aria-label="Testovací zprávy">{filtered.map(m => <article className="message" key={m.id}><span className="avatar" aria-hidden="true">{m.author.slice(0,1)}</span><div className="message-content"><div className="message-meta"><strong>{m.author}</strong><time>{m.time}</time>{m.role && <span className="role">Člen</span>}</div><p>{m.text}</p></div><div className="message-actions" role="group" aria-label={`Akce komentáře od ${m.author}`}><button className={m.favorite ? 'is-active' : ''} aria-pressed={m.favorite} aria-label={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} title={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} onClick={() => toggleFavorite(m.id)}><Star size={17} fill={m.favorite ? 'currentColor' : 'none'}/></button><button className={activeFeatured === m.id ? 'is-active' : ''} aria-pressed={activeFeatured === m.id} aria-label="Zvýraznit komentář (demo)" onClick={() => { setActiveFeatured(m.id); }} title="Zvýraznit komentář (demo)"><Eye size={17}/></button></div></article>)}{filtered.length === 0 && <p className="empty">Žádné zprávy v tomto filtru.</p>}</div>
      <div className="chat-foot"><span>{messages.length} testovacích zpráv</span><button onClick={() => { if(chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }}><RotateCcw size={14}/> Na konec</button></div></section>
      <div className={'directing-column ' + (mobilePage !== 'directing' ? 'mobile-hidden' : '')}>
        <DirectingPanels messages={messages} favorites={favorites} featuredId={activeFeatured} onFeature={setActiveFeatured} collapsed={collapsed} toggle={category=>setCollapsed(v=>({...v,[category]:!v[category]}))}/>
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

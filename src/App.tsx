import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, Heart, MessageSquare, MoreHorizontal, Pause, Play, RotateCcw, Star, Trash2, Zap, List, Type } from 'lucide-react';
import Shell from './components/Shell';
import { initialMessages, type Category, type Message } from './mock/data';

type Filter = 'all' | 'favorites';
type ActivePage = 'chat' | 'directing';
const descriptions: Record<Category, string> = { FEATURED: 'Žádný aktivní komentář', EVENT: 'Fronta: 2 čekající události', TICKER: 'Automatika pozastavena', EDITORIAL: 'Žádný aktivní titulek' };
function CategoryPanel({ category, collapsed, toggle, children }: { category: Category; collapsed: boolean; toggle: () => void; children: React.ReactNode }) {
  const icons = { FEATURED: Star, EVENT: Zap, TICKER: List, EDITORIAL: Type };
  const PanelIcon = icons[category];
  return <section className="panel director-panel"><button className="panel-toggle" aria-expanded={!collapsed} onClick={toggle}><span className="panel-heading"><PanelIcon size={18} strokeWidth={2}/>{category}</span><span className="panel-summary">{descriptions[category]}</span>{collapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}</button>{!collapsed && <div className="panel-body">{children}</div>}</section>;
}
function Directing() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [filter, setFilter] = useState<Filter>('all');
  const [mobilePage, setMobilePage] = useState<ActivePage>('chat');
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({ FEATURED: false, EVENT: false, TICKER: false, EDITORIAL: false });
  const [chatPaused, setChatPaused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeFeatured, setActiveFeatured] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
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
  const chosen = messages.find(m => m.id === activeFeatured);
  return <div className="live-view" style={{ '--directing-width': directingWidth + '%' } as CSSProperties}>
    <div className="demo-banner"><span><AlertTriangle size={16}/> DEMO REŽIM – žádné spojení s YouTube ani OBS. Všechny akce jsou jen lokální simulace.</span><button onClick={addDemoMessage} className="small-button">+ Testovací zpráva</button></div>
    <div className="page-toolbar"><h1>Živá režie</h1><span className="muted">Ukázkové vysílání · simulace</span></div>
    <div className="mobile-tabs" role="tablist" aria-label="Část režie"><button role="tab" aria-selected={mobilePage === 'chat'} className={mobilePage === 'chat' ? 'selected' : ''} onClick={() => setMobilePage('chat')}>CHAT</button><button role="tab" aria-selected={mobilePage === 'directing'} className={mobilePage === 'directing' ? 'selected' : ''} onClick={() => setMobilePage('directing')}>REŽIE</button></div>
    <div className={'work-area' + (resizing ? ' is-resizing' : '')} ref={workArea}>
      <div className="column-resizer" role="separator" aria-label="Šířka režijního sloupce" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={directingWidth} aria-valuetext={`Režie ${directingWidth} %, chat ${100 - directingWidth} %`} tabIndex={0} title="Tažením změnit šířku · dvojklik obnoví 60:40" onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); setResizing(true); }} onDoubleClick={() => setDirectingWidth(60)} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); setDirectingWidth(width => Math.max(30, width - 2)); } if (event.key === 'ArrowRight') { event.preventDefault(); setDirectingWidth(width => Math.min(70, width + 2)); } if (event.key === 'Home') { event.preventDefault(); setDirectingWidth(30); } if (event.key === 'End') { event.preventDefault(); setDirectingWidth(70); } }}><span className="resize-grip" /></div>
      <section className={'panel chat-panel ' + (mobilePage !== 'chat' ? 'mobile-hidden' : '')} aria-label="Živý chat"><div className="chat-head"><h2><MessageSquare size={19}/> CHAT</h2><div className="toolbar-actions"><button title={chatPaused ? 'Pokračovat' : 'Pozastavit'} aria-label={chatPaused ? 'Pokračovat' : 'Pozastavit'} className="icon-button" onClick={() => setChatPaused(!chatPaused)}>{chatPaused ? <Play size={17}/> : <Pause size={17}/>}</button><button title="Vyčistit grafiku – simulace" aria-label="Vyčistit grafiku – simulace" className="icon-button" disabled><Trash2 size={17}/></button><button title={chatVisible ? 'Skrýt CHAT v grafice – simulace' : 'Zobrazit CHAT v grafice – simulace'} aria-label="Přepnout viditelnost chatu" className="icon-button" onClick={() => setChatVisible(!chatVisible)}>{chatVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div></div>
      <div className="chat-state"><span className={'state-dot ' + (chatVisible && !chatPaused ? 'ok' : 'warn')}/>{!chatVisible ? 'Grafika CHAT skryta (demo)' : chatPaused ? 'Grafika CHAT pozastavena (demo)' : 'Automatika CHAT aktivní (demo)'}</div>
      <div className="filter-row"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Vše ({messages.length})</button><button className={filter === 'favorites' ? 'selected' : ''} onClick={() => setFilter('favorites')}>Oblíbené ({favorites.length})</button></div>
      <div className="messages" ref={chatScroll} role="log" aria-label="Testovací zprávy">{filtered.map(m => <article className="message" key={m.id}><span className="avatar" aria-hidden="true">{m.author.slice(0,1)}</span><div className="message-content"><div className="message-meta"><strong>{m.author}</strong><time>{m.time}</time>{m.role && <span className="role">Člen</span>}</div><p>{m.text}</p></div><div className="message-actions" role="group" aria-label={`Akce komentáře od ${m.author}`}><button className={m.favorite ? 'is-active' : ''} aria-pressed={m.favorite} aria-label={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} title={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} onClick={() => toggleFavorite(m.id)}><Star size={17} fill={m.favorite ? 'currentColor' : 'none'}/></button><button className={activeFeatured === m.id ? 'is-active' : ''} aria-pressed={activeFeatured === m.id} aria-label="Zvýraznit komentář (demo)" onClick={() => { setActiveFeatured(m.id); setSelectedMessage(m.id); }} title="Zvýraznit komentář (demo)"><Eye size={17}/></button></div></article>)}{filtered.length === 0 && <p className="empty">Žádné zprávy v tomto filtru.</p>}</div>
      <div className="chat-foot"><span>{messages.length} testovacích zpráv</span><button onClick={() => { if(chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }}><RotateCcw size={14}/> Na konec</button></div></section>
      <div className={'directing-column ' + (mobilePage !== 'directing' ? 'mobile-hidden' : '')}>
        <CategoryPanel category="FEATURED" collapsed={collapsed.FEATURED} toggle={() => setCollapsed(s => ({...s, FEATURED: !s.FEATURED}))}><div className="panel-state">{chosen ? <>Ukázkově zvýrazněno: <strong>{chosen.author}</strong><p>{chosen.text}</p></> : 'Momentálně nic nevysíláno.'}</div><div className="section-label">Oblíbené komentáře ({favorites.length})</div>{favorites.map(m => <div key={m.id} className={'compact-item ' + (selectedMessage === m.id ? 'picked' : '')}><span className="featured-comment"><strong>{m.author}</strong><span>{m.text}</span></span><button className="small-button featured-action" onClick={() => {setActiveFeatured(m.id); setSelectedMessage(m.id);}}>Zvýraznit</button></div>)}{favorites.length === 0 && <div className="empty">Žádné oblíbené komentáře.</div>}{chosen && <button className="small-button danger" onClick={() => setActiveFeatured(null)}>Skrýt zvýraznění</button>}</CategoryPanel>
        <CategoryPanel category="EVENT" collapsed={collapsed.EVENT} toggle={() => setCollapsed(s => ({...s, EVENT: !s.EVENT}))}><div className="panel-state">Ukázková fronta, automatika není připojena.</div><div className="compact-item"><span>Super Chat · Dopravák · 100 Kč</span><span className="muted">Čeká</span></div><div className="compact-item"><span>Nové členství · Martina</span><span className="muted">Čeká</span></div></CategoryPanel>
        <CategoryPanel category="TICKER" collapsed={collapsed.TICKER} toggle={() => setCollapsed(s => ({...s, TICKER: !s.TICKER}))}><div className="panel-state">Automatika pozastavena (demo)</div><div className="compact-item"><span>Připravované změny grafikonu</span><span className="muted">Aktivní položka</span></div><button className="small-button" disabled title="Funkce přijde v další etapě">Spravovat zprávy</button></CategoryPanel>
        <CategoryPanel category="EDITORIAL" collapsed={collapsed.EDITORIAL} toggle={() => setCollapsed(s => ({...s, EDITORIAL: !s.EDITORIAL}))}><div className="panel-state">Momentálně není zobrazen žádný titulek.</div><button className="small-button" disabled title="Funkce přijde v další etapě">Vybrat titulek</button></CategoryPanel>
      </div>
    </div>
  </div>;
}
export default function App() { return <Shell>{section => section === 'live' ? <Directing/> : <div className="placeholder"><h1>{({intro:'INTRO',break:'BREAK',outro:'OUTRO',archive:'Archiv',diagnostics:'Diagnostika',settings:'Nastavení'} as Record<string,string>)[section]}</h1><p>Stránka bude doplněna v další vývojové etapě. Jde pouze o navigační prototyp.</p><Heart size={18}/><MoreHorizontal size={18}/></div>}</Shell>; }

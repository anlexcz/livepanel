import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, Heart, MessageSquare, MoreHorizontal, Pause, Play, RotateCcw, Star, Trash2 } from 'lucide-react';
import Shell from './components/Shell';
import { initialMessages, type Category, type Message } from './mock/data';

type Filter = 'all' | 'favorites';
type ActivePage = 'chat' | 'directing';
const descriptions: Record<Category, string> = { FEATURED: 'Žádný aktivní komentář', EVENT: 'Fronta: 2 čekající události', TICKER: 'Automatika pozastavena', EDITORIAL: 'Žádný aktivní titulek' };
function CategoryPanel({ category, collapsed, toggle, children }: { category: Category; collapsed: boolean; toggle: () => void; children: React.ReactNode }) {
  return <section className="panel director-panel"><button className="panel-toggle" aria-expanded={!collapsed} onClick={toggle}><span className="panel-heading">{category}</span><span className="panel-summary">{descriptions[category]}</span>{collapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}</button>{!collapsed && <div className="panel-body">{children}</div>}</section>;
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
  const [chatWidth, setChatWidth] = useState(60);
  const chatScroll = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => messages.filter(m => filter === 'all' || m.favorite), [messages, filter]);
  const favorites = messages.filter(m => m.favorite);
  function toggleFavorite(id: string) { setMessages(previous => previous.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m)); }
  function addDemoMessage() { const next = messages.length + 1; setMessages(previous => [...previous, { id: 'm' + next, author: 'Testovací divák', text: 'Nová ukázková zpráva číslo ' + next + '. Pouze test, bez YouTube API.', time: '19:' + String(next).padStart(2, '0'), favorite: false }]); requestAnimationFrame(() => { if (chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }); }
  const chosen = messages.find(m => m.id === activeFeatured);
  return <div className="live-view" style={{ '--chat-width': chatWidth + '%' } as CSSProperties}>
    <div className="demo-banner"><span><AlertTriangle size={16}/> DEMO REŽIM – žádné spojení s YouTube ani OBS. Všechny akce jsou jen lokální simulace.</span><button onClick={addDemoMessage} className="small-button">+ Testovací zpráva</button></div>
    <div className="page-toolbar"><h1>Živá režie</h1><span className="muted">Ukázkové vysílání · simulace</span><label className="width-setting">CHAT {chatWidth}% <input aria-label="Šířka chatu" type="range" min="45" max="70" value={chatWidth} onChange={e => setChatWidth(Number(e.target.value))}/></label></div>
    <div className="mobile-tabs" role="tablist" aria-label="Část režie"><button role="tab" aria-selected={mobilePage === 'chat'} className={mobilePage === 'chat' ? 'selected' : ''} onClick={() => setMobilePage('chat')}>CHAT</button><button role="tab" aria-selected={mobilePage === 'directing'} className={mobilePage === 'directing' ? 'selected' : ''} onClick={() => setMobilePage('directing')}>REŽIE</button></div>
    <div className="work-area">
      <section className={'panel chat-panel ' + (mobilePage !== 'chat' ? 'mobile-hidden' : '')} aria-label="Živý chat"><div className="chat-head"><h2><MessageSquare size={19}/> CHAT</h2><div className="toolbar-actions"><button title={chatPaused ? 'Pokračovat' : 'Pozastavit'} aria-label={chatPaused ? 'Pokračovat' : 'Pozastavit'} className="icon-button" onClick={() => setChatPaused(!chatPaused)}>{chatPaused ? <Play size={17}/> : <Pause size={17}/>}</button><button title="Vyčistit grafiku – simulace" aria-label="Vyčistit grafiku – simulace" className="icon-button" disabled><Trash2 size={17}/></button><button title={chatVisible ? 'Skrýt CHAT v grafice – simulace' : 'Zobrazit CHAT v grafice – simulace'} aria-label="Přepnout viditelnost chatu" className="icon-button" onClick={() => setChatVisible(!chatVisible)}>{chatVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div></div>
      <div className="chat-state"><span className={'state-dot ' + (chatVisible && !chatPaused ? 'ok' : 'warn')}/>{!chatVisible ? 'Grafika CHAT skryta (demo)' : chatPaused ? 'Grafika CHAT pozastavena (demo)' : 'Automatika CHAT aktivní (demo)'}</div>
      <div className="filter-row"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Vše ({messages.length})</button><button className={filter === 'favorites' ? 'selected' : ''} onClick={() => setFilter('favorites')}>Oblíbené ({favorites.length})</button></div>
      <div className="messages" ref={chatScroll} role="log" aria-label="Testovací zprávy">{filtered.map(m => <article className="message" key={m.id}><span className="avatar" aria-hidden="true">{m.author.slice(0,1)}</span><div className="message-content"><div className="message-meta"><strong>{m.author}</strong>{m.role && <span className="role">Člen</span>}<time>{m.time}</time></div><p>{m.text}</p><div className="message-actions"><button aria-label={m.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'} title="Oblíbené" onClick={() => toggleFavorite(m.id)}><Star size={16} fill={m.favorite ? 'currentColor' : 'none'}/></button><button onClick={() => { setActiveFeatured(m.id); setSelectedMessage(m.id); }} title="Zvýraznit – pouze demo"><Eye size={16}/><span>Zvýraznit</span></button></div></div></article>)}{filtered.length === 0 && <p className="empty">Žádné zprávy v tomto filtru.</p>}</div>
      <div className="chat-foot"><span>{messages.length} testovacích zpráv</span><button onClick={() => { if(chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }}><RotateCcw size={14}/> Na konec</button></div></section>
      <div className={'directing-column ' + (mobilePage !== 'directing' ? 'mobile-hidden' : '')}>
        <CategoryPanel category="FEATURED" collapsed={collapsed.FEATURED} toggle={() => setCollapsed(s => ({...s, FEATURED: !s.FEATURED}))}><div className="panel-state">{chosen ? <>Ukázkově zvýrazněno: <strong>{chosen.author}</strong><p>{chosen.text}</p></> : 'Momentálně nic nevysíláno.'}</div><div className="section-label">Oblíbené komentáře ({favorites.length})</div>{favorites.map(m => <div key={m.id} className={'compact-item ' + (selectedMessage === m.id ? 'picked' : '')}><span>{m.author}: {m.text}</span><button className="small-button" onClick={() => {setActiveFeatured(m.id); setSelectedMessage(m.id);}}>Zvýraznit</button></div>)}{favorites.length === 0 && <div className="empty">Žádné oblíbené komentáře.</div>}{chosen && <button className="small-button danger" onClick={() => setActiveFeatured(null)}>Skrýt zvýraznění</button>}</CategoryPanel>
        <CategoryPanel category="EVENT" collapsed={collapsed.EVENT} toggle={() => setCollapsed(s => ({...s, EVENT: !s.EVENT}))}><div className="panel-state">Ukázková fronta, automatika není připojena.</div><div className="compact-item"><span>Super Chat · Dopravák · 100 Kč</span><span className="muted">Čeká</span></div><div className="compact-item"><span>Nové členství · Martina</span><span className="muted">Čeká</span></div></CategoryPanel>
        <CategoryPanel category="TICKER" collapsed={collapsed.TICKER} toggle={() => setCollapsed(s => ({...s, TICKER: !s.TICKER}))}><div className="panel-state">Automatika pozastavena (demo)</div><div className="compact-item"><span>Připravované změny grafikonu</span><span className="muted">Aktivní položka</span></div><button className="small-button" disabled title="Funkce přijde v další etapě">Spravovat zprávy</button></CategoryPanel>
        <CategoryPanel category="EDITORIAL" collapsed={collapsed.EDITORIAL} toggle={() => setCollapsed(s => ({...s, EDITORIAL: !s.EDITORIAL}))}><div className="panel-state">Momentálně není zobrazen žádný titulek.</div><button className="small-button" disabled title="Funkce přijde v další etapě">Vybrat titulek</button></CategoryPanel>
      </div>
    </div>
  </div>;
}
export default function App() { return <Shell>{section => section === 'live' ? <Directing/> : <div className="placeholder"><h1>{({intro:'INTRO',break:'BREAK',outro:'OUTRO',archive:'Archiv',diagnostics:'Diagnostika',settings:'Nastavení'} as Record<string,string>)[section]}</h1><p>Stránka bude doplněna v další vývojové etapě. Jde pouze o navigační prototyp.</p><Heart size={18}/><MoreHorizontal size={18}/></div>}</Shell>; }

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Archive, ChevronDown, Clapperboard, LayoutDashboard, Menu, Radio, Settings, Users, X } from 'lucide-react';

type Section = 'live' | 'intro' | 'break' | 'outro' | 'archive' | 'diagnostics' | 'settings';
const sections: { id: Section; name: string; icon: typeof Radio; group?: string }[] = [
  { id: 'live', name: 'Živá režie', icon: LayoutDashboard },
  { id: 'intro', name: 'INTRO', icon: Clapperboard, group: 'Scénické overlaye' },
  { id: 'break', name: 'BREAK', icon: Clapperboard },
  { id: 'outro', name: 'OUTRO', icon: Clapperboard },
  { id: 'archive', name: 'Archiv', icon: Archive },
  { id: 'diagnostics', name: 'Diagnostika', icon: Activity },
  { id: 'settings', name: 'Nastavení', icon: Settings },
];
export default function Shell({ children }: { children: (section: Section) => ReactNode }) {
  const [section, setSection] = useState<Section>('live');
  const [open, setOpen] = useState(false);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  return <div className="app-shell">
    <aside className="nav-rail" aria-label="Hlavní navigace"><button className="rail-button" type="button" aria-label="Otevřít navigaci" onClick={() => setOpen(true)}><Menu size={23} /></button><span className="rail-divider" />{sections.filter(item => !['intro', 'break', 'outro'].includes(item.id)).map(item => <button key={item.id} className={'rail-button ' + (section === item.id ? 'active' : '')} type="button" title={item.name} aria-label={item.name} onClick={() => setSection(item.id)}><item.icon size={22} /></button>)}</aside>
    {open && <><button className="nav-backdrop" aria-label="Zavřít navigaci" onClick={() => setOpen(false)} /><nav className="nav-drawer" aria-label="Navigace"><div className="drawer-head">NAVIGACE<button className="icon-button" aria-label="Zavřít" onClick={() => setOpen(false)}><X size={20}/></button></div>{sections.map(item => <div key={item.id}>{item.group && <div className="nav-group">{item.group} <ChevronDown size={14}/></div>}<button className={'nav-link ' + (section === item.id ? 'active' : '')} onClick={() => { setSection(item.id); setOpen(false); }}><item.icon size={18}/>{item.name}</button></div>)}</nav></>}
    <header className="topbar"><button className="mobile-menu icon-button" aria-label="Otevřít navigaci" onClick={() => setOpen(true)}><Menu size={22}/></button><span className="brand">METROBUS <span>LIVEPANEL</span></span><span className="top-spacer"/><div className="status-strip" aria-label="Ukázkové provozní stavy"><span title="Relace: demo"><Radio size={16} className="state-ok"/><span>DEMO</span></span><span title="Collector: simulován"><Activity size={16} className="state-warn"/><span>MOCK</span></span><span title="OBS: nepřipojeno"><Clapperboard size={16} className="state-error"/><span>OBS offline</span></span></div><button className="operators" title="Ukázkové účty, žádné reálné připojení"><Users size={18}/><span>1</span></button></header>
    <main className="main-content">{children(section)}</main>
  </div>;
}

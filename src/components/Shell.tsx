import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, Archive, ChevronDown, Clapperboard, LayoutDashboard, Menu, Radio, Settings, Users, X } from 'lucide-react';
import { Buttons, PanelButton } from './Ui';

export type Section = 'live' | 'intro' | 'break' | 'outro' | 'archive' | 'diagnostics' | 'settings';
type Guard = { dirty: boolean; save: () => void; discard: () => void };
type GuardContextValue = { register: (value: Guard) => () => void };
const GuardContext = createContext<GuardContextValue | null>(null);
export function useNavigationGuard(dirty: boolean, save: () => void, discard: () => void) {
  const context=useContext(GuardContext);
  useEffect(()=>context?.register({dirty,save,discard}),[context,dirty,save,discard]);
}
const sceneSections = [
  { id: 'intro', name: 'INTRO' },
  { id: 'break', name: 'BREAK' },
  { id: 'outro', name: 'OUTRO' },
] as const;
const sections: { id: Section; name: string; icon: typeof Radio }[] = [
  { id: 'live', name: 'Živá režie', icon: LayoutDashboard },
  { id: 'archive', name: 'Archiv', icon: Archive },
  { id: 'diagnostics', name: 'Diagnostika', icon: Activity },
  { id: 'settings', name: 'Nastavení', icon: Settings },
];
const sceneActive = (section: Section) => section === 'intro' || section === 'break' || section === 'outro';
export default function Shell({ children }: { children: (section: Section) => ReactNode }) {
  const [section,setSection]=useState<Section>('live');
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState<Section|null>(null);
  const guardRef=useRef<Guard|null>(null);
  const register=useCallback((value:Guard)=>{
    guardRef.current=value;
    return ()=>{if(guardRef.current===value)guardRef.current=null;};
  },[]);
  function navigate(next:Section) {
    setOpen(false);
    if (next===section) return;
    if (guardRef.current?.dirty){setPending(next);return;}
    setSection(next);
  }
  function resolvePending(action:'save'|'discard'|'stay'){
    if(action==='stay'){setPending(null);return;}
    if(action==='save')guardRef.current?.save();
    else guardRef.current?.discard();
    if(pending)setSection(pending);
    setPending(null);
  }
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){if(pending)setPending(null);else setOpen(false);}
    };
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[pending]);
  return <GuardContext.Provider value={{register}}><div className={"app-shell "+(open?"nav-expanded":"")}>
    <aside className="nav-rail" aria-label="Hlavní navigace">
      <button className="rail-toggle" type="button" title={open?'Zavřít navigaci':'Otevřít navigaci'} aria-label={open?'Zavřít navigaci':'Otevřít navigaci'} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?<X size={23}/>:<Menu size={23}/>}<span className="rail-label rail-title">NAVIGACE</span></button>
      <span className="rail-divider"/>
      <div className="rail-links">
        <button className={'rail-link '+(section==='live'?'active':'')} type="button" title="Živá režie" aria-label="Živá režie" onClick={()=>navigate('live')}><LayoutDashboard size={21}/><span className="rail-label">Živá režie</span></button>
        <button className={'rail-link scene-group-trigger '+(sceneActive(section)?'active':'')} type="button" title="Scénické overlaye – otevřít navigaci" aria-label="Scénické overlaye – otevřít nabídku INTRO, BREAK, OUTRO" aria-expanded={open} onClick={()=>setOpen(true)}><Clapperboard size={21}/><span className="rail-label">Scénické overlaye</span>{open&&<ChevronDown size={15} className="rail-group-chevron"/>}</button>
        {open&&<div className="scene-subnav" aria-label="Scénické overlaye">
          {sceneSections.map(item=><button className={'scene-subnav-link '+(section===item.id?'active':'')} key={item.id} type="button" aria-current={section===item.id?'page':undefined} onClick={()=>navigate(item.id)}>{item.name}</button>)}
        </div>}
        {sections.filter(item=>item.id!=='live').map(item=><button key={item.id} className={'rail-link '+(section===item.id?'active':'')} type="button" title={item.name} aria-label={item.name} onClick={()=>navigate(item.id)}><item.icon size={21}/><span className="rail-label">{item.name}</span></button>)}
      </div>
    </aside>
    <button className={'nav-backdrop '+(open?'is-open':'')} type="button" aria-label="Zavřít navigaci" aria-hidden={!open} tabIndex={open?0:-1} onClick={()=>setOpen(false)}/>
    <nav className={'nav-drawer '+(open?'is-open':'')} aria-label="Navigace" aria-hidden={!open} inert={!open}>
      <div className="drawer-head"><button className="drawer-close" type="button" aria-label="Zavřít navigaci" title="Zavřít navigaci" onClick={()=>setOpen(false)}><X size={23}/></button><span>NAVIGACE</span></div>
      <button type="button" className={'nav-link '+(section==='live'?'active':'')} onClick={()=>navigate('live')}><LayoutDashboard size={18}/>Živá režie</button>
      <div className="nav-group"><Clapperboard size={18}/>Scénické overlaye</div>
      {sceneSections.map(item=><button type="button" key={item.id} className={'nav-link scene-drawer-link '+(section===item.id?'active':'')} onClick={()=>navigate(item.id)}>{item.name}</button>)}
      {sections.filter(item=>item.id!=='live').map(item=><button type="button" className={'nav-link '+(section===item.id?'active':'')} key={item.id} onClick={()=>navigate(item.id)}><item.icon size={18}/>{item.name}</button>)}
    </nav>
    <header className="topbar">
      <button type="button" className="mobile-menu icon-button" aria-label="Otevřít navigaci" onClick={()=>setOpen(true)}><Menu size={22}/></button>
      <span className="brand"><span className="brand-mark"><img className="brand-logo" src="/livepanel/assets/metrobus-mark-white.png" alt="Metrobus"/></span><span className="brand-title"><span className="brand-live">LIVE</span><span className="brand-panel">PANEL</span></span></span>
      <span className="top-spacer"/>
      <div className="status-strip" aria-label="Ukázkové provozní stavy">
        <span title="Relace: demo"><Radio size={16} className="state-ok"/><span>DEMO</span></span>
        <span title="Collector: simulován"><Activity size={16} className="state-warn"/><span>MOCK</span></span>
        <span title="OBS: nepřipojeno"><Clapperboard size={16} className="state-error"/><span>OBS offline</span></span>
      </div>
      <button type="button" className="operators" title="Testovací operátor, žádné reálné připojení"><Users size={18}/><span>1</span></button>
    </header>
    <main className="main-content">{children(section)}</main>
    {pending&&<div className="lp-modal-backdrop" role="presentation"><div className="lp-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
      <h2 id="leave-title">Neuložené změny</h2>
      <p>V editoru máš rozepsané změny. Co s nimi chceš udělat před opuštěním stránky?</p>
      <Buttons><PanelButton primary onClick={()=>resolvePending('save')}>Uložit a pokračovat (demo)</PanelButton><PanelButton danger onClick={()=>resolvePending('discard')}>Zahodit změny</PanelButton><PanelButton onClick={()=>resolvePending('stay')}>Zůstat v editoru</PanelButton></Buttons>
    </div></div>}
  </div></GuardContext.Provider>;
}

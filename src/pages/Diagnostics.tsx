import { useState } from 'react';
import { AlertTriangle, Activity, Clock3, Database, Radio, Server, WifiOff } from 'lucide-react';
import { DemoNotice, Disclosure, PageHeading, Status, Surface } from '../components/Ui';

type EventItem={at:string;title:string;detail:string;status:'good'|'warn'|'error'};
const events:EventItem[]=[
  {at:'19:08:22',title:'Příjem obnoven',detail:'Mock collector pokračuje ve sběru',status:'good'},
  {at:'19:08:02',title:'Collector přerušen',detail:'Simulovaný krátký výpadek síťového spojení',status:'warn'},
  {at:'19:00:00',title:'Relace zahájena',detail:'Testovací relace bez YouTube připojení',status:'good'},
];
function Metric({icon:Icon,name,value,note,status}:{icon:typeof Radio;name:string;value:string;note:string;status:'good'|'warn'|'error'|'neutral'}) {
  return <div className="lp-metric"><div className="lp-metric-top"><Icon size={19}/><span>{name}</span></div><Status type={status}>{value}</Status><small>{note}</small></div>;
}
export default function DiagnosticsPage(){
  const [view,setView]=useState<'normal'|'collector'|'overlay'|'storage'>('normal');
  return <div className="lp-page">
    <PageHeading title="Diagnostika" description="Provozní přehled, připojení a historie významných událostí" />
    <DemoNotice>Všechny ukazatele a provozní události jsou ilustrační. Není připojen žádný server, collector, databáze ani OBS.</DemoNotice>
    <Surface title="Testovací scénář" subtitle="Vyzkoušení vizuálních stavů bez ovlivnění režie">
      <div className="lp-button-row lp-segment">
        {[['normal','Výchozí'],['collector','Výpadek Collectoru'],['overlay','OBS offline'],['storage','Chyba ukládání']].map(([value,label])=>
          <button key={value} className={view===value?'is-selected':''} onClick={()=>setView(value as typeof view)}>{label}</button>)}
      </div>
    </Surface>
    {view!=='normal'&&<div className="lp-diagnostic-warning"><AlertTriangle size={18}/><div><strong>{view==='collector'?'Collector není dostupný':view==='overlay'?'Grafický overlay je odpojený':'Ukládání produkčního stavu selhalo'}</strong><p>{view==='overlay'?'Simulace stavu po překročení desetisekundového limitu.': 'Pouze testovací scénář bez skutečného provozu.'}</p></div></div>}
    <div className="lp-metric-grid">
      <Metric icon={Server} name="Server" value={view==='storage'?'Chyba stavu':'Pouze demo'} status={view==='storage'?'error':'neutral'} note="Není připojen backend"/>
      <Metric icon={Radio} name="Vysílací relace" value="Simulovaná" status="neutral" note="Testovací režie"/>
      <Metric icon={Activity} name="YouTube Collector" value={view==='collector'?'Nedostupný':'Simulace'} status={view==='collector'?'error':'warn'} note="Metoda: mock / žádné API"/>
      <Metric icon={WifiOff} name="OBS overlay" value={view==='overlay'?'Odpojeno':'Nepřipojeno'} status={view==='overlay'?'error':'neutral'} note="Přítomnost zdroje neprokazuje vysílání"/>
      <Metric icon={Database} name="Databáze" value={view==='storage'?'Chyba zápisu':'Bez databáze'} status={view==='storage'?'error':'neutral'} note="Production State není uložen"/>
      <Metric icon={Clock3} name="Poslední zpráva" value="19:08:22" status="neutral" note="Ukázkový čas, nikoli živé měření"/>
    </div>
    <Surface title="Historie provozních událostí" subtitle="Chronologicky, nejnovější nahoře · cíl retence 30 dní">
      <div className="lp-event-history">{events.map((event,i)=><div key={i} className="lp-history-row"><span className="lp-history-time">{event.at}</span><Status type={event.status}>{event.title}</Status><span className="lp-muted">{event.detail}</span></div>)}</div>
    </Surface>
    <Surface title="Technický detail" subtitle="Samostatná informační vrstva bez duplicitních příkazů">
      <Disclosure title="Ukázkový technický log"><pre className="lp-log">{'[19:08:02] WARN MOCK_COLLECTOR_DISCONNECTED\n[19:08:22] INFO MOCK_COLLECTOR_RECONNECTED\n[19:08:22] INFO DEMO_STATE_UNCHANGED'}</pre></Disclosure>
      <p className="lp-muted">Z této stránky nelze restartovat Collector ani měnit grafiku. Tyto operace patří do režie.</p>
    </Surface>
  </div>;
}

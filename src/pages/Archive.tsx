import { useMemo, useState } from 'react';
import { CalendarDays, Download, FileJson, Search } from 'lucide-react';
import { Buttons, DemoNotice, Empty, Field, PageHeading, PanelButton, Surface } from '../components/Ui';
import { sampleArchive, type ArchiveItem } from '../mock/archive';

function safeCsv(value: string) { const clean = /^[=+\-@\t\r]/.test(value) ? "'" + value : value; return '"' + clean.replace(/"/g,'""') + '"'; }
function downloadRows(rows: ArchiveItem[], format: 'csv'|'json') {
  const text = format === 'json' ? JSON.stringify(rows,null,2) : ['date,source,kind,author,content',...rows.map(r=>[r.date,r.source,r.kind,r.author,r.content].map(safeCsv).join(','))].join('\r\n');
  const blob = new Blob([format==='csv' ? '\uFEFF' + text : text],{type:format==='csv'?'text/csv;charset=utf-8':'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='livepanel-demo-archiv.'+format;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export default function ArchivePage() {
  const [from,setFrom]=useState('2026-11-08'),[to,setTo]=useState('2026-11-11'),[query,setQuery]=useState(''),[kind,setKind]=useState('all');
  const rows=useMemo(()=>sampleArchive.filter(r=>{
    const day=r.date.slice(0,10);
    return (!from||day>=from)&&(!to||day<=to)&&(kind==='all'||kind===r.kind)&&(!query||[r.author,r.content,r.source].join(' ').toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs')));
  }).sort((a,b)=>b.date.localeCompare(a.date)),[from,to,query,kind]);
  return <div className="lp-page">
    <PageHeading title="Archiv komentářů" description="Souvislý chronologický archiv napříč vysíláními" />
    <DemoNotice>Všechny záznamy jsou uměle vytvořená testovací data. CSV/JSON export stáhne pouze tyto ukázky; skutečný YouTube archiv ani retence nejsou implementovány.</DemoNotice>
    <Surface title="Filtry a export" subtitle="Časové období v Europe/Prague">
      <div className="lp-filter-grid">
        <Field label="Od"><input type="date" value={from} max={to || undefined} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Do"><input type="date" value={to} min={from || undefined} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Typ"><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Všechny události</option><option value="Komentář">Komentář</option><option value="Super Chat">Super Chat</option><option value="Členství">Členství</option></select></Field>
        <Field label="Hledat"><span className="lp-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Autor nebo text"/></span></Field>
      </div>
      <div className="lp-filter-footer"><span>{rows.length} testovacích záznamů</span><Buttons>
        <PanelButton onClick={()=>downloadRows(rows,'csv')} disabled={!rows.length}><Download size={15}/> Export CSV</PanelButton>
        <PanelButton onClick={()=>downloadRows(rows,'json')} disabled={!rows.length}><FileJson size={15}/> Export JSON</PanelButton>
      </Buttons></div>
    </Surface>
    <Surface title="Komentáře a události" subtitle="Nejnovější nahoře">
      {rows.length===0?<Empty>Pro zvolené období nejsou žádná testovací data.</Empty>:
        <div className="lp-archive-list">{rows.map(row=><article className="lp-archive-row" key={row.id}>
          <div className="lp-archive-time"><CalendarDays size={15}/>{row.date.replace('T',' · ')}</div>
          <div className="lp-archive-entry"><strong>{row.author}</strong><span className="lp-muted">{row.source}</span><span className="lp-archive-kind">{row.kind}</span><p>{row.content}</p></div>
        </article>)}</div>}
    </Surface>
  </div>;
}

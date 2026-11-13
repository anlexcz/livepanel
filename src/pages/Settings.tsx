import { useState } from 'react';
import { Check, Link2, LockKeyhole, Monitor, ShieldCheck, UserRound } from 'lucide-react';
import { DemoNotice, Field, PageHeading, PanelButton, Surface, Status } from '../components/Ui';

export default function SettingsPage(){
  const [section,setSection]=useState('general');
  const [displayName,setDisplayName]=useState('Testovací operátor');
  const [compact,setCompact]=useState(true);
  const [confirmation,setConfirmation]=useState('');
  const [source,setSource]=useState('https://www.youtube.com/watch?v=DEMO');
  return <div className="lp-page">
    <PageHeading title="Nastavení" description="Účty, připojení a osobní preference rozhraní" />
    <DemoNotice>Účty a nastavení propojení jsou pouze návrhem UI. Neukládají se hesla ani OAuth tokeny a nepřipojuje se YouTube.</DemoNotice>
    <div className="lp-settings-layout">
      <nav className="lp-settings-menu" aria-label="Kategorie nastavení">
        {[['general','Obecné'],['operators','Operátoři'],['youtube','YouTube a relace'],['appearance','Rozhraní']].map(([key,name])=><button className={section===key?'is-selected':''} key={key} onClick={()=>{setSection(key);setConfirmation('');}}>{name}</button>)}
      </nav>
      <div className="lp-settings-main">
        {section==='general'&&<Surface title="Základní údaje" subtitle="Konfigurace projektu">
          <div className="lp-kv"><span>Název</span><strong>Metrobus LivePanel</strong></div>
          <div className="lp-kv"><span>Budoucí provozní adresa</span><strong>panel.metrobus.cz</strong></div>
          <div className="lp-kv"><span>Testovací frontend</span><strong>GitHub Pages</strong></div>
          <div className="lp-kv"><span>Datová vrstva</span><Status type="warn">Mock bez backendu</Status></div>
          <p className="lp-muted">Žádné automatické aktualizace ani zálohování nejsou součástí plánované administrace.</p>
        </Surface>}
        {section==='operators'&&<><Surface title="Operátorské účty" subtitle="Osobní účty se stejnými režijními právy">
          <div className="lp-list-row"><UserRound size={19}/><div><strong>Testovací operátor</strong><small>Aktuální prohlížeč · simulace</small></div><Status type="neutral">DEMO</Status></div>
          <div className="lp-list-row"><ShieldCheck size={19}/><div><strong>Metrobus</strong><small>Budoucí společný účet</small></div><Status type="neutral">Nenastaveno</Status></div>
          <PanelButton disabled>Přidat účet</PanelButton>
        </Surface><Surface title="Osobní profil"><Field label="Zobrazované jméno"><input value={displayName} onChange={e=>setDisplayName(e.target.value)} /></Field><PanelButton onClick={()=>setConfirmation('Jméno bylo změněno pouze v náhledu, bez serverového ukládání.')}>Použít v demo UI</PanelButton>{confirmation&&<p className="lp-local-confirm"><Check size={15}/>{confirmation}</p>}</Surface></>}
        {section==='youtube'&&<><Surface title="Připojení YouTube" subtitle="Budoucí propojení jednoho kanálu">
          <div className="lp-list-row"><Link2 size={19}/><div><strong>YouTube kanál Metrobus</strong><small>OAuth není implementován</small></div><Status type="neutral">Nepřipojeno</Status></div>
          <PanelButton disabled>Propojit kanál</PanelButton>
        </Surface><Surface title="Ukázkový vstup vysílání">
          <Field label="Adresa vysílání"><input value={source} onChange={e=>setSource(e.target.value)} /></Field>
          <p className="lp-muted">Výběr streamu a automatická aktivace relace budou implementovány s backendem. Tento formulář nic nespouští.</p>
          <PanelButton disabled>Zahájit podle odkazu</PanelButton>
        </Surface></>}
        {section==='appearance'&&<><Surface title="Osobní preference" subtitle="Lokální nastavení bez vlivu na ostatní operátory">
          <div className="lp-kv"><span>Administrace</span><strong>Pouze téměř černé téma</strong></div>
          <div className="lp-kv"><span>Výchozí sloupce</span><strong>REŽIE 60 % · CHAT 40 %</strong></div>
          <Field label="Kompaktní zobrazení"><span className="lp-checkbox-line"><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/> Zapnout kompaktní rozestupy (náhled preference)</span></Field>
          <p className="lp-muted">Skutečné osobní preference budou později automaticky synchronizovány přes uživatelský účet. V tomto prototypu se nastavení neopírá o server.</p>
        </Surface><Surface title="Rozlišení a přístupnost">
          <div className="lp-list-row"><Monitor size={19}/><div><strong>Responzivní režie</strong><small>Na mobilu přepínání CHAT / REŽIE</small></div></div>
          <div className="lp-list-row"><LockKeyhole size={19}/><div><strong>Bezpečné ovládání</strong><small>Serverové potvrzení produkčních akcí dosud neexistuje</small></div></div>
        </Surface></>}
      </div>
    </div>
  </div>;
}

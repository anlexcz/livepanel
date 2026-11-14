import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Pause, Play, RotateCcw, Save, SkipForward, Upload } from 'lucide-react';
import { Buttons, DemoNotice, Field, PageHeading, PanelButton, Surface, UnsavedBar } from '../components/Ui';
import { useNavigationGuard } from '../components/Shell';
import { defaultIntro, defaultBreak, defaultPokec, demoRead, demoWrite, outroTemplates, parseSupporterNames, type BreakConfig, type IntroConfig, type OutroConfig, type SceneKind } from './sceneModel';
import ScenePreview, { countdownSeconds, timeLabel } from './ScenePreview';

type Configs={intro:IntroConfig;break:BreakConfig;outro:OutroConfig};
const defaults: Configs={intro:defaultIntro,break:defaultBreak,outro:defaultPokec};
const labels:Record<SceneKind,string>={intro:'INTRO',break:'BREAK',outro:'OUTRO'};
const load=():Configs=>({
  intro:demoRead('intro',defaultIntro),
  break:demoRead('break',defaultBreak),
  outro:demoRead('outro:pokec',defaultPokec),
});
function lineList(value:string){return value.split('\n').map(v=>v.trim()).filter(Boolean).slice(0,80);}
function Lines({label,value,onChange,onBlur,help}:{label:string;value:string[];onChange:(v:string[])=>void;onBlur:()=>void;help?:string}){
  const [text,setText]=useState(()=>value.join('\\n'));
  const normalized=value.join('\\n');
  useEffect(()=>setText(normalized),[normalized]);
  return <Field label={label} help={help}><textarea rows={4} value={text} onChange={e=>{setText(e.target.value);onChange(lineList(e.target.value));}} onBlur={onBlur}/></Field>;
}
export default function SceneEditor({kind}:{kind:SceneKind}) {
  const [saved,setSaved]=useState<Configs>(load);
  const [draft,setDraft]=useState<Configs>(load);
  const [preview,setPreview]=useState<Configs>(load);
  const [supporters,setSupporters]=useState<string[]>([]);
  const [supporterMessage,setSupporterMessage]=useState('');
  const [selectedTemplate]=useState('pokec');
  const [activeTemplate,setActiveTemplate]=useState(()=>demoRead('outro:active',{id:'pokec'}).id);
  const [notice,setNotice]=useState('');
  const [background,setBackground]=useState('dark');
  const [elapsed,setElapsed]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [started,setStarted]=useState(false);
  const [breakDuration,setBreakDuration]=useState(()=>countdownSeconds(defaultBreak));
  const layoutRef=useRef<HTMLDivElement>(null);
  const clockRef=useRef<number|null>(null);
  const [resizing,setResizing]=useState(false);
  const [formWidth,setFormWidth]=useState(()=>{
    const value=Number(localStorage.getItem('livepanel:scene-form-width'));
    return value>=30&&value<=70?value:40;
  });
  const dirty=useMemo(()=>JSON.stringify(saved[kind])!==JSON.stringify(draft[kind]),[saved,draft,kind]);
  const config=preview[kind];
  const template=outroTemplates.find(t=>t.id===selectedTemplate)||outroTemplates[0];
  const duration=kind==='break'?breakDuration:kind==='intro'?20:template.duration;
  const finished=kind!=='intro'&&Number.isFinite(duration)&&started&&elapsed>=duration;
  function edit<K extends SceneKind>(target:K,changes:Partial<Configs[K]>,commit=false){
    setDraft(v=>({...v,[target]:{...v[target],...changes}}));
    if(commit) setPreview(v=>({...v,[target]:{...v[target],...changes}}));
    setNotice('');
  }
  function commit(){
    setPreview(v=>({...v,[kind]:structuredClone(draft[kind])}));
  }
  function save(){
    const next=structuredClone(draft[kind]);
    if(!demoWrite(kind==='outro'?'outro:'+selectedTemplate:kind,next)) {
      setNotice('Uložení se nezdařilo: prohlížeč nepovolil lokální úložiště.');
      return;
    }
    setSaved(v=>({...v,[kind]:next}));setPreview(v=>({...v,[kind]:next}));
    setNotice('Demo konfigurace uložena pouze v tomto prohlížeči. OBS ani server se nezměnily.');
  }
  function discard(){
    const value=structuredClone(saved[kind]);
    setDraft(v=>({...v,[kind]:value}));setPreview(v=>({...v,[kind]:value}));
    setNotice('Rozpracované změny byly zahozeny.');
  }
  useNavigationGuard(dirty,save,discard);
  useEffect(()=>{
    if(!dirty)return;
    const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[dirty]);
  useEffect(()=>{
    localStorage.setItem('livepanel:scene-form-width',String(formWidth));
  },[formWidth]);
  useEffect(()=>{
    if(!resizing)return;
    const move=(e:PointerEvent)=>{
      const rect=layoutRef.current?.getBoundingClientRect();
      if(!rect||rect.width<1)return;
      setFormWidth(Math.max(30,Math.min(70,Math.round((e.clientX-rect.left)/rect.width*100))));
    };
    const stop=()=>setResizing(false);
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);
    return ()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};
  },[resizing]);
  useEffect(()=>{
    if(!playing)return;
    let last=Date.now();
    clockRef.current=window.setInterval(()=>{
      const now=Date.now();const delta=Math.max(0,(now-last)/1000);last=now;
      setElapsed(v=>v+delta);
    },100);
    return ()=>{if(clockRef.current!==null)window.clearInterval(clockRef.current);clockRef.current=null;};
  },[playing]);
  useEffect(()=>{
    if(!playing||kind==='intro')return;
    if(finished){setPlaying(false);setElapsed(duration);}
  },[playing,finished,duration,kind]);
  function play(){
    if(!started||finished){
      setElapsed(0);
      if(kind==='break')setBreakDuration(countdownSeconds(preview.break));
      setStarted(true);
    }
    setPlaying(true);
  }
  function resetPreview(){
    setPlaying(false);setStarted(false);setElapsed(0);
    if(kind==='break')setBreakDuration(countdownSeconds(preview.break));
  }
  function seek(value:number){setPlaying(false);setStarted(true);setElapsed(value);}
  async function importSupporters(file?:File){
    if(!file)return;
    try{
      const names=parseSupporterNames(await file.text());
      if(!names.length)throw Error('V importu nejsou žádná použitelná jména.');
      setSupporters(names);setSupporterMessage('Načteno '+names.length+' jmen pouze do paměti této stránky. Soukromé sloupce se zahazují; žádná data se nikam neodesílají.');
    }catch(e){setSupporterMessage(e instanceof Error?e.message:'CSV nelze zpracovat.');}
  }
  const intro=draft.intro, pause=draft.break, outro=draft.outro;
  return <div className="lp-page lp-scene-page">
    <PageHeading title={labels[kind]} description="Scénický editor · výhradně lokální testování, bez OBS" actions={<span className="lp-version-tag">DEMO NÁHLED</span>}/>
    <DemoNotice>Testovací animace a konfigurace jsou pouze v prohlížeči. Nejde o produkční Browser Source, skutečné zvukové stopy ani synchronizaci se serverem.</DemoNotice>
    <div className="lp-scene-columns" ref={layoutRef} style={{'--scene-form-width':formWidth+'%'} as CSSProperties}>
      <div className="column-resizer lp-scene-resizer" role="separator" tabIndex={0} aria-label="Šířka nastavení a náhledu" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={formWidth} title="Tažením upravit šířku, dvojklik vrátí 40:60" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();setResizing(true);}} onDoubleClick={()=>setFormWidth(40)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();setFormWidth(v=>Math.max(30,v-2));}if(e.key==='ArrowRight'){e.preventDefault();setFormWidth(v=>Math.min(70,v+2));}}}><span className="resize-grip"/></div>
      <div className="lp-scene-form">
        <Surface title="Nastavení" subtitle={kind==='intro'?'Univerzální úvodní scéna':kind==='break'?'Přestávková obrazovka':'Nezávislé šablony'}>
          {dirty&&<p className="lp-dirty-inline"><span/> Neuložené změny</p>}
          {kind==='intro'&&<Field label="Název pořadu (nepovinné)" help="Prázdné pole znamená pouze logo Metrobusu.">
            <input value={intro.title} placeholder="Bez názvu zobrazit pouze logo" onChange={e=>edit('intro',{title:e.target.value})} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
          </Field>}
          {kind==='break'&&<>
            <Field label="Nadpis" help="Při prázdném poli se zobrazí „Přestávka“."><input value={pause.title} onChange={e=>edit('break',{title:e.target.value})} onBlur={commit}/></Field>
            <Field label="Animované pozadí"><select value={pause.background} onChange={e=>edit('break',{background:e.target.value as BreakConfig['background']},true)}><option value="dark-glow">Tmavé pohybující se glow</option><option value="light-glow">Světlé pohybující se glow</option></select></Field>
            <label className="lp-checkbox-line"><input type="checkbox" checked={pause.showDetail} onChange={e=>edit('break',{showDetail:e.target.checked},true)}/> Zobrazovat doplňující text</label>
            {pause.showDetail&&<Field label="Doplňující text"><textarea rows={3} value={pause.detail} onChange={e=>edit('break',{detail:e.target.value})} onBlur={commit}/></Field>}
            <Field label="Režim odpočtu"><select value={pause.countdown} onChange={e=>edit('break',{countdown:e.target.value as BreakConfig['countdown']},true)}><option value="off">Bez odpočtu</option><option value="length">Pevná délka</option><option value="until">Do konkrétního času</option></select></Field>
            {pause.countdown==='length'&&<Field label="Délka odpočtu (minuty)"><input type="number" min="1" max="999" value={pause.minutes} onChange={e=>edit('break',{minutes:Number(e.target.value)})} onBlur={commit}/></Field>}
            {pause.countdown==='until'&&<Field label="Cílový čas (dnes, místní čas)" help="Pokud dnešní čas již uplynul, zobrazí se rovnou závěrečná zpráva."><input type="time" value={pause.until} onChange={e=>edit('break',{until:e.target.value},true)}/></Field>}
            {pause.countdown!=='off'&&<Field label="Text po skončení odpočtu"><input value={pause.ending} onChange={e=>edit('break',{ending:e.target.value})} onBlur={commit}/></Field>}
            <PanelButton onClick={()=>{edit('break',structuredClone(defaultBreak),true);resetPreview();}}><RotateCcw size={15}/> Obnovit výchozí (bez uložení)</PanelButton>
          </>}
          {kind==='outro'&&<>
            <Field label="Šablona"><select value={selectedTemplate} onChange={()=>{}}>{outroTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <p className="lp-muted">Registr je připravený pro nezávislé šablony. Nyní je dostupná jedna ověřená referenční šablona z {template.source}; automatické načítání složek vyžaduje server.</p>
            <div className="lp-subsection"><strong>Titulky a identita šablony</strong>
              <Field label="Horní značka"><input value={outro.titleTop} onChange={e=>edit('outro',{titleTop:e.target.value})} onBlur={commit}/></Field>
              <Field label="Název pořadu"><input value={outro.titleBottom} onChange={e=>edit('outro',{titleBottom:e.target.value})} onBlur={commit}/></Field>
            </div>
            <div className="lp-subsection"><strong>Účinkující</strong>
              <Field label="Nadpis seznamu"><input value={outro.guestsTitle} onChange={e=>edit('outro',{guestsTitle:e.target.value})} onBlur={commit}/></Field>
              <Lines label="Účinkující – jeden na řádek" value={outro.guests} onChange={guests=>edit('outro',{guests})} onBlur={commit}/>
            </div>
            <div className="lp-subsection"><strong>Sociální sítě a odkazy</strong>
              <Field label="Nadpis"><input value={outro.socialsTitle} onChange={e=>edit('outro',{socialsTitle:e.target.value})} onBlur={commit}/></Field>
              <Field label="Hlavní odkaz / účet"><input value={outro.socialLink} onChange={e=>edit('outro',{socialLink:e.target.value})} onBlur={commit}/></Field>
              <Field label="Výzva divákům"><input value={outro.ctaLeadTitle} onChange={e=>edit('outro',{ctaLeadTitle:e.target.value})} onBlur={commit}/></Field>
            </div>
            <div className="lp-subsection"><strong>Forendors</strong>
              <Field label="Doprovodný text"><textarea rows={3} value={outro.forendorsText} onChange={e=>edit('outro',{forendorsText:e.target.value})} onBlur={commit}/></Field>
              <Field label="Adresa Forendors"><input value={outro.forendorsUrl} onChange={e=>edit('outro',{forendorsUrl:e.target.value})} onBlur={commit}/></Field>
              <Field label="Nadpis podporovatelů"><input value={outro.supportersTitle} onChange={e=>edit('outro',{supportersTitle:e.target.value})} onBlur={commit}/></Field>
              <Field label="Poděkování"><input value={outro.supportersThanks} onChange={e=>edit('outro',{supportersThanks:e.target.value})} onBlur={commit}/></Field>
              <label className="lp-file-upload"><Upload size={16}/> Testovací import CSV – pouze místně<input type="file" accept=".csv,text/csv" onChange={e=>{void importSupporters(e.target.files?.[0]);e.target.value='';}}/></label>
              {supporterMessage&&<p className="lp-muted" role="status">{supporterMessage}</p>}
              {supporters.length>0&&<div className="lp-supporters-preview"><strong>Načtená jména ({supporters.length})</strong><p>{supporters.slice(0,20).join(' · ')}</p><PanelButton onClick={()=>{setSupporters([]);setSupporterMessage('Import byl z náhledu vymazán.');}}>Vymazat import</PanelButton></div>}
              <p className="lp-muted">CSV se neodesílá na server a importovaná jména se neukládají do localStorage. Produkční společný seznam Forendors bude řešen backendem.</p>
            </div>
            <div className="lp-subsection"><strong>Hlášky v patičce</strong>
              <Lines label="Hlášky – jedna na řádek" value={outro.easterEggs} onChange={easterEggs=>edit('outro',{easterEggs})} onBlur={commit}/>
              <Field label="Střídat po (sekundy)"><input type="number" min="3" max="120" value={outro.easterEggRotateSec} onChange={e=>edit('outro',{easterEggRotateSec:Number(e.target.value)})} onBlur={commit}/></Field>
              <Field label="Výrobní titulek"><input value={outro.footer} onChange={e=>edit('outro',{footer:e.target.value})} onBlur={commit}/></Field>
            </div>
            <div className="lp-subsection"><strong>Aktivní šablona (pouze demo)</strong>
              <p className="lp-muted">Aktivní: {activeTemplate}. Výběr šablony k úpravám sám o sobě nic neaktivuje.</p>
              <PanelButton primary onClick={()=>{setActiveTemplate(selectedTemplate);demoWrite('outro:active',{id:selectedTemplate});setNotice('Aktivní demo šablona uložena lokálně. OBS se nezměnilo.');}}>Nastavit jako aktivní (demo)</PanelButton>
            </div>
          </>}
          <Buttons><PanelButton onClick={discard} disabled={!dirty}>Zahodit</PanelButton><PanelButton primary onClick={save} disabled={!dirty}><Save size={15}/> Uložit (demo)</PanelButton></Buttons>
          {notice&&<p className="lp-local-confirm" role="status"><Check size={15}/>{notice}</p>}
        </Surface>
      </div>
      <div className="lp-scene-preview-column">
        <Surface title="Náhled" subtitle="Oddělený animovaný testovací přehrávač – nezávislý na OBS">
          <div className="lp-preview-toolbar"><span>Kontrolní podklad</span>
            <select aria-label="Kontrolní podklad" value={background} onChange={e=>setBackground(e.target.value)}>
              <option value="dark">Černý</option><option value="white">Bílý</option><option value="checker">Šachovnice</option><option value="sample">Zkušební scéna</option>
            </select>
          </div>
          <ScenePreview kind={kind} intro={preview.intro} pause={preview.break} outro={preview.outro} elapsed={elapsed} duration={duration} background={background} hasStarted={started} supporters={supporters}/>
          <div className="lp-preview-controls">
            <PanelButton onClick={()=>playing?setPlaying(false):play()}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pozastavit':finished?'Přehrát znovu':started?'Pokračovat':'Přehrát'}</PanelButton>
            <PanelButton onClick={resetPreview}><RotateCcw size={15}/> Reset</PanelButton>
            {kind==='break'&&preview.break.countdown!=='off'&&<PanelButton onClick={()=>{setStarted(true);setPlaying(false);setElapsed(duration);}}><SkipForward size={15}/> Konec</PanelButton>}
          </div>
          {kind==='intro'&&<p className="lp-muted">1,5 s úvodní prodleva → přibližně 20 s demonstrační animace → tichá smyčka. Schválená hudba a přesná synchronizace zatím nejsou k dispozici v tomto prototypu.</p>}
          {kind==='break'&&<p className="lp-muted">{preview.break.countdown==='off'?'Pozadí lze přehrávat libovolně dlouho bez odpočtu.':finished?'Odpočet skončil; scéna pokračuje bez automatického přepnutí.':'Zbývá '+timeLabel(Math.max(0,duration-elapsed))+' (lokální časovač náhledu).'}</p>}
          {kind==='outro'&&<><Field label={'Časová osa náhledu · '+timeLabel(elapsed)+' / '+timeLabel(duration)}>
            <input type="range" min="0" max={duration} step=".1" value={Math.min(duration,elapsed)} onChange={e=>seek(Number(e.target.value))}/>
          </Field><p className="lp-muted">Ukázková sekvence odvozená z členění referenčního OUTRO; nejde o převzatý přehrávač ani hotovou produkční animaci ze Studio repozitáře.</p></>}
        </Surface>
      </div>
    </div>
    {dirty&&<UnsavedBar onSave={save} onDiscard={discard}/>}
  </div>;
}

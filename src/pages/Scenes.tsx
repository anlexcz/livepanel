import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pause, Play, RotateCcw, Save, SkipForward } from 'lucide-react';
import { Buttons, DemoNotice, Field, PageHeading, PanelButton, Surface, UnsavedBar } from '../components/Ui';
import { useNavigationGuard } from '../components/Shell';
import { initialScenes, type SceneSettings, type SceneKind } from '../mock/scenes';

const labels: Record<SceneKind, string> = { intro: 'INTRO', break: 'BREAK', outro: 'OUTRO' };
function DisplayPreview({ kind, data, background, playing, finished }: { kind: SceneKind; data: SceneSettings; background: string; playing: boolean; finished: boolean }) {
  return <div className={'lp-preview lp-preview-' + background} aria-label="Lokální náhled scény (ilustrační)">
    <div className="lp-preview-content">
      <img src="/livepanel/assets/metrobus-white.png" alt="Metrobus" />
      {kind === 'intro' && data.title && <strong>{data.title}</strong>}
      {kind === 'break' && <><strong>{finished ? data.ending || 'Za chvíli pokračujeme' : data.title || 'Přestávka'}</strong>{data.detail && <span>{data.detail}</span>}{data.countdown !== 'off' && !finished && <b>{data.countdown === 'length' ? data.minutes + ':00' : data.until}</b>}</>}
      {kind === 'outro' && <><strong>{data.title}</strong><span>{data.presenter}</span><small>{data.social}</small></>}
      <small className="lp-preview-watermark">SIMULOVANÝ NÁHLED · {playing ? 'PŘEHRÁVÁNÍ' : 'POZASTAVENO'}</small>
    </div>
  </div>;
}
function SceneEditor({ kind }: { kind: SceneKind }) {
  const [saved, setSaved] = useState<SceneSettings>(initialScenes[kind]);
  const [draft, setDraft] = useState<SceneSettings>(initialScenes[kind]);
  const [preview, setPreview] = useState<SceneSettings>(initialScenes[kind]);
  const [previewBg, setPreviewBg] = useState('dark');
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeline, setTimeline] = useState(0);
  const [activeTemplate, setActiveTemplate] = useState('pokec');
  const [notice, setNotice] = useState('');
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  function save() { setSaved({...draft}); setPreview({...draft}); setNotice('Konfigurace byla uložena pouze v tomto prohlížeči (demo).'); }
  function discard() { setDraft({...saved}); setPreview({...saved}); setNotice('Rozpracované změny byly zahozena (demo).'); }
  useNavigationGuard(dirty, save, discard);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function change<K extends keyof SceneSettings>(key: K, value: SceneSettings[K], commitPreview = false) {
    setDraft(previous => ({ ...previous, [key]: value }));
    if (commitPreview) setPreview(previous => ({ ...previous, [key]: value }));
  }
  function commit<K extends keyof SceneSettings>(key: K) { setPreview(previous => ({...previous, [key]: draft[key]})); }
  const isOutro = kind === 'outro', isBreak = kind === 'break';
  return <div className="lp-page lp-scene-page">
    <PageHeading title={labels[kind]} description={'Scénický editor · pouze testovací náhled, bez spojení s OBS'} actions={<span className="lp-version-tag">UI PROTOTYP</span>} />
    <DemoNotice>Konfigurace a přehrávání jsou pouze lokální simulace. Náhled není skutečný OBS Browser Source a nezahrnuje produkční hudbu ani animaci.</DemoNotice>
    <div className="lp-scene-columns" ref={layoutRef} style={{'--scene-form-width':formWidth+'%'} as React.CSSProperties}>
      <div className="column-resizer lp-scene-resizer" role="separator" tabIndex={0} aria-label="Šířka formuláře scénického editoru" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={formWidth} title="Tažením upravit poměr; dvojklik obnoví 40:60" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();setResizing(true);}} onDoubleClick={()=>setFormWidth(40)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();setFormWidth(x=>Math.max(30,x-2));}if(e.key==='ArrowRight'){e.preventDefault();setFormWidth(x=>Math.min(70,x+2));}}}><span className="resize-grip"/></div>
      <div className="lp-scene-form">
        <Surface title="Nastavení" subtitle={kind === 'intro' ? 'Univerzální úvodní scéna' : isBreak ? 'Přestávková obrazovka' : 'Závěrečné šablony'}>
          {dirty && <p className="lp-dirty-inline"><span/> Neuložené změny</p>}
          {isOutro && <><Field label="Šablona">
            <select value={draft.template} onChange={e => change('template',e.target.value,true)}><option value="pokec">Pokec (ukázková šablona)</option><option value="expres">Expres (ukázková šablona)</option></select>
          </Field><p className="lp-muted">Šablony jsou zatím pouze demonstrativní. Produkční přehrávač není implementován.</p></>}
          <Field label={kind === 'intro' ? 'Název pořadu (nepovinné)' : isBreak ? 'Nadpis' : 'Závěrečný nadpis'}>
            <input value={draft.title} onChange={e=>change('title',e.target.value)} onBlur={()=>commit('title')} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} placeholder={kind === 'intro' ? 'Bez názvu zobrazit pouze logo' : 'Text'} />
          </Field>
          {isBreak && <><Field label="Pozadí">
            <select value={draft.background} onChange={e=>change('background',e.target.value as 'dark'|'light',true)}><option value="dark">Tmavé glow (koncept)</option><option value="light">Světlé glow (koncept)</option></select>
          </Field><Field label="Doplňující text"><textarea rows={3} value={draft.detail} onChange={e=>change('detail',e.target.value)} onBlur={()=>commit('detail')}/></Field>
          <Field label="Režim odpočtu"><select value={draft.countdown} onChange={e=>change('countdown',e.target.value as SceneSettings['countdown'],true)}><option value="off">Bez odpočtu</option><option value="length">Pevná délka</option><option value="until">Do konkrétního času</option></select></Field>
          {draft.countdown === 'length' && <Field label="Délka (minuty)"><input inputMode="numeric" type="number" min="1" max="999" value={draft.minutes} onChange={e=>change('minutes',e.target.value)} onBlur={()=>commit('minutes')}/></Field>}
          {draft.countdown === 'until' && <Field label="Cílový čas"><input type="time" value={draft.until} onChange={e=>change('until',e.target.value,true)}/></Field>}
          <Field label="Text po skončení odpočtu"><input value={draft.ending} onChange={e=>change('ending',e.target.value)} onBlur={()=>commit('ending')}/></Field></>}
          {isOutro && <><Field label="Účinkující"><input value={draft.presenter} onChange={e=>change('presenter',e.target.value)} onBlur={()=>commit('presenter')}/></Field>
          <Field label="Sociální sítě"><input value={draft.social} onChange={e=>change('social',e.target.value)} onBlur={()=>commit('social')}/></Field>
          <div className="lp-subsection"><strong>Aktivní šablona (demo)</strong><p className="lp-muted">Aktuálně vybrána: {activeTemplate}</p><Buttons><PanelButton primary onClick={()=>setActiveTemplate(draft.template)}>Nastavit jako aktivní (demo)</PanelButton></Buttons></div>
          <div className="lp-subsection"><strong>Forendors</strong><p className="lp-muted">Import podporovatelů bude dostupný po připojení backendu. Neodesílejte sem skutečné osobní údaje.</p><PanelButton disabled>Importovat CSV</PanelButton></div></>}
          <Buttons><PanelButton onClick={discard} disabled={!dirty}>Zahodit</PanelButton><PanelButton primary onClick={save} disabled={!dirty}><Save size={15}/> Uložit (demo)</PanelButton></Buttons>
          {notice && <p className="lp-local-confirm" role="status"><Check size={15}/>{notice}</p>}
        </Surface>
      </div>
      <div className="lp-scene-preview-column">
        <Surface title="Náhled" subtitle="Samostatný náhled bez vlivu na živou produkci">
          <div className="lp-preview-toolbar">
            <span>Testovací podklad</span>
            <select aria-label="Podklad náhledu" value={previewBg} onChange={e=>setPreviewBg(e.target.value)}>
              <option value="dark">Černý</option><option value="white">Bílý</option><option value="checker">Šachovnice</option><option value="sample">Zkušební scéna</option>
            </select>
          </div>
          <DisplayPreview kind={kind} data={preview} background={previewBg} playing={playing} finished={finished}/>
          <div className="lp-preview-controls">
            <PanelButton onClick={()=>setPlaying(!playing)}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? 'Pozastavit' : 'Přehrát'}</PanelButton>
            <PanelButton onClick={()=>{setPlaying(false);setFinished(false);setTimeline(0);setPreview({...draft});}}><RotateCcw size={15}/> Reset</PanelButton>
            {isBreak && <PanelButton onClick={()=>{setFinished(true);setPlaying(false);}}><SkipForward size={15}/> Konec</PanelButton>}
          </div>
          {isOutro && <Field label={'Časová osa náhledu: ' + timeline + ' s'}><input type="range" min="0" max="30" value={timeline} onChange={e=>setTimeline(Number(e.target.value))}/></Field>}
          {kind === 'intro' && <p className="lp-muted">Animace a hudební synchronizace budou dopracovány v navazující fázi. Tlačítka zde řídí pouze koncept náhledu.</p>}
        </Surface>
      </div>
    </div>
    {dirty && <UnsavedBar onSave={save} onDiscard={discard}/>}
  </div>;
}
export default SceneEditor;

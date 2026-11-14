import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProductionClient, ProductionCommandError, type ProductionAction, type ProductionView } from './client';
import './production.css';

export default function ProductionLive() {
  const clientRef=useRef<ProductionClient|null>(null);
  if(clientRef.current===null)clientRef.current=new ProductionClient();
  const client=clientRef.current;
  const [view,setView]=useState<ProductionView>(()=>client.current());
  const [streamId,setStreamId]=useState('');
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const unsubscribe=client.subscribe(setView);
    client.start();
    return ()=>{unsubscribe();client.stop();};
  },[client]);

  const snapshot=view.snapshot;
  const connected=view.status==='connected'&&snapshot!==null;
  const ready=connected&&!view.pending;
  const active=ready&&snapshot?.streamId!==null;
  const action=async(name:ProductionAction,payload:Record<string,unknown>={})=>{
    setError(null);
    try {await client.send(name,payload);}
    catch(reason) {
      const code=reason instanceof ProductionCommandError?reason.code:'UNKNOWN';
      setError(code==='REVISION_CONFLICT'?'Stav mezitím změnil jiný operátor. Ověř aktuální hodnoty.'
        :code==='DISCONNECTED'||code==='RESYNC_REQUIRED'?'Spojení bylo přerušeno. Vyčkej na aktuální snímek.'
        :code==='TIMEOUT'?'Potvrzení se ztratilo. Akci neposílej naslepo znovu.'
        :'Příkaz nebyl potvrzen serverem ('+code+').');
    }
  };
  const start=(event:FormEvent)=>{
    event.preventDefault();
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(streamId)) {
      setError('Identifikátor relace smí obsahovat pouze písmena, čísla, _ a -.');return;
    }
    void action('session.start',{streamId});
  };
  return <div className="lp-production-page">
    <div className="lp-production-heading">
      <h1>Živá režie · serverový stav</h1>
      <span className={'lp-production-status '+(connected?'online':'offline')} role="status">
        {connected?'Připojeno':view.status==='reconnecting'?'Obnovuji spojení…':'Čekám na server…'}
      </span>
    </div>
    <p className="lp-production-caution">První funkční režijní rozhraní. CHAT, FEATURED a EDITORIAL jsou zatím jen stavové reference bez YouTube Collectoru a OBS vykreslování. Ostatní stránky administrace zůstávají demonstrační.</p>
    {view.notice&&<p role="status">{view.notice}</p>}
    {error&&<p role="alert" className="lp-production-error">{error}</p>}
    {view.pending&&<p role="status">Čekám na potvrzení serveru…</p>}
    <div className="lp-production-grid">
      <section className="lp-production-panel">
        <h2>Vysílací relace</h2>
        <p>Revize: <strong>{snapshot?.revision??'—'}</strong></p>
        <p>Aktivní relace: <strong>{snapshot?.streamId??'Žádná'}</strong></p>
        {!snapshot?.streamId?<form onSubmit={start}>
          <label htmlFor="lp-stream-id">Identifikátor testovací relace</label>
          <input id="lp-stream-id" value={streamId} onChange={event=>setStreamId(event.target.value)}
            placeholder="např. zkouska_01" minLength={1} maxLength={128} required/>
          <button type="submit" disabled={!ready}>Založit relaci</button>
        </form>:<button type="button" disabled={!ready} onClick={()=>void action('session.stop')}>Ukončit relaci</button>}
      </section>
      <section className="lp-production-panel">
        <h2>CHAT</h2>
        <p>Serverový režim: <strong>{snapshot?.state.chat.mode??'—'}</strong></p>
        <div className="lp-production-actions">
          <button disabled={!active} onClick={()=>void action('chat.setMode',{mode:'enabled'})}>Zapnout</button>
          <button disabled={!active} onClick={()=>void action('chat.setMode',{mode:'paused'})}>Pozastavit</button>
          <button disabled={!active} onClick={()=>void action('chat.setMode',{mode:'disabled'})}>Vypnout</button>
        </div>
      </section>
      <section className="lp-production-panel">
        <h2>FEATURED</h2>
        <p>Aktivní zpráva: <strong>{snapshot?.state.featured.messageId??'Žádná'}</strong></p>
        <button disabled={!active||!snapshot?.state.featured.messageId} onClick={()=>void action('featured.hide')}>Skrýt zvýraznění</button>
        <p className="lp-production-note">Výběr konkrétní YouTube zprávy bude možný až po připojení collectoru a archivu.</p>
      </section>
      <section className="lp-production-panel">
        <h2>EDITORIAL</h2>
        <p>Aktivní titulek: <strong>{snapshot?.state.editorial.itemId??'Žádný'}</strong></p>
        <button disabled={!active||!snapshot?.state.editorial.itemId} onClick={()=>void action('editorial.hide')}>Skrýt titulek</button>
      </section>
      <section className="lp-production-panel">
        <h2>EVENT / TICKER</h2>
        <div className="lp-production-actions">
          <button type="button" disabled={!active||!!snapshot?.state.event.paused}
            onClick={()=>void action('event.pause')}>Pozastavit EVENT</button>
          <button type="button" disabled={!active||!snapshot?.state.event.paused}
            onClick={()=>void action('event.resume')}>Povolit EVENT</button>
        </div>
        <p>EVENT: {snapshot?.state.event.paused?'Pozastaven':'Nepozastaven'} · fronta {snapshot?.state.event.queue.length??'—'}</p>
        <p>TICKER: {snapshot?.state.ticker.status??'—'}</p>
        <p className="lp-production-note">EVENT lze ručně pozastavit či povolit. Fronta se zatím automaticky nepřehrává. TICKER zůstává pouze pro čtení.</p>
      </section>
    </div>
  </div>;
}

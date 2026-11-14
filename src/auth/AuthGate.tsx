import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { authClient, AuthRequestError, type DeviceSession, type OperatorIdentity } from './client';

type Status = 'checking' | 'anonymous' | 'authenticated' | 'unavailable';
type AuthGateProps = { children: (identity: OperatorIdentity, logout: () => Promise<void>) => ReactNode };
const unavailableText = 'Nepodařilo se ověřit přihlášení. Zkontroluj připojení k serveru.';

export default function AuthGate({ children }: AuthGateProps) {
  const [status,setStatus]=useState<Status>('checking');
  const [identity,setIdentity]=useState<OperatorIdentity|null>(null);
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [sessions,setSessions]=useState<DeviceSession[]|null>(null);
  const [currentPassword,setCurrentPassword]=useState('');
  const [nextPassword,setNextPassword]=useState('');

  const check = useCallback(async (signal?:AbortSignal) => {
    try {
      const response=await authClient.me(signal);
      if(signal?.aborted) return;
      setIdentity(response.user);
      setStatus('authenticated');
    } catch(error) {
      if(signal?.aborted) return;
      setIdentity(null);
      setSessions(null);
      setStatus(error instanceof AuthRequestError && error.status===401?'anonymous':'unavailable');
    }
  },[]);

  useEffect(()=>{
    const abort=new AbortController();
    void check(abort.signal);
    return ()=>abort.abort();
  },[check]);

  useEffect(()=>{
    const onFocus=()=>{ if(document.visibilityState==='visible') void check(); };
    document.addEventListener('visibilitychange',onFocus);
    window.addEventListener('focus',onFocus);
    return ()=>{
      document.removeEventListener('visibilitychange',onFocus);
      window.removeEventListener('focus',onFocus);
    };
  },[check]);

  const login=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy) return;
    setBusy(true);setMessage('');
    try {
      await authClient.login(username,password);
      setPassword('');
      await check();
    } catch(error) {
      setPassword('');
      setMessage(error instanceof AuthRequestError && error.status===429
        ? 'Příliš mnoho pokusů. Zkus to později.'
        : error instanceof AuthRequestError && error.status===401
          ? 'Nesprávné jméno nebo heslo.'
          : 'Přihlášení se nezdařilo. Ověř spojení se serverem.');
    } finally { setBusy(false); }
  };

  const logout=async()=>{
    setBusy(true);setMessage('');
    try {
      await authClient.logout();
      setIdentity(null);setSessions(null);setStatus('anonymous');
    } catch(error) {
      if(error instanceof AuthRequestError && error.status===401) {
        setIdentity(null);setSessions(null);setStatus('anonymous');
      } else setMessage('Odhlášení nebylo potvrzeno serverem.');
    } finally {setBusy(false);}
  };

  const listSessions=async()=>{
    setBusy(true);setMessage('');
    try {setSessions((await authClient.sessions()).sessions);}
    catch {setMessage('Přehled zařízení se nepodařilo načíst.');await check();}
    finally {setBusy(false);}
  };

  const revoke=async(id:string)=>{
    setBusy(true);setMessage('');
    try {
      await authClient.revoke(id);
      if(id===identity?.sessionId) {
        setIdentity(null);setSessions(null);setStatus('anonymous');
      } else {
        setSessions((await authClient.sessions()).sessions);
      }
    } catch {setMessage('Odhlášení zařízení nebylo potvrzeno serverem.');await check();}
    finally {setBusy(false);}
  };

  const changePassword=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setBusy(true);setMessage('');
    try {
      await authClient.changePassword(currentPassword,nextPassword);
      setCurrentPassword('');setNextPassword('');
      setIdentity(null);setSessions(null);setStatus('anonymous');
      setMessage('Heslo změněno. Přihlas se znovu na všech zařízeních.');
    } catch(error) {
      setMessage(error instanceof AuthRequestError && error.status===403
        ? 'Současné heslo není správné.' : 'Heslo se nepodařilo změnit.');
      await check();
    } finally {setBusy(false);}
  };

  if(status==='checking') return <main className="lp-auth-screen"><div className="lp-auth-card" role="status">Ověřuji přihlášení…</div></main>;
  if(status==='unavailable') return <main className="lp-auth-screen"><section className="lp-auth-card" role="alert"><h1>LivePanel není dostupný</h1><p>{unavailableText}</p><button type="button" onClick={()=>{setStatus('checking');void check();}}>Zkusit znovu</button></section></main>;
  if(status==='anonymous') return <main className="lp-auth-screen"><form className="lp-auth-card" onSubmit={event=>void login(event)}>
    <h1>Metrobus LivePanel</h1><p>Přihlášení operátora</p>
    <label htmlFor="lp-auth-name">Uživatelské jméno</label>
    <input id="lp-auth-name" autoComplete="username" name="username" required maxLength={48} value={username} onChange={event=>setUsername(event.target.value)}/>
    <label htmlFor="lp-auth-password">Heslo</label>
    <input id="lp-auth-password" type="password" name="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/>
    <button type="submit" disabled={busy}>{busy?'Přihlašuji…':'Přihlásit se'}</button>
    {message&&<p role="alert" className="lp-auth-message">{message}</p>}
  </form></main>;
  if(!identity) return null;

  return <div className="lp-authenticated">
    <div className="lp-auth-identity" aria-label="Přihlášený operátor">
      <strong>{identity.username}</strong>
      {identity.shared&&<span>sdílený účet</span>}
      <button type="button" disabled={busy} onClick={()=>void logout()}>Odhlásit</button>
      <button type="button" disabled={busy} onClick={()=>void listSessions()}>Zařízení</button>
      <details><summary>Změnit heslo</summary><form className="lp-auth-password-form" onSubmit={event=>void changePassword(event)}>
        <label>Současné heslo<input type="password" autoComplete="current-password" required value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label>
        <label>Nové heslo<input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={nextPassword} onChange={event=>setNextPassword(event.target.value)}/></label>
        <button type="submit" disabled={busy}>Uložit nové heslo</button>
      </form></details>
    </div>
    {message&&<p role="alert" className="lp-auth-global-message">{message}</p>}
    {sessions&&<section className="lp-auth-sessions" aria-label="Přihlášená zařízení"><h2>Aktivní relace</h2>
      {sessions.map(item=><div key={item.id}><span>{item.id===identity.sessionId?'Toto zařízení':'Jiné zařízení'} · {new Date(item.createdAtMs).toLocaleString('cs-CZ')}</span>
        <button type="button" disabled={busy} onClick={()=>void revoke(item.id)}>Odhlásit</button></div>)}
      <button type="button" onClick={()=>setSessions(null)}>Zavřít</button>
    </section>}
    {children(identity,logout)}
  </div>;
}

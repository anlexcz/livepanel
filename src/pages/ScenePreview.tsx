import type { BreakConfig, IntroConfig, OutroConfig, SceneKind } from './sceneModel';

export function countdownSeconds(config: BreakConfig): number {
  if (config.countdown === 'off') return Infinity;
  if (config.countdown === 'length') return Math.max(0, Math.floor(Number(config.minutes) * 60));
  const [h,m]=(config.until||'').split(':').map(Number);
  if (!Number.isInteger(h)||!Number.isInteger(m)||h<0||h>23||m<0||m>59) return 0;
  const now=new Date();const target=new Date(now);
  target.setHours(h,m,0,0);
  return Math.max(0,Math.ceil((target.getTime()-now.getTime())/1000));
}
export function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return '';
  const value=Math.max(0,Math.ceil(seconds));
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
type Props = {
  kind: SceneKind; intro: IntroConfig; pause: BreakConfig; outro: OutroConfig;
  elapsed: number; duration: number; background: string; hasStarted: boolean; playing: boolean;
  supporters: string[];
};
export default function ScenePreview({kind,intro,pause,outro,elapsed,duration,background,hasStarted,playing,supporters}: Props) {
  const introPhase = !hasStarted ? 'idle' : elapsed<1.5 ? 'delay' : elapsed<20 ? 'opening' : 'loop';
  const breakFinished=hasStarted && pause.countdown!=='off' && elapsed>=duration;
  const outroPhase=elapsed<6?'logo':elapsed<12?'guests':elapsed<18?'socials':elapsed<27?'supporters':'end';
  const introOpening=Math.min(1,Math.max(0,(elapsed-1.5)/1.3));
  const introPosition=Math.min(100,Math.max(0,(elapsed-1.5)/18.5*100));
  return <div className={'lp-preview lp-preview-'+background} aria-label="Samostatný lokální grafický náhled scény">
    {kind==='break'&&<div aria-hidden="true" className={'scene-glow scene-glow-'+pause.background}/>}
    <div className={'scene-art scene-art-'+kind+' '+(kind==='intro'?'scene-intro-'+introPhase:'')}>
      {kind==='intro'&&<div className="scene-intro-body" style={introPhase==='opening'?{opacity:introOpening,transform:'scale('+(0.94+0.06*introOpening)+')'}:undefined}>
        <div className="scene-intro-line" style={{width:introPhase==='opening'?introPosition+'%':introPhase==='delay'?'0%':'100%'}}/>
        <img className="scene-wordmark" src="/livepanel/assets/metrobus-white.png" alt="Metrobus"/>
        {intro.title.trim()&&<strong className="scene-intro-title">{intro.title}</strong>}
      </div>}
      {kind==='break'&&<div className="scene-break-body">
        <img className="scene-wordmark" src="/livepanel/assets/metrobus-white.png" alt="Metrobus"/>
        {breakFinished?<strong>{pause.ending.trim()||'Za chvíli pokračujeme'}</strong>:<>
          <strong>{pause.title.trim()||'Přestávka'}</strong>
          {pause.showDetail&&pause.detail.trim()&&<p>{pause.detail}</p>}
          {pause.countdown!=='off'&&<span className="scene-countdown" aria-label="Zbývající čas">{timeLabel(Math.max(0,duration-elapsed))}</span>}
        </>}
      </div>}
      {kind==='outro'&&<div className={'scene-outro-body scene-outro-'+outroPhase}>
        <div className="scene-outro-heading"><span>{outro.titleTop}</span><strong>{outro.titleBottom}</strong></div>
        {outroPhase==='guests'&&<div className="scene-outro-detail"><small>{outro.guestsTitle}</small><strong>{outro.guests.join(' · ')||'Bez účinkujících'}</strong></div>}
        {outroPhase==='socials'&&<div className="scene-outro-detail"><small>{outro.socialsTitle}</small><strong>{outro.socialLink}</strong><span>{outro.ctaLeadTitle}</span></div>}
        {outroPhase==='supporters'&&<div className="scene-outro-detail scene-outro-supporters"><small>{outro.supportersTitle}</small><strong>{supporters.length?supporters.slice(0,10).join(' · '):'Ukázka bez importovaných podporovatelů'}</strong><span>{outro.forendorsText}</span></div>}
        {outroPhase==='end'&&<div className="scene-outro-detail"><strong>{outro.supportersThanks}</strong><span>{outro.footer}</span></div>}
        {outro.easterEggs.length>0 && elapsed>6 && outroPhase!=='end' && <small className="scene-outro-egg">{outro.easterEggs[Math.floor(elapsed/Math.max(3,outro.easterEggRotateSec))%outro.easterEggs.length]}</small>}
      </div>}
    </div>
    <div className="scene-preview-label">TESTOVACÍ NÁHLED · BEZ OBS {kind==='intro'&&hasStarted?introPhase==='loop'?'· TICHÁ SMYČKA':'· ÚVODNÍ SEKVENCE':''}</div>
  </div>;
}

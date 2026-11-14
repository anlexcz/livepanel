import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, ChevronDown, Download, Info } from 'lucide-react';

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="lp-page-heading"><div><h1>{title}</h1>{description && <p className="lp-muted">{description}</p>}</div>{actions && <div className="lp-page-actions">{actions}</div>}</div>;
}
export function Surface({ title, subtitle, children, actions, className = '' }: { title?: string; subtitle?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return <section className={'lp-surface ' + className}>
    {(title || actions) && <div className="lp-surface-head"><div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div><div className="lp-head-actions">{actions}</div></div>}
    <div className="lp-surface-body">{children}</div>
  </section>;
}
export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="lp-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}
export function DemoNotice({ children }: { children?: ReactNode }) {
  return <div className="lp-demo-notice"><Info size={16}/><span>{children || 'Pouze lokální simulace. Změny se neukládají na server ani neposílají do OBS.'}</span></div>;
}
export function Status({ type, children }: { type: 'good' | 'warn' | 'error' | 'neutral'; children: ReactNode }) {
  return <span className={'lp-status lp-status-' + type}><span className="lp-status-dot"/>{children}</span>;
}
/** Read-only labelled setting or connection item, shared between admin sections. */
export function InfoRow({ icon: Icon, title, detail, trailing }: { icon: LucideIcon; title: string; detail: string; trailing?: ReactNode }) {
  return <div className="lp-list-row">
    <Icon size={19} aria-hidden="true"/>
    <div><strong>{title}</strong><small>{detail}</small></div>
    {trailing}
  </div>;
}
/** Uniform diagnostic metric: title, value/status and explanatory note. */
export function MetricCard({ icon: Icon, name, value, note, status }: { icon: LucideIcon; name: string; value: string; note: string; status: 'good'|'warn'|'error'|'neutral' }) {
  return <div className="lp-metric">
    <div className="lp-metric-top"><Icon size={19} aria-hidden="true"/><span>{name}</span></div>
    <Status type={status}>{value}</Status><small>{note}</small>
  </div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="lp-empty">{children}</p>;
}
export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div className="lp-error-notice"><AlertTriangle size={16}/>{children}</div>;
}
export function Buttons({ children }: { children: ReactNode }) { return <div className="lp-button-row">{children}</div>; }
export function PanelButton({ children, onClick, primary = false, danger = false, disabled = false, title }: { children: ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; title?: string }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={'lp-btn ' + (primary ? 'lp-btn-primary ' : '') + (danger ? 'lp-btn-danger' : '')}>{children}</button>;
}
export function UnsavedBar({ onSave, onDiscard }: { onSave: () => void; onDiscard: () => void }) {
  return <div className="lp-unsaved-bar"><span className="lp-unsaved-text"><AlertTriangle size={16}/> Neuložené změny</span><Buttons><PanelButton onClick={onDiscard}>Zahodit</PanelButton><PanelButton primary onClick={onSave}><Check size={15}/> Uložit (demo)</PanelButton></Buttons></div>;
}
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="lp-disclosure"><summary>{title}<ChevronDown size={16}/></summary><div>{children}</div></details>;
}
export function ExportButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <PanelButton onClick={onClick}><Download size={15}/>{children}</PanelButton>;
}

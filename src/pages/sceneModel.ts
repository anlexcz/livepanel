/** Local development-only scene configuration. Not an OBS production format. */
export type SceneKind = 'intro' | 'break' | 'outro';
export type IntroConfig = { title: string };
export type BreakConfig = {
  title: string; background: 'dark-glow' | 'light-glow';
  showDetail: boolean; detail: string; countdown: 'off' | 'length' | 'until';
  minutes: number; until: string; ending: string;
};
export type OutroConfig = {
  titleTop: string; titleBottom: string; guestsTitle: string;
  guests: string[]; socialsTitle: string; socialLink: string;
  ctaLeadTitle: string; forendorsText: string; forendorsUrl: string;
  supportersTitle: string; supportersThanks: string;
  easterEggs: string[]; easterEggRotateSec: number; footer: string;
};
export const defaultIntro: IntroConfig = { title: '' };
export const defaultBreak: BreakConfig = {
  title: 'Přestávka', background: 'dark-glow', showDetail: true,
  detail: 'Za chvíli jsme zpět.', countdown: 'off', minutes: 5,
  until: '21:00', ending: 'Za chvíli pokračujeme',
};
/** Field selection derived from anlexcz/studio/outro/settings.json, not a port of its renderer. */
export const defaultPokec: OutroConfig = {
  titleTop: 'METROBUS', titleBottom: 'POKEC',
  guestsTitle: 'V tomto díle vystoupili',
  guests: ['Jiří Trsek','Honza Škopek'],
  socialsTitle: 'Zůstaň na spoji.', socialLink: '@metrobuscz',
  ctaLeadTitle: 'Tohle není konečná!',
  forendorsText: 'Celý Pokec bez střihů a další díly na Forendors.',
  forendorsUrl: 'https://forendors.cz/metrobuscz',
  supportersTitle: 'Díky vám jedeme dál.',
  supportersThanks: 'Děkujeme za vaši podporu.',
  easterEggs: ['Toto outro obsahuje náhradní autobusovou dopravu.','Metrobus děkuje i nočním sovám.'],
  easterEggRotateSec: 15,
  footer: 'Vyrobil Metrobus ve svém studiu · 2026',
};
export type OutroTemplate = {
  id: string; name: string; source: string; duration: number;
  defaultConfig: OutroConfig;
};
export const outroTemplates: OutroTemplate[] = [{
  id: 'pokec', name: 'Pokec – referenční koncept', source: 'anlexcz/studio/outro',
  duration: 32, defaultConfig: defaultPokec,
}];
const prefix = 'livepanel:demo-scene:';
export function demoRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return structuredClone(fallback);
    return {...structuredClone(fallback),...parsed};
  } catch { return structuredClone(fallback); }
}
export function demoWrite<T>(key: string, value: T): boolean {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
/** CSV import stays in this browser memory; do not store raw Forendors exports. */
export function parseSupporterNames(csv: string): string[] {
  if (csv.length > 1024 * 1024) throw Error('Soubor je příliš velký (max. 1 MB).');
  const firstLine = csv.split(/\r?\n/, 1)[0] || '';
  const separator = (firstLine.match(/;/g)||[]).length >= (firstLine.match(/,/g)||[]).length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i=0; i<csv.length; i++) {
    const ch=csv[i];
    if (ch === '"') { if (quoted && csv[i+1]==='"') { cell += '"'; i++; } else quoted=!quoted; }
    else if (ch===separator && !quoted) { row.push(cell); cell=''; }
    else if ((ch==='\n' || ch==='\r') && !quoted) {
      if(ch==='\r' && csv[i+1]==='\n')i++;
      row.push(cell); rows.push(row); row=[]; cell='';
      if(rows.length > 2000) throw Error('Příliš mnoho řádků.');
    } else cell+=ch;
  }
  if (quoted) throw Error('Neplatné CSV – neuzavřené uvozovky.');
  if (cell || row.length) { row.push(cell);rows.push(row); }
  const normalized=(s:string)=>s.trim().replace(/^\uFEFF/,'').toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const heads=(rows[0]||[]).map(normalized);
  const index=heads.findIndex(h=>['jmeno','jmeno a prijmeni','prezdivka','zobrazovane jmeno','name','display name','nickname','uzivatel'].includes(h));
  if (index<0) throw Error('CSV nemá rozpoznaný sloupec jména či přezdívky. Nic nebylo importováno.');
  return Array.from(new Set(rows.slice(1).map(r=>(r[index]||'').trim()).filter(x=>x && x.length<=100))).slice(0,500);
}

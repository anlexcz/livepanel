export type ArchiveItem = { id: string; date: string; source: string; kind: 'Komentář' | 'Super Chat' | 'Členství'; author: string; content: string; featuredShown?: boolean };
export const sampleArchive: ArchiveItem[] = [
  { id:'a01',date:'2026-11-10T18:01:00',source:'Nový grafikon se blíží',kind:'Komentář',author:'Petr Novotný',content:'Zdravím všechny ve studiu!' },
  { id:'a02',date:'2026-11-10T18:02:00',source:'Nový grafikon se blíží',kind:'Komentář',author:'Dopravní nadšenec',content:'Budete řešit i změny v prosincovém grafikonu?' },
  { id:'a03',date:'2026-11-10T18:07:00',source:'Nový grafikon se blíží',kind:'Super Chat',author:'Dopravák',content:'Díky za přenos – 100 Kč' },
  { id:'a04',date:'2026-11-10T18:12:00',source:'Nový grafikon se blíží',kind:'Členství',author:'Martina',content:'Nové členství' },
  { id:'a05',date:'2026-11-10T19:14:00',source:'Nový grafikon se blíží',kind:'Komentář',author:'Honza Š.',content:'A co nová tramvaj 52T?' },
  { id:'a06',date:'2026-11-08T18:30:00',source:'Nedělní dopravní pokec',kind:'Komentář',author:'Lucie',content:'Díky za zpracování tématu.' },
  { id:'a07',date:'2026-11-08T18:40:00',source:'Nedělní dopravní pokec',kind:'Komentář',author:'Metrofan',content:'Pozdrav ze Smíchova.' },
];

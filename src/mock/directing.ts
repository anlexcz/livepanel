export type EventItem = { id: string; type: 'Super Chat' | 'Členství' | 'Super Sticker'; author: string; detail: string };
export type TickerItem = { id: string; text: string; enabled: boolean };
export type EditorialItem = { id: string; heading: string; subheading: string };
export const initialEvents: EventItem[] = [
  {id:'evt-1', type:'Super Chat',author:'Dopravák',detail:'100 Kč · Děkujeme za přenos!'},
  {id:'evt-2', type:'Členství',author:'Martina',detail:'Nový člen Metrobusu'},
];
export const initialTicker: TickerItem[] = [
  {id:'tick-1', text:'Připravují se změny železničního grafikonu.',enabled:true},
  {id:'tick-2', text:'Děkujeme za sledování Metrobusu.',enabled:true},
  {id:'tick-3', text:'Sledujte nás na sociálních sítích.',enabled:false},
];
export const initialEditorial: EditorialItem[] = [
  {id:'edit-1',heading:'Nový grafikon',subheading:'Prosinec 2026'},
  {id:'edit-2',heading:'Modernizace tramvají',subheading:'52T a vozy T3'},
];

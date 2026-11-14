export type Message = { id: string; author: string; text: string; time: string; favorite: boolean; featuredShown?: boolean; role?: 'moderator' | 'member' };
export type Category = 'FEATURED' | 'EVENT' | 'TICKER' | 'EDITORIAL';
export const initialMessages: Message[] = [
  { id: 'm1', author: 'Petr Novotný', text: 'Zdravím všechny, těším se na dnešní vysílání!', time: '19:00', favorite: false },
  { id: 'm2', author: 'Dopravní nadšenec', text: 'Budete řešit i změny v prosincovém grafikonu?', time: '19:01', favorite: true },
  { id: 'm3', author: 'Kateřina H.', text: 'Ta nová tramvaj vypadá fakt zajímavě.', time: '19:02', favorite: false, role: 'member' },
  { id: 'm4', author: 'Jan Šimek', text: 'Jak to bude s přestupy na Smíchově?', time: '19:03', favorite: true },
  { id: 'm5', author: 'Metrofan', text: 'Díky za vysvětlení, zdravím režii.', time: '19:04', favorite: false },
  { id: 'm6', author: 'Tomáš D.', text: 'Půjde dnes řeč také na nové linkové vedení?', time: '19:05', favorite: false },
  { id: 'm7', author: 'Lucie', text: 'Sleduju z vlaku, obraz i zvuk jsou v pořádku.', time: '19:06', favorite: false },
];
export const categories: Category[] = ['FEATURED', 'EVENT', 'TICKER', 'EDITORIAL'];
export const mockStatus = { session: 'Ukázkové vysílání', collector: 'Simulovaný příjem', overlay: 'Bez spojení s OBS' };

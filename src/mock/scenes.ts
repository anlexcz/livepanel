export type SceneKind = 'intro' | 'break' | 'outro';
export type SceneSettings = {
  title: string; detail: string; background: 'dark' | 'light'; countdown: 'off' | 'length' | 'until';
  minutes: string; until: string; ending: string; template: string; presenter: string; social: string;
};
export const initialScenes: Record<SceneKind, SceneSettings> = {
  intro: { title: '', detail: '', background: 'dark', countdown: 'off', minutes: '5', until: '21:00', ending: '', template: '', presenter: '', social: '' },
  break: { title: 'Přestávka', detail: 'Za chvíli jsme zpět.', background: 'dark', countdown: 'off', minutes: '5', until: '21:00', ending: 'Za chvíli pokračujeme', template: '', presenter: '', social: '' },
  outro: { title: 'Děkujeme za sledování', detail: '', background: 'dark', countdown: 'off', minutes: '5', until: '21:00', ending: '', template: 'pokec', presenter: 'Honza Škopek', social: '@metrobuscz' },
};

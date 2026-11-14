import type { ProductionSnapshot } from '../production/store.js';

export type Action =
  | 'session.start' | 'session.stop'
  | 'chat.setMode'
  | 'featured.show' | 'featured.hide'
  | 'editorial.show' | 'editorial.hide';

export type Command = {
  type: 'COMMAND';
  commandId: string;
  action: Action;
  payload: Record<string, unknown>;
  expectedRevision?: number;
};

export type Result = {
  type: 'RESULT';
  commandId: string;
  ok: boolean;
  revision: number;
  error?: 'INVALID_COMMAND' | 'REVISION_CONFLICT' | 'INVALID_STATE' | 'COMMAND_ID_REUSED' | 'PERSISTENCE_ERROR';
};
export type Update = { type: 'UPDATE'; revision: number; category: 'session' | 'chat' | 'featured' | 'editorial'; value: unknown };
export type Snapshot = { type: 'SNAPSHOT'; revision: number; state: ProductionSnapshot };

const actions: Action[] = ['session.start','session.stop','chat.setMode','featured.show','featured.hide','editorial.show','editorial.hide'];
const fields = (value: Record<string, unknown>, expected: string[]): boolean =>
  Object.keys(value).sort().join(',') === [...expected].sort().join(',');

export function decodeCommand(raw: unknown): Command | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const object = raw as Record<string, unknown>;
  if (!('payload' in object) || !('action' in object) || !('commandId' in object)) return null;
  if (Object.keys(object).some(key => !['type','commandId','action','payload','expectedRevision'].includes(key))) return null;
  if (object.type !== 'COMMAND' || typeof object.commandId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,128}$/.test(object.commandId) ||
      typeof object.action !== 'string' || !actions.includes(object.action as Action) ||
      !object.payload || typeof object.payload !== 'object' || Array.isArray(object.payload)) return null;
  const rev = object.expectedRevision;
  if (rev !== undefined && (typeof rev !== 'number' || !Number.isSafeInteger(rev) || rev < 0)) return null;
  const p = object.payload as Record<string, unknown>;
  switch (object.action) {
    case 'session.start':
      if (!fields(p,['streamId']) || typeof p.streamId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.streamId)) return null;
      break;
    case 'chat.setMode':
      if (!fields(p,['mode']) || !['enabled','paused','disabled'].includes(String(p.mode))) return null;
      break;
    case 'featured.show':
      if (!fields(p,['messageId','expiresAtMs']) || typeof p.messageId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(p.messageId) ||
          typeof p.expiresAtMs !== 'number' || !Number.isSafeInteger(p.expiresAtMs) || p.expiresAtMs < 0) return null;
      break;
    case 'editorial.show':
      if (!fields(p,['itemId']) || typeof p.itemId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(p.itemId)) return null;
      break;
    default:
      if (!fields(p,[])) return null;
  }
  return object as Command;
}

export function categoryFor(action: Action): Update['category'] {
  if (action.startsWith('session.')) return 'session';
  if (action.startsWith('chat.')) return 'chat';
  if (action.startsWith('featured.')) return 'featured';
  return 'editorial';
}

export function updateFromSnapshot(category: Update['category'], current: ProductionSnapshot): Update {
  return {
    type: 'UPDATE', revision: current.revision, category,
    value: category === 'session' ? { streamId: current.streamId, state: current.state }
      : current.state[category],
  };
}

/** Only these fields are safe for the eventual public OBS transport. */
export function publicProjection(snapshot: ProductionSnapshot) {
  return {
    revision: snapshot.revision,
    active: snapshot.streamId !== null,
    state: {
      chat: { mode: snapshot.state.chat.mode },
      featured: { active: snapshot.state.featured.messageId !== null },
      event: { paused: snapshot.state.event.paused },
      ticker: { status: snapshot.state.ticker.status },
      editorial: { active: snapshot.state.editorial.itemId !== null },
    },
  };
}

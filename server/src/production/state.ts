/**
 * Internal state model, intentionally not a public HTTP or WebSocket contract.
 * No YouTube chat archive or operator preferences belong here.
 */
export type ProductionState = {
  chat: { mode: 'enabled' | 'paused' | 'disabled' };
  featured: { messageId: string | null; expiresAtMs: number | null };
  event: { queue: string[]; paused: boolean };
  ticker: { status: 'stopped' | 'running' | 'paused'; position: number };
  editorial: { itemId: string | null };
};

export function initialProductionState(): ProductionState {
  return {
    chat: { mode: 'disabled' },
    featured: { messageId: null, expiresAtMs: null },
    event: { queue: [], paused: false },
    ticker: { status: 'stopped', position: 0 },
    editorial: { itemId: null },
  };
}

export function validateProductionState(value: unknown): asserts value is ProductionState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Production State');
  const state = value as Record<string, unknown>;
  const record = (part: unknown): Record<string, unknown> => {
    if (!part || typeof part !== 'object' || Array.isArray(part)) throw new Error('Invalid Production State section');
    return part as Record<string, unknown>;
  };
  const keys = (obj: Record<string, unknown>, expected: string[]): void => {
    if (Object.keys(obj).sort().join(',') !== [...expected].sort().join(',')) throw new Error('Unexpected Production State fields');
  };
  keys(state, ['chat','featured','event','ticker','editorial']);
  const chat = record(state.chat);
  keys(chat, ['mode']);
  if (typeof chat.mode !== 'string' || !['enabled','paused','disabled'].includes(chat.mode)) throw new Error('Invalid chat mode');
  const featured = record(state.featured);
  keys(featured, ['messageId','expiresAtMs']);
  if (featured.messageId !== null && (typeof featured.messageId !== 'string' || !featured.messageId.trim())) throw new Error('Invalid featured message ID');
  if (featured.expiresAtMs !== null && (typeof featured.expiresAtMs !== 'number' || !Number.isSafeInteger(featured.expiresAtMs) || featured.expiresAtMs < 0)) throw new Error('Invalid featured expiry');
  if ((featured.messageId === null) !== (featured.expiresAtMs === null)) throw new Error('Featured reference and expiry must both be set or both null');
  const event = record(state.event);
  keys(event, ['queue','paused']);
  if (!Array.isArray(event.queue) || event.queue.some((item: unknown) => typeof item !== 'string' || !item.trim()) || typeof event.paused !== 'boolean') throw new Error('Invalid event queue');
  const ticker = record(state.ticker);
  keys(ticker, ['status','position']);
  if (typeof ticker.status !== 'string' || !['stopped','running','paused'].includes(ticker.status)) || typeof ticker.position !== 'number' || !Number.isSafeInteger(ticker.position) || ticker.position < 0) throw new Error('Invalid ticker');
  const editorial = record(state.editorial);
  keys(editorial, ['itemId']);
  if (editorial.itemId !== null && (typeof editorial.itemId !== 'string' || !editorial.itemId.trim())) throw new Error('Invalid editorial reference');
}

/** Expiration uses an absolute wall-clock timestamp so restart never restarts a timer. */
export function reconcileExpired(state: ProductionState, nowMs: number): ProductionState {
  if (state.featured.expiresAtMs !== null && state.featured.expiresAtMs <= nowMs) {
    return { ...state, featured: { messageId: null, expiresAtMs: null } };
  }
  return state;
}

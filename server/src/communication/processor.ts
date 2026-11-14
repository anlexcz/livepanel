import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { initialProductionState } from '../production/state.js';
import { ProductionStore, RevisionConflictError, type ProductionSnapshot } from '../production/store.js';
import {
  categoryFor, decodeCommand, updateFromSnapshot,
  type Command, type Result, type Update,
} from './protocol.js';

type Subscriber = (update: Update) => void;
type CacheRow = { request_hash: string; result_json: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export class CommandProcessor {
  private subscribers = new Set<Subscriber>();
  constructor(private readonly db: Database.Database, private readonly store: ProductionStore,
    private readonly clock: () => number = Date.now) {}

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /** Call only after an authenticated/authorized transport boundary. */
  execute(candidate: unknown): Result {
    const command = decodeCommand(candidate);
    const fallbackId = candidate && typeof candidate === 'object' && 'commandId' in candidate &&
      typeof candidate.commandId === 'string' && candidate.commandId.length <= 128 ? candidate.commandId : '';
    let revision: number;
    try {
      revision = this.store.read().revision;
    } catch {
      return {type:'RESULT',commandId:fallbackId,ok:false,revision:0,error:'PERSISTENCE_ERROR'};
    }
    if (!command) return {type:'RESULT',commandId:fallbackId,ok:false,revision,error:'INVALID_COMMAND'};

    const { commandId } = command;
    const hash = createHash('sha256').update(canonical({
      action:command.action, payload:command.payload, expectedRevision:command.expectedRevision ?? null,
    })).digest('hex');
    let changedSnapshot: ProductionSnapshot | null = null;
    let beforeSnapshot: ProductionSnapshot | null = null;
    try {
      const transaction = this.db.transaction((): Result => {
        const previous = this.db.prepare('SELECT request_hash, result_json FROM production_commands WHERE command_id = ?')
          .get(commandId) as CacheRow | undefined;
        if (previous) {
          if (previous.request_hash !== hash) {
            return {type:'RESULT',commandId,ok:false,revision:this.store.read().revision,error:'COMMAND_ID_REUSED'};
          }
          return JSON.parse(previous.result_json) as Result;
        }

        const before = this.store.read();
        const currentRevision = before.revision;
        let result: Result;
        try {
          const after = this.apply(command);
          beforeSnapshot = before;
          changedSnapshot = after;
          result = {type:'RESULT',commandId,ok:true,revision:after.revision};
        } catch (error) {
          if (error instanceof RevisionConflictError) {
            result = {type:'RESULT',commandId,ok:false,revision:currentRevision,error:'REVISION_CONFLICT'};
          } else if (error instanceof Error && error.message.startsWith('INVALID_STATE')) {
            result = {type:'RESULT',commandId,ok:false,revision:currentRevision,error:'INVALID_STATE'};
          } else {
            throw error;
          }
        }
        this.db.prepare('INSERT INTO production_commands (command_id,request_hash,result_json,created_at_ms) VALUES (?,?,?,?)')
          .run(commandId,hash,JSON.stringify(result),this.clock());
        return result;
      });
      const result = transaction();
      if (changedSnapshot && beforeSnapshot && result.ok) {
        const before: ProductionSnapshot = beforeSnapshot;
        const after: ProductionSnapshot = changedSnapshot;
        // Exactly one UPDATE per persisted revision. If a command also expires
        // another category, send the full session state to avoid revision gaps.
        let category: Update['category'] = categoryFor(command.action);
        if (before.streamId !== after.streamId) {
          category = 'session';
        } else if (category !== 'session') {
          for (const part of ['chat','featured','editorial','event','ticker'] as const) {
            if (part !== category && JSON.stringify(before.state[part]) !== JSON.stringify(after.state[part])) {
              category = 'session';
              break;
            }
          }
        }
        const update = updateFromSnapshot(category, after);
        for (const subscriber of this.subscribers) {
          try { subscriber(update); } catch { /* commit has already succeeded */ }
        }
      }
      return result;
    } catch {
      return {type:'RESULT',commandId,ok:false,revision,error:'PERSISTENCE_ERROR'};
    }
  }

  private apply(command: Command): ProductionSnapshot {
    const p = command.payload;
    const expected = command.expectedRevision;
    switch (command.action) {
      case 'session.start':
        return this.store.update(current => {
          if (current.streamId !== null) throw new Error('INVALID_STATE already active');
          return {streamId:p.streamId as string,state:initialProductionState()};
        },expected);
      case 'session.stop':
        if (this.store.read().streamId === null) throw new Error('INVALID_STATE no active session');
        return this.store.clearSession(expected);
      default:
        return this.store.update(current => {
          if (current.streamId === null) throw new Error('INVALID_STATE no active session');
          const state = current.state;
          switch(command.action) {
            case 'chat.setMode':
              return {state:{...state,chat:{mode:p.mode as 'enabled'|'paused'|'disabled'}}};
            case 'featured.show':
              if ((p.expiresAtMs as number) <= this.clock()) throw new Error('INVALID_STATE expiry must be in future');
              return {state:{...state,featured:{messageId:p.messageId as string,expiresAtMs:p.expiresAtMs as number}}};
            case 'featured.hide':
              return {state:{...state,featured:{messageId:null,expiresAtMs:null}}};
            case 'editorial.show':
              return {state:{...state,editorial:{itemId:p.itemId as string}}};
            case 'editorial.hide':
              return {state:{...state,editorial:{itemId:null}}};
            default:
              throw new Error('INVALID_STATE unsupported action');
          }
        },expected);
    }
  }
}

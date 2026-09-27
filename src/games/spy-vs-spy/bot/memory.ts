import { rand, type RngState } from '../../../shared/rng';
import type { DeathCause, GameEvent, RemedyKind, SecretKind, TrapKind } from '../logic/state';
import { type Iq, IQ_PARAMS } from './iq';
import type { BotView, Glance } from './view';

/** What the bot knows about one piece of furniture, from a search or from a fixture's look (spec bot §4). */
export type PieceNote =
  | { kind: 'empty' }
  | { kind: 'remedy'; remedy: RemedyKind }
  | { kind: 'item'; thing: 'secret' | 'kufrik'; secret?: SecretKind }
  | { kind: 'fixture'; remedy: RemedyKind }
  | { kind: 'armoury' };

/** A place he learned to fear: a piece, a door, or (for a timed bomb) the whole room. */
export interface Danger {
  at: { piece: number } | { door: string } | { room: number };
  cause: DeathCause | TrapKind;
  since: number;
}

/** Passed into `remember` because a `died` event carries no piece/door, and the view has no search target — the
 * bot's own intent (what he was doing this tick) is the fair source for where the danger sits. */
export interface RememberContext {
  /** `p:<id>` | `d:<key>` | `f:<room>`, matching `Memory.ownTraps`' keys — the target of a trap the bot just placed. */
  pendingTrapTarget: string | null;
  /** the piece id he was searching or about to search, for a furniture-trap death. */
  searching: number | null;
  /** the door key he was opening or passing, for a door-trap death. */
  door: string | null;
}

/** The bot's notebook (spec bot §4): everything he has learned, decaying per `forget`. */
export interface Memory {
  /** piece id → what he found there, and when. */
  pieces: Map<number, { room: number; note: PieceNote; at: number }>;
  /** room → time seen as a dot on the paid map. */
  itemRoomsSeen: Map<number, number>;
  /** `p:<pieceId>` | `d:<doorKey>` | `f:<room>` → kind — his own traps, which he avoids. */
  ownTraps: Map<string, TrapKind>;
  dangers: Danger[];
  lastGlance: (Glance & { at: number }) | null;
  lastSeenOpponent: { room: number; at: number } | null;
  /** searches since the last map use. */
  searchedCount: number;
  foundSinceMap: number;
}

export function createMemory(): Memory {
  return {
    pieces: new Map(),
    itemRoomsSeen: new Map(),
    ownTraps: new Map(),
    dangers: [],
    lastGlance: null,
    lastSeenOpponent: null,
    searchedCount: 0,
    foundSinceMap: 0,
  };
}

const FURNITURE_TRAPS: readonly DeathCause[] = ['bomba', 'pruzina'];
const DOOR_TRAPS: readonly DeathCause[] = ['elektrina', 'pistole'];

/** Updates the notebook from this tick's view and the noticed events (search results, own traps set, deaths, disarms). */
export function remember(mem: Memory, view: BotView, events: readonly GameEvent[], ctx: RememberContext): void {
  const time = view.time;
  const room = view.self.room;

  // Fixtures give themselves away by their look, no search needed.
  for (const p of view.pieces) {
    if (p.source !== null) mem.pieces.set(p.id, { room, note: { kind: 'fixture', remedy: p.source }, at: time });
  }

  for (const e of events) {
    if ('spy' in e && e.spy !== view.self.id) continue;
    switch (e.type) {
      case 'found': {
        let note: PieceNote;
        if (e.thing === null) note = { kind: 'empty' };
        else if (e.thing.kind === 'remedy') note = { kind: 'remedy', remedy: e.thing.remedy };
        else if (e.thing.kind === 'secret') note = { kind: 'item', thing: 'secret', secret: e.thing.secret };
        else note = { kind: 'item', thing: 'kufrik' };
        mem.pieces.set(e.furniture, { room, note, at: time });
        mem.searchedCount++;
        if (e.thing !== null && e.thing.kind !== 'remedy') mem.foundSinceMap++;
        break;
      }
      case 'alreadyHave':
        // The event doesn't say which kind (round 6 §3: it stays hidden) — only that it was a loose secret.
        mem.pieces.set(e.furniture, { room, note: { kind: 'item', thing: 'secret' }, at: time });
        mem.searchedCount++;
        mem.foundSinceMap++;
        break;
      case 'resupplied':
        mem.pieces.set(e.furniture, { room, note: { kind: 'armoury' }, at: time });
        break;
      case 'trapSet':
        if (ctx.pendingTrapTarget !== null) mem.ownTraps.set(ctx.pendingTrapTarget, e.trap);
        break;
      case 'died':
        if (FURNITURE_TRAPS.includes(e.cause) && ctx.searching !== null) {
          mem.dangers.push({ at: { piece: ctx.searching }, cause: e.cause, since: time });
        } else if (DOOR_TRAPS.includes(e.cause) && ctx.door !== null) {
          mem.dangers.push({ at: { door: ctx.door }, cause: e.cause, since: time });
        } else if (e.cause === 'casovana') {
          mem.dangers.push({ at: { room }, cause: e.cause, since: time });
        }
        break;
      case 'mapOpened':
        mem.searchedCount = 0;
        mem.foundSinceMap = 0;
        break;
      default:
        break;
    }
  }

  if (view.opponent !== null) mem.lastSeenOpponent = { room, at: time };
  if (view.glance !== null) mem.lastGlance = { ...view.glance, at: time };
  if (view.itemRooms !== null) for (const r of view.itemRooms) mem.itemRoomsSeen.set(r, time);
}

/** Fades entries per IQ (`forgetPerMinute`, `forgetOwnTraps`) using the bot RNG. */
export function forget(mem: Memory, iq: Iq, dt: number, rng: RngState): void {
  const params = IQ_PARAMS[iq];
  if (params.forgetPerMinute <= 0) return;
  const chance = params.forgetPerMinute * (dt / 60);

  for (const key of [...mem.pieces.keys()]) if (rand(rng) < chance) mem.pieces.delete(key);
  for (const key of [...mem.itemRoomsSeen.keys()]) if (rand(rng) < chance) mem.itemRoomsSeen.delete(key);
  mem.dangers = mem.dangers.filter(() => rand(rng) >= chance);
  if (mem.lastGlance !== null && rand(rng) < chance) mem.lastGlance = null;
  if (mem.lastSeenOpponent !== null && rand(rng) < chance) mem.lastSeenOpponent = null;

  if (params.forgetOwnTraps) {
    for (const key of [...mem.ownTraps.keys()]) if (rand(rng) < chance) mem.ownTraps.delete(key);
  }
}

import { rand, type RngState } from '../../../shared/rng';
import type { DeathCause, GameEvent, RemedyKind, SecretKind, Thing, TrapKind } from '../logic/state';
import { type Iq, IQ_PARAMS } from './iq';
import type { BotView, Glance } from './view';

/** What the bot knows one piece of furniture holds now, from a search, from what he put or dropped into it, or from a
 *  fixture's look (spec bot §4). A piece he took an item from is `empty` — the item is in his hand. */
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
  /** piece id → what he believes it holds, and since when. */
  pieces: Map<number, { room: number; note: PieceNote; at: number }>;
  /** room → the pieces worth searching he saw there (not fixtures, not the armoury), so he knows what is left.
   *  The layout never fades; only what he learned about the pieces does. */
  roomPieces: Map<number, number[]>;
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
    roomPieces: new Map(),
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

/** The note for a piece that now holds `t`. */
function holding(t: Thing): PieceNote {
  if (t.kind === 'remedy') return { kind: 'remedy', remedy: t.remedy };
  if (t.kind === 'secret') return { kind: 'item', thing: 'secret', secret: t.secret };
  return { kind: 'item', thing: 'kufrik' };
}

/** Updates the notebook from this tick's view and the noticed events (search results, own traps set, deaths, disarms). */
export function remember(mem: Memory, view: BotView, events: readonly GameEvent[], ctx: RememberContext): void {
  const time = view.time;
  const room = view.self.room;

  // Fixtures give themselves away by their look, no search needed.
  for (const p of view.pieces) {
    if (p.source !== null) mem.pieces.set(p.id, { room, note: { kind: 'fixture', remedy: p.source }, at: time });
  }
  mem.roomPieces.set(room, view.pieces.filter((p) => p.source === null && !p.armoury).map((p) => p.id));

  const note = (piece: number, n: PieceNote, at = room) => mem.pieces.set(piece, { room: at, note: n, at: time });
  for (const e of events) {
    if ('spy' in e && e.spy !== view.self.id) continue;
    switch (e.type) {
      case 'found':
        // Nothing, or a remedy (a fixture keeps giving it) — or he took a secret/the kufřík, leaving the piece empty.
        note(e.furniture, e.thing?.kind === 'remedy' ? holding(e.thing) : { kind: 'empty' });
        mem.searchedCount++;
        if (e.thing !== null && e.thing.kind !== 'remedy') mem.foundSinceMap++;
        break;
      case 'stored':
        // The found secret went into his kufřík, or he took the kufřík with his loose secret in it: empty either way.
        note(e.furniture, { kind: 'empty' });
        mem.searchedCount++;
        mem.foundSinceMap++;
        break;
      case 'swapped':
        note(e.furniture, holding(e.gave));
        mem.searchedCount++;
        if (e.took.kind !== 'remedy') mem.foundSinceMap++;
        break;
      case 'hidden':
        note(e.furniture, holding(e.thing));
        mem.searchedCount++;
        break;
      case 'dropped': {
        // On his death the hand lands in the nearest free piece, maybe next door; noted if he knows that piece.
        if (e.furniture === null || e.thing === null) break;
        const id = e.furniture;
        const at = [...mem.roomPieces].find(([, ids]) => ids.includes(id))?.[0];
        if (at !== undefined) note(id, holding(e.thing), at);
        break;
      }
      case 'alreadyHave':
        // The event doesn't say which kind (round 6 §3: it stays hidden) — only that it was a loose secret.
        note(e.furniture, { kind: 'item', thing: 'secret' });
        mem.searchedCount++;
        mem.foundSinceMap++;
        break;
      case 'resupplied':
        note(e.furniture, { kind: 'armoury' });
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
  if (view.itemRooms !== null) {
    // The open map shows every visited room's dot: a visited room without one has none any more.
    for (const r of view.known) if (!view.itemRooms.includes(r.id)) mem.itemRoomsSeen.delete(r.id);
    for (const r of view.itemRooms) mem.itemRoomsSeen.set(r, time);
  }
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

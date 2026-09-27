import { rand, type RngState } from '../../../shared/rng';
import { RULES } from '../logic/rules';
import type { DeathCause, GameEvent, PlaceTarget, RemedyKind, SecretKind, Thing, TrapKind } from '../logic/state';
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
  /** room → the last time he stood in it (to walk the least recently seen rooms when nothing else is left). */
  lastIn: Map<number, number>;
  /** piece → until when he leaves it alone: a search there kept starting nothing (see `giveUp`). */
  givenUp: Map<number, number>;
  /** room → when a time bomb there goes off, as far as he knows (his own, or one he hears ticking); gone once over. */
  ticking: Map<number, number>;
  /** trap target (`ownTraps`' keys) → until when he leaves it alone: placing there was refused. */
  noTrap: Map<string, number>;
}

/** How long a piece he gave up on is left alone before it may be tried again. */
export const GIVE_UP_FOR = 30;

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
    lastIn: new Map(),
    givenUp: new Map(),
    ticking: new Map(),
    noTrap: new Map(),
  };
}

const FURNITURE_TRAPS: readonly DeathCause[] = ['bomba', 'pruzina'];
const DOOR_TRAPS: readonly DeathCause[] = ['elektrina', 'pistole'];

/** His own trap's key in `Memory.ownTraps` (and `noTrap`): on a piece, a door, the floor of a room. */
export const pieceKey = (id: number) => `p:${id}`;
export const doorTrapKey = (key: string) => `d:${key}`;
export const floorKey = (room: number) => `f:${room}`;

/** The key of a trap being put down at `target` in `room`. */
export function placeKey(target: PlaceTarget, room: number): string {
  if (target.on === 'furniture') return pieceKey(target.furniture);
  return target.on === 'door' ? doorTrapKey(target.key) : floorKey(room);
}

/** The room of a piece he knows of: from its note, else from the room layout (which never fades — a note can, and a
 *  piece he died at may never have had one); null for a piece he has never seen. */
export function pieceRoom(mem: Memory, piece: number): number | null {
  const noted = mem.pieces.get(piece)?.room;
  if (noted !== undefined) return noted;
  for (const [room, ids] of mem.roomPieces) if (ids.includes(piece)) return room;
  return null;
}

/** His own events that end a search of the piece they name. */
const SEARCH_DONE: readonly GameEvent['type'][] = ['found', 'stored', 'swapped', 'hidden', 'alreadyHave'];

/** Drops the dangers at `at` (a trap springs once: after a safe pass, a safe search or a disarm it is gone). */
function clearDanger(mem: Memory, at: { piece: number } | { door: string }): void {
  mem.dangers = mem.dangers.filter((d) => ('piece' in at ? !('piece' in d.at && d.at.piece === at.piece)
    : !('door' in d.at && d.at.door === at.door)));
}

/** Whether two danger spots are the same piece, door or room. */
function sameSpot(a: Danger['at'], b: Danger['at']): boolean {
  if ('piece' in a) return 'piece' in b && a.piece === b.piece;
  if ('door' in a) return 'door' in b && a.door === b.door;
  return 'room' in b && a.room === b.room;
}

/** Notes a danger at `at`: refreshes `since` when one is already noted there (review finding 6) instead of adding a
 *  duplicate. */
function noteDanger(mem: Memory, at: Danger['at'], cause: Danger['cause'], time: number): void {
  const existing = mem.dangers.find((d) => sameSpot(d.at, at));
  if (existing !== undefined) existing.since = time;
  else mem.dangers.push({ at, cause, since: time });
}

/** The note for a piece that now holds `t`. */
function holding(t: Thing): PieceNote {
  if (t.kind === 'remedy') return { kind: 'remedy', remedy: t.remedy };
  if (t.kind === 'secret') return { kind: 'item', thing: 'secret', secret: t.secret };
  return { kind: 'item', thing: 'kufrik' };
}

/** Updates the notebook from this tick's view and the noticed events (search results, own traps set or refused, deaths,
 *  disarms, bombs ticking). */
export function remember(mem: Memory, view: BotView, events: readonly GameEvent[], ctx: RememberContext): void {
  const time = view.time;
  const room = view.self.room;

  // Fixtures give themselves away by their look, no search needed.
  for (const p of view.pieces) {
    if (p.source !== null) mem.pieces.set(p.id, { room, note: { kind: 'fixture', remedy: p.source }, at: time });
  }
  mem.roomPieces.set(room, view.pieces.filter((p) => p.source === null && !p.armoury).map((p) => p.id));
  mem.lastIn.set(room, time);

  const note = (piece: number, n: PieceNote, at = room) => mem.pieces.set(piece, { room: at, note: n, at: time });
  for (const e of events) {
    if ('spy' in e && e.spy !== view.self.id) continue;
    // A search that finished: he came through the piece alive, so no trap sits there now.
    if (SEARCH_DONE.includes(e.type) && 'furniture' in e && e.furniture !== null) clearDanger(mem, { piece: e.furniture });
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
        mem.searchedCount++; // it was a search that found the piece empty, before his hand went in
        break;
      case 'dropped': {
        // On his death the hand lands in the nearest free piece, maybe next door — but a dead human sees only his
        // death room, so it's noted only when that piece stands right there in view (review finding 2, fairness).
        if (e.furniture === null || e.thing === null) break;
        const id = e.furniture;
        if (view.pieces.some((p) => p.id === id)) note(id, holding(e.thing));
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
        if (e.trap === 'casovana') mem.ticking.set(room, time + RULES.timeBombFuse);
        break;
      case 'refused':
        if (ctx.pendingTrapTarget !== null) mem.noTrap.set(ctx.pendingTrapTarget, time + GIVE_UP_FOR);
        break;
      case 'tick':
        // A bomb heard: it may have a whole fuse left (one he set himself he knows the time of).
        if (!mem.ticking.has(e.room)) mem.ticking.set(e.room, time + RULES.timeBombFuse);
        break;
      case 'explode':
        mem.ticking.delete(e.room);
        mem.ownTraps.delete(floorKey(e.room));
        break;
      case 'doorOpened':
        // Through a door without dying: no trap there any more.
        if (!events.some((d) => d.type === 'died' && d.spy === view.self.id)) clearDanger(mem, { door: e.key });
        break;
      case 'died':
        // A trap springs once: if it was his own, it is gone now.
        if (FURNITURE_TRAPS.includes(e.cause) && ctx.searching !== null) {
          noteDanger(mem, { piece: ctx.searching }, e.cause, time);
          mem.ownTraps.delete(pieceKey(ctx.searching));
        } else if (DOOR_TRAPS.includes(e.cause) && ctx.door !== null) {
          noteDanger(mem, { door: ctx.door }, e.cause, time);
          mem.ownTraps.delete(doorTrapKey(ctx.door));
        } else if (e.cause === 'casovana') {
          noteDanger(mem, { room }, e.cause, time);
        }
        break;
      case 'disarmed':
        if (ctx.searching !== null) {
          mem.ownTraps.delete(pieceKey(ctx.searching));
          clearDanger(mem, { piece: ctx.searching });
        }
        if (ctx.door !== null) {
          mem.ownTraps.delete(doorTrapKey(ctx.door));
          clearDanger(mem, { door: ctx.door });
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

  for (const [r, until] of mem.ticking) if (until <= time) mem.ticking.delete(r);
  for (const [key, until] of mem.noTrap) if (until <= time) mem.noTrap.delete(key);

  if (view.opponent !== null) mem.lastSeenOpponent = { room, at: time };
  if (view.glance !== null) mem.lastGlance = { ...view.glance, at: time };
  if (view.itemRooms !== null) {
    // The open map shows every visited room's dot: a visited room without one has none any more.
    for (const r of view.known) if (!view.itemRooms.includes(r.id)) mem.itemRoomsSeen.delete(r.id);
    for (const r of view.itemRooms) mem.itemRoomsSeen.set(r, time);
  }
}

/** Leaves `piece` alone for `GIVE_UP_FOR` seconds from `time` — searches there kept starting nothing. Unlike a note,
 *  it says nothing about what the piece holds, so it may be tried again later. */
export function giveUp(mem: Memory, piece: number, time: number): void {
  mem.givenUp.set(piece, time + GIVE_UP_FOR);
}

/** Whether he is leaving `piece` alone at `time`. */
export function gaveUp(mem: Memory, piece: number, time: number): boolean {
  return (mem.givenUp.get(piece) ?? -Infinity) > time;
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

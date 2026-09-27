import { RULES } from '../logic/rules';
import { REMEDY_FOR } from '../logic/traps';
import { DIRS, TRAPS, doorKey, neighbor, type DeathCause, type Dir, type RemedyKind, type TrapKind } from '../logic/state';
import type { Goal, Scored } from './decide';
import { type Iq, IQ_PARAMS } from './iq';
import { gaveUp, type Danger, type Memory } from './memory';
import { doorPoint } from './motor';
import { route, type Hop } from './route';
import type { BotView, DoorView } from './view';

/**
 * The bot's tactics (spec bot §5, the trap rows of §6): setting traps, fetching a remedy, the armoury, and getting out
 * of a room with a bomb ticking in it — plus what they change for everything else: every route goes round his own
 * traps and weighs a ticking room. Scored on the same 0..100 scale as the goals in `decide.ts`.
 */

/** A room further away costs this much per door on the way. */
export const HOP = 4;

// A trap: `TRAP` for a valid target (IQ 1–2: anywhere; with `smartTraps` only for a reason — the opponent's likely
// path, a noted item here, the exit here — and `TRAP_REASON` for each reason beyond the first), less `TRAP_CROWD` for
// each trap of his already in the room, times `trapWill`. Not with `TRAP_CLOCK` or less left: each costs clock.
const TRAP = 65;
const TRAP_REASON = 10;
const TRAP_CROWD = 25;
const TRAP_CLOCK = 30;
/** A remedy: this much above the goal it clears the way for (less the walk to its source). */
const REMEDY_EDGE = 10;
/** The armoury: worth a walk with at most `ARMOURY_STOCK` traps left in all. */
const ARMOURY = 50;
const ARMOURY_STOCK = 1;
/** Out of a room with a bomb ticking: above everything but the escape. */
const FLEE_BOMB = 98;

/** His own trap's key in `Memory.ownTraps` (and `noTrap`). */
export const pieceKey = (id: number) => `p:${id}`;
export const doorTrapKey = (key: string) => `d:${key}`;
export const floorKey = (room: number) => `f:${room}`;

export const ownTrapped = (mem: Memory, piece: number) => mem.ownTraps.has(pieceKey(piece));

/** Whether a bomb is ticking in `room` as far as he knows. */
export const ticking = (view: BotView, mem: Memory, room: number) => (mem.ticking.get(room) ?? -Infinity) > view.time;

function remedyFor(cause: DeathCause | TrapKind): RemedyKind | null {
  return cause in REMEDY_FOR ? REMEDY_FOR[cause as keyof typeof REMEDY_FOR] : null;
}

/** Whether his hand holds what disarms `cause`. */
function holdsRemedy(view: BotView, cause: DeathCause | TrapKind): boolean {
  const hand = view.self.hand;
  return hand?.kind === 'remedy' && hand.remedy === remedyFor(cause);
}

/** What weighs on his routes: places he died, unless he holds their remedy. */
const routeDangers = (view: BotView, mem: Memory): Danger[] => mem.dangers.filter((d) => !holdsRemedy(view, d.cause));

/** Doors he never passes: those he trapped himself and holds no remedy for (`trapTarget` keeps his map connected), and
 *  every door into another room with a bomb ticking. */
function closedDoors(view: BotView, mem: Memory): Set<string> {
  const out = new Set<string>();
  for (const [key, kind] of mem.ownTraps) if (key.startsWith('d:') && !holdsRemedy(view, kind)) out.add(key.slice(2));
  for (const r of view.known) {
    if (r.id === view.self.room || !ticking(view, mem, r.id)) continue;
    for (const dir of DIRS) {
      const nb = r.doors[dir] ? neighbor(view, r.id, dir) : null;
      if (nb !== null) out.add(doorKey(r.id, nb));
    }
  }
  return out;
}

/** His way from here to `room` over known rooms: round his own traps and ticking rooms, dangers costing extra; null
 *  when there is none. */
export function pathTo(view: BotView, mem: Memory, room: number): Hop[] | null {
  return route(view.known, view.cols, view.self.room, room, routeDangers(view, mem), closedDoors(view, mem));
}

/** Doors to pass from his room to `room` (see `pathTo`), null when unreachable — or when a bomb ticks there. */
export function hops(view: BotView, mem: Memory, room: number): number | null {
  if (ticking(view, mem, room)) return null;
  return pathTo(view, mem, room)?.length ?? null;
}

/** Whether, with the doors he avoids and one more trap on door `key`, he could still reach every room he knows or has
 *  seen a door to. */
function keepsConnected(view: BotView, mem: Memory, key: string): boolean {
  const blocked = closedDoors(view, mem).add(key);
  const rooms = new Set<number>();
  for (const r of view.known) {
    rooms.add(r.id);
    for (const dir of DIRS) {
      const nb = r.doors[dir] ? neighbor(view, r.id, dir) : null;
      if (nb !== null) rooms.add(nb);
    }
  }
  return [...rooms].every((r) => route(view.known, view.cols, view.self.room, r, [], blocked) !== null);
}

// ---------- traps ----------

/** Whether placing on `key` is still open to him: not his own trap already, not refused lately. */
function free(view: BotView, mem: Memory, key: string): boolean {
  return !mem.ownTraps.has(key) && (mem.noTrap.get(key) ?? -Infinity) <= view.time;
}

/** Doors of his room he could leave by: not the exit, not one he trapped himself. */
function waysOut(mem: Memory, view: BotView): DoorView[] {
  return view.doors.filter((d) => !d.exit && d.to !== null && !mem.ownTraps.has(doorTrapKey(d.key)));
}

/** Whether `room` is known to lead on: visited, with another door than the one in. */
function leadsOn(view: BotView, room: number): boolean {
  const r = view.known.find((k) => k.id === room);
  return r !== undefined && DIRS.filter((d) => r.doors[d]).length >= 2;
}

/** The nearest way out of his room to a room without a bomb ticking: one that leads on (else he could sit out the
 *  fuse in a dead end, cut off), or — unless `onwardOnly` — any; null when there is none. */
function fleeDoor(view: BotView, mem: Memory, onwardOnly: boolean): Dir | null {
  let best: Dir | null = null;
  let bestCost = Infinity;
  for (const d of waysOut(mem, view)) {
    if (ticking(view, mem, d.to!)) continue;
    const onward = leadsOn(view, d.to!);
    if (onwardOnly && !onward) continue;
    const p = doorPoint(d.dir);
    // Any onward door before any dead end, then the nearest.
    const cost = Math.abs(p.x - view.self.x) + Math.abs(p.z - view.self.z) + (onward ? 0 : RULES.roomW * 2);
    if (cost < bestCost) {
      best = d.dir;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * Where `trap` could go in his room, the nearest first — the same kinds of target as `logic/traps.ts`
 * `placeTargetFor`, from the view: bomba/pružina on a piece (never the armoury — he would lock himself out of it — nor
 * a fixture he may need, nor one he still `wants`: unsearched or holding what he lacks); elektřina/pistole on a door
 * that is not the exit, when he can still get everywhere without it (he never passes his own); časovaná at his feet,
 * while there is a way out that leads on. Whether the opponent got there first he cannot know: a refusal is noted
 * (`noTrap`) and he moves on.
 */
function trapTarget(view: BotView, mem: Memory, trap: TrapKind, wanted: (piece: number) => boolean): number | string | null {
  const x = view.self.x;
  switch (trap) {
    case 'bomba':
    case 'pruzina': {
      const pieces = view.pieces
        .filter((p) => !p.armoury && p.source === null && free(view, mem, pieceKey(p.id)) && !wanted(p.id))
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
      return pieces[0]?.id ?? null;
    }
    case 'elektrina':
    case 'pistole': {
      const door = waysOut(mem, view).find((d) => free(view, mem, doorTrapKey(d.key)) && keepsConnected(view, mem, d.key));
      return door?.key ?? null;
    }
    case 'casovana':
      return fleeDoor(view, mem, true) !== null && free(view, mem, floorKey(view.self.room)) ? 'here' : null;
  }
}

/** How good a trap in his room is (before `trapWill` and crowding): flat without `smartTraps`, else by the reasons. */
function trapValue(view: BotView, mem: Memory, smart: boolean): number {
  if (!smart) return TRAP;
  const room = view.self.room;
  const glance = mem.lastGlance;
  const reasons = [
    glance !== null && (glance.room === room || view.doors.some((d) => d.to === glance.room)),
    [...mem.pieces.values()].some((e) => e.room === room && e.note.kind === 'item'),
    view.doors.some((d) => d.exit),
  ].filter(Boolean).length;
  return reasons === 0 ? 0 : TRAP + TRAP_REASON * (reasons - 1);
}

/** His own traps in his room: on its pieces, its doors, its floor. */
function ownTrapsHere(view: BotView, mem: Memory): number {
  return view.pieces.filter((p) => ownTrapped(mem, p.id)).length
    + view.doors.filter((d) => mem.ownTraps.has(doorTrapKey(d.key))).length
    + (mem.ownTraps.has(floorKey(view.self.room)) ? 1 : 0);
}

/** One trap goal per kind in stock with a valid target here. `wanted`: pieces he still has a use for. */
export function trapGoals(view: BotView, mem: Memory, iq: Iq, wanted: (piece: number) => boolean): Scored[] {
  const { trapWill, smartTraps } = IQ_PARAMS[iq];
  const self = view.self;
  if (view.opponent !== null || self.clock <= TRAP_CLOCK || ticking(view, mem, self.room)) return [];
  const value = trapValue(view, mem, smartTraps) - TRAP_CROWD * ownTrapsHere(view, mem);
  if (value <= 0) return [];
  const out: Scored[] = [];
  for (const trap of TRAPS) {
    if (self.stock[trap] <= 0) continue;
    const at = trapTarget(view, mem, trap, wanted);
    if (at !== null) out.push({ goal: { kind: 'trap', trap, at }, score: value * trapWill });
  }
  return out;
}

// ---------- remedies ----------

/** Whether he fears to open `piece`: his own trap is on it, or he died there — and he holds no remedy for it. */
export function hazard(view: BotView, mem: Memory, piece: number): boolean {
  const own = mem.ownTraps.get(pieceKey(piece));
  if (own !== undefined && !holdsRemedy(view, own)) return true;
  return mem.dangers.some((d) => 'piece' in d.at && d.at.piece === piece && remedyFor(d.cause) !== null
    && !holdsRemedy(view, d.cause));
}

/** The remedy he lacks for what lies ahead on the way to `dest`: his own trap or a death at the piece he is going for,
 *  or a death at any door of his route (a route goes round those when it can, so one on it means there is no other
 *  way — and a source behind him stays worth fetching wherever he stands). Null when the way is clear. His own door
 *  traps are never on his way (see `pathTo`). */
function remedyAhead(view: BotView, mem: Memory, dest: { room: number; piece: number | null }): RemedyKind | null {
  const causes: (DeathCause | TrapKind)[] = [];
  const own = dest.piece === null ? undefined : mem.ownTraps.get(pieceKey(dest.piece));
  if (own !== undefined) causes.push(own);
  const doors = new Set((pathTo(view, mem, dest.room) ?? []).map((h) => h.key));
  for (const d of mem.dangers) {
    if (('piece' in d.at && d.at.piece === dest.piece) || ('door' in d.at && doors.has(d.at.door))) causes.push(d.cause);
  }
  for (const c of causes) {
    const r = remedyFor(c);
    if (r !== null && !holdsRemedy(view, c)) return r;
  }
  return null;
}

/**
 * Fetching a remedy (spec bot §5): the goal he would pursue (`dest`, scored `score`) leads through a known danger or
 * his own trap he holds no remedy for, and a source of it is known (a fixture, or a piece noted with one). Only with
 * empty hands: the hand holds one thing, and taking a remedy with a secret or the kufřík in hand would leave that
 * behind in the source (`logic/hand.ts` swaps) — with his finds in hand he keeps them and goes round the danger if he
 * can (`pathTo`), or takes the risk.
 */
export function remedyGoal(view: BotView, mem: Memory, dest: { room: number; piece: number | null; score: number }): Scored | null {
  if (view.self.hand !== null) return null;
  const need = remedyAhead(view, mem, dest);
  if (need === null) return null;
  let best: Scored | null = null;
  for (const [piece, e] of mem.pieces) {
    if (!remedySource(mem, piece, need) || gaveUp(mem, piece, view.time) || ownTrapped(mem, piece)) continue;
    if (mem.dangers.some((d) => 'piece' in d.at && d.at.piece === piece)) continue;
    const h = hops(view, mem, e.room);
    if (h === null) continue;
    const score = dest.score + REMEDY_EDGE - HOP * h;
    if (best === null || score > best.score) best = { goal: { kind: 'remedy', piece, remedy: need }, score };
  }
  return best;
}

/** Whether `piece` is noted as giving `remedy`. */
function remedySource(mem: Memory, piece: number, remedy: RemedyKind): boolean {
  const note = mem.pieces.get(piece)?.note;
  return (note?.kind === 'fixture' || note?.kind === 'remedy') && note.remedy === remedy;
}

// ---------- the armoury, the bomb ----------

const lowStock = (view: BotView) => Object.values(view.self.stock).reduce((a, b) => a + b, 0) <= ARMOURY_STOCK;

/** The armoury (spec bot §5): few traps left, the cabinet open for him, its room known and reachable. */
export function armouryGoal(view: BotView, mem: Memory): Scored | null {
  const room = view.armouryRoom;
  if (room === null || view.self.armouryTimer > 0 || !lowStock(view)) return null;
  if (room === view.self.room && !view.pieces.some((p) => p.armoury)) return null;
  const h = hops(view, mem, room);
  return h === null ? null : { goal: { kind: 'armoury', piece: null }, score: ARMOURY - HOP * h };
}

/** A bomb ticking in his room (his own just set, or one he hears): out through the nearest door. */
export function bombGoal(view: BotView, mem: Memory): Scored | null {
  if (!ticking(view, mem, view.self.room)) return null;
  const dir = fleeDoor(view, mem, false);
  return dir === null ? null : { goal: { kind: 'flee', dir }, score: FLEE_BOMB };
}

/** `stillWorth` for the goals above; undefined for any other goal. */
export function tacticStillWorth(view: BotView, mem: Memory, goal: Goal): boolean | undefined {
  const self = view.self;
  switch (goal.kind) {
    case 'trap': {
      if (self.stock[goal.trap] <= 0 || view.opponent !== null) return false;
      const at = goal.at;
      if (typeof at === 'number') return view.pieces.some((p) => p.id === at) && free(view, mem, pieceKey(at));
      if (at === 'here') return !ticking(view, mem, self.room) && free(view, mem, floorKey(self.room));
      return view.doors.some((d) => d.key === at) && free(view, mem, doorTrapKey(at));
    }
    case 'remedy':
      return self.hand === null && remedySource(mem, goal.piece, goal.remedy) && !gaveUp(mem, goal.piece, view.time);
    case 'armoury':
      return view.armouryRoom !== null && self.armouryTimer === 0 && lowStock(view);
    case 'flee':
      return ticking(view, mem, self.room);
    default:
      return undefined;
  }
}

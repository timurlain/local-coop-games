import { rand, type RngState } from '../../../shared/rng';
import { hasAllSecrets, hasKind } from '../logic/hand';
import { RULES } from '../logic/rules';
import { DIRS, neighbor, type Dir, type RemedyKind, type Thing, type TrapKind } from '../logic/state';
import { type Iq, IQ_PARAMS } from './iq';
import type { Memory, PieceNote } from './memory';
import { route } from './route';
import type { BotView } from './view';

/**
 * The bot's decision (spec bot §5): every goal he could pursue gets a utility score, the best wins. Only what the view
 * and his notebook say goes in. Trap, remedy, armoury, fight and flee are not scored yet (they would score 0).
 */
export type Goal =
  | { kind: 'search'; piece: number } | { kind: 'fetch'; piece: number } | { kind: 'escape' }
  | { kind: 'explore' } | { kind: 'trap'; trap: TrapKind; at: number | string | 'here' }
  | { kind: 'remedy'; piece: number; remedy: RemedyKind } | { kind: 'armoury'; piece: number | null }
  | { kind: 'map' } | { kind: 'fight' } | { kind: 'flee'; dir: Dir };

export interface Scored {
  goal: Goal;
  score: number;
}

/** Bonus for the goal already being pursued, so he does not dither. */
export const STICKY = 15;

// Base scores (0..100); a room further away costs `HOP` per door on the way (`EXPLORE_HOP` for exploring).
const ESCAPE = 100;
const EXPLORE_FOR_EXIT = 95;
const FETCH_KUFRIK = 90;
const FETCH_SECRET = 85;
const MAP = 70;
const SEARCH = 60;
/** at most this much off a search for the piece being across the room */
const SEARCH_SPREAD = 20;
const EXPLORE = 45;
/** a secret of a kind he does not know, worth a look only with empty hands */
const FETCH_ANY = 30;
const HOP = 4;
const EXPLORE_HOP = 2;
/** the map is worth its price after this many searches in a row with nothing found … */
const MAP_AFTER = 8;
/** … while his clock has more than this left */
const MAP_CLOCK = 60;

const sameGoal = (a: Goal, b: Goal | null) => b !== null && JSON.stringify(a) === JSON.stringify(b);

/** Doors to pass from his room to `room` over known rooms (known dangers cost extra), null when unreachable. */
function hops(view: BotView, mem: Memory, room: number): number | null {
  return route(view.known, view.cols, view.self.room, room, mem.dangers)?.length ?? null;
}

/** The known room with the exit, and its side — only while the exit is visible to him. */
export function exitOf(view: BotView): { room: number; dir: Dir } | null {
  const r = view.known.find((k) => k.exit !== null);
  return r === undefined ? null : { room: r.id, dir: r.exit! };
}

/** Whether a piece he knows of is still worth a search: never looked, or noted empty before the paid map showed a
 *  dot in its room that no item note there explains. */
function unsearched(mem: Memory, piece: number, room: number): boolean {
  const entry = mem.pieces.get(piece);
  if (entry === undefined) return true;
  if (entry.note.kind !== 'empty') return false;
  const dot = mem.itemRoomsSeen.get(room);
  if (dot === undefined || dot <= entry.at) return false;
  return ![...mem.pieces.values()].some((e) => e.room === room && e.note.kind === 'item');
}

function roomHasUnsearched(mem: Memory, room: number): boolean {
  const pieces = mem.roomPieces.get(room);
  return pieces === undefined || pieces.some((id) => unsearched(mem, id, room));
}

/**
 * Where exploring takes him: the nearest unvisited room behind a known door, or (unless he only wants the exit) the
 * nearest other known room with a piece still to search. null when there is none.
 */
export function exploreTarget(view: BotView, mem: Memory, exitOnly: boolean): number | null {
  const knownIds = new Set(view.known.map((r) => r.id));
  const targets = new Set<number>();
  for (const r of view.known) {
    for (const dir of DIRS) {
      const nb = r.doors[dir] ? neighbor(view, r.id, dir) : null;
      if (nb !== null && !knownIds.has(nb)) targets.add(nb);
    }
    if (!exitOnly && r.id !== view.self.room && roomHasUnsearched(mem, r.id)) targets.add(r.id);
  }
  let best: number | null = null;
  let bestHops = Infinity;
  for (const t of [...targets].sort((a, b) => a - b)) {
    const h = hops(view, mem, t);
    if (h !== null && h < bestHops) {
      best = t;
      bestHops = h;
    }
  }
  return best;
}

/** What fetching the thing noted in a piece is worth with `hand` held (before distance), 0 when it gets him nothing. */
function fetchValue(note: PieceNote, hand: Thing | null): number {
  if (note.kind !== 'item') return 0;
  // Taking the kufřík: with empty hands, or a loose secret that goes straight into it.
  if (note.thing === 'kufrik') return hand?.kind === 'kufrik' ? 0 : FETCH_KUFRIK;
  if (note.secret === undefined) return hand === null ? FETCH_ANY : 0;
  // A secret he lacks, into the kufřík or into empty hands; for a loose one it would only be a swap.
  if (hasKind(hand, note.secret) || hand?.kind === 'secret') return 0;
  return FETCH_SECRET;
}

/** Every goal worth anything right now, with its plain score (no noise, no stickiness). */
function candidates(view: BotView, mem: Memory): Scored[] {
  const out: Scored[] = [];
  const self = view.self;
  const full = hasAllSecrets(self.hand);
  const exit = exitOf(view);

  if (full) {
    if (exit !== null && hops(view, mem, exit.room) !== null) out.push({ goal: { kind: 'escape' }, score: ESCAPE });
    else if (exploreTarget(view, mem, true) !== null) out.push({ goal: { kind: 'explore' }, score: EXPLORE_FOR_EXIT });
    return out;
  }

  for (const [piece, entry] of mem.pieces) {
    const value = fetchValue(entry.note, self.hand);
    if (value <= 0) continue;
    const h = hops(view, mem, entry.room);
    if (h !== null) out.push({ goal: { kind: 'fetch', piece }, score: value - HOP * h });
  }

  let searchHere = false;
  for (const p of view.pieces) {
    if (p.source !== null || p.armoury || !unsearched(mem, p.id, self.room)) continue;
    out.push({ goal: { kind: 'search', piece: p.id }, score: SEARCH - (SEARCH_SPREAD * Math.abs(p.x - self.x)) / RULES.roomW });
    searchHere = true;
  }

  // Exploring is for when nothing is left here: leaving a half-searched room would only bring him back to it.
  const target = searchHere ? null : exploreTarget(view, mem, false);
  if (target !== null) {
    const h = hops(view, mem, target) ?? 0;
    out.push({ goal: { kind: 'explore' }, score: Math.max(1, EXPLORE - EXPLORE_HOP * h) });
  }

  if (mem.searchedCount >= MAP_AFTER && mem.foundSinceMap === 0 && self.clock > MAP_CLOCK) {
    out.push({ goal: { kind: 'map' }, score: MAP });
  }
  return out;
}

/** Whether `goal` is still worth pursuing (cheap enough for every tick: it is the plain candidate list). */
export function stillWorth(view: BotView, mem: Memory, goal: Goal): boolean {
  return candidates(view, mem).some((c) => sameGoal(c.goal, goal));
}

/** All goals with their scores (0..100 + noise), highest first. The current goal gets STICKY (+15). */
export function scoreGoals(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Scored[] {
  const { noise } = IQ_PARAMS[iq];
  return candidates(view, mem)
    .map((c) => ({
      goal: c.goal,
      score: c.score + (rand(rng) * 2 - 1) * noise + (sameGoal(c.goal, current) ? STICKY : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

/** The best goal; exploring when nothing scores at all. */
export function chooseGoal(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Goal {
  return scoreGoals(view, mem, iq, current, rng)[0]?.goal ?? { kind: 'explore' };
}

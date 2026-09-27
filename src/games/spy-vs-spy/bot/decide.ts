import { rand, type RngState } from '../../../shared/rng';
import { hasAllSecrets, hasKind } from '../logic/hand';
import { RULES } from '../logic/rules';
import { DIRS, neighbor, type Dir, type RemedyKind, type Thing, type TrapKind } from '../logic/state';
import { type Iq, IQ_PARAMS } from './iq';
import {
  armouryGoal, bombGoal, hazard, hops, HOP, ownTrapped, remedyGoal, tacticStillWorth, trapGoals,
} from './decide-tactics';
import { fightGoal } from './fight';
import { gaveUp, pieceRoom, type Memory, type PieceNote } from './memory';
import type { BotView } from './view';

/**
 * The bot's decision (spec bot §5): every goal he could pursue gets a utility score, the best wins. Only what the view
 * and his notebook say goes in. Traps, remedies, the armoury and leaving a ticking room are scored in
 * `decide-tactics.ts`, fighting and fleeing from a fight in `fight.ts`.
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
// Last resorts, offered only when nothing above scores: the map (after MAP_AFTER searches, finds or not), a second look
// at the oldest piece noted empty, a walk to the room he saw least recently.
const LAST_MAP = 8;
const LAST_SEARCH = 5;
const LAST_WANDER = 2;
const EXPLORE_HOP = 2;
/** the map is worth its price after this many searches in a row with nothing found … */
const MAP_AFTER = 8;
/** … while his clock has more than this left */
const MAP_CLOCK = 60;

export const sameGoal = (a: Goal, b: Goal | null) => b !== null && JSON.stringify(a) === JSON.stringify(b);

/** The known room with the exit, and its side — only while the exit is visible to him. */
export function exitOf(view: BotView): { room: number; dir: Dir } | null {
  const r = view.known.find((k) => k.exit !== null);
  return r === undefined ? null : { room: r.id, dir: r.exit! };
}

/** Whether a piece he knows of is still worth a search: never looked, or noted empty before the paid map showed a
 *  dot in its room that no item note there explains. */
function unsearched(mem: Memory, piece: number, room: number): boolean {
  const entry = mem.pieces.get(piece);
  // His own trapped piece he has forgotten the contents of: nothing to look for there.
  if (entry === undefined) return !ownTrapped(mem, piece);
  if (entry.note.kind !== 'empty') return false;
  const dot = mem.itemRoomsSeen.get(room);
  if (dot === undefined || dot <= entry.at) return false;
  return ![...mem.pieces.values()].some((e) => e.room === room && e.note.kind === 'item');
}

/** Whether a known room still has a piece to search that he dares to open (the others come up through `look`). */
function roomHasUnsearched(view: BotView, mem: Memory, room: number): boolean {
  const pieces = mem.roomPieces.get(room);
  return pieces === undefined || pieces.some((id) => unsearched(mem, id, room) && !hazard(view, mem, id));
}

/** Where exploring takes him, and why: an unvisited room behind a known door (`new`), another known room with a
 *  piece still to search (`search`), or — the last resort — the room he stood in least recently (`wander`). */
export interface ExploreTarget {
  room: number;
  why: 'new' | 'search' | 'wander';
}

/** The nearest `new` (or, unless `exitOnly`, `search`) room; else the room he stood in least recently. */
function exploreTarget(view: BotView, mem: Memory, exitOnly: boolean): ExploreTarget | null {
  const knownIds = new Set(view.known.map((r) => r.id));
  const targets = new Map<number, ExploreTarget['why']>();
  for (const r of view.known) {
    for (const dir of DIRS) {
      const nb = r.doors[dir] ? neighbor(view, r.id, dir) : null;
      if (nb !== null && !knownIds.has(nb)) targets.set(nb, 'new');
    }
    if (!exitOnly && r.id !== view.self.room && roomHasUnsearched(view, mem, r.id)) targets.set(r.id, 'search');
  }
  let best: ExploreTarget | null = null;
  let bestHops = Infinity;
  for (const room of [...targets.keys()].sort((a, b) => a - b)) {
    const h = hops(view, mem, room);
    if (h !== null && h < bestHops) {
      best = { room, why: targets.get(room)! };
      bestHops = h;
    }
  }
  if (best !== null) return best;
  let oldest = Infinity;
  for (const r of view.known) {
    const seen = mem.lastIn.get(r.id) ?? -Infinity;
    if (r.id !== view.self.room && seen < oldest && hops(view, mem, r.id) !== null) {
      best = { room: r.id, why: 'wander' };
      oldest = seen;
    }
  }
  return best;
}

/** Where the explore goal takes him from here: with the full kufřík anywhere that may show the exit, otherwise the
 *  nearest room with something new; with nothing left, the room he saw least recently. null when there is none. */
export function exploreFor(view: BotView, mem: Memory): ExploreTarget | null {
  return exploreTarget(view, mem, hasAllSecrets(view.self.hand));
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

/** Whether the escape can be done from here: the exit known, a way there, and its door in view when he is there. */
function canEscape(view: BotView, mem: Memory): boolean {
  const exit = exitOf(view);
  if (exit === null || hops(view, mem, exit.room) === null) return false;
  return exit.room !== view.self.room || view.doors.some((d) => d.exit);
}

/** The piece noted empty longest ago (reachable, not given up; his own trapped ones too), for a second look. */
function oldestEmpty(view: BotView, mem: Memory): number | null {
  let best: number | null = null;
  let bestAt = Infinity;
  for (const [piece, e] of mem.pieces) {
    if (e.note.kind !== 'empty' || e.at >= bestAt || gaveUp(mem, piece, view.time)) continue;
    if (hops(view, mem, e.room) === null) continue;
    best = piece;
    bestAt = e.at;
  }
  return best;
}

/**
 * `goal` (a search or fetch of `piece` in `room`) worth `score`. A piece he fears (`hazard`: his own trap, or where he
 * died) comes up only when it may hold something — an item noted in it, a map dot, the last resort's second look (the
 * opponent may have sprung his trap and dropped his hand there) — and then, with empty hands, he fetches its remedy
 * first when he knows a source; otherwise he opens it all the same and takes the hit (a trap is spent then).
 */
function look(view: BotView, mem: Memory, goal: Goal & { piece: number }, room: number, score: number): Scored {
  if (!hazard(view, mem, goal.piece)) return { goal, score };
  return remedyGoal(view, mem, { room, piece: goal.piece, score }) ?? { goal, score };
}

/** Whether a noted piece holds something he still has a use for: the kufřík without one, a secret he lacks. */
function needed(note: PieceNote | undefined, hand: Thing | null): boolean {
  if (note?.kind !== 'item') return false;
  if (note.thing === 'kufrik') return hand?.kind !== 'kufrik';
  return note.secret !== undefined && !hasKind(hand, note.secret);
}

/** Where a goal takes him (for the remedy check), null for goals without a place. */
function destination(goal: Goal, view: BotView, mem: Memory, target: ExploreTarget | null): { room: number; piece: number | null } | null {
  switch (goal.kind) {
    case 'search':
    case 'fetch':
      return { room: pieceRoom(mem, goal.piece) ?? view.self.room, piece: goal.piece };
    case 'explore':
      return target === null ? null : { room: target.room, piece: null };
    default:
      return null;
  }
}

/** Every goal worth anything right now, with its plain score (no noise, no stickiness). Empty only when there is
 *  nothing at all he could do. */
function candidates(view: BotView, mem: Memory, iq: Iq): Scored[] {
  const out: Scored[] = [];
  const self = view.self;

  // The escape before all; then a bomb ticking here, then the opponent in his room: nothing else matters.
  const full = hasAllSecrets(self.hand);
  if (full && canEscape(view, mem)) return [{ goal: { kind: 'escape' }, score: ESCAPE }];
  const flee = bombGoal(view, mem);
  if (flee !== null) return [flee];
  const fight = fightGoal(view, mem, iq);
  if (fight !== null) return [fight];

  if (full) {
    if (exploreFor(view, mem) !== null) out.push({ goal: { kind: 'explore' }, score: EXPLORE_FOR_EXIT });
    return out;
  }

  for (const [piece, entry] of mem.pieces) {
    const value = fetchValue(entry.note, self.hand);
    if (value <= 0 || gaveUp(mem, piece, view.time)) continue;
    const h = hops(view, mem, entry.room);
    if (h !== null) out.push(look(view, mem, { kind: 'fetch', piece }, entry.room, value - HOP * h));
  }

  let searchHere = false;
  for (const p of view.pieces) {
    if (p.source !== null || p.armoury || !unsearched(mem, p.id, self.room) || gaveUp(mem, p.id, view.time)) continue;
    if (hazard(view, mem, p.id)) continue;
    out.push({ goal: { kind: 'search', piece: p.id }, score: SEARCH - (SEARCH_SPREAD * Math.abs(p.x - self.x)) / RULES.roomW });
    searchHere = true;
  }
  // The pieces he fears that may hold something, wherever he knows them (so a remedy is worth the same from any room).
  for (const [room, ids] of mem.roomPieces) {
    const h = hops(view, mem, room);
    if (h === null) continue;
    for (const id of ids) {
      if (!hazard(view, mem, id) || !unsearched(mem, id, room) || gaveUp(mem, id, view.time)) continue;
      out.push(look(view, mem, { kind: 'search', piece: id }, room, SEARCH - HOP * h));
    }
  }

  // Exploring is for when nothing is left here: leaving a half-searched room would only bring him back to it.
  const target = searchHere ? null : exploreFor(view, mem);
  if (target !== null && target.why !== 'wander') {
    const h = hops(view, mem, target.room) ?? 0;
    out.push({ goal: { kind: 'explore' }, score: Math.max(1, EXPLORE - EXPLORE_HOP * h) });
  }

  if (mem.searchedCount >= MAP_AFTER && mem.foundSinceMap === 0 && self.clock > MAP_CLOCK) {
    out.push({ goal: { kind: 'map' }, score: MAP });
  }

  // The best goal so far may lead through a danger: a remedy first.
  const top = out.reduce<Scored | null>((a, b) => (a === null || b.score > a.score ? b : a), null);
  const dest = top === null ? null : destination(top.goal, view, mem, target);
  const remedy = dest === null ? null : remedyGoal(view, mem, { ...dest, score: top!.score });
  if (remedy !== null) out.push(remedy);

  const wanted = (piece: number) => unsearched(mem, piece, self.room) || needed(mem.pieces.get(piece)?.note, self.hand);
  out.push(...trapGoals(view, mem, iq, wanted));
  const armoury = armouryGoal(view, mem);
  if (armoury !== null) out.push(armoury);

  if (out.length === 0) {
    if (mem.searchedCount >= MAP_AFTER && self.clock > MAP_CLOCK) out.push({ goal: { kind: 'map' }, score: LAST_MAP });
    const piece = oldestEmpty(view, mem);
    if (piece !== null) out.push(look(view, mem, { kind: 'search', piece }, mem.pieces.get(piece)!.room, LAST_SEARCH));
    if (target !== null) out.push({ goal: { kind: 'explore' }, score: LAST_WANDER });
  }
  return out;
}

/**
 * Whether `goal` is still worth pursuing: a cheap check of just that goal, for every tick (the full scoring runs on
 * the think beat). `since` is when he took the goal up (a second look at an empty piece is spent once it is noted
 * again after that); `target` is where his explore goal is heading.
 */
export function stillWorth(view: BotView, mem: Memory, goal: Goal, since: number, target: ExploreTarget | null): boolean {
  const full = hasAllSecrets(view.self.hand);
  const tactic = tacticStillWorth(view, mem, goal);
  if (tactic !== undefined) return tactic;
  switch (goal.kind) {
    case 'search': {
      if (full || gaveUp(mem, goal.piece, view.time)) return false;
      const entry = mem.pieces.get(goal.piece);
      // His own trapped piece only ever as a last look (see `lastLook`).
      if (ownTrapped(mem, goal.piece) && entry?.note.kind !== 'empty') return false;
      if (entry === undefined) return true;
      return unsearched(mem, goal.piece, entry.room) || (entry.note.kind === 'empty' && entry.at < since);
    }
    case 'fetch': {
      const entry = mem.pieces.get(goal.piece);
      return !full && entry !== undefined && fetchValue(entry.note, view.self.hand) > 0 && !gaveUp(mem, goal.piece, view.time);
    }
    case 'escape':
      return full && exitOf(view) !== null;
    case 'explore':
      if (target === null || target.room === view.self.room || (full && exitOf(view) !== null)) return false;
      if (target.why === 'new') return !view.known.some((r) => r.id === target.room);
      if (target.why === 'search') return roomHasUnsearched(view, mem, target.room);
      return true;
    case 'map':
      return mem.searchedCount > 0 && view.self.clock > MAP_CLOCK;
    case 'fight':
      return view.opponent !== null;
    default:
      return false;
  }
}

/** All goals with their scores (0..100 + noise), highest first. The current goal gets STICKY (+15). */
export function scoreGoals(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Scored[] {
  const { noise } = IQ_PARAMS[iq];
  return candidates(view, mem, iq)
    .map((c) => ({
      goal: c.goal,
      score: c.score + (rand(rng) * 2 - 1) * noise + (sameGoal(c.goal, current) ? STICKY : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

/** The best goal; exploring when nothing scores at all (then there is nowhere to go either, and he waits). */
export function chooseGoal(view: BotView, mem: Memory, iq: Iq, current: Goal | null, rng: RngState): Goal {
  return scoreGoals(view, mem, iq, current, rng)[0]?.goal ?? { kind: 'explore' };
}

import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { doorKeyFor } from '../../src/games/spy-vs-spy/logic/places';
import { RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import {
  DIRS, NO_INPUT, TRAPS, neighbor,
  type Dir, type Furniture, type GameEvent, type GameState, type PlayerId, type RemedyKind, type SecretKind, type Spy, type SpyInput, type Thing, type TrapKind,
} from '../../src/games/spy-vs-spy/logic/state';

/** Level of `openGame`: the one with the 3×3 grid. */
export const OPEN_LEVEL = 2;
/** Clock and stock every spy of `openGame` starts with. */
export const OPEN_RULES = levelRules(OPEN_LEVEL);

/**
 * 3×3 embassy (level 2) with every internal door open, the exit on room 2's east wall,
 * nothing hidden, no sources, no traps. Spy 0 in room 0, spy 1 in room 8, apart
 * (createGame's own R3 shared start would otherwise put both in the same room) —
 * most tests here only place one spy and rely on the other being harmlessly far away.
 *
 *   0 1 2→exit
 *   3 4 5
 *   6 7 8
 */
export function openGame(): GameState {
  const s = createGame(1, OPEN_LEVEL);
  for (const r of s.rooms) {
    for (const d of DIRS) r.doors[d] = neighbor(s, r.id, d) !== null;
    r.exit = null;
  }
  s.rooms[2].exit = 'E';
  for (const f of s.furniture) {
    f.hidden = null;
    f.source = null;
    f.trap = null;
  }
  for (const spy of s.spies) spy.visited.fill(false);
  place(s, 0, 0, 40, RULES.roomD / 2);
  place(s, 1, 8, 160, RULES.roomD / 2);
  return s;
}

export function place(s: GameState, id: PlayerId, room: number, x: number, z: number): Spy {
  const spy = s.spies[id];
  spy.room = room;
  spy.x = x;
  spy.z = z;
  spy.visited[room] = true;
  return spy;
}

/**
 * Marks the door (or exit) at `dir` of `spy`'s current room as open, skipping the 0.3 s Akce
 * animation — for tests written before closed doors (spec §5) that only care about passing
 * through. Stays open for the full `doorOpenDuration`.
 */
export function openDoor(s: GameState, spyId: PlayerId, dir: Dir): void {
  const spy = s.spies[spyId];
  const key = doorKeyFor(s, spy.room, dir);
  s.doorOpen[key] = { phase: 'open', timer: RULES.doorOpenDuration };
}

/** The room's first piece: always one on the back wall (they are generated first). */
export function firstFurniture(s: GameState, room: number): Furniture {
  return s.furniture[s.rooms[room].furniture[0]];
}

/** Puts spy `id` right at the piece: on its front edge (z 0 for a wall piece). */
export function atFurniture(s: GameState, id: PlayerId, f: Furniture): Spy {
  return place(s, id, f.room, f.x, f.z);
}

export const input = (p: Partial<SpyInput> = {}): SpyInput => ({ ...NO_INPUT, ...p });
export const secret = (k: SecretKind): Thing => ({ kind: 'secret', secret: k, lastHolder: null });
export const kufrik = (...contents: SecretKind[]): Thing => ({ kind: 'kufrik', contents: [...contents], lastHolder: null });
export const remedy = (k: RemedyKind): Thing => ({ kind: 'remedy', remedy: k });

/** `thing` as last held by `by` (spec §7) — a copy, for asserting the result of a take. */
export function taken<T extends Thing>(thing: T, by: PlayerId): T {
  return thing.kind === 'remedy' ? thing : ({ ...thing, lastHolder: by } as T);
}

/** Runs the full step for `seconds` with fixed inputs; returns all events. */
export function run(s: GameState, inputs: [SpyInput, SpyInput], seconds: number, dt = 1 / 60): GameEvent[] {
  const out: GameEvent[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) out.push(...step(s, inputs, dt));
  return out;
}

// ---------- round 4: the trap hand (spec §1) ----------

/** One 60 Hz frame, seconds. */
export const TICK = 1 / 60;

/** Inputs with `inp` for spy `id` and nothing for the other. */
export function only(id: PlayerId, inp: SpyInput): [SpyInput, SpyInput] {
  return id === 0 ? [inp, input()] : [input(), inp];
}

/** A quick Trapulator tap (pressed one tick, released the next) while holding `with` (e.g. a walk). */
export function tap(s: GameState, id: PlayerId = 0, with_: Partial<SpyInput> = {}): GameEvent[] {
  return [
    ...step(s, only(id, input({ ...with_, trap: true })), TICK),
    ...step(s, only(id, input(with_)), TICK),
  ];
}

/** Taps until spy `id` holds `kind` (throws when it can't, e.g. stock 0). */
export function select(s: GameState, kind: TrapKind, id: PlayerId = 0): void {
  for (let i = 0; i <= TRAPS.length && s.spies[id].selected !== kind; i++) tap(s, id);
  if (s.spies[id].selected !== kind) throw new Error(`could not select ${kind}`);
}

/** One fresh Akce press (released on the next tick), then waits out the placing time. */
export function akceAndWait(s: GameState, id: PlayerId = 0): GameEvent[] {
  const ev = step(s, only(id, input({ action: true })), TICK);
  ev.push(...run(s, only(id, input()), RULES.placeTime + 0.05));
  return ev;
}


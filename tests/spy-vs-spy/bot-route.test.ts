import { describe, expect, it } from 'vitest';
import type { Danger } from '../../src/games/spy-vs-spy/bot/memory';
import { DANGER_COST, nearestFrontier, route, type Hop } from '../../src/games/spy-vs-spy/bot/route';
import type { KnownRoom } from '../../src/games/spy-vs-spy/bot/view';
import { doorKey, type Dir } from '../../src/games/spy-vs-spy/logic/state';

const NO_DANGERS: Danger[] = [];

/** A 3x3 grid (ids 0..8, row-major: id = gy*3+gx), fully doored internally, all rooms known. */
function grid3x3(): KnownRoom[] {
  const cols = 3;
  const rows = 3;
  const known: KnownRoom[] = [];
  for (let id = 0; id < cols * rows; id++) {
    const gx = id % cols;
    const gy = Math.floor(id / cols);
    const doors: Record<Dir, boolean> = { N: gy > 0, S: gy < rows - 1, E: gx < cols - 1, W: gx > 0 };
    known.push({ id, doors, exit: null });
  }
  return known;
}

function room(id: number, doors: Partial<Record<Dir, boolean>>, exit: Dir | null = null): KnownRoom {
  return { id, doors: { N: false, S: false, E: false, W: false, ...doors }, exit };
}

/** [from, ...hop.to] for asserting the visited room sequence. */
function pathIds(from: number, hops: Hop[]): number[] {
  const ids = [from];
  for (const h of hops) ids.push(h.to);
  return ids;
}

describe('route (spec §6)', () => {
  it('returns [] for the current room', () => {
    expect(route(grid3x3(), 3, 4, 4, NO_DANGERS)).toEqual([]);
  });

  it('finds a straight path across a row', () => {
    const known = grid3x3();
    const hops = route(known, 3, 0, 2, NO_DANGERS) as Hop[];
    expect(hops).not.toBeNull();
    expect(pathIds(0, hops)).toEqual([0, 1, 2]);
    expect(hops.map((h) => h.dir)).toEqual(['E', 'E']);
    expect(hops[0]).toEqual({ from: 0, dir: 'E', to: 1, key: doorKey(0, 1) });
  });

  it('picks the shorter of two routes', () => {
    // 0-1-2 direct row (2 hops) vs the long way around via row 1 (4 hops) — direct must win.
    const known = grid3x3();
    const hops = route(known, 3, 0, 2, NO_DANGERS) as Hop[];
    expect(hops.length).toBe(2);
  });

  it('detours around a danger door when the detour costs no more than DANGER_COST extra', () => {
    // A hexagon of rooms (no 1<->4 shortcut): straight 0->1->2 is 2 hops; the only other way round,
    // 0->3->4->5->2, is 4 hops (+2) — cheaper than paying +DANGER_COST(6) on the 0-1 door.
    const known = [
      room(0, { E: true, S: true }),
      room(1, { W: true, E: true }),
      room(2, { W: true, S: true }),
      room(3, { N: true, E: true }),
      room(4, { W: true, E: true }),
      room(5, { W: true, N: true }),
    ];
    const dangers: Danger[] = [{ at: { door: doorKey(0, 1) }, cause: 'pistole', since: 0 }];
    const hops = route(known, 3, 0, 2, dangers) as Hop[];
    expect(pathIds(0, hops)).toEqual([0, 3, 4, 5, 2]);
  });

  it('goes through the danger when there is no cheaper detour', () => {
    // Two rooms joined only by one door: no detour exists, so the dangerous door must be taken anyway.
    const known = [room(0, { E: true }), room(1, { W: true })];
    const dangers: Danger[] = [{ at: { door: doorKey(0, 1) }, cause: 'elektrina', since: 0 }];
    const hops = route(known, 2, 0, 1, dangers) as Hop[];
    expect(pathIds(0, hops)).toEqual([0, 1]);
  });

  it('a room danger adds DANGER_COST to entering that room', () => {
    // Straight 0->1->2 (cost 1+DANGER_COST(6)+1=8 since room 1 is dangerous) vs detour 0->3->4->5->2 (cost 4).
    const known = grid3x3();
    const dangers: Danger[] = [{ at: { room: 1 }, cause: 'casovana', since: 0 }];
    const hops = route(known, 3, 0, 2, dangers) as Hop[];
    expect(pathIds(0, hops)).toEqual([0, 3, 4, 5, 2]);
  });

  it('a piece danger does not affect routing', () => {
    const known = grid3x3();
    const dangers: Danger[] = [{ at: { piece: 42 }, cause: 'bomba', since: 0 }];
    const hops = route(known, 3, 0, 2, dangers) as Hop[];
    expect(pathIds(0, hops)).toEqual([0, 1, 2]);
  });

  it('returns null when the target is not reachable through known doors', () => {
    const known = [room(0, { E: true }), room(1, { W: true }), room(2, {})];
    expect(route(known, 3, 0, 2, NO_DANGERS)).toBeNull();
  });

  it('DANGER_COST is 6', () => {
    expect(DANGER_COST).toBe(6);
  });

  it('breaks ties deterministically in N, S, E, W order', () => {
    // 3x3 grid, from the center (id4). Room 1 (N of 4) and room 5 (E of 4) both reach room 2 in one more hop —
    // two equal-cost (2-hop) routes to room 2. N must be preferred.
    const known = [
      room(4, { N: true, E: true }),
      room(1, { E: true }), // N of 4; its E door reaches room 2
      room(5, { N: true }), // E of 4; its N door also reaches room 2
    ];
    const hops = route(known, 3, 4, 2, NO_DANGERS) as Hop[];
    expect(pathIds(4, hops)).toEqual([4, 1, 2]);
    expect(hops[0].dir).toBe('N');
  });
});

describe('nearestFrontier (spec §6)', () => {
  it('returns the hop into the closest unvisited room, tie-broken N before E', () => {
    // 2x2 grid: known room at id2 (bottom-left) has an N door to unvisited id0 and an E door to unvisited id3 —
    // both one hop away. N must win.
    const known = [room(2, { N: true, E: true })];
    const hops = nearestFrontier(known, 2, 2, 2) as Hop[];
    expect(hops.length).toBe(1);
    expect(hops[0].dir).toBe('N');
    expect(pathIds(2, hops)).toEqual([2, 0]);
  });

  it('returns the closer frontier room over a farther one', () => {
    // 2xN grid: 0 -S-> unvisited 2 (1 hop) directly; 0 -E-> known 1 -S-> unvisited 3 (2 hops). 2 is nearer.
    const known = [room(0, { E: true, S: true }), room(1, { W: true, S: true })];
    const hops = nearestFrontier(known, 2, 3, 0) as Hop[];
    expect(pathIds(0, hops)).toEqual([0, 2]);
  });

  it('returns null when every known door leads back into known space', () => {
    const known = grid3x3();
    expect(nearestFrontier(known, 3, 3, 0)).toBeNull();
  });

  it('has no dangers parameter — routing to the frontier ignores danger entirely', () => {
    expect(route.length).toBe(5);
    expect(nearestFrontier.length).toBe(4);
  });
});

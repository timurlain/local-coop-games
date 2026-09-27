import { DIRS, doorKey, neighbor, type Dir } from '../logic/state';
import type { Danger } from './memory';
import type { KnownRoom } from './view';

/** One step of a route: leaving `from` through the door facing `dir`, arriving at `to` via door `key` (spec §6). */
export interface Hop {
  from: number;
  dir: Dir;
  to: number;
  key: string;
}

/** A door or the room it leads to costs this much extra when a known danger sits there. */
export const DANGER_COST = 6;

const NONE: ReadonlySet<string> = new Set();

/** Large enough that `neighbor`'s row bound never rejects a real neighbour; only known doors are ever followed. */
const NO_ROW_LIMIT = Number.MAX_SAFE_INTEGER;

function hopCost(dangers: readonly Danger[], key: string, to: number): number {
  let cost = 1;
  for (const d of dangers) {
    if ('door' in d.at && d.at.door === key) cost += DANGER_COST;
    else if ('room' in d.at && d.at.room === to) cost += DANGER_COST;
  }
  return cost;
}

function reconstruct(prevHop: ReadonlyMap<number, Hop>, from: number, target: number): Hop[] {
  const hops: Hop[] = [];
  let cur = target;
  while (cur !== from) {
    const hop = prevHop.get(cur);
    if (hop === undefined) return [];
    hops.push(hop);
    cur = hop.from;
  }
  hops.reverse();
  return hops;
}

/** Picks the unvisited room with the smallest known distance (a plain array scan: tiny grids, ≤ 36 rooms). */
function pickNearest(dist: ReadonlyMap<number, number>, visited: ReadonlySet<number>): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const [id, d] of dist) {
    if (!visited.has(id) && d < bestDist) {
      best = id;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Cheapest path over known rooms and their doors (spec §6): each door costs 1, +DANGER_COST when a known danger
 * sits on that door or in the room it leads to; `blocked` door keys are never passed. `null` if `to` isn't reachable
 * through known doors. `from` may be unvisited only when it equals `to` (returns `[]`); ties break in `DIRS` order
 * (N, S, E, W).
 */
export function route(
  known: readonly KnownRoom[], cols: number, from: number, to: number, dangers: readonly Danger[],
  blocked: ReadonlySet<string> = NONE,
): Hop[] | null {
  if (from === to) return [];

  const byId = new Map(known.map((r) => [r.id, r]));
  const dist = new Map<number, number>([[from, 0]]);
  const prevHop = new Map<number, Hop>();
  const visited = new Set<number>();

  for (;;) {
    const currentId = pickNearest(dist, visited);
    if (currentId === null) return null;
    if (currentId === to) return reconstruct(prevHop, from, to);
    visited.add(currentId);

    const room = byId.get(currentId);
    if (room === undefined) continue; // an unvisited room has no known doors to follow further

    const currentDist = dist.get(currentId) as number;
    for (const dir of DIRS) {
      if (!room.doors[dir]) continue;
      const nb = neighbor({ cols, rows: NO_ROW_LIMIT }, currentId, dir);
      if (nb === null) continue;
      const key = doorKey(currentId, nb);
      if (blocked.has(key)) continue;
      const nd = currentDist + hopCost(dangers, key, nb);
      if (!dist.has(nb) || nd < (dist.get(nb) as number)) {
        dist.set(nb, nd);
        prevHop.set(nb, { from: currentId, dir, to: nb, key });
      }
    }
  }
}

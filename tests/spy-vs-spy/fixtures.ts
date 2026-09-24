import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import {
  DIRS, NO_INPUT, neighbor,
  type Furniture, type GameState, type PlayerId, type RemedyKind, type SecretKind, type Spy, type SpyInput, type Thing,
} from '../../src/games/spy-vs-spy/logic/state';

/**
 * 3×3 embassy with every internal door open, the exit on room 2's east wall,
 * nothing hidden, no sources, no traps. Spy 0 in room 0, spy 1 in room 8.
 *
 *   0 1 2→exit
 *   3 4 5
 *   6 7 8
 */
export function openGame(): GameState {
  const s = createGame(1, 'mala');
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

export function firstFurniture(s: GameState, room: number): Furniture {
  return s.furniture[s.rooms[room].furniture[0]];
}

export function atFurniture(s: GameState, id: PlayerId, f: Furniture): Spy {
  return place(s, id, f.room, f.x, 0);
}

export const input = (p: Partial<SpyInput> = {}): SpyInput => ({ ...NO_INPUT, ...p });
export const secret = (k: SecretKind): Thing => ({ kind: 'secret', secret: k });
export const kufrik = (...contents: SecretKind[]): Thing => ({ kind: 'kufrik', contents: [...contents] });
export const remedy = (k: RemedyKind): Thing => ({ kind: 'remedy', remedy: k });

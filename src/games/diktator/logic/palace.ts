import type { FactionId, GroupId, StrengthGroupId } from './groups';
import { RULES } from './rules';

/** The two playable characters: Zogu (politics, money) and velitel Kovář (security). */
export const HEROES = ['zogu', 'velitel'] as const;
export type Hero = (typeof HEROES)[number];

export type Direction = 'up' | 'down' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** A room id from the scenario's layout. */
export type RoomId = string;

/** The groups that have a room of their own and can be talked to there. */
export const ROOM_GROUPS = ['armada', 'rolnici', 'statkari', 'policie'] as const;
export type RoomGroupId = (typeof ROOM_GROUPS)[number];

/** Scenario data: the room grid and what happens where. */
export interface PalaceLayout {
  /** Rows top to bottom; arrows move one cell. */
  readonly grid: readonly (readonly RoomId[])[];
  readonly names: Readonly<Record<RoomId, string>>;
  readonly start: Readonly<Record<Hero, RoomId>>;
  readonly throne: RoomId;
  readonly study: RoomId;
  readonly mother: RoomId;
  readonly envoys: RoomId;
  readonly guardroom: RoomId;
  readonly groupRoom: Readonly<Record<RoomGroupId, RoomId>>;
  /** Where a decision is sealed; decisions not listed are sealed in the study. */
  readonly decisionRoom: Readonly<Record<string, RoomId>>;
}

/** One quarter's palace day. Reset at the start of every quarter. */
export interface PalaceState {
  at: Record<Hero, RoomId>;
  hours: Record<Hero, number>;
  /** Who carries the royal seal; null = it lies in the study. */
  seal: Hero | null;
  /** Rooms entered this quarter (their mood is known). */
  seen: Record<RoomId, true>;
  /** Factions whose plot the commander revealed this quarter. */
  investigated: Partial<Record<FactionId, true>>;
  /** The commander guards the king tonight. */
  guarded: boolean;
  /** Pressed "Konec dne". The evening starts when both have. */
  done: Record<Hero, boolean>;
}

export function other(h: Hero): Hero {
  return h === 'zogu' ? 'velitel' : 'zogu';
}

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

function cellOf(L: PalaceLayout, room: RoomId): readonly [number, number] {
  for (let r = 0; r < L.grid.length; r++) {
    const c = L.grid[r].indexOf(room);
    if (c >= 0) return [r, c];
  }
  throw new Error(`room ${room} is not in the palace`);
}

/** The room one step away, or null at a wall. */
export function neighbour(L: PalaceLayout, room: RoomId, dir: Direction): RoomId | null {
  const [r, c] = cellOf(L, room);
  const [dr, dc] = STEP[dir];
  return L.grid[r + dr]?.[c + dc] ?? null;
}

/** Directions with a room behind them, in the order up, down, left, right. */
export function exits(L: PalaceLayout, room: RoomId): Direction[] {
  return DIRECTIONS.filter((d) => neighbour(L, room, d) !== null);
}

/** Where a group can be seen: its own room; rebels on the guardroom's map; foreign powers in the envoys' salon. */
export function roomOfGroup(L: PalaceLayout, g: GroupId): RoomId {
  if ((ROOM_GROUPS as readonly string[]).includes(g)) return L.groupRoom[g as RoomGroupId];
  if (g === 'povstalci') return L.guardroom;
  return L.envoys;
}

/** Groups Zogu can talk to in this room. */
export function groupsInRoom(L: PalaceLayout, room: RoomId): StrengthGroupId[] {
  return ROOM_GROUPS.filter((g) => L.groupRoom[g] === room);
}

export function decisionRoom(L: PalaceLayout, decisionId: string): RoomId {
  return L.decisionRoom[decisionId] ?? L.study;
}

export function newPalaceDay(L: PalaceLayout): PalaceState {
  return {
    at: { zogu: L.start.zogu, velitel: L.start.velitel },
    hours: { zogu: RULES.palace.hours.zogu, velitel: RULES.palace.hours.velitel },
    seal: null,
    seen: { [L.start.zogu]: true, [L.start.velitel]: true },
    investigated: {},
    guarded: false,
    done: { zogu: false, velitel: false },
  };
}

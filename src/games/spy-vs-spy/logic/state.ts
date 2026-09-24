import type { RngState } from '../../../shared/rng';

export type PlayerId = 0 | 1;
export type Dir = 'N' | 'S' | 'E' | 'W';
export type EmbassySize = 'mala' | 'stredni' | 'velka';
export type SecretKind = 'klic' | 'penize' | 'pas' | 'plany';
export type RemedyKind = 'voda' | 'kleste' | 'destnik' | 'nuzky';
export type FurnitureTrapKind = 'bomba' | 'pruzina';
export type DoorTrapKind = 'elektrina' | 'pistole';
export type TrapKind = FurnitureTrapKind | DoorTrapKind | 'casovana';
export type FurnitureKind = 'stul' | 'knihovna' | 'lampa' | 'pohovka' | 'trezor' | 'obraz' | 'skrin' | 'vesak';
export type DeathCause = TrapKind | 'fight';

export const DIRS: readonly Dir[] = ['N', 'S', 'E', 'W'];
export const SECRETS: readonly SecretKind[] = ['klic', 'penize', 'pas', 'plany'];
export const REMEDIES: readonly RemedyKind[] = ['voda', 'kleste', 'destnik', 'nuzky'];
export const TRAPS: readonly TrapKind[] = ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana'];
export const FURNITURE_KINDS: readonly FurnitureKind[] = [
  'stul', 'knihovna', 'lampa', 'pohovka', 'trezor', 'obraz', 'skrin', 'vesak',
];
export const OPPOSITE: Readonly<Record<Dir, Dir>> = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** Door-trap key used for the airport exit door. */
export const EXIT_KEY = 'exit';

export type Thing =
  | { kind: 'secret'; secret: SecretKind }
  | { kind: 'kufrik'; contents: SecretKind[] }
  | { kind: 'remedy'; remedy: RemedyKind };

export interface FurnitureTrap {
  kind: FurnitureTrapKind;
  owner: PlayerId;
}

export interface Furniture {
  id: number;
  room: number;
  kind: FurnitureKind;
  /** x position on the back wall, logic units */
  x: number;
  /** the single hidden-thing slot */
  hidden: Thing | null;
  /** infinite remedy source (does not use the hidden slot) */
  source: RemedyKind | null;
  trap: FurnitureTrap | null;
}

export interface Room {
  id: number;
  gx: number;
  gy: number;
  doors: Record<Dir, boolean>;
  /** side of this room that holds the airport exit door, if any */
  exit: Dir | null;
  furniture: number[];
}

export interface DoorTrap {
  kind: DoorTrapKind;
  owner: PlayerId;
}

export interface TimeBomb {
  room: number;
  x: number;
  z: number;
  fuse: number;
  owner: PlayerId;
}

export type SpyMode = 'normal' | 'searching' | 'dead' | 'out' | 'escaped';

/** Held state of one player's controls for this tick. Edges are derived from `Spy.prev`. */
export interface SpyInput {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  action: boolean;
  trap: boolean;
}

export const NO_INPUT: Readonly<SpyInput> = { moveX: 0, moveY: 0, action: false, trap: false };

export interface Spy {
  id: PlayerId;
  room: number;
  x: number;
  z: number;
  facing: -1 | 1;
  hand: Thing | null;
  /** seconds left */
  clock: number;
  health: number;
  mode: SpyMode;
  /** countdown for 'searching' and 'dead' */
  modeTimer: number;
  searchTarget: number | null;
  /** furniture id while Akce is being held (hide vs search decision) */
  holdTarget: number | null;
  holdTime: number;
  deathCause: DeathCause | null;
  menuOpen: boolean;
  menuCursor: number;
  armed: TrapKind | null;
  stock: Record<TrapKind, number>;
  swingCooldown: number;
  /** >0 while the club swing animation shows */
  swingAnim: number;
  blocking: boolean;
  /** >0 while "Zamčeno" is shown */
  lockedMsg: number;
  visited: boolean[];
  prev: SpyInput;
}

export type GameResult = { kind: 'win'; winner: PlayerId } | { kind: 'draw' };

export interface GameState {
  seed: number;
  cols: number;
  rows: number;
  rooms: Room[];
  furniture: Furniture[];
  doorTraps: Record<string, DoorTrap>;
  timeBombs: TimeBomb[];
  spies: [Spy, Spy];
  rng: RngState;
  time: number;
  tick: number;
  result: GameResult | null;
}

export type GameEvent =
  | { type: 'searchStart'; spy: PlayerId }
  | { type: 'found'; spy: PlayerId; thing: Thing | null }
  | { type: 'hidden'; spy: PlayerId }
  | { type: 'trapSet'; spy: PlayerId; trap: TrapKind }
  | { type: 'trapFailed'; spy: PlayerId }
  | { type: 'disarmed'; spy: PlayerId; trap: TrapKind }
  | { type: 'died'; spy: PlayerId; cause: DeathCause }
  | { type: 'respawn'; spy: PlayerId }
  | { type: 'swing'; spy: PlayerId }
  | { type: 'hit'; spy: PlayerId }
  | { type: 'blocked'; spy: PlayerId }
  | { type: 'door'; spy: PlayerId }
  | { type: 'locked'; spy: PlayerId }
  | { type: 'tick'; room: number }
  | { type: 'explode'; room: number }
  | { type: 'escaped'; spy: PlayerId }
  | { type: 'timeout'; spy: PlayerId }
  | { type: 'draw' };

const DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
};

export function neighbor(grid: { cols: number; rows: number }, roomId: number, dir: Dir): number | null {
  const gx = roomId % grid.cols;
  const gy = Math.floor(roomId / grid.cols);
  const [dx, dy] = DELTA[dir];
  const nx = gx + dx;
  const ny = gy + dy;
  if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) return null;
  return ny * grid.cols + nx;
}

export function doorKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** A spy that can be hit, trapped and blown up. */
export function isActive(spy: Spy): boolean {
  return spy.mode === 'normal' || spy.mode === 'searching';
}

export function opponentOf(state: GameState, spy: Spy): Spy {
  return state.spies[spy.id === 0 ? 1 : 0];
}

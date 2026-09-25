import type { RngState } from '../../../shared/rng';

export type PlayerId = 0 | 1;
export type Dir = 'N' | 'S' | 'E' | 'W';
export type SecretKind = 'klic' | 'penize' | 'pas' | 'plany';
export type RemedyKind = 'voda' | 'kleste' | 'destnik' | 'nuzky';
export type FurnitureTrapKind = 'bomba' | 'pruzina';
export type DoorTrapKind = 'elektrina' | 'pistole';
export type TrapKind = FurnitureTrapKind | DoorTrapKind | 'casovana';
export type FurnitureKind =
  | 'stul' | 'knihovna' | 'lampa' | 'pohovka' | 'trezor' | 'obraz' | 'skrin' | 'vesak'
  | 'kartoteka' | 'gramofon' | 'globus' | 'kredenc' | 'radio' | 'kvetina' | 'krb' | 'telefon'
  | 'hasicak' | 'naradi' | 'lekarnicka' | 'zbrojnice';
/** Furniture kinds that are always an infinite source of exactly one remedy (never ordinary theme pool pieces). */
export type FixtureKind = 'vesak' | 'hasicak' | 'naradi' | 'lekarnicka';
/** Spec §8: a jab (Akce) or a head bash (Akce while holding up). */
export type AttackKind = 'jab' | 'bash';
export type DeathCause = TrapKind | 'fight';
/** Visual theme of a room: wall colour, floor style and the furniture pool. */
export type RoomTheme =
  | 'kancelar' | 'knihovna' | 'salonek' | 'archiv' | 'konferencni' | 'kuchynka' | 'sifrovna' | 'pracovna';
/** Country whose Prague embassy the match is set in (1930s, interwar); visual only. */
export type HostCountry = 'cs' | 'pl' | 'de' | 'hu' | 'at';
export const HOSTS: readonly HostCountry[] = ['cs', 'pl', 'de', 'hu', 'at'];
/** Range of the in-game year, inclusive. */
export const YEAR_MIN = 1929;
export const YEAR_MAX = 1937;

export const DIRS: readonly Dir[] = ['N', 'S', 'E', 'W'];
export const SECRETS: readonly SecretKind[] = ['klic', 'penize', 'pas', 'plany'];
export const TRAPS: readonly TrapKind[] = ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana'];
export const FURNITURE_KINDS: readonly FurnitureKind[] = [
  'stul', 'knihovna', 'lampa', 'pohovka', 'trezor', 'obraz', 'skrin', 'vesak',
  'kartoteka', 'gramofon', 'globus', 'kredenc', 'radio', 'kvetina', 'krb', 'telefon',
  'hasicak', 'naradi', 'lekarnicka', 'zbrojnice',
];
/** Round 6 §4: the armoury cabinet (zbrojní skříň), one per embassy; searching it hands out a trap, never a thing. */
export const ARMOURY_KIND = 'zbrojnice' satisfies FurnitureKind;
export const FIXTURE_KINDS: readonly FixtureKind[] = ['vesak', 'hasicak', 'naradi', 'lekarnicka'];
/** Kinds that may stand free on the floor (round 5 §5); tall pieces and fixtures always stay on the wall. */
export const FREE_STANDING_KINDS: readonly FurnitureKind[] = ['stul', 'pohovka', 'globus', 'kvetina', 'trezor'];
/** A fixture's kind always means its remedy; set on `Furniture.source` for every fixture and only for fixtures. */
export const FIXTURE_REMEDY: Readonly<Record<FixtureKind, RemedyKind>> = {
  vesak: 'destnik',
  hasicak: 'voda',
  naradi: 'kleste',
  lekarnicka: 'nuzky',
};
/**
 * Whether a piece can hold a hidden thing for the generator and for death drops (round 6 §4): not a fixture (its
 * remedy source; the generator never hides anything there and drops skip it) and not the armoury (nothing can ever be
 * hidden in it). The one rule for "can hold an item" — use it instead of checking `source` directly.
 */
export function canHold(f: Pick<Furniture, 'kind' | 'source'>): boolean {
  return f.source === null && f.kind !== ARMOURY_KIND;
}

/** Wall decorations: purely visual, never searchable. */
export type FlagKind = `vlajka_${HostCountry}`;
export type DecorKind =
  | 'plakat_psst' | 'plakat_mapa' | 'plakat_tajne' | 'plakat_spion' | 'portret' | 'hodiny' | 'okno' | 'telegram'
  | FlagKind;

export interface RoomDecor {
  kind: DecorKind;
  /** centre x on the back wall, logic units */
  x: number;
}

export const ROOM_THEMES: readonly RoomTheme[] = [
  'kancelar', 'knihovna', 'salonek', 'archiv', 'konferencni', 'kuchynka', 'sifrovna', 'pracovna',
];
export const OPPOSITE: Readonly<Record<Dir, Dir>> = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** Door-trap key used for the airport exit door. */
export const EXIT_KEY = 'exit';

export type Thing =
  | { kind: 'secret'; secret: SecretKind; lastHolder: PlayerId | null }
  | { kind: 'kufrik'; contents: SecretKind[]; lastHolder: PlayerId | null }
  | { kind: 'remedy'; remedy: RemedyKind };

export interface FurnitureTrap {
  kind: FurnitureTrapKind;
  owner: PlayerId;
}

export interface Furniture {
  id: number;
  room: number;
  kind: FurnitureKind;
  /** floor position, logic units: x along the room; z = 0 for a piece against the back wall, otherwise the front
   *  edge of a free-standing piece (round 5 §5) */
  x: number;
  z: number;
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
  /** visual only */
  theme: RoomTheme;
  /** visual only: 1-2 pictures in the band above the furniture */
  decor: RoomDecor[];
  /** visual only: floor rug in the middle of the room */
  rug: boolean;
}

export interface DoorTrap {
  kind: DoorTrapKind;
  owner: PlayerId;
}

/** Runtime state of one door's Akce-opened cycle (spec §5): absent from `GameState.doorOpen` = closed. */
export type DoorPhase = 'opening' | 'open';

export interface DoorRuntimeState {
  phase: DoorPhase;
  /** seconds left in this phase */
  timer: number;
}

export interface TimeBomb {
  room: number;
  x: number;
  z: number;
  fuse: number;
  owner: PlayerId;
}

/** Where a trap in hand goes (round 4 §1): furniture (bomba/pružina), a door key (elektřina/pistole) or the floor
 *  at the spy's feet (časovaná). */
export type PlaceTarget =
  | { on: 'furniture'; furniture: number }
  | { on: 'door'; key: string }
  | { on: 'floor' };

/** A trap being put down (round 4 §1): the spy is immobile until `timer` runs out, then it is placed. */
export interface Placing {
  trap: TrapKind;
  target: PlaceTarget;
  /** seconds left */
  timer: number;
}

/** A Trapulator stock digit blinking after +1 (round 6 §4). */
export interface StockFlash {
  trap: TrapKind;
  /** seconds left */
  timer: number;
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
  /** seconds since the last hit taken; drives strength recovery, reset on hit and on respawn */
  sinceHit: number;
  /** running total from `scoreDeltas` (spec §7); can go negative */
  score: number;
  mode: SpyMode;
  /** countdown for 'searching' and 'dead' */
  modeTimer: number;
  searchTarget: number | null;
  deathCause: DeathCause | null;
  /** the trap in hand (round 4 §1), chosen by tapping the Trapulator; its stock is spent only when placed */
  selected: TrapKind | null;
  /** seconds the Trapulator button has been held in the current press; null when up or the press was cancelled
   *  (a release under `RULES.trapTapMax` is a tap, reaching it opens the map) */
  trapPress: number | null;
  /** true while the big map (MAPA) is shown; only while the Trapulator button stays held after `trapTapMax` */
  mapOpen: boolean;
  /** a trap being put down (immobile), or null */
  placing: Placing | null;
  /** >0 while the refusal head shake shows (round 4 §1); purely visual, never blocks anything */
  refuseTimer: number;
  stock: Record<TrapKind, number>;
  /** Round 6 §4: seconds until the armoury opens again for this spy (0 = open); ticked in `step` in every mode */
  armouryTimer: number;
  /** Round 6 §4: a stock digit just went up (salvaged or resupplied) and blinks on the Trapulator; visual only */
  stockFlash: StockFlash | null;
  /** seconds until another swing may start; set at the strike (spec §8) */
  swingCooldown: number;
  /** >0 while the club swing animation shows (wind-up + strike) */
  swingAnim: number;
  /** the swing in progress (spec §8): Akce = jab, Akce + up = head bash; null once the animation ends */
  attack: AttackKind | null;
  /** seconds of wind-up left before the strike lands; 0 once it has struck */
  strikeIn: number;
  /** holding away from the opponent: stops a jab */
  blocking: boolean;
  /** holding down in a shared room while not swinging (spec §8): stops a head bash, can't move */
  ducking: boolean;
  /** seconds left of the airport guard's kick (spec §9): tumbling back, immobile; 0 = not kicked */
  kickTimer: number;
  /** door key this spy is opening (immobile); its 0.3 s countdown lives on `GameState.doorOpen[key]` (spec §5) */
  doorOpening: string | null;
  /** `GameState.tick` when the spy entered its current room: door pass, match start (same for both) or respawn (spec §2) */
  enteredAt: number;
  visited: boolean[];
  /** internal doors passed, most recent last, at most `RULES.trailLength`; kept across death (spec §9) */
  trail: Dir[];
  prev: SpyInput;
}

export type GameResult = { kind: 'win'; winner: PlayerId } | { kind: 'draw' };

export interface GameState {
  seed: number;
  /** visual only: whose embassy this is (from the looks stream) */
  host: HostCountry;
  /** visual only: the year shown on the title card, YEAR_MIN..YEAR_MAX */
  year: number;
  /** 1-8 (spec §4) */
  level: number;
  cols: number;
  rows: number;
  /** „Skrýt letiště": the exit is hidden from a spy until it holds the full kufřík (see `exitVisibleTo`) */
  hideAirport: boolean;
  rooms: Room[];
  furniture: Furniture[];
  doorTraps: Record<string, DoorTrap>;
  /** open/opening state of internal doors and the exit, keyed like `doorTraps` (incl. `EXIT_KEY`); spec §5 */
  doorOpen: Record<string, DoorRuntimeState>;
  timeBombs: TimeBomb[];
  spies: [Spy, Spy];
  rng: RngState;
  time: number;
  tick: number;
  result: GameResult | null;
}

export type GameEvent =
  | { type: 'searchStart'; spy: PlayerId }
  | { type: 'found'; spy: PlayerId; thing: Thing | null; furniture: number; stolenFrom?: PlayerId }
  | { type: 'stored'; spy: PlayerId; secret: SecretKind; furniture: number; stolenFrom?: PlayerId }
  | { type: 'swapped'; spy: PlayerId; gave: Thing; took: Thing; furniture: number; stolenFrom?: PlayerId }
  | { type: 'hidden'; spy: PlayerId; thing: Thing; furniture: number }
  /** round 6 §3: the piece holds a secret kind the spy already has (one of a kind); it stays hidden, the spy shrugs */
  | { type: 'alreadyHave'; spy: PlayerId; furniture: number }
  | { type: 'dropped'; spy: PlayerId; thing: Thing | null; furniture: number | null }
  | { type: 'trapSet'; spy: PlayerId; trap: TrapKind }
  /** round 4 §1: the spy shakes his head — no valid target, target already trapped, or a shared room */
  | { type: 'refused'; spy: PlayerId }
  /** a matching remedy defused a trap (round 4 §3: the render shows how, by `remedy`) */
  | { type: 'disarmed'; spy: PlayerId; trap: FurnitureTrapKind | DoorTrapKind; remedy: RemedyKind }
  /** round 6 §4: right after `disarmed`, when the trap was the opponent's — the disarming spy keeps it (+1 stock) */
  | { type: 'salvaged'; spy: PlayerId; trap: FurnitureTrapKind | DoorTrapKind }
  /** round 6 §4: the armoury handed out one trap (+1 stock of `trap`) and closed for this spy */
  | { type: 'resupplied'; spy: PlayerId; trap: TrapKind; furniture: number }
  /** `killer` is set only for cause 'fight': the opponent who landed the strike (spec §7). */
  | { type: 'died'; spy: PlayerId; cause: DeathCause; killer?: PlayerId }
  | { type: 'respawn'; spy: PlayerId }
  | { type: 'swing'; spy: PlayerId }
  | { type: 'hit'; spy: PlayerId }
  | { type: 'blocked'; spy: PlayerId; kind: AttackKind }
  | { type: 'door'; spy: PlayerId }
  | { type: 'doorOpened'; spy: PlayerId; key: string }
  | { type: 'bump'; spy: PlayerId }
  /** the airport guard kicked this spy back from the exit (spec §9) */
  | { type: 'bounced'; spy: PlayerId }
  | { type: 'tick'; room: number }
  | { type: 'explode'; room: number }
  | { type: 'escaped'; spy: PlayerId }
  | { type: 'timeout'; spy: PlayerId }
  | { type: 'mapOpened'; spy: PlayerId }
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

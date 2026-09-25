import type { SecretKind, TrapKind } from './state';

/** One difficulty level (spec §4): embassy grid, clock per spy and each spy's starting trap stock. */
export interface LevelRules {
  cols: number;
  rows: number;
  clockSeconds: number;
  trapStockPerSpy: Readonly<Record<TrapKind, number>>;
}

const level = (
  cols: number, rows: number, minutes: number,
  [bomba, pruzina, elektrina, pistole, casovana]: readonly [number, number, number, number, number],
): LevelRules => ({ cols, rows, clockSeconds: minutes * 60, trapStockPerSpy: { bomba, pruzina, elektrina, pistole, casovana } });

/** Every tunable number lives here. Units: logic units, seconds. */
export const RULES = {
  roomW: 200,
  roomD: 40,
  /** half-width of N/S doors along x */
  doorHalfX: 12,
  /** half-width of E/W doors along z */
  doorHalfZ: 8,
  /** how close to a wall counts as "standing at the door" (round 5 §1: 6 → 10) */
  doorReach: 10,
  speedX: 60,
  speedZ: 30,
  /**
   * Back-wall furniture positions (round 5 §5): one piece at most on each side of the back door, at one of these x.
   * With the round-5 reach no two pieces' zones touch, nor the back door's (x 88-112) or a side door's (x ≤ 10).
   */
  slotX: [[36, 48, 60], [140, 152, 164]] as readonly (readonly number[])[],
  /** free-standing pieces (round 5 §5): x on the floor to either side of the back door (x 88-112, so even the widest
   *  piece never stands in front of it), z = their front edge */
  freeSlotX: [62, 66, 70, 130, 134, 138] as readonly number[],
  freeSlotZ: [13, 15, 17] as readonly number[],
  /** chance a room gets a free-standing piece (at most one) */
  freeStandingChance: 0.5,
  /** where a spy starts and respawns: centre x, in front of any free-standing piece's reach-free floor */
  spawnZ: 28,
  /** Reach of a piece (round 5 §1: 14 → 22, 8 → 12), for searching and placing alike: up to `furnitureReachX` to
   *  either side and `furnitureReachZ` in front of it (of the wall, or of a free-standing piece's front edge). */
  furnitureReachX: 22,
  furnitureReachZ: 12,
  furniturePerRoom: { min: 2, max: 3 },
  /** Round 6 §3: how many of each secret kind the generator hides. A spy still carries at most one of a kind, and
   *  escape still needs one of each in the kufřík. */
  secretCopies: { klic: 1, penize: 2, pas: 2, plany: 1 } as Readonly<Record<SecretKind, number>>,
  extraDoorChance: 0.5,
  searchTime: 0.5,
  timeBombFuse: 15,
  /** clock cost to the placer of any successfully-placed trap (incl. the time bomb) */
  trapSetCost: 3,
  /** Trapulator button (round 4 §1): a press released sooner is a tap (cycles the trap in hand); held this long
   *  it opens the map instead */
  trapTapMax: 0.5,
  /** Akce with a trap in hand: the spy stands still this long, then the trap is placed */
  placeTime: 0.4,
  /** the refusal head shake; visual only */
  refuseTime: 0.5,
  /** clock cost to open the big map (MAPA), charged once per opening */
  mapCost: 5,
  deathPenalty: 30,
  respawnTime: 3,
  health: 7,
  /** seconds after the last hit before strength recovery starts */
  regenDelay: 2.5,
  /** seconds between each +1 strength recovery tick once it has started */
  regenInterval: 2.5,
  fightRangeX: 48,
  fightRangeZ: 16,
  /** after the strike lands, before another swing may start (spec §8) */
  swingCooldown: 0.4,
  /** jab (Akce) wind-up; the damage lands at its end (spec §8) */
  swingWindup: 0.15,
  /** head bash (Akce + up) wind-up; the damage lands at its end (spec §8) */
  bashWindup: 0.3,
  /** how long the strike frame shows after the wind-up; rendering only */
  strikeAnim: 0.2,
  jabDamage: 1,
  bashDamage: 2,
  knockback: 12,
  /** a blocked jab shoves the attacker this far back, away from the defender (round 4 §2) */
  blockPushback: 8,
  /** the airport guard (spec §9): how far he kicks a spy without the full kufřík back into the room, and how
   *  long that spy tumbles, immobile */
  guardKick: 30,
  guardKickTime: 0.8,
  /** Akce at a closed door (spec §5): immobile while it swings open, then open for both spies. */
  doorOpenTime: 0.3,
  doorOpenDuration: 1.5,
  /** Breadcrumbs (spec §9): door moves remembered per spy, and the last level that shows them. */
  trailLength: 9,
  breadcrumbsMaxLevel: 6,
  /** Levels 1-8, index = level - 1 (spec §4). Stock order: bomba/pružina/elektřina/pistole/časovaná. */
  levels: [
    level(3, 3, 5, [1, 1, 1, 1, 1]),
    level(3, 3, 6, [2, 2, 1, 1, 1]),
    level(4, 3, 8, [2, 2, 2, 2, 1]),
    level(4, 4, 10, [3, 3, 2, 2, 2]),
    level(5, 4, 12, [3, 3, 3, 3, 2]),
    level(6, 4, 15, [4, 4, 3, 3, 2]),
    level(6, 5, 18, [5, 5, 4, 4, 2]),
    level(6, 6, 24, [8, 8, 8, 8, 3]),
  ] as readonly LevelRules[],
  defaultLevel: 3,
};

/** Every playable level, 1-based. */
export const LEVELS: readonly number[] = RULES.levels.map((_, i) => i + 1);

export function isLevel(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= RULES.levels.length;
}

export function levelRules(n: number): LevelRules {
  if (!isLevel(n)) throw new Error(`no level ${n}`);
  return RULES.levels[n - 1];
}

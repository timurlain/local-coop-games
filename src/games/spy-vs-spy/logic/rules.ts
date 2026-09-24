import type { TrapKind } from './state';

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
  /** how close to a wall counts as "standing at the door" */
  doorReach: 6,
  speedX: 60,
  speedZ: 30,
  /** furniture slots on the back wall */
  slotX: [30, 65, 135, 170] as readonly number[],
  furnitureReachX: 14,
  furnitureReachZ: 8,
  furniturePerRoom: { min: 2, max: 4 },
  extraDoorChance: 0.5,
  searchTime: 0.5,
  hideHold: 0.4,
  timeBombFuse: 15,
  /** clock cost to the placer of any successfully-placed trap (incl. the time bomb) */
  trapSetCost: 3,
  /** clock cost to open the big map (MAPA), charged once per opening */
  mapCost: 5,
  deathPenalty: 30,
  respawnTime: 3,
  health: 7,
  /** seconds after the last hit before strength recovery starts */
  regenDelay: 2.5,
  /** seconds between each +1 strength recovery tick once it has started */
  regenInterval: 2.5,
  fightRangeX: 24,
  fightRangeZ: 8,
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
  lockedMsgTime: 1,
  /** Akce at a closed door (spec §5): immobile while it swings open, then open for both spies. */
  doorOpenTime: 0.3,
  doorOpenDuration: 1.5,
  /** Levels 1-8, index = level - 1 (spec §4). Stock order: bomba/pružina/elektřina/pistole/časovaná. */
  levels: [
    level(3, 2, 5, [1, 1, 1, 1, 1]),
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

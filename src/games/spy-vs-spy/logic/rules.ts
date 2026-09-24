import type { EmbassySize, TrapKind } from './state';

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
  trapStock: { bomba: 3, pruzina: 3, elektrina: 3, pistole: 3, casovana: 2 } as Readonly<Record<TrapKind, number>>,
  timeBombFuse: 15,
  /** clock cost to the placer of any successfully-placed trap (incl. the time bomb) */
  trapSetCost: 3,
  deathPenalty: 30,
  respawnTime: 3,
  health: 7,
  /** seconds after the last hit before strength recovery starts */
  regenDelay: 2.5,
  /** seconds between each +1 strength recovery tick once it has started */
  regenInterval: 2.5,
  fightRangeX: 24,
  fightRangeZ: 8,
  swingCooldown: 0.4,
  swingAnim: 0.35,
  /** portion of swingAnim spent winding up before the strike lands; rendering only */
  swingWindup: 0.15,
  knockback: 12,
  clockOptions: [300, 480, 720] as readonly number[],
  defaultClock: 480,
  lockedMsgTime: 1,
  sizes: {
    mala: { cols: 3, rows: 3 },
    stredni: { cols: 4, rows: 3 },
    velka: { cols: 5, rows: 4 },
  } as Readonly<Record<EmbassySize, { cols: number; rows: number }>>,
};

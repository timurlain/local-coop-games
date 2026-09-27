import { RULES } from '../logic/rules';
import type { PlayerId } from '../logic/state';

/** The computer opponent's level (spec bot §1, §6): 1 nemotorný … 5 mistr špión. */
export type Iq = 1 | 2 | 3 | 4 | 5;
export const IQS: readonly Iq[] = [1, 2, 3, 4, 5];

export function isIq(n: unknown): n is Iq {
  return typeof n === 'number' && (IQS as readonly number[]).includes(n);
}

/** How one IQ level plays (spec bot §6 table; IQ 2 and 4 in between, tuned by the tournament). */
export interface IqParams {
  /** s between seeing and pressing */
  reaction: number;
  /** s between decisions */
  thinkEvery: number;
  /** chance a memory entry fades per minute */
  forgetPerMinute: number;
  /** whether his own traps fade from memory too */
  forgetOwnTraps: boolean;
  /** decision noise added to goal scores (score units, see decide.ts) */
  noise: number;
  /** 0..1 appetite for setting traps */
  trapWill: number;
  /** trap placement uses glances, items and the exit */
  smartTraps: boolean;
  /** chance per second to glance at the other half of the screen */
  glancePerSecond: number;
  /** chance per motor intent of a wrong or overshooting input */
  slipChance: number;
  /** chance to read a head bash and duck */
  duckChance: number;
  /** chance to hold block when a jab is likely */
  preBlock: number;
  /** chance to bash after a blocked jab */
  punish: number;
  /** flee when own health ≤ this and the opponent's ≥ 4; null = never */
  fleeAt: number | null;
}

export const IQ_PARAMS: Readonly<Record<Iq, IqParams>> = {
  1: {
    reaction: 0.8, thinkEvery: 0.5, forgetPerMinute: 0.5, forgetOwnTraps: true, noise: 40, trapWill: 0.15,
    smartTraps: false, glancePerSecond: 0, slipChance: 0.15, duckChance: 0.1, preBlock: 0, punish: 0, fleeAt: null,
  },
  2: {
    reaction: 0.65, thinkEvery: 0.4, forgetPerMinute: 0.3, forgetOwnTraps: true, noise: 25, trapWill: 0.3,
    smartTraps: false, glancePerSecond: 0.02, slipChance: 0.08, duckChance: 0.3, preBlock: 0.1, punish: 0.1, fleeAt: 1,
  },
  3: {
    reaction: 0.4, thinkEvery: 0.25, forgetPerMinute: 0.1, forgetOwnTraps: false, noise: 12, trapWill: 0.55,
    smartTraps: true, glancePerSecond: 0.06, slipChance: 0.03, duckChance: 0.5, preBlock: 0.3, punish: 0.4, fleeAt: 2,
  },
  4: {
    reaction: 0.3, thinkEvery: 0.22, forgetPerMinute: 0.03, forgetOwnTraps: false, noise: 5, trapWill: 0.75,
    smartTraps: true, glancePerSecond: 0.12, slipChance: 0.01, duckChance: 0.75, preBlock: 0.5, punish: 0.7, fleeAt: 2,
  },
  5: {
    reaction: 0.2, thinkEvery: 0.2, forgetPerMinute: 0, forgetOwnTraps: false, noise: 1, trapWill: 0.9,
    smartTraps: true, glancePerSecond: 0.2, slipChance: 0, duckChance: 0.95, preBlock: 0.7, punish: 0.9, fleeAt: 3,
  },
};

/** Health handicap (spec bot §1): IQ 1 → 5, IQ 2 → 6, IQ 3–5 → full `RULES.health`. */
export function botMaxHealth(iq: Iq): number {
  if (iq === 1) return 5;
  if (iq === 2) return 6;
  return RULES.health;
}

/** Seed of a bot's own RNG stream (never `state.rng`), distinct per side. */
export function botRngSeed(gameSeed: number, side: PlayerId): number {
  return (gameSeed ^ (side === 0 ? 0x85ebca6b : 0x9e3779b9)) >>> 0;
}

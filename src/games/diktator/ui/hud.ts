// HUD lines: the top bar (date and money) and each half's hero line (room, hours, seal). Pure.

import { cs } from '../../../shared/i18n/cs';
import type { Hero } from '../logic/palace';
import { RULES } from '../logic/rules';
import type { Scenario } from '../logic/scenario';
import type { GameState } from '../logic/state';
import { quarterLabel } from '../logic/turn';

const T = cs.diktator;

export interface HeroHud {
  readonly name: string;
  readonly room: string;
  /** Remaining hours as filled dots, spent ones hollow: '●●○'. Kept for tests; the stage now draws the hourglasses. */
  readonly hours: string;
  /** Hours left and the hero's total for the quarter (play-test round 6a: the stage's hourglasses). */
  readonly hoursLeft: number;
  readonly hoursTotal: number;
  readonly seal: boolean;
  readonly done: boolean;
  /** Steps left before the next hour is spent (play-test round 4); null once he has no hour left to spend it in. */
  readonly stepsLeft: number | null;
}

export function heroHud(sc: Scenario, s: GameState, hero: Hero): HeroHud {
  const p = s.palace;
  if (!p || !sc.palace) throw new Error('heroHud needs palace mode');
  const total = RULES.palace.hours[hero];
  const left = Math.max(0, Math.min(total, p.hours[hero]));
  return {
    name: T.heroes[hero],
    room: sc.palace.names[p.at[hero]],
    hours: '●'.repeat(left) + '○'.repeat(total - left),
    hoursLeft: left,
    hoursTotal: total,
    seal: p.seal === hero,
    done: p.done[hero],
    stepsLeft: p.hours[hero] >= 1 ? RULES.palace.stepsPerHour - p.steps[hero] : null,
  };
}

export function topHud(s: GameState): string[] {
  const { year, q } = quarterLabel(Math.max(1, s.quarter));
  return [T.quarter(year, q), T.treasury(s.treasury), T.balance(s.income - s.costs), T.guard(s.guard)];
}

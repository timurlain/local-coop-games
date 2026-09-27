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
  /** Remaining hours as filled dots, spent ones hollow: '●●○'. */
  readonly hours: string;
  readonly seal: boolean;
  readonly done: boolean;
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
    seal: p.seal === hero,
    done: p.done[hero],
  };
}

export function topHud(s: GameState): string[] {
  const { year, q } = quarterLabel(Math.max(1, s.quarter));
  return [T.quarter(year, q), T.treasury(s.treasury), T.balance(s.income - s.costs), T.guard(s.guard)];
}

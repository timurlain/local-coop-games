import { formPlots } from './plot';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

/**
 * Yearly, permanent tariff penalty (our addition, play-test change; tariffs plan): every January from 1926
 * (`quarter % 4 === 1`, skipping the game's very first quarter), income drops by `RULES.tariffPenaltyPerYear`
 * for every tariff petition ever accepted ("yes") and never refused since — the decrease piles up year after
 * year and is never undone. Must run before `settleTreasury` books the quarter's budget.
 */
export function applyTariffPenalty(sc: Scenario, s: GameState, events: GameEvent[]): void {
  if (s.quarter <= 1 || s.quarter % 4 !== 1) return;
  const tariffsInForce = sc.petitions
    .filter((p) => p.tariff)
    .reduce((sum, p) => sum + (s.accepted[p.id] ?? 0), 0);
  if (tariffsInForce === 0) return;
  const amount = RULES.tariffPenaltyPerYear * tariffsInForce;
  s.income = Math.max(0, s.income - amount);
  events.push({ type: 'tariffPenalty', tariffs: tariffsInForce, amount });
}

/**
 * Start-of-turn money (L618–620): a negative treasury is bankrupt (army and police popularity, police
 * strength and the bodyguard drop by 1, then plots re-form); then the quarter's budget is always booked
 * (our addition, play-test change): `income − costs`, replacing the original's costs-only settlement. The
 * original's "pay nothing at exactly 0" no longer applies — with income, the balance is always booked.
 */
export function settleTreasury(s: GameState, events: GameEvent[]): void {
  if (s.treasury < 0) {
    s.pop.armada = Math.max(0, s.pop.armada - 1);
    s.pop.policie = Math.max(0, s.pop.policie - 1);
    s.str.policie = Math.max(0, s.str.policie - 1);
    s.guard = Math.max(0, s.guard - 1);
    events.push({ type: 'bankrupt' });
    formPlots(s);
  }
  s.treasury += s.income - s.costs;
  events.push({ type: 'budget', income: s.income, costs: s.costs });
}

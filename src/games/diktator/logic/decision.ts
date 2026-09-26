import type { Dice } from './dice';
import type { LenderId } from './groups';
import { formPlots } from './plot';
import { affordable, applyEffects, type Decision } from './records';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

export function decisionById(sc: Scenario, id: string): Decision {
  const d = sc.decisions.find((x) => x.id === id);
  if (!d) throw new Error(`unknown decision ${id}`);
  return d;
}

/** Decisions still on the menu (used ones are hidden; reusable ones never get used up). */
export function availableDecisions(sc: Scenario, s: GameState): Decision[] {
  return sc.decisions.filter((d) => d.reusable || !s.used[d.id]);
}

/** Foreign aid (L2060–2140). Always uses the turn's decision. */
function askForAid(s: GameState, id: string, lender: LenderId, dice: Dice, events: GameEvent[]): void {
  if (s.quarter < dice.int(RULES.aidEarliestSpread) + RULES.aidEarliestBase) {
    events.push({ type: 'aidRefused', lender, reason: 'tooEarly' });
  } else if (s.used[id]) {
    events.push({ type: 'aidRefused', lender, reason: 'used' });
  } else if (s.pop[lender] <= s.low) {
    events.push({ type: 'aidRefused', lender, reason: 'unpopular' });
  } else {
    const amount = s.pop[lender] * RULES.aidPerPop + dice.int(RULES.aidSpread);
    s.treasury += amount;
    s.used[id] = true;
    events.push({ type: 'aidGranted', lender, amount });
  }
}

/**
 * The presidential decision (L2500–2746). Returns whether the turn's decision was used up.
 * `share` is only read by the Swiss account (send ⌊treasury / share⌋; the original is share 2).
 */
export function takeDecision(
  sc: Scenario,
  s: GameState,
  id: string,
  share: 1 | 2 | 3 | 4,
  dice: Dice,
  events: GameEvent[],
): boolean {
  if (s.decisionTaken) throw new Error('decision already taken this turn');
  const d = decisionById(sc, id);
  const special = d.special;
  if (special?.kind === 'aid') {
    // Aid checks "already used" itself (with the original message), so it stays on the menu until granted.
    askForAid(s, id, special.lender, dice, events);
  } else if (special?.kind === 'swiss') {
    const amount = Math.max(0, Math.floor(s.treasury / share));
    if (amount >= 1) {
      s.swiss += amount;
      s.treasury -= amount;
    }
    events.push({ type: 'swissTransfer', amount: amount >= 1 ? amount : 0 });
  } else {
    if (!d.reusable && s.used[id]) throw new Error(`decision ${id} already used`);
    if (!affordable(s.treasury, d.effects)) {
      events.push({ type: 'decisionUnaffordable', id });
      return false;
    }
    applyEffects(s, d.effects);
    if (special?.kind === 'bodyguard') s.guard += RULES.bodyguardStep;
    if (special?.kind === 'plane') s.hasPlane = true;
    if (!d.reusable) s.used[id] = true;
    events.push({ type: 'decided', id });
  }
  s.decisionTaken = true;
  formPlots(s);
  return true;
}

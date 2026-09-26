import { RULES } from './rules';
import type { GameEvent, GameState } from './state';

/** The secret police report (L1700–1772): needs money and a friendly, strong police; costs 1. */
export function policeReport(s: GameState, events: GameEvent[]): void {
  if (s.treasury <= 0) {
    events.push({ type: 'policeReportRefused', reason: 'noMoney' });
    return;
  }
  if (s.pop.policie <= s.low || s.str.policie <= s.low) {
    events.push({ type: 'policeReportRefused', reason: 'policeHostile' });
    return;
  }
  s.treasury -= RULES.policeReportCost;
  events.push({
    type: 'policeReport',
    report: {
      pop: { ...s.pop },
      str: { ...s.str },
      plots: { ...s.plots },
      guard: s.guard,
      low: s.low,
      threshold: s.threshold,
    },
  });
}

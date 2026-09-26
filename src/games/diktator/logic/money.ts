import { formPlots } from './plot';
import type { GameEvent, GameState } from './state';

/**
 * Start-of-turn money (L618–620): a negative treasury is bankrupt (army and police popularity, police
 * strength and the bodyguard drop by 1, then plots re-form); a positive treasury pays the per-turn costs.
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
  if (s.treasury > 0) {
    s.treasury -= s.costs;
    events.push({ type: 'costsPaid', amount: s.costs });
  }
}

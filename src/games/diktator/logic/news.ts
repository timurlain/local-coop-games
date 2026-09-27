import type { Dice } from './dice';
import { formPlots } from './plot';
import { applyEffects } from './records';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

/** L2750–2806: 1 in 3 turns an unused random news item happens (cyclic scan; nothing when all are used). */
export function maybeNews(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (dice.int(RULES.newsOneIn) !== 0) return;
  const ns = sc.news;
  const start = dice.int(ns.length);
  for (let k = 0; k < ns.length; k++) {
    const n = ns[(start + k) % ns.length];
    if (s.used[n.id]) continue;
    s.used[n.id] = true;
    applyEffects(s, n.effects);
    events.push({ type: 'news', id: n.id });
    formPlots(s);
    return;
  }
}

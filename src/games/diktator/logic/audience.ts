import type { Dice } from './dice';
import { affordable, applyEffects, clamp, type Petition } from './records';
import type { Scenario } from './scenario';
import type { GameEvent, GameState } from './state';

export function petitionById(sc: Scenario, id: string): Petition {
  const p = sc.petitions.find((x) => x.id === id);
  if (!p) throw new Error(`unknown petition ${id}`);
  return p;
}

/** A petition that has reached its `maxAccepted` cap (our addition, play-test change): never drawn again,
 * not even after a deck reset — unlike `used`, this is not cleared. */
function isCapped(p: Petition, s: GameState): boolean {
  return p.maxAccepted !== undefined && (s.accepted[p.id] ?? 0) >= p.maxAccepted;
}

/**
 * L630–648: random start, cyclic scan for an unused, uncapped petition; when all uncapped petitions are
 * used, only the petitions' used flags are reset and a fresh draw is made — decisions and news keep their
 * own used flags. Capped petitions (our addition) stay excluded through the reset.
 */
export function drawPetition(sc: Scenario, s: GameState, dice: Dice): string {
  const ps = sc.petitions;
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = dice.int(ps.length);
    for (let k = 0; k < ps.length; k++) {
      const p = ps[(start + k) % ps.length];
      if (!s.used[p.id] && !isCapped(p, s)) {
        s.used[p.id] = true;
        return p.id;
      }
    }
    for (const p of ps) delete s.used[p.id];
  }
  if (ps.every((p) => isCapped(p, s))) throw new Error('every petition has reached its cap');
  throw new Error('scenario has no petitions');
}

/** Our addition: put the petition back and draw another unused, uncapped one from the same faction. */
export function suggestOther(sc: Scenario, s: GameState, currentId: string, dice: Dice): string {
  const current = petitionById(sc, currentId);
  const options = sc.petitions.filter((p) => p.from === current.from && p.id !== currentId && !s.used[p.id] && !isCapped(p, s));
  if (options.length === 0) throw new Error(`no other petition from ${current.from}`);
  delete s.used[currentId];
  const next = options[dice.int(options.length)];
  s.used[next.id] = true;
  return next.id;
}

function refuse(s: GameState, p: Petition): void {
  s.pop[p.from] = clamp(s.pop[p.from] - (p.effects.pop?.[p.from] ?? 0));
}

/** L694–766. `goAway` is our addition: −1 popularity and the petition goes back into the deck. */
export function answerPetition(
  sc: Scenario,
  s: GameState,
  id: string,
  answer: 'yes' | 'no' | 'goAway',
  events: GameEvent[],
): void {
  const p = petitionById(sc, id);
  if (answer === 'goAway') {
    s.pop[p.from] = clamp(s.pop[p.from] - 1);
    delete s.used[id];
    events.push({ type: 'answered', id, answer });
    return;
  }
  if (answer === 'yes' && !affordable(s.treasury, p.effects)) {
    refuse(s, p);
    events.push({ type: 'forcedNo', id });
    return;
  }
  if (answer === 'yes') {
    applyEffects(s, p.effects);
    s.accepted[id] = (s.accepted[id] ?? 0) + 1;
  } else refuse(s, p);
  events.push({ type: 'answered', id, answer });
}

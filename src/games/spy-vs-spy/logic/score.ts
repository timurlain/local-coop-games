import type { GameEvent, GameState } from './state';

/** Spec §7 rank names, in ascending order of the score thresholds below. */
export const RANKS = ['Nováček', 'Agent', 'Tajný agent', 'Mistr špionáže', 'Velmistr špionáže'] as const;
export type Rank = (typeof RANKS)[number];

const FIGHT_KILL_BONUS = 80;
const FIGHT_DEATH_PENALTY = -20;
const TRAP_SET_BONUS = 30;
const TRAP_DEATH_PENALTY = -80;
const STEAL_BONUS = 60;
const MAP_OPEN_PENALTY = -70;
const DISARM_BONUS = 40;
const ESCAPE_BASE = 1000;
const ESCAPE_PER_SECOND = 5;

/** Rank for a final score (spec §7): boundaries are inclusive on their lower end. */
export function rankFor(score: number): Rank {
  if (score < 0) return 'Nováček';
  if (score < 300) return 'Agent';
  if (score < 800) return 'Tajný agent';
  if (score < 1500) return 'Mistr špionáže';
  return 'Velmistr špionáže';
}

/**
 * Pure: the score change for each spy from one tick's events (spec §7 table). `step` adds the
 * result into `spy.score` right after collecting the tick's events. Reads `state` only for the
 * escaper's remaining clock — everything else comes from the events themselves.
 */
export function scoreDeltas(state: GameState, events: readonly GameEvent[]): [number, number] {
  const deltas: [number, number] = [0, 0];
  for (const e of events) {
    switch (e.type) {
      case 'died':
        if (e.cause === 'fight') {
          deltas[e.spy] += FIGHT_DEATH_PENALTY;
          if (e.killer !== undefined) deltas[e.killer] += FIGHT_KILL_BONUS;
        } else {
          // Any trap death, including the placer's own trap or a time bomb (spec §7).
          deltas[e.spy] += TRAP_DEATH_PENALTY;
        }
        break;
      case 'trapSet':
        deltas[e.spy] += TRAP_SET_BONUS;
        break;
      case 'disarmed':
        deltas[e.spy] += DISARM_BONUS;
        break;
      case 'mapOpened':
        deltas[e.spy] += MAP_OPEN_PENALTY;
        break;
      case 'found':
      case 'stored':
      case 'swapped':
        if (e.stolenFrom !== undefined) deltas[e.spy] += STEAL_BONUS;
        break;
      case 'escaped':
        deltas[e.spy] += ESCAPE_BASE + ESCAPE_PER_SECOND * Math.floor(state.spies[e.spy].clock);
        break;
      default:
        break;
    }
  }
  return deltas;
}

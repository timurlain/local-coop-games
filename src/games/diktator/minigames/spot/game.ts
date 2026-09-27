// "Najdi střelce" as a MiniGame (spec 2026-09-27-diktator-atentat-design §3, §5): wraps the pure simulation
// (`logic.ts`) and the drawing (`render.ts`) behind the arena's interface, plus the police-tip text.

import type { Hero } from '../../logic/palace';
import type { AttemptDifficulty, PlaceId } from '../../logic/state';
import { cs } from '../../../../shared/i18n/cs';
import type { ArenaInput, MiniGame } from '../arena';
import { accuse, createSpot, spotResult, stepSpot, type Clue, type SpotState } from './logic';
import { drawSpot } from './render';

const IDLE: ArenaInput = { moveX: 0, moveY: 0, action: false };

/** One clue as a Czech word, from `cs.diktator.atentat.clueWords`. */
function clueWord(c: Clue): string {
  const W = cs.diktator.atentat.clueWords;
  switch (c.key) {
    case 'hat': return W.hat[c.value];
    case 'scarf': return W.scarf[c.value];
    case 'glasses': return W.glasses;
    case 'bag': return W.bag;
  }
}

/** Joins the clue words with `, ` and `and` before the last one (empty for no clues). */
export function tipText(clues: readonly Clue[]): string {
  const words = clues.map(clueWord);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return words.slice(0, -1).join(', ') + cs.diktator.atentat.and + words[words.length - 1];
}

export class SpotGame implements MiniGame<'found' | 'missed'> {
  readonly state: SpotState;

  constructor(difficulty: AttemptDifficulty, place: PlaceId, seed: number) {
    this.state = createSpot(difficulty, place, seed);
  }

  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void {
    const input = inputs.velitel ?? IDLE;
    stepSpot(this.state, dt, input);
    if (input.action) accuse(this.state);
  }

  render(ctx: CanvasRenderingContext2D, t: number): void {
    drawSpot(ctx, this.state, t);
  }

  result(): 'found' | 'missed' | null {
    return spotResult(this.state);
  }
}

// The shared frame of every Diktátor mini-game (spec 2026-09-27-diktator-atentat-design §3).

import type { Hero } from '../logic/palace';

/** Per-hero input for one tick: held movement and whether Action went down this tick. */
export interface ArenaInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly action: boolean;
  /** Action is held down this tick (Pochod na Tiranu: Zogu negotiates while he holds it). */
  readonly held?: boolean;
}

export interface MiniGame<R> {
  /** Advance by `dt` seconds with the inputs of the heroes the game uses. */
  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void;
  /** Draw in the arena's logical space (960 × 540); the caller has set the transform. */
  render(ctx: CanvasRenderingContext2D, t: number): void;
  /** The result once the game is over (after its ending animation), else null. */
  result(): R | null;
}

export const ARENA_W = 960;
export const ARENA_H = 540;

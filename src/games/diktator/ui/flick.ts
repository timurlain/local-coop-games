// Held stick / D-pad / arrow states → one step per flick (spec §12: "one flick = one room"). Pure.

import type { Direction } from '../logic/palace';

export interface Axes {
  readonly moveX: number;
  readonly moveY: number;
}

export class Flick {
  private x = 0;
  private y = 0;

  /** The direction that was just pressed, or null. Holding fires nothing more; horizontal wins a tie. */
  next(a: Axes): Direction | null {
    const fx = a.moveX !== 0 && a.moveX !== this.x;
    const fy = a.moveY !== 0 && a.moveY !== this.y;
    this.x = a.moveX;
    this.y = a.moveY;
    if (fx) return a.moveX < 0 ? 'left' : 'right';
    if (fy) return a.moveY < 0 ? 'up' : 'down';
    return null;
  }

  /** Treats the current axes as already held, so a direction held while a screen opened does not fire into it. */
  hold(a: Axes): void {
    this.x = a.moveX;
    this.y = a.moveY;
  }
}

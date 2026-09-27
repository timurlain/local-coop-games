// Pochod na Tiranu as a MiniGame (spec 2026-09-27-diktator-pochod-design §3): accumulates real time into fixed
// simulation steps, carries Action presses to the next step, collects the events for sounds and bubbles, and hands
// the drawing to render.ts. The page (main.ts) owns the cards around it; `view` tells the drawing which backdrop to use.

import type { Hero } from '../../logic/palace';
import type { ArenaInput, MiniGame } from '../arena';
import { createMarch, marchResult, stepMarch, type MarchOptions } from './logic';
import type { MarchMap } from './map';
import { drawMarch, type MarchView } from './render';
import { MARCH } from './rules';
import type { MarchEvent, MarchInput, MarchResult, MarchState } from './state';
import { marchToast } from './text';

export interface Toast {
  readonly text: string;
  /** Scene time (`state.now`) until which it shows. */
  readonly until: number;
}

const TOAST_SECONDS = 2.5;
/** The longest real time one update may simulate (a background tab must not run the march on its own). */
const MAX_FRAME = 0.25;

export class MarchGame implements MiniGame<MarchResult> {
  readonly state: MarchState;
  view: MarchView = 'intro';
  /** Solo play: the hero the device steers (Tab / Back switches). */
  active: Hero = 'zogu';
  /** The negotiation key's name for the bubble („Drž F — vyjednávat“). */
  actionKey = 'F';
  toasts: Toast[] = [];
  private acc = 0;
  private edges: Partial<Record<Hero, boolean>> = {};
  private events: MarchEvent[] = [];

  constructor(map: MarchMap, seed: number, solo: boolean, opts: MarchOptions = {}) {
    this.state = createMarch(map, seed, solo, opts);
  }

  update(dt: number, inputs: Readonly<Partial<Record<Hero, ArenaInput>>>): void {
    if (this.view !== 'play') return;
    for (const h of ['zogu', 'velitel'] as const) if (inputs[h]?.action) this.edges[h] = true;
    this.acc = Math.min(this.acc + dt, MAX_FRAME);
    while (this.acc >= MARCH.step) {
      this.acc -= MARCH.step;
      const step: Partial<Record<Hero, MarchInput>> = {};
      for (const h of ['zogu', 'velitel'] as const) {
        const i = inputs[h];
        if (!i) continue;
        step[h] = { moveX: i.moveX, moveY: i.moveY, action: this.edges[h] ?? false, held: i.held ?? false };
      }
      this.edges = {};
      const events = stepMarch(this.state, MARCH.step, step, this.active);
      for (const e of events) {
        const text = marchToast(e, this.state);
        if (text) this.toasts = [...this.toasts, { text, until: this.state.now + TOAST_SECONDS }].slice(-3);
      }
      this.events.push(...events);
    }
    this.toasts = this.toasts.filter((t) => t.until > this.state.now);
  }

  /** The events since the last call (sounds). */
  drainEvents(): MarchEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  render(ctx: CanvasRenderingContext2D, t: number): void {
    drawMarch(ctx, this, t);
  }

  result(): MarchResult | null {
    return marchResult(this.state);
  }
}

// Canvas smoke test for drawSpot (plan Atentát, task 4): draws the scene for both places, clue counts 0–3, and
// several times — including after `found` and after `missed` — against a recording fake context and asserts it
// never throws and never leaks state (save/restore always balanced). Same fake ctx / Path2D pattern as
// tests/diktator/scene.test.ts.

import { describe, expect, it } from 'vitest';
import { accuse, createSpot, spotResult, stepSpot, type SpotInput, type SpotState } from '../../src/games/diktator/minigames/spot/logic';
import { CLOSEUP, closeupGround, drawSpot } from '../../src/games/diktator/minigames/spot/render';
import { tipText } from '../../src/games/diktator/minigames/spot/game';
import { FIGURE_HEIGHT } from '../../src/games/diktator/render/puppet/skeleton';
import type { AttemptDifficulty } from '../../src/games/diktator/logic/state';
import type { PlaceId } from '../../src/games/diktator/logic/state';

/** Same convention as render.ts's private `PUPPET_SCALE`: a standing figure is ~95 units tall at scale 1. */
const PUPPET_SCALE = 95 / FIGURE_HEIGHT;

/** Records every call and rejects a non-finite numeric argument, the way a real Path2D would misbehave silently. */
class FakePath2D {
  readonly calls: unknown[][] = [];
  constructor(...args: unknown[]) {
    this.record('new', args);
  }
  private record(name: string, args: unknown[]): void {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`Path2D.${name}: non-finite arg ${String(a)}`);
    this.calls.push([name, ...args]);
  }
  moveTo(...a: unknown[]): void { this.record('moveTo', a); }
  lineTo(...a: unknown[]): void { this.record('lineTo', a); }
  quadraticCurveTo(...a: unknown[]): void { this.record('quadraticCurveTo', a); }
  rect(...a: unknown[]): void { this.record('rect', a); }
  ellipse(...a: unknown[]): void { this.record('ellipse', a); }
  arc(...a: unknown[]): void { this.record('arc', a); }
  closePath(...a: unknown[]): void { this.record('closePath', a); }
}

/** A recording fake CanvasRenderingContext2D: any method call is recorded and checked for non-finite numeric
 * arguments; save/restore are tracked as a depth counter; any property may be set (fillStyle, font, …). */
function createFakeCtx(): CanvasRenderingContext2D & { depth: number } {
  const store: Record<string, unknown> = {};
  let depth = 0;
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (prop === 'depth') return depth;
      return (...args: unknown[]) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) {
            throw new Error(`ctx.${String(prop)}(${args.map(String).join(', ')}): non-finite argument`);
          }
        }
        if (prop === 'save') depth++;
        if (prop === 'restore') {
          depth--;
          if (depth < 0) throw new Error('ctx.restore(): more restores than saves');
        }
        return undefined;
      };
    },
    set(t, prop, value) {
      t[String(prop)] = value;
      return true;
    },
  };
  return new Proxy(store, handler) as unknown as CanvasRenderingContext2D & { depth: number };
}

const IDLE: SpotInput = { moveX: 0, moveY: 0 };
const diff = (clues: number, crowd = 14, seconds = 40): AttemptDifficulty => ({ seconds, clues, crowd, maxWrong: 3 });
const PLACES: readonly PlaceId[] = ['trziste', 'dustojnici'];

/** Runs `stepSpot` for `seconds` in small ticks (so the fuse/gunman logic sees plenty of steps). */
function advanceBy(s: SpotState, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) stepSpot(s, 0.1, IDLE);
}

describe('drawSpot (canvas smoke test)', () => {
  it('draws every place and clue count without throwing, balancing save/restore, at rest and mid-fuse', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      for (const place of PLACES) {
        for (const clues of [0, 1, 2, 3]) {
          for (let seed = 1; seed <= 3; seed++) {
            const s = createSpot(diff(clues), place, seed);
            for (const t of [0, 5]) {
              if (t > 0) advanceBy(s, t);
              const ctx = createFakeCtx();
              try {
                drawSpot(ctx, s, s.t);
              } catch (e) {
                throw new Error(`drawSpot threw for place=${place} clues=${clues} seed=${seed} t=${t}: ${(e as Error).message}`);
              }
              expect(ctx.depth, `place=${place} clues=${clues} seed=${seed} t=${t}`).toBe(0);
            }
          }
        }
      }
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });

  it('draws the found ending (tackle) without throwing, balancing save/restore', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      for (const place of PLACES) {
        const s = createSpot(diff(2), place, 11);
        const gunman = s.people.find((p) => p.gunman)!;
        s.glass.x = gunman.x;
        s.glass.y = gunman.y - 20;
        accuse(s);
        expect(s.outcome).toBe('found');
        for (const dt of [0, 0.3, 0.9, 1.5]) {
          stepSpot(s, dt, IDLE);
          const ctx = createFakeCtx();
          expect(() => drawSpot(ctx, s, s.t), `place=${place} t=${s.t}`).not.toThrow();
          expect(ctx.depth, `place=${place} t=${s.t}`).toBe(0);
        }
        expect(spotResult(s)).toBe('found');
      }
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });

  it('draws the missed ending (shots) without throwing, balancing save/restore', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      for (const place of PLACES) {
        const s = createSpot(diff(1, 14, 1), place, 5);
        advanceBy(s, 2);
        expect(s.outcome).toBe('missed');
        for (const dt of [0, 0.3, 0.9, 1.5]) {
          stepSpot(s, dt, IDLE);
          const ctx = createFakeCtx();
          expect(() => drawSpot(ctx, s, s.t), `place=${place} t=${s.t}`).not.toThrow();
          expect(ctx.depth, `place=${place} t=${s.t}`).toBe(0);
        }
      }
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });

  it('draws a wrong accusation (protest bubble) without throwing, balancing save/restore', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      const s = createSpot(diff(2), 'trziste', 3);
      const gunman = s.people.find((p) => p.gunman)!;
      const innocent = s.people.find((p) => !p.gunman && p.id !== gunman.id)!;
      s.glass.x = innocent.x;
      s.glass.y = innocent.y - 20;
      accuse(s);
      expect(s.outcome).toBeNull();
      expect(innocent.protestUntil).toBeGreaterThan(s.t);
      const ctx = createFakeCtx();
      expect(() => drawSpot(ctx, s, s.t)).not.toThrow();
      expect(ctx.depth).toBe(0);
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });
});

describe('tipText', () => {
  it('joins the clue words with commas and "and" before the last one', () => {
    expect(tipText([{ key: 'scarf', value: 'red' }])).toBe('červený šátek');
    expect(tipText([{ key: 'hat', value: 'fez' }, { key: 'scarf', value: 'red' }])).toBe('fez a červený šátek');
    expect(tipText([{ key: 'hat', value: 'fez' }, { key: 'glasses', value: true }, { key: 'bag', value: true }])).toBe('fez, brýle a brašnu přes rameno');
    expect(tipText([])).toBe('');
  });
});

describe('closeupGround (review round 1, fix 1)', () => {
  it('keeps the head top and the hand/chest height inside the close-up window at the drawn scale (2.6)', () => {
    const scale = 2.6;
    const ground = closeupGround(scale);
    // The head's top (world y = FIGURE_HEIGHT above the feet) must not be drawn above the circle's top edge.
    const headTopY = ground - PUPPET_SCALE * scale * FIGURE_HEIGHT;
    expect(headTopY).toBeGreaterThanOrEqual(CLOSEUP.y - CLOSEUP.r);
    // The chin/collar landmark that `closeupGround` centres the window on must land inside the circle too (it's
    // what carries the face and the hand/chest-height weapon tell).
    expect(ground).toBe(CLOSEUP.y + PUPPET_SCALE * scale * (15 + 14 + 28 + 3)); // thigh + shin + torso + neck
    const chinY = ground - PUPPET_SCALE * scale * (15 + 14 + 28 + 3);
    expect(chinY).toBeGreaterThanOrEqual(CLOSEUP.y - CLOSEUP.r);
    expect(chinY).toBeLessThanOrEqual(CLOSEUP.y + CLOSEUP.r);
  });
});

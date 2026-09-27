// Canvas smoke test for the march drawing (plan Pochod, task 8): every view, many moments of a played march, against
// a recording fake context — never throws, never leaks canvas state. Same fake ctx / Path2D pattern as
// tests/diktator/spot-render.test.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MarchGame } from '../../../src/games/diktator/minigames/march/game';
import { MARCH } from '../../../src/games/diktator/minigames/march/rules';
import { followerLooks, trailPoint, type MarchView } from '../../../src/games/diktator/minigames/march/render';
import { marchToast } from '../../../src/games/diktator/minigames/march/text';
import { POSES } from '../../../src/games/diktator/render/puppet/poses';
import { solvePuppet } from '../../../src/games/diktator/render/puppet/skeleton';
import { ALBANIA_MARCH } from '../../../src/games/diktator/scenario/albania/march-map';
import { noise } from './helpers';

class FakePath2D {
  constructor(...args: unknown[]) {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error('Path2D: non-finite');
  }
  private check(a: unknown[]): void {
    for (const x of a) if (typeof x === 'number' && !Number.isFinite(x)) throw new Error('Path2D: non-finite');
  }
  moveTo(...a: unknown[]): void { this.check(a); }
  lineTo(...a: unknown[]): void { this.check(a); }
  quadraticCurveTo(...a: unknown[]): void { this.check(a); }
  rect(...a: unknown[]): void { this.check(a); }
  ellipse(...a: unknown[]): void { this.check(a); }
  arc(...a: unknown[]): void { this.check(a); }
  closePath(): void {}
}

function createFakeCtx(): CanvasRenderingContext2D & { depth: number } {
  let depth = 0;
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(_t, prop) {
      if (prop === 'depth') return depth;
      return (...args: unknown[]) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`ctx.${String(prop)}: non-finite argument`);
        }
        if (prop === 'save') depth++;
        if (prop === 'restore' && --depth < 0) throw new Error('ctx.restore(): more restores than saves');
        return undefined;
      };
    },
    set(t, prop, value) {
      t[String(prop)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D & { depth: number };
}

let originalPath2D: unknown;
beforeAll(() => {
  originalPath2D = globalThis.Path2D;
  (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
});
afterAll(() => {
  (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
});

function draw(game: MarchGame, label: string): void {
  const ctx = createFakeCtx();
  expect(() => game.render(ctx, game.state.now), label).not.toThrow();
  expect(ctx.depth, label).toBe(0);
}

describe('drawMarch (canvas smoke test)', () => {
  it('draws every view', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    for (const view of ['intro', 'play', 'result', 'poster'] as MarchView[]) {
      game.view = view;
      draw(game, view);
    }
  });

  it('draws a played march at many moments: walking, negotiating, fights, catches, the end', () => {
    for (const seed of [1, 2, 3]) {
      const game = new MarchGame(ALBANIA_MARCH, seed, seed === 3);
      game.view = 'play';
      const zi = noise(seed);
      const vi = noise(seed + 50);
      for (let k = 0; k < 60 && !game.result(); k++) {
        for (let i = 0; i < 90; i++) game.update(MARCH.step, { zogu: zi(), velitel: vi() });
        draw(game, `seed ${seed}, frame ${k}`);
      }
    }
  });

  it('draws the stunned, down and surrendering gendarmes, the rope at full length and the catch caption', () => {
    const game = new MarchGame(ALBANIA_MARCH, 4, false);
    game.view = 'play';
    const s = game.state;
    const z = s.heroes.zogu;
    for (const mode of ['stunned', 'down', 'surrender', 'leaving', 'chase'] as const) {
      s.foes.push({
        id: 900 + s.foes.length, kind: 'gendarme', x: z.x - 60, y: z.y, facing: 1, moving: false, mode, until: 99, hits: 1,
        route: 0, wp: 1, dir: 1, squad: 77, stuck: 0, place: -1, homeX: z.x, homeY: z.y,
      });
    }
    s.heroes.velitel.x = z.x - MARCH.rope;
    z.frozenUntil = s.now + 1;
    draw(game, 'fight');
  });
});

describe('drawing helpers', () => {
  it('finds points behind Zogu along his trail', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    const s = game.state;
    s.trail = [[0, 0], [100, 0]];
    s.heroes.zogu.x = 200;
    s.heroes.zogu.y = 0;
    expect(trailPoint(s, 50)).toEqual({ x: 150, y: 0 });
    expect(trailPoint(s, 150)).toEqual({ x: 50, y: 0 });
    expect(trailPoint(s, 999)).toEqual({ x: 0, y: 0 });
  });

  it('builds the column: 3 Russians, a peasant per village, a soldier per joined guard, at most 12', () => {
    const s = new MarchGame(ALBANIA_MARCH, 1, false).state;
    expect(followerLooks(s)).toHaveLength(3);
    s.villages = 4;
    s.volunteers = true;
    s.joined = 9;
    expect(followerLooks(s)).toHaveLength(12);
  });

  it('raises both hands when a gendarme surrenders', () => {
    const j = solvePuppet(POSES.handsUp(0));
    expect(j.armF.hand[1]).toBeGreaterThan(j.neck[1]);
    expect(j.armB.hand[1]).toBeGreaterThan(j.neck[1]);
  });

  it('turns events into bubbles', () => {
    const s = new MarchGame(ALBANIA_MARCH, 1, false).state;
    const klos = s.places.findIndex((p) => p.def.id === 'klos');
    expect(marchToast({ type: 'won', place: klos }, s)).toBe('Selé z Klosu se přidávají!');
    expect(marchToast({ type: 'refused', place: 0, reason: 'noGold' }, s)).toBe('Bez zlata ani slovo.');
    expect(marchToast({ type: 'caught' }, s)).toBe('Zogu strávil noc v zajetí a ráno se vykoupil.');
    expect(marchToast({ type: 'tick' }, s)).toBeNull();
  });
});

describe('MarchGame', () => {
  it('runs only in the play view, in fixed steps, and never loses an Action press', () => {
    const game = new MarchGame(ALBANIA_MARCH, 1, false);
    game.update(1, {});
    expect(game.state.now).toBe(0);
    game.view = 'play';
    game.update(0.005, { velitel: { moveX: 0, moveY: 0, action: true } });
    expect(game.state.now).toBe(0);
    game.update(0.02, { velitel: { moveX: 0, moveY: 0, action: false } });
    expect(game.drainEvents()).toContainEqual({ type: 'swing' });
    expect(game.drainEvents()).toEqual([]);
    game.update(5, {});
    expect(game.state.now).toBeLessThan(0.3);
  });
});

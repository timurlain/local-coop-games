import { describe, expect, it } from 'vitest';
import { kill } from '../../src/games/spy-vs-spy/logic/death';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { LEVELS, RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { Dir, GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { backArrows, recordTrail, showsBreadcrumbs } from '../../src/games/spy-vs-spy/logic/trail';
import { ARROW_PIXELS, TRAIL_STEP, breadcrumbArrows } from '../../src/games/spy-vs-spy/render/hud';
import { UNDER_PARTS } from '../../src/games/spy-vs-spy/render/layout';
import { input, kufrik, openDoor, openGame, place, run } from './fixtures';

const TICK = 1 / 60;
const IDLE = input();

describe('backArrows', () => {
  it('is empty for an empty trail', () => {
    expect(backArrows([])).toEqual([]);
  });

  it('reverses each move and lists the most recent first', () => {
    expect(backArrows(['N', 'E', 'E', 'S'])).toEqual(['N', 'W', 'W', 'S']);
  });

  it('gives at most 9 arrows', () => {
    const trail: Dir[] = ['W', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'E'];
    const back = backArrows(trail);
    expect(back).toHaveLength(RULES.trailLength);
    expect(back[0]).toBe('W');
    expect(back.slice(1)).toEqual(Array(8).fill('S'));
  });
});

describe('recordTrail', () => {
  it('appends the move, most recent last, keeping at most 9', () => {
    const trail: Dir[] = [];
    for (let i = 0; i < 12; i++) recordTrail(trail, i === 11 ? 'W' : 'N');
    expect(trail).toHaveLength(RULES.trailLength);
    expect(trail[trail.length - 1]).toBe('W');
  });
});

describe('breadcrumbs in play', () => {
  it('a new spy starts with an empty trail and the game knows its level', () => {
    const s = createGame(7, 4);
    expect(s.level).toBe(4);
    expect(s.spies.map((sp) => sp.trail)).toEqual([[], []]);
  });

  it('records every internal door passage', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    openDoor(s, 0, 'N');
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    place(s, 0, 1, 200, 20);
    openDoor(s, 0, 'E');
    updateMovement(s, spy, input({ moveX: 1 }), TICK, []);
    expect(spy.room).toBe(2);
    expect(spy.trail).toEqual(['N', 'E']);
    expect(backArrows(spy.trail)).toEqual(['W', 'S']);
  });

  it('does not record a bump into a closed door, or the exit', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []); // closed: bump
    place(s, 0, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    openDoor(s, 0, 'E');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(ev).toEqual([{ type: 'escaped', spy: 0 }]);
    expect(spy.trail).toEqual([]);
  });

  it('keeps the trail across death and respawn', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.trail = ['N', 'E'];
    kill(s, spy, 'bomba', []);
    run(s, [IDLE, IDLE], RULES.respawnTime + 0.1);
    expect(spy.mode).toBe('normal');
    expect(spy.trail).toEqual(['N', 'E']);
  });
});

describe('showsBreadcrumbs', () => {
  it('shows the trail on levels 1-6 and hides it on 7-8', () => {
    expect(LEVELS.filter(showsBreadcrumbs)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('breadcrumb strip', () => {
  it('shows the way back for the viewer', () => {
    const s = openGame();
    s.spies[0].trail = ['S', 'E'];
    expect(breadcrumbArrows(s, s.spies[0])).toEqual(['W', 'N']);
    expect(breadcrumbArrows(s, s.spies[1])).toEqual([]);
  });

  it('shows nothing on levels 7 and 8', () => {
    for (const level of [7, 8]) {
      const s = createGame(3, level);
      s.spies[0].trail = ['S', 'E'];
      expect(breadcrumbArrows(s, s.spies[0])).toEqual([]);
    }
  });

  it('has room for 9 arrows in its slot, vertically centred', () => {
    const slot = UNDER_PARTS.trail;
    expect(RULES.trailLength * TRAIL_STEP - 1).toBeLessThanOrEqual(slot.w);
    expect(ARROW_PIXELS.N.length).toBeLessThanOrEqual(slot.h);
  });

  it('draws each arrow as a pixel shape pointing its way', () => {
    const lit = (rows: readonly string[]) =>
      rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `${x},${y}` : null))).filter((p) => p !== null);
    const n = ARROW_PIXELS.N;
    const size = n.length;
    for (const d of ['N', 'S', 'E', 'W'] as const) {
      expect(ARROW_PIXELS[d]).toHaveLength(size);
      for (const row of ARROW_PIXELS[d]) expect(row).toHaveLength(size);
    }
    // the tip of N is one pixel at the top middle, the widest row below it
    expect(n[0].split('#').length - 1).toBe(1);
    expect(n[0][(size - 1) / 2]).toBe('#');
    // S is N upside down, W is N turned left, E is W mirrored
    expect(ARROW_PIXELS.S).toEqual([...n].reverse());
    const turnLeft = n.map((_, y) => n.map((row) => row[size - 1 - y]).join(''));
    expect(ARROW_PIXELS.W).toEqual(turnLeft);
    expect(ARROW_PIXELS.E).toEqual(ARROW_PIXELS.W.map((row) => [...row].reverse().join('')));
    expect(lit(ARROW_PIXELS.E)).toHaveLength(lit(n).length);
  });
});

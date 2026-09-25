import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { VIEW, floorScale, furnitureBase, hidingSpot, project, wallX } from '../../src/games/spy-vs-spy/render/geometry';
import { depthSorted, type Layer } from '../../src/games/spy-vs-spy/render/view';

describe('free-standing pieces on screen (round 5 §5)', () => {
  it('scales with the floor: the wall scale at the back, bigger towards the viewer', () => {
    expect(floorScale(0)).toBe(VIEW.scale);
    expect(floorScale(RULES.roomD)).toBeCloseTo((VIEW.frontRight - VIEW.frontLeft) / RULES.roomW, 9);
    expect(floorScale(15)).toBeGreaterThan(floorScale(13));
  });

  it('stands a wall piece on the back wall and a free one on the floor at its front edge', () => {
    expect(furnitureBase({ x: 48, z: 0 })).toEqual({ x: wallX(48), y: VIEW.backY, k: VIEW.scale });
    const p = project(100, 15);
    expect(furnitureBase({ x: 100, z: 15 })).toEqual({ x: p.sx, y: p.sy, k: floorScale(15) });
  });

  it('hides things a little above the floor line of the piece', () => {
    expect(hidingSpot({ x: 48, z: 0 })).toEqual({ x: Math.round(wallX(48)), y: VIEW.backY - 5 });
    const p = project(100, 15);
    expect(hidingSpot({ x: 100, z: 15 })).toEqual({ x: Math.round(p.sx), y: Math.round(p.sy) - 5 });
  });
});

describe('depthSorted', () => {
  const layer = (name: string, z: number, rank: 0 | 1 | 2, out: string[]): Layer => ({ z, rank, draw: () => out.push(name) });

  it('draws a spy behind a piece first (the piece covers him) and one in front of it last', () => {
    const out: string[] = [];
    const layers = [layer('front spy', 25, 1, out), layer('table', 15, 0, out), layer('back spy', 10, 1, out)];
    for (const l of depthSorted(layers)) l.draw();
    expect(out).toEqual(['back spy', 'table', 'front spy']);
  });

  it('at the same depth: the piece, then the spy standing at its edge, then his effect', () => {
    const out: string[] = [];
    for (const l of depthSorted([layer('sparkle', 15, 2, out), layer('spy', 15, 1, out), layer('table', 15, 0, out)])) l.draw();
    expect(out).toEqual(['table', 'spy', 'sparkle']);
  });
});

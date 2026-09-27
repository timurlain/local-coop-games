import { describe, expect, it } from 'vitest';
import { BUMP_SEC, bumpOffset, progress, SLIDE_SEC, slideOffsets } from '../../src/games/diktator/render/rooms/stage';
import { STAGE_H, STAGE_W } from '../../src/games/diktator/render/rooms/crowd';

function near(a: readonly number[], b: readonly number[]): void {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(1e-9));
}

describe('progress', () => {
  it('is 1 without an animation and runs 0 → 1 over its length', () => {
    expect(progress(null, 5)).toBe(1);
    expect(SLIDE_SEC).toBe(0.4);
    const bump = { kind: 'bump', dir: 'up', start: 1 } as const;
    expect(progress(bump, 1)).toBe(0);
    expect(progress(bump, 1 + BUMP_SEC / 2)).toBeCloseTo(0.5);
    expect(progress(bump, 9)).toBe(1);
    expect(progress(bump, 0)).toBe(0);
  });
});

describe('slideOffsets', () => {
  it('brings the new room in from the side the hero walked to', () => {
    near([...slideOffsets('right', 0).from, ...slideOffsets('right', 0).to], [0, 0, STAGE_W, 0]);
    near([...slideOffsets('right', 1).from, ...slideOffsets('right', 1).to], [-STAGE_W, 0, 0, 0]);
    near([...slideOffsets('up', 1).from], [0, STAGE_H]);
    near([...slideOffsets('down', 0).to], [0, STAGE_H]);
  });
});

describe('bumpOffset', () => {
  it('nudges toward the wall and back', () => {
    near(bumpOffset('left', 0), [0, 0]);
    near(bumpOffset('left', 0.5), [-4, 0]);
    near(bumpOffset('down', 1), [0, 0]);
  });
});

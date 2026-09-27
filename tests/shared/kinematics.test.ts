import { describe, expect, it } from 'vitest';
import { angleTo, dir, reach, rotate, step } from '../../src/shared/rig/kinematics';

const close = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('kinematics (0° = up, clockwise positive)', () => {
  it('dir and step', () => {
    close(dir(0), [0, 1]);
    close(dir(90), [1, 0]);
    close(step([1, 1], 180, 2), [1, -1]);
  });
  it('rotate and angleTo', () => {
    close(rotate([0, 1], 90), [1, 0]);
    expect(angleTo([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });
  it('reach puts the end of a two-bone chain on a reachable target', () => {
    const root = [0, 0] as const;
    const target = [5, 12] as const;
    const [upper, lower] = reach(root, target, 8, 7, -1);
    close(step(step(root, upper, 8), lower, 7), target);
  });
});

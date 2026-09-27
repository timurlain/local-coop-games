import { describe, expect, it } from 'vitest';
import { BONES, solvePuppet, type PuppetPose } from '../../src/games/diktator/render/puppet/skeleton';

const STAND: PuppetPose = { armF: [172, -8], armB: [188, 8], legF: [176, 2], legB: [184, -2] };

describe('solvePuppet', () => {
  it('stands on the ground', () => {
    const j = solvePuppet(STAND);
    expect(Math.min(j.legF.foot[1], j.legB.foot[1])).toBeCloseTo(0, 6);
  });

  it('keeps the shoulder on the torso line, also when leaning', () => {
    for (const lean of [0, 30, -10]) {
      const j = solvePuppet({ ...STAND, lean });
      const dx = j.shoulder[0] - j.hip[0];
      const dy = j.shoulder[1] - j.hip[1];
      expect(Math.hypot(dx, dy)).toBeCloseTo(BONES.torso * BONES.shoulderAt, 6);
      expect((Math.atan2(dx, dy) * 180) / Math.PI).toBeCloseTo(lean, 6);
    }
  });

  it('puts the hand on an IK target given relative to the hip (the salute to the temple)', () => {
    const j = solvePuppet({ ...STAND, reachF: [7, 46], bendF: -1 });
    expect(j.armF.hand[0] - j.hip[0]).toBeCloseTo(7, 4);
    expect(j.armF.hand[1] - j.hip[1]).toBeCloseTo(46, 4);
  });

  it('lifts the whole figure by bob and carries face, prop and mouth through', () => {
    const j = solvePuppet({ ...STAND, bob: 3, prop: 'glass', mouthOpen: true, face: 'shocked' });
    expect(Math.min(j.legF.foot[1], j.legB.foot[1])).toBeCloseTo(3, 6);
    expect(j.prop).toBe('glass');
    expect(j.mouthOpen).toBe(true);
    expect(j.face).toBe('shocked');
  });
});

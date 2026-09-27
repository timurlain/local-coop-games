import { describe, expect, it } from 'vitest';
import { BONES, solvePuppet, type PuppetPose } from '../../src/games/diktator/render/puppet/skeleton';
import { GROUP_LOOK, LOOKS } from '../../src/games/diktator/render/puppet/looks';
import { MOOD_FACES, MOODS, POSES, faceForMood, type PoseName } from '../../src/games/diktator/render/puppet/poses';
import { GROUPS } from '../../src/games/diktator/logic/groups';

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

describe('poses and moods', () => {
  const finite = (p: import('../../src/games/diktator/render/puppet/skeleton').PuppetPose) => {
    const j = solvePuppet(p);
    for (const v of [j.hip, j.head, j.shoulder, j.armF.hand, j.armB.hand, j.legF.foot, j.legB.foot]) {
      expect(Number.isFinite(v[0]) && Number.isFinite(v[1])).toBe(true);
    }
  };

  it('every named pose solves at several times', () => {
    for (const name of Object.keys(POSES) as PoseName[]) for (const t of [0, 0.4, 1.7]) finite(POSES[name](t));
  });

  it('has ten moods, 0 = vzbouření … 9 = nadšení, each solvable', () => {
    expect(MOODS).toHaveLength(10);
    for (const m of MOODS) for (const t of [0, 0.9]) finite(m(t));
  });

  it('shares each face between two neighbouring moods', () => {
    expect(MOOD_FACES).toEqual(['furious', 'furious', 'grumpy', 'grumpy', 'neutral', 'neutral', 'happy', 'happy', 'ecstatic', 'ecstatic']);
    expect(faceForMood(9)).toBe('ecstatic');
    expect(faceForMood(0)).toBe('furious');
  });

  it("Mother's warning: upper arm forward, forearm raised from the elbow", () => {
    const j = solvePuppet(POSES.warn(0));
    expect(j.armF.el[0] - j.shoulder[0]).toBeGreaterThan(BONES.upper * 0.8);
    expect(j.armF.hand[1] - j.armF.el[1]).toBeGreaterThan(BONES.fore * 0.8);
    expect(j.prop).toBe('finger');
  });

  it('the salute touches the head and the fright is only in the face', () => {
    const j = solvePuppet(POSES.salute(0));
    expect(Math.hypot(j.armF.hand[0] - j.head[0], j.armF.hand[1] - j.head[1])).toBeLessThan(BONES.head + 2);
    const f = POSES.shocked(0);
    expect(f.face).toBe('shocked');
    expect(f.armF).toEqual(POSES.stand(0).armF);
  });
});

describe('looks', () => {
  it('every group wears a known look', () => {
    for (const g of GROUPS) expect(LOOKS[GROUP_LOOK[g]]).toBeDefined();
  });

  it('the Queen Mother wears a dress; the envoys carry their colours', () => {
    expect(LOOKS.mother.dress).toBe(true);
    expect(LOOKS.italy.prop).toBe('flagIT');
    expect(LOOKS.italy.sash).toEqual(['#1f8a3b', '#f4f1e8', '#c8102e']);
    expect(LOOKS.britain.monocle).toBe(true);
    expect(LOOKS.yugo.sash).toEqual(['#1d3f8f', '#f4f1e8', '#c8102e']);
  });
});

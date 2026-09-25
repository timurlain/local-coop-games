import { describe, expect, it } from 'vitest';
import {
  RIG_CHARS, RIG_H, RIG_PALETTES, RIG_POSES, RIG_W, RIG_WEIGHTS, renderRig, solve, type RigPose, type RigPoseName,
} from '../../src/games/spy-vs-spy/render/rig';
import { downsample, outline, rasterize, type Paint } from '../../src/games/spy-vs-spy/render/rig/raster';
import { BONES, KNEE_RADIUS, reach, rotate, soleY, step } from '../../src/games/spy-vs-spy/render/rig/skeleton';

const close = (a: readonly number[], b: readonly number[], eps = 1e-6): void => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i]), `component ${i}: ${v} vs ${b[i]}`).toBeLessThan(eps));
};

const NAMES = Object.keys(RIG_POSES) as RigPoseName[];

function rowsOf(paints: Paint[], w: number, h: number): string[] {
  return downsample(rasterize(paints, w, h, 8), RIG_WEIGHTS).map((r) => r.map((c) => c.ch).join(''));
}

describe('rig rasterizer', () => {
  it('fills a pixel-aligned polygon exactly', () => {
    const square: Paint = { shape: { kind: 'poly', pts: [[1, 0], [3, 0], [3, 2], [1, 2]] }, ch: 'b', part: 1 };
    expect(rowsOf([square], 4, 3)).toEqual(['.bb.', '.bb.', '....']);
  });

  it('paints later shapes over earlier ones', () => {
    const back: Paint = { shape: { kind: 'poly', pts: [[0, 0], [4, 0], [4, 2], [0, 2]] }, ch: 'b', part: 1 };
    const front: Paint = { shape: { kind: 'poly', pts: [[2, 0], [4, 0], [4, 2], [2, 2]] }, ch: 's', part: 2 };
    expect(rowsOf([back, front], 4, 2)).toEqual(['bbss', 'bbss']);
  });

  it('a pixel is only filled when the shape covers about half of it', () => {
    const sliver: Paint = { shape: { kind: 'poly', pts: [[0, 0], [0.3, 0], [0.3, 1], [0, 1]] }, ch: 'b', part: 1 };
    const most: Paint = { shape: { kind: 'poly', pts: [[1, 0], [1.7, 0], [1.7, 1], [1, 1]] }, ch: 'b', part: 1 };
    expect(rowsOf([sliver, most], 2, 1)).toEqual(['.b']);
  });

  it('a small eye dot survives inside the face it sits on', () => {
    const face: Paint = { shape: { kind: 'poly', pts: [[0, 0], [3, 0], [3, 3], [0, 3]] }, ch: 's', part: 1 };
    const eye: Paint = { shape: { kind: 'circle', c: [1.5, 1.5], r: 0.4 }, ch: 'd', part: 1 };
    expect(rowsOf([face, eye], 3, 3)).toEqual(['sss', 'sds', 'sss']);
  });

  it('rings the silhouette 4-connected and separates same-coloured overlapping parts', () => {
    const cells = downsample(rasterize([
      { shape: { kind: 'poly', pts: [[1, 1], [4, 1], [4, 2], [1, 2]] }, ch: 'b', part: 1 },
      { shape: { kind: 'poly', pts: [[3, 1], [4, 1], [4, 2], [3, 2]] }, ch: 'b', part: 2 },
    ], 6, 3, 4), RIG_WEIGHTS);
    // the back part's pixel touching the nearer part becomes a line; the nearer part keeps its pixel
    expect(outline(cells, (a, b) => a.ch === b.ch)).toEqual(['.ooo..', 'obobo.', '.ooo..']);
  });
});

describe('rig skeleton', () => {
  it('angles: 0 is up, 90 forward, 180 down', () => {
    close(step([0, 0], 0, 2), [0, 2]);
    close(step([0, 0], 90, 2), [2, 0]);
    close(step([1, 1], 180, 2), [1, -1]);
    close(rotate([1, 0], 90), [0, -1]);
  });

  it('standing straight puts the hip one leg length above the ankle on the ground', () => {
    const pose: RigPose = {
      spine: 0, neck: 0, head: 0, armFront: [180, 0], armBack: [180, 0], legFront: [180, 0], legBack: [180, 0],
    };
    const j = solve(pose);
    close(j.ankleFront, [0, BONES.ankle]);
    close(j.hip, [0, BONES.ankle + BONES.shin + BONES.thigh]);
    close(j.chest, [0, j.hip[1] + BONES.spine]);
    close(j.handFront, [0, j.shoulder[1] - BONES.upperArm - BONES.forearm]);
  });

  it('child bones inherit their parent angle (forward kinematics)', () => {
    const pose: RigPose = {
      spine: 30, neck: 0, head: 0, armFront: [60, 90], armBack: [150, 0], legFront: [180, 0], legBack: [180, 0],
    };
    const j = solve(pose);
    // upper arm at 30 + 60 = 90 (straight forward), forearm at 90 + 90 = 180 (straight down)
    close(j.elbowFront, [j.shoulder[0] + BONES.upperArm, j.shoulder[1]]);
    close(j.handFront, [j.elbowFront[0], j.elbowFront[1] - BONES.forearm]);
    expect(j.forearmFrontAngle).toBe(180);
  });

  it('the lowest foot or kneecap touches the ground, then rootX / rootY shift the body', () => {
    for (const name of NAMES) {
      const pose: RigPose = RIG_POSES[name];
      const j = solve(pose);
      const low = Math.min(
        soleY(j.ankleFront, pose.footFront ?? 0), soleY(j.ankleBack, pose.footBack ?? 0),
        j.kneeFront[1] - KNEE_RADIUS, j.kneeBack[1] - KNEE_RADIUS,
      );
      expect(low, name).toBeCloseTo(pose.rootY ?? 0, 6);
    }
  });

  it('two-bone IK reaches a target inside the arm span', () => {
    const [u, l] = reach([0, 0], [5, 4], BONES.upperArm, BONES.forearm, 1);
    close(step(step([0, 0], u, BONES.upperArm), l, BONES.forearm), [5, 4], 1e-6);
  });

  it('a back arm told to grip the umbrella ends on its shaft', () => {
    const pose: RigPose = RIG_POSES.duck;
    if (!('grip' in pose.armBack)) throw new Error('duck grips the umbrella with the back hand');
    const j = solve(pose);
    close(j.handBack, step(j.handFront, j.umbrellaAngle!, pose.armBack.grip), 1e-6);
  });
});

describe('rig renderer', () => {
  it('is deterministic', () => {
    for (const name of NAMES) expect(renderRig(RIG_POSES[name]), name).toEqual(renderRig(RIG_POSES[name]));
  });

  it('renders every pose at the requested size using only rig palette characters', () => {
    const allowed = new Set(['.', ...RIG_CHARS]);
    for (const name of NAMES) {
      for (const [w, h] of [[RIG_W, RIG_H], [32, 36]] as const) {
        const { rows } = renderRig(RIG_POSES[name], { w, h, scale: h / RIG_H });
        expect(rows, name).toHaveLength(h);
        for (const r of rows) {
          expect(r.length, name).toBe(w);
          for (const ch of r) expect(allowed.has(ch), `${name}: '${ch}'`).toBe(true);
        }
      }
    }
  });

  it('every palette colours every rig character', () => {
    for (const [pal, colours] of Object.entries(RIG_PALETTES)) {
      expect(Object.keys(colours).sort(), pal).toEqual([...RIG_CHARS].sort());
    }
  });

  it('the hand points land on drawn pixels', () => {
    for (const name of NAMES) {
      const { rows, hand, backHand } = renderRig(RIG_POSES[name]);
      for (const [x, y] of [hand, backHand]) expect(rows[y]?.[x] ?? '.', `${name} (${x},${y})`).not.toBe('.');
    }
  });

  it('the figure stands on the bottom of the frame with a 1-px outline below the shoes', () => {
    for (const name of NAMES) {
      const { rows } = renderRig(RIG_POSES[name]);
      expect(rows[RIG_H - 1].replaceAll('.', '').replaceAll('o', ''), name).toBe('');
      expect(rows[RIG_H - 2], name).toMatch(/[kb]/);
    }
  });

  it('the head is one wedge: the long skin-coloured nose points forward past the body, with an eye', () => {
    const { rows } = renderRig(RIG_POSES.stand);
    const cx = RIG_W / 2;
    const skinCols = rows.flatMap((r) => [...r].flatMap((ch, x) => (ch === 's' ? [x] : [])));
    expect(Math.max(...skinCols) - cx).toBeGreaterThanOrEqual(10);
    expect(rows.join('')).toContain('d');
    // the hat's crown is highest behind the centre line, the brim reaches as far forward as the nose
    const top = rows.findIndex((r) => r.includes('b'));
    expect(rows[top].indexOf('b')).toBeLessThan(cx);
  });

  it('duck: low, with the umbrella canopy spread flat above the hat', () => {
    expect(solve(RIG_POSES.duck).hip[1]).toBeLessThan(solve(RIG_POSES.stand).hip[1] - 4);
    const stand = renderRig(RIG_POSES.stand).rows;
    const duck = renderRig(RIG_POSES.duck).rows;
    const hatTop = (rows: readonly string[]): number => rows.findIndex((r) => r.includes('b'));
    expect(hatTop(duck) - hatTop(stand)).toBeGreaterThanOrEqual(5);
    const widest = Math.max(...duck.slice(0, hatTop(duck)).map((r) => [...r].filter((ch) => ch === 'u').length));
    expect(widest).toBeGreaterThanOrEqual(12);
  });

  it('swingStrike: the closed umbrella is thrust forward, its ferrule out in front', () => {
    const { rows, hand } = renderRig(RIG_POSES.swingStrike);
    const ferrule = rows.flatMap((r) => [...r].flatMap((ch, x) => (ch === 'f' ? [x] : [])));
    expect(Math.min(...ferrule)).toBeGreaterThan(hand[0] + 5);
  });
});

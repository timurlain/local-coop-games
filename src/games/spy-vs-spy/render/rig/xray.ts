// The X-ray skeleton of a posed spy (round 6 §6, the electric bucket): the same rig pose drawn as a dark silhouette
// (hat and long nose kept, ringed by the outline) with the rig's own bones on top as white bones — skull, spine and
// ribs, pelvis, arm and leg bones with knobbly joints. The far limbs are a dimmer grey, so the pose still reads.
//
// Characters: x = the silhouette, w = near bones, W = far bones, e = the eye socket, o = the outline glow.

import { buildParts, headPoint, HEAD_SHAPES, toPixels, type WorldPaint } from './parts';
import { downsample, outline, rasterize, type Shape, type Vec } from './raster';
import { BONES, rotate, solve, step, type Joints, type RigPose } from './skeleton';

export const XRAY_CHARS = ['o', 'x', 'w', 'W', 'e'] as const;

const XRAY_WEIGHTS: Readonly<Record<string, number>> = { x: 1, W: 2, w: 2.2, e: 4, o: 2.4 };

export interface XrayOptions {
  readonly w: number;
  readonly h: number;
  readonly cx?: number;
  readonly scale?: number;
  readonly squash?: number;
  readonly tilt?: number;
  readonly ss?: number;
}

const PELVIS: readonly Vec[] = [[-2.3, -0.7], [2.5, -0.7], [1.2, 0.6], [-1.2, 0.6]];

const bone = (a: Vec, b: Vec, r: number): Shape => ({ kind: 'capsule', a, b, ra: r, rb: r });
const knob = (c: Vec, r: number): Shape => ({ kind: 'circle', c, r });

/** A point `p` authored on an upright bone at `origin`, turned to world angle `angle`. */
function on(origin: Vec, angle: number, p: Vec): Vec {
  const [x, y] = rotate(p, angle);
  return [origin[0] + x, origin[1] + y];
}

/** The bones of the posed skeleton, back to front, in world space. */
export function skeletonBones(pose: RigPose, j: Joints): WorldPaint[] {
  const far = (shape: Shape): WorldPaint => ({ shape, ch: 'W', part: 2 });
  const near = (shape: Shape): WorldPaint => ({ shape, ch: 'w', part: 3 });
  const foot = (ankle: Vec, tilt: number): Shape => bone(on(ankle, tilt, [-0.6, -0.6]), on(ankle, tilt, [2.5, -0.9]), 0.5);
  const ribs: WorldPaint[] = [0.52, 0.8].map((f, i) => {
    const c = step(j.hip, j.spineAngle, BONES.spine * f);
    const half = 1.9 + i * 0.3;
    return near(bone(on(c, j.spineAngle, [-half, 0.25]), on(c, j.spineAngle, [half + 0.3, -0.25]), 0.36));
  });
  return [
    // far arm and leg
    far(bone(j.shoulder, j.elbowBack, 0.4)), far(bone(j.elbowBack, j.handBack, 0.38)), far(knob(j.handBack, 0.8)),
    far(bone(j.hip, j.kneeBack, 0.42)), far(bone(j.kneeBack, j.ankleBack, 0.4)), far(knob(j.kneeBack, 0.75)),
    far(foot(j.ankleBack, pose.footBack ?? 0)),
    // spine, ribs, pelvis, neck
    near(bone(j.hip, j.chest, 0.42)),
    ...ribs,
    near({ kind: 'poly', pts: PELVIS.map((p) => on(j.hip, j.spineAngle, p)) }),
    near(bone(j.chest, j.neckTop, 0.45)),
    // near leg
    near(bone(j.hip, j.kneeFront, 0.42)), near(bone(j.kneeFront, j.ankleFront, 0.4)), near(knob(j.kneeFront, 0.75)),
    near(foot(j.ankleFront, pose.footFront ?? 0)),
    // skull with its eye socket
    near(knob(headPoint(j, [0.1, 3.9]), 2.1)),
    near(bone(headPoint(j, [0.6, 1.2]), headPoint(j, [2.2, 1.6]), 0.55)),
    { shape: knob(headPoint(j, HEAD_SHAPES.EYE), 0.7), ch: 'e', part: 4 },
    // near arm, in front of the ribs
    near(bone(j.shoulder, j.elbowFront, 0.4)), near(bone(j.elbowFront, j.handFront, 0.38)), near(knob(j.elbowFront, 0.7)),
    near(knob(j.handFront, 0.8)),
  ];
}

/** Renders the pose as an X-ray: rows of XRAY_CHARS. Deterministic like `renderRig`. */
export function renderXray(pose: RigPose, opts: XrayOptions): string[] {
  const { w, h } = opts;
  const cx = opts.cx ?? Math.floor(w / 2);
  const scale = opts.scale ?? 1;
  const scaleY = scale * (opts.squash ?? 1);
  const j = solve(pose);
  const silhouette = buildParts(pose, j).map((p): WorldPaint => ({ ...p, ch: 'x', part: 1 }));
  const all = [...silhouette, ...skeletonBones(pose, j)];
  // the bones lie inside the silhouette, so a tilted X-ray is lifted exactly like the tilted figure
  const paints = toPixels(all, { cx, ground: h - 1, scale, scaleY, tilt: opts.tilt });
  return outline(downsample(rasterize(paints, w, h, opts.ss ?? 8), XRAY_WEIGHTS), () => false);
}

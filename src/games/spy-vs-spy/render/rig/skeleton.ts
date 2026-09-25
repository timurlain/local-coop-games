// 2D side-view skeleton of a spy facing right. World space: x forward (right), y up, ground at y = 0,
// the body's centre line at x = 0; one unit = one output pixel of the 40-px-tall frame.
//
// Angles are in degrees, 0 = straight up, positive = clockwise (towards the facing side), so 90 points
// forward and 180 points down. Every bone's angle is relative to its parent (hip → spine → neck → head,
// spine → upper arm → forearm → umbrella, hip → thigh → shin); the hip itself stays upright.

import type { Vec } from './raster';

export const BONES = {
  thigh: 5.5,
  shin: 5.5,
  /** Ankle height above the sole of a flat shoe. */
  ankle: 1.5,
  spine: 8.5,
  neck: 1.5,
  upperArm: 5,
  forearm: 4.5,
} as const;

/** Shoe around the ankle, in world orientation (x forward, y up) before its tilt; the sole is at −ankle. */
export const SHOE: readonly Vec[] = [[-1.5, 0.8], [-1.7, -1.5], [3.1, -1.5], [3.1, -0.5], [1.2, 0.8]];

/** Share of the head's tilt the hat follows: a fully tilted fedora reads as a cone, so its brim stays flatter. */
export const HAT_NOD = 0.55;

/** Radius of the trouser leg at the knee (a kneeling knee rests on the floor). */
export const KNEE_RADIUS = 1.4;

/** Upper and lower bone angles of a limb: [shoulder or hip, elbow or knee]. */
export type Limb = readonly [upper: number, lower: number];

export type UmbrellaState = 'closed' | 'open';

export interface RigPose {
  /** Spine lean from upright (+ = leaning forward). */
  readonly spine: number;
  readonly neck: number;
  /** Head tilt on the neck (+ = nose down). */
  readonly head: number;
  /**
   * Which way the face looks: 1 = in profile towards the facing side (default), −1 = in profile the other way,
   * in between = turned towards the viewer, the nose and brim foreshortened by |headTurn|.
   */
  readonly headTurn?: number;
  readonly armFront: Limb;
  /** Angles, or grip the umbrella `at` units up the shaft from the front hand (2-bone IK). */
  readonly armBack: Limb | { readonly grip: number };
  readonly legFront: Limb;
  readonly legBack: Limb;
  /** Shoe tilt (+ = toes down, i.e. on tiptoe / pushing off). */
  readonly footFront?: number;
  readonly footBack?: number;
  /** Shoulders drawn up by this many units; the head sinks between them. */
  readonly shrug?: number;
  /** Hip height above the ground instead of standing on the lowest foot (keeps the upper body still while stepping). */
  readonly hipHeight?: number;
  /** Body offset after the feet are put on the ground (bob, lunge). */
  readonly rootX?: number;
  readonly rootY?: number;
  /** The near arm (and its umbrella) is drawn over the head, e.g. raised in front of the face. */
  readonly armOverHead?: boolean;
  /** Umbrella in the front hand; `angle` is relative to the forearm. */
  readonly umbrella?: { readonly state: UmbrellaState; readonly angle: number };
}

/** World-space joints plus the world angle of every bone, as computed by `solve`. */
export interface Joints {
  readonly hip: Vec;
  readonly chest: Vec;
  readonly spineAngle: number;
  readonly neckTop: Vec;
  readonly headAngle: number;
  /** World angle of the hat: it follows a nod only partly, so the fedora keeps its shape when looking down. */
  readonly hatAngle: number;
  readonly headTurn: number;
  readonly shoulder: Vec;
  readonly elbowFront: Vec;
  readonly handFront: Vec;
  readonly forearmFrontAngle: number;
  readonly elbowBack: Vec;
  readonly handBack: Vec;
  readonly kneeFront: Vec;
  readonly ankleFront: Vec;
  readonly kneeBack: Vec;
  readonly ankleBack: Vec;
  readonly umbrellaAngle: number | null;
}

const RAD = Math.PI / 180;

/** Unit vector of a world angle. */
export function dir(angle: number): Vec {
  return [Math.sin(angle * RAD), Math.cos(angle * RAD)];
}

/** Moves `len` units from `p` along world angle `angle`. */
export function step(p: Vec, angle: number, len: number): Vec {
  const [dx, dy] = dir(angle);
  return [p[0] + dx * len, p[1] + dy * len];
}

/** Rotates a point authored for an upright bone (x forward, y along the bone) to world angle `angle`. */
export function rotate([x, y]: Vec, angle: number): Vec {
  const s = Math.sin(angle * RAD);
  const c = Math.cos(angle * RAD);
  return [x * c + y * s, -x * s + y * c];
}

/** World angle pointing from a to b. */
export function angleTo(a: Vec, b: Vec): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / RAD;
}

/**
 * Two-bone IK: [upper, lower] world angles so a chain of l1 + l2 from `root` reaches `target` (clamped to
 * reach). `bend` +1 bends the middle joint clockwise of the root→target line (an elbow pointing down/back
 * when reaching forward), −1 the other way.
 */
export function reach(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): [number, number] {
  const d = Math.min(Math.hypot(target[0] - root[0], target[1] - root[1]), l1 + l2 - 1e-6);
  const base = angleTo(root, target);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA))) / RAD;
  const upper = base + bend * a;
  const elbow = step(root, upper, l1);
  // point the lower bone at the target (exact when in reach)
  return [upper, angleTo(elbow, target)];
}

/** Lowest y of the shoe on `ankle` tilted by `tilt`. */
export function soleY(ankle: Vec, tilt: number): number {
  return ankle[1] + Math.min(...SHOE.map((p) => rotate(p, tilt)[1]));
}

/** Forward kinematics: the pose's joints in world space, feet put on the ground, then shifted by rootX/Y. */
export function solve(pose: RigPose): Joints {
  const L = BONES;
  const shrug = pose.shrug ?? 0;
  // hip at the origin first; everything is translated once the lowest ankle is known
  const hip0: Vec = [0, 0];
  const kneeF = step(hip0, pose.legFront[0], L.thigh);
  const ankleF = step(kneeF, pose.legFront[0] + pose.legFront[1], L.shin);
  const kneeB = step(hip0, pose.legBack[0], L.thigh);
  const ankleB = step(kneeB, pose.legBack[0] + pose.legBack[1], L.shin);
  // the lowest point of a shoe (tilted with its foot) or a kneecap (knee − its radius) touches the ground
  const lift = -Math.min(
    soleY(ankleF, pose.footFront ?? 0), soleY(ankleB, pose.footBack ?? 0), kneeF[1] - KNEE_RADIUS, kneeB[1] - KNEE_RADIUS,
  );
  const off: Vec = [pose.rootX ?? 0, (pose.hipHeight ?? lift) + (pose.rootY ?? 0)];
  const t = (p: Vec): Vec => [p[0] + off[0], p[1] + off[1]];

  const hip = t(hip0);
  const spineAngle = pose.spine;
  const chest = step(hip, spineAngle, L.spine);
  const neckAngle = spineAngle + pose.neck;
  const neckTop = step(chest, neckAngle, L.neck - shrug * 0.8);
  const headAngle = neckAngle + pose.head;
  const hatAngle = headAngle * HAT_NOD;
  // shoulders sit just below the top of the spine, raised by the shrug
  const shoulder = step(chest, spineAngle, -0.9 + shrug);

  const upperF = spineAngle + pose.armFront[0];
  const elbowFront = step(shoulder, upperF, L.upperArm);
  const forearmFrontAngle = upperF + pose.armFront[1];
  const handFront = step(elbowFront, forearmFrontAngle, L.forearm);
  const umbrellaAngle = pose.umbrella ? forearmFrontAngle + pose.umbrella.angle : null;

  let elbowBack: Vec;
  let handBack: Vec;
  if ('grip' in pose.armBack) {
    const target = step(handFront, umbrellaAngle ?? forearmFrontAngle, pose.armBack.grip);
    const [u, l] = reach(shoulder, target, L.upperArm, L.forearm, 1);
    elbowBack = step(shoulder, u, L.upperArm);
    handBack = step(elbowBack, l, L.forearm);
  } else {
    const upperB = spineAngle + pose.armBack[0];
    elbowBack = step(shoulder, upperB, L.upperArm);
    handBack = step(elbowBack, upperB + pose.armBack[1], L.forearm);
  }

  return {
    hip, chest, spineAngle, neckTop, headAngle, hatAngle, headTurn: pose.headTurn ?? 1, shoulder,
    elbowFront, handFront, forearmFrontAngle, elbowBack, handBack,
    kneeFront: t(kneeF), ankleFront: t(ankleF), kneeBack: t(kneeB), ankleBack: t(ankleB),
    umbrellaAngle,
  };
}

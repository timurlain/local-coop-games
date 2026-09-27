// Generic 2D bone math shared by the rigs (spy-vs-spy, diktator). World space: x forward (right), y up;
// angles in degrees, 0 = straight up, positive = clockwise. Pure.

export type Vec = readonly [x: number, y: number];

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
 * reach). `bend` +1 bends the middle joint clockwise of the root→target line, −1 the other way.
 */
export function reach(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): [number, number] {
  const d = Math.min(Math.hypot(target[0] - root[0], target[1] - root[1]), l1 + l2 - 1e-6);
  const base = angleTo(root, target);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA))) / RAD;
  const upper = base + bend * a;
  const elbow = step(root, upper, l1);
  return [upper, angleTo(elbow, target)];
}

// Named poses and the ten mood poses of the approved puppet sketch (version 2). Pure; every pose is a function
// of time in seconds so idle motion (bouncing, fist shaking) lives with the pose.

import type { Face, PuppetPose } from './skeleton';

export type PoseFn = (t: number) => PuppetPose;

const STAND: PuppetPose = { lean: 0, head: 0, armF: [172, -8], armB: [188, 8], legF: [176, 2], legB: [184, -2] };

function walkPose(t: number): PuppetPose {
  const s = Math.sin(t * 7);
  return {
    ...STAND,
    lean: 3,
    armF: [180 - s * 28, -18],
    armB: [180 + s * 28, -18],
    legF: [180 + s * 24, -Math.max(0, s) * 30],
    legB: [180 - s * 24, -Math.max(0, -s) * 30],
    bob: Math.abs(s) * 1.5,
  };
}

const POSE_TABLE = {
  stand: () => STAND,
  walk: (t: number) => walkPose(t),
  talk: (t: number) => ({ ...STAND, head: 4, armF: [120 + Math.sin(t * 5) * 12, -40], mouthOpen: Math.sin(t * 12) > 0 }) satisfies PuppetPose,
  bow: () => ({ ...STAND, lean: 32, head: 12, armF: [158, -12], armB: [150, -10], legF: [172, 10], legB: [178, 8] }) satisfies PuppetPose,
  salute: () => ({ ...STAND, head: -2, reachF: [7, 46], bendF: -1 }) satisfies PuppetPose,
  point: () => ({ ...STAND, lean: 4, armF: [92, 0], head: 2 }) satisfies PuppetPose,
  shocked: () => ({ ...STAND, lean: -3, head: -6, face: 'shocked' }) satisfies PuppetPose,
  /** Wagging a finger at you: upper arm forward, forearm up from the elbow, index finger up, shaking. */
  warn: (t: number) =>
    ({ ...STAND, head: 4, armF: [82, -88 + Math.sin(t * 9) * 14], prop: 'finger', mouthOpen: Math.sin(t * 10) > 0.2 }) satisfies PuppetPose,
  clasp: () => ({ ...STAND, head: 5, armF: [150, -65], armB: [160, -62] }) satisfies PuppetPose,
  /** The front upper arm down and a little forward, the forearm bent up across the chest: the hand sits inside
   * the coat at chest height. */
  handInCoat: () => ({ ...STAND, reachF: [6, 22], bendF: -1, hideHandF: true }) satisfies PuppetPose,
  /** Walking with the front hand hidden in the coat, as `handInCoat`. */
  handInCoatWalk: (t: number) => ({ ...walkPose(t), reachF: [6, 22], bendF: -1, hideHandF: true }) satisfies PuppetPose,
} as const satisfies Record<string, PoseFn>;

export type PoseName = keyof typeof POSE_TABLE;
export const POSES: Readonly<Record<PoseName, PoseFn>> = POSE_TABLE;

/** Mood poses, index = popularity: 0 vzbouření … 9 nadšení. */
export const MOODS: readonly PoseFn[] = [
  (t) => ({ ...STAND, lean: 12, head: 6, armF: [25 + Math.sin(t * 9) * 10, -30], armB: [18 + Math.sin(t * 9 + 1) * 10, -35], prop: 'club', mouthOpen: true }),
  (t) => ({ ...STAND, lean: 9, head: 6, armF: [35 + Math.sin(t * 14) * 14, -80], armB: [45 + Math.sin(t * 14 + 2) * 14, -80], mouthOpen: Math.sin(t * 8) > 0 }),
  (t) => ({ ...STAND, lean: 7, head: 4, armF: [95 + Math.sin(t * 6) * 6, 0], armB: [190, 10], mouthOpen: Math.sin(t * 7) > 0.3 }),
  () => ({ ...STAND, lean: 4, armF: [150, 85], armB: [205, -85] }),
  (t) => ({ ...STAND, head: -6 + Math.sin(t * 1.3) * 8, armF: [145, -120], armB: [150, -115] }),
  (t) => ({ ...STAND, head: 10, armF: [120, -70 + Math.sin(t * 2) * 6], armB: [235, 70] }),
  () => ({ ...STAND }),
  () => ({ ...STAND, head: 3, armF: [150, -65], armB: [160, -62] }),
  (t) => ({ ...STAND, head: -4, armF: [40 + Math.sin(t * 3) * 6, -35], armB: [185, 5], prop: 'glass' }),
  (t) => ({ ...STAND, head: -4, reachF: [21, 20 + Math.sin(t * 8) * 2], bendF: -1, armB: [215, -40], prop: 'thumb', bob: Math.max(0, Math.sin(t * 8)) * 5, mouthOpen: true }),
];

/** Five faces, each shared by two neighbouring moods. */
export const MOOD_FACES: readonly Face[] = ['furious', 'furious', 'grumpy', 'grumpy', 'neutral', 'neutral', 'happy', 'happy', 'ecstatic', 'ecstatic'];

export function faceForMood(level: number): Face {
  return MOOD_FACES[Math.max(0, Math.min(9, Math.round(level)))];
}

/** Pose for a popularity level, clamped and rounded the same way as `faceForMood` — never an out-of-range index. */
export function poseForMood(level: number): PoseFn {
  return MOODS[Math.max(0, Math.min(9, Math.round(level)))];
}

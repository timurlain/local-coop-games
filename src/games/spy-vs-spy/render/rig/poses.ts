// Prototype pose library (facing right). Angles in degrees, see skeleton.ts for the conventions.

import type { RigPose } from './skeleton';

export const RIG_POSES = {
  stand: {
    spine: 0, neck: 0, head: 0,
    armFront: [174, -6], armBack: [186, 4],
    legFront: [176, 4], legBack: [186, -3],
  },
  // mid-stride: front leg reaching forward, back leg pushing off its toes, arms swinging against the legs
  walk2: {
    spine: 4, neck: -2, head: 0,
    armFront: [200, -8], armBack: [150, -22],
    legFront: [152, 26], legBack: [206, 6], footBack: 28,
  },
  // lunging jab: weight on the bent front leg, back leg straight, the umbrella thrust along the arm
  swingStrike: {
    spine: 20, neck: -10, head: -8,
    armFront: [66, 6], armBack: [196, 20],
    legFront: [126, 50], legBack: [222, 4], footBack: 30,
    umbrella: { state: 'closed', angle: 0 },
  },
  // low crouch under the open umbrella: the canopy is a roof over the hat, the back hand steadies the shaft
  duck: {
    spine: 30, neck: -6, head: -16,
    armFront: [-52, 10], armBack: { grip: -2 },
    legFront: [96, 100], legBack: [160, 120], footBack: 30,
    shrug: 1.4,
    umbrella: { state: 'open', angle: 22 },
  },
  // open umbrella held out in front as a shield
  block: {
    spine: 6, neck: -4, head: -2,
    armFront: [160, -100], armBack: [196, 20],
    legFront: [150, 24], legBack: [206, 0],
    rootX: -1.5,
    umbrella: { state: 'open', angle: 30 },
  },
  // giggle: shoulders up, face tilted down, hands clasped at the belly; the two frames bob the head
  giggle1: {
    spine: 3, neck: 6, head: 16,
    armFront: [168, -78], armBack: [176, -72],
    legFront: [176, 4], legBack: [186, -3],
    shrug: 1.4,
  },
  giggle2: {
    spine: 6, neck: 10, head: 26,
    armFront: [172, -84], armBack: [180, -78],
    legFront: [168, 18], legBack: [180, 14],
    shrug: 2.2,
  },
} as const satisfies Record<string, RigPose>;

export type RigPoseName = keyof typeof RIG_POSES;

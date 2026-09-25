// The spy's pose library (facing right): one pose per game frame. Angles in degrees, see skeleton.ts for the
// conventions (0 = up, 90 = forward, 180 = down; arms relative to the spine, legs to the upright hip).

import { solve, type Limb, type RigPose } from './skeleton';

const STAND_LEGS = { legFront: [176, 4] as Limb, legBack: [186, -3] as Limb };

// ---------- walking on tiptoe: stride, pass (head up), the other stride, the other pass ----------

const walk1: RigPose = {
  spine: 4, neck: -2, head: 0,
  armFront: [200, -8], armBack: [150, -22],
  legFront: [152, 26], legBack: [206, 6], footBack: 28,
};
const walk2: RigPose = {
  spine: 2, neck: -5, head: -2,
  armFront: [184, -10], armBack: [172, -12],
  legFront: [178, 2], footFront: 24, legBack: [146, 64], footBack: 34,
};
const walk3: RigPose = {
  ...walk1,
  armFront: [150, -22], armBack: [200, -8],
  legFront: [206, 6], footFront: 28, legBack: [152, 26], footBack: 0,
};
const walk4: RigPose = {
  ...walk2,
  armFront: [172, -12], armBack: [184, -10],
  legFront: [146, 64], footFront: 34, legBack: [178, 2], footBack: 24,
};

// ---------- the fight: crouched guard, the closed umbrella level and pointed at the opponent ----------

const GUARD_UPPER = {
  spine: 14, neck: -10, head: -4,
  armFront: [136, -62] as Limb, armBack: [200, 24] as Limb,
  rootX: -4,
  umbrella: { state: 'closed', angle: 2 },
} as const;

const fightStand: RigPose = {
  ...GUARD_UPPER,
  legFront: [118, 74], legBack: [236, -52], footBack: 8,
};
/** The guard's hip height: stepping keeps the upper body (and the umbrella) exactly where it is. */
const GUARD_HIP = solve(fightStand).hip[1];

const fightWalk1: RigPose = {
  ...GUARD_UPPER, hipHeight: GUARD_HIP,
  legFront: [108, 80], legBack: [244, -60], footBack: 24,
};
const fightWalk2: RigPose = {
  ...GUARD_UPPER, hipHeight: GUARD_HIP,
  legFront: [131, 77], footFront: 10, legBack: [140, 100], footBack: 30,
};

// wind-up: the umbrella drawn back over the shoulder, pointing up and back
const swingWind: RigPose = {
  spine: 2, neck: -8, head: -4,
  armFront: [214, 84], armBack: [200, 20],
  legFront: [140, 44], legBack: [212, -14], footBack: 14,
  umbrella: { state: 'closed', angle: 30 },
};

// lunging jab: weight on the bent front leg, back leg straight, the umbrella thrust along the arm; the body is
// pulled back so the ferrule stays inside the frame
const swingStrike: RigPose = {
  spine: 20, neck: -10, head: -8,
  armFront: [66, 8], armBack: [196, 20],
  legFront: [122, 52], legBack: [226, 4], footBack: 30,
  rootX: -7,
  umbrella: { state: 'closed', angle: 2 },
};

// head bash: the near arm raised over the head in front, the umbrella coming down over the hat brim
const bashStrike: RigPose = {
  spine: 12, neck: -6, head: 4,
  armFront: [14, 38], armBack: [200, 24],
  legFront: [132, 54], legBack: [214, -18], footBack: 18,
  rootX: -3,
  armOverHead: true,
  umbrella: { state: 'closed', angle: 44 },
};

// open umbrella held out in front as a shield
const block: RigPose = {
  spine: 6, neck: -4, head: -2,
  armFront: [160, -100], armBack: [196, 20],
  legFront: [150, 24], legBack: [206, 0],
  rootX: -3,
  umbrella: { state: 'open', angle: 30 },
};

// low kneel under the open umbrella: the canopy is a roof over the hat, the back hand steadies the shaft
const duck: RigPose = {
  spine: 30, neck: -6, head: -16,
  armFront: [-52, 10], armBack: { grip: -2 },
  legFront: [96, 100], legBack: [160, 120], footBack: 30,
  shrug: 1.4,
  umbrella: { state: 'open', angle: 22 },
};

// ---------- searching, hiding, placing ----------

const DIG = {
  spine: 30, neck: -4, head: 12, rootX: -2,
  legFront: [136, 56] as Limb, legBack: [226, -50] as Limb,
} as const;
const searchDig1: RigPose = { ...DIG, armFront: [96, 40], armBack: [120, 20] };
const searchDig2: RigPose = { ...DIG, armFront: [78, 50], armBack: [132, 6] };

// placing something forward and down (into the furniture)
const hidePut: RigPose = {
  spine: 24, neck: 0, head: 14, rootX: -1,
  armFront: [98, 26], armBack: [196, 10],
  legFront: [158, 18], legBack: [194, -6],
};

// a clear kneel, the hand setting the trap on the floor
const placeTrap: RigPose = {
  spine: 30, neck: -8, head: 0, rootX: -1,
  armFront: [112, 14], armBack: [196, 16],
  legFront: [96, 100], legBack: [160, 120], footBack: 30,
};

// ---------- reactions ----------

const shrug: RigPose = {
  spine: 0, neck: 0, head: 8,
  armFront: [158, -104], armBack: [204, 104],
  ...STAND_LEGS,
  shrug: 2,
};

const liftFind: RigPose = {
  spine: -4, neck: -8, head: -12,
  armFront: [22, -12], armBack: [190, 8],
  ...STAND_LEGS,
};

// laughing: leaning back, head thrown back with the nose up, pointing at the loser
const laugh1: RigPose = {
  spine: -10, neck: -10, head: -26,
  armFront: [72, -18], armBack: [200, 14],
  legFront: [168, 12], legBack: [190, -4],
};
const laugh2: RigPose = {
  spine: -15, neck: -12, head: -34,
  armFront: [66, -26], armBack: [206, 16],
  legFront: [164, 22], legBack: [186, 10],
};

// head shake: the same body, arms out in protest, the face turned towards the viewer, then away
const REFUSE = {
  spine: 0, neck: 0, head: 0,
  armFront: [140, -34] as Limb, armBack: [222, 30] as Limb,
  ...STAND_LEGS,
} as const;
const refuse1: RigPose = { ...REFUSE, headTurn: 0.35 };
const refuse2: RigPose = { ...REFUSE, headTurn: -1 };

// giggle: shoulders up, face tilted down (the hat only half follows the nod), hands clasped at the belly; the two
// frames bob the head
const giggle1: RigPose = {
  spine: 3, neck: 6, head: 16,
  armFront: [168, -78], armBack: [176, -72],
  ...STAND_LEGS,
  shrug: 1.4,
};
const giggle2: RigPose = {
  spine: 6, neck: 10, head: 24,
  armFront: [172, -84], armBack: [180, -78],
  legFront: [168, 18], legBack: [180, 14],
  shrug: 2.2,
};

export const RIG_POSES = {
  stand: { spine: 0, neck: 0, head: 0, armFront: [174, -6], armBack: [186, 4], ...STAND_LEGS },
  walk1, walk2, walk3, walk4,
  fightStand, fightWalk1, fightWalk2, swingWind, swingStrike, bashStrike, block, duck,
  searchDig1, searchDig2, hidePut, placeTrap,
  shrug, liftFind, laugh1, laugh2, refuse1, refuse2, giggle1, giggle2,
} as const satisfies Record<string, RigPose>;

export type RigPoseName = keyof typeof RIG_POSES;

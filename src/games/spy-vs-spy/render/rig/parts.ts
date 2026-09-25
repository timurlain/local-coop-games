// The spy's body parts as vector shapes hung on the skeleton, listed back to front.
//
// Characters: b = the spy colour (coat, sleeves, trousers, hat), o = drawn line (belt), s / S = skin and
// its shade (face, nose, hands), d = the eye dot, k = shoes, u = umbrella cloth and shaft, h = the crook
// handle, f = the metal ferrule. Shapes are authored for an upright bone (x forward, y along the bone) and
// rotated with it; everything is in world units (see skeleton.ts).

import type { Paint, Shape, Vec } from './raster';
import { rotate, SHOE, step, type Joints, type RigPose } from './skeleton';

/** Draw order and outline depth: a part only gets a separating line from parts with a higher number. */
export const PART = {
  armBack: 1,
  legBack: 2,
  legFront: 3,
  body: 4,
  armFront: 5,
  umbrella: 6,
  handFront: 7,
  head: 8,
} as const;

type WorldPaint = { readonly shape: Shape; readonly ch: string; readonly part: number };

/** Places an upright-authored polygon at `origin`, turned to world angle `angle`. */
function poly(origin: Vec, angle: number, pts: readonly Vec[]): Shape {
  return {
    kind: 'poly',
    pts: pts.map((p) => {
      const [x, y] = rotate(p, angle);
      return [origin[0] + x, origin[1] + y] as Vec;
    }),
  };
}

function limb(a: Vec, b: Vec, ra: number, rb = ra): Shape {
  return { kind: 'capsule', a, b, ra, rb };
}

function dot(c: Vec, r: number): Shape {
  return { kind: 'circle', c, r };
}

// Head + hat as one pointed wedge, like the 1984 originals. Origin = top of the neck.
// Face: flat back of the head, a pointed chin.
const FACE: readonly Vec[] = [[-3.4, 6.4], [3.4, 6.4], [3.6, 4.2], [2.5, 1.8], [1, 0.4], [-1.5, 0.4], [-3.2, 2], [-3.6, 4]];
// Long pointed nose straight out under the brim, tip slightly lower than its root.
const NOSE: readonly Vec[] = [[2.6, 6.3], [12.2, 4.9], [11.8, 4.4], [2.6, 3.3]];
// Fedora: brim from behind the head to the nose tip; the crown is highest at the back and slopes into the brim.
const HAT: readonly Vec[] = [
  [-7.2, 6.2], [12.4, 6.2], [12.6, 6.9], [7, 7.8], [1.5, 10.6], [-2.5, 12.8], [-4.6, 12.9], [-5.7, 12], [-5.5, 8.2], [-7.6, 7.6],
];
const EYE: Vec = [1.6, 5.2];

// Trench coat on the spine (origin = hip): straight sides, hem at the upper thigh.
function coat(shrug: number): Vec[] {
  const top = 8.9 + shrug * 0.6;
  return [[-3.9, -2.8], [4.3, -2.8], [4.1, top - 1.4], [2.8, top], [-2.6, top], [-3.9, top - 1.2]];
}
const BELT: readonly Vec[] = [[-4.2, 1.3], [4.6, 1.3], [4.6, 2.1], [-4.2, 2.1]];

/** Closed umbrella along its shaft (origin = the gripping hand, y = towards the tip). */
function closedUmbrella(hand: Vec, angle: number): WorldPaint[] {
  const u = PART.umbrella;
  return [
    ...crook(hand, angle),
    { shape: limb(step(hand, angle, -1), step(hand, angle, 12.6), 0.45), ch: 'u', part: u },
    { shape: poly(hand, angle, [[-1.05, 2.4], [1.05, 2.4], [1.2, 3.6], [0.35, 11.4], [-0.35, 11.4], [-1.2, 3.6]]), ch: 'u', part: u },
    { shape: limb(step(hand, angle, 12.2), step(hand, angle, 14), 0.5, 0.3), ch: 'f', part: u },
  ];
}

/** Open umbrella seen from the side: a dome on the shaft, opening towards the tip. */
function openUmbrella(hand: Vec, angle: number): WorldPaint[] {
  const u = PART.umbrella;
  const dome: Vec[] = [];
  // a wide, shallow dome with a flat rim: reads as an umbrella even at 1x
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (i / 16);
    dome.push([-8.2 * Math.cos(a), 7.4 + 4.4 * Math.sin(a) ** 0.7]);
  }
  return [
    ...crook(hand, angle),
    { shape: limb(step(hand, angle, -1), step(hand, angle, 12), 0.45), ch: 'u', part: u },
    { shape: poly(hand, angle, dome), ch: 'u', part: u },
    { shape: limb(step(hand, angle, 12), step(hand, angle, 13.4), 0.5, 0.3), ch: 'f', part: u },
  ];
}

/** The J-shaped crook below the hand. */
function crook(hand: Vec, angle: number): WorldPaint[] {
  const p = (x: number, y: number): Vec => {
    const [rx, ry] = rotate([x, y], angle);
    return [hand[0] + rx, hand[1] + ry];
  };
  const u = PART.umbrella;
  return [
    { shape: limb(p(0, -0.5), p(0, -2.4), 0.55), ch: 'h', part: u },
    { shape: limb(p(0, -2.4), p(-1.1, -3.4), 0.55), ch: 'h', part: u },
    { shape: limb(p(-1.1, -3.4), p(-2.1, -2.6), 0.55), ch: 'h', part: u },
  ];
}

function umbrella(pose: RigPose, j: Joints): WorldPaint[] {
  if (!pose.umbrella || j.umbrellaAngle === null) return [];
  return pose.umbrella.state === 'open' ? openUmbrella(j.handFront, j.umbrellaAngle) : closedUmbrella(j.handFront, j.umbrellaAngle);
}

function leg(knee: Vec, ankle: Vec, hip: Vec, tilt: number, part: number): WorldPaint[] {
  return [
    { shape: limb(hip, knee, 1.7, 1.4), ch: 'b', part },
    { shape: limb(knee, ankle, 1.4, 1.15), ch: 'b', part },
    { shape: poly(ankle, tilt, SHOE), ch: 'k', part },
  ];
}

/** Every shape of the posed spy, back to front, in world space. */
export function buildParts(pose: RigPose, j: Joints): WorldPaint[] {
  const shrug = pose.shrug ?? 0;
  return [
    // back arm (sleeve, cuff, shaded hand)
    { shape: limb(j.shoulder, j.elbowBack, 1.5, 1.3), ch: 'b', part: PART.armBack },
    { shape: limb(j.elbowBack, j.handBack, 1.3, 1.1), ch: 'b', part: PART.armBack },
    { shape: dot(j.handBack, 1.3), ch: 'S', part: PART.armBack },
    // legs, back then front, under the coat
    ...leg(j.kneeBack, j.ankleBack, j.hip, pose.footBack ?? 0, PART.legBack),
    ...leg(j.kneeFront, j.ankleFront, j.hip, pose.footFront ?? 0, PART.legFront),
    // coat and belt
    { shape: poly(j.hip, j.spineAngle, coat(shrug)), ch: 'b', part: PART.body },
    { shape: poly(j.hip, j.spineAngle, BELT), ch: 'o', part: PART.body },
    // front arm (its hand grips over the umbrella; the head is nearest of all)
    { shape: limb(j.shoulder, j.elbowFront, 1.5, 1.3), ch: 'b', part: PART.armFront },
    { shape: limb(j.elbowFront, j.handFront, 1.3, 1.1), ch: 'b', part: PART.armFront },
    ...umbrella(pose, j),
    { shape: dot(j.handFront, 1.35), ch: 's', part: PART.handFront },
    // head: face, nose, eye, hat
    { shape: poly(j.neckTop, j.headAngle, FACE), ch: 's', part: PART.head },
    { shape: poly(j.neckTop, j.headAngle, NOSE), ch: 's', part: PART.head },
    { shape: dot(pointOn(j.neckTop, j.headAngle, EYE), 0.55), ch: 'd', part: PART.head },
    { shape: poly(j.neckTop, j.headAngle, HAT), ch: 'b', part: PART.head },
  ];
}

function pointOn(origin: Vec, angle: number, p: Vec): Vec {
  const [x, y] = rotate(p, angle);
  return [origin[0] + x, origin[1] + y];
}

/** Maps world units to output pixels: x centred on `cx`, the ground (y = 0) at pixel row edge `ground`. */
export function toPixels(paints: readonly WorldPaint[], cx: number, ground: number, scale: number): Paint[] {
  const m = (p: Vec): Vec => [cx + 0.5 + p[0] * scale, ground - p[1] * scale];
  return paints.map(({ shape, ch, part }) => {
    switch (shape.kind) {
      case 'poly':
        return { ch, part, shape: { kind: 'poly', pts: shape.pts.map(m) } };
      case 'capsule':
        return { ch, part, shape: { kind: 'capsule', a: m(shape.a), b: m(shape.b), ra: shape.ra * scale, rb: shape.rb * scale } };
      case 'circle':
        return { ch, part, shape: { kind: 'circle', c: m(shape.c), r: shape.r * scale } };
    }
  });
}

// The Diktátor puppet: a side-view cartoon figure ("DuckTales" proportions — a big head on a small body).
// World units, ground at y = 0, y up; 0° = up, clockwise positive; the figure faces +x. Pure.

import { reach, step, type Vec } from '../../../../shared/rig/kinematics';

export const BONES = { thigh: 15, shin: 14, torso: 28, neck: 3, head: 15, upper: 12, fore: 11, shoulderAt: 0.9 } as const;

/** Standing height from the soles to the top of the head. */
export const FIGURE_HEIGHT = BONES.thigh + BONES.shin + BONES.torso + BONES.neck + BONES.head * 2;

/** [upper, lower] angles. Arms: shoulder relative to the torso, elbow relative to the upper arm; 180 = hanging.
 * Legs: hip absolute, knee relative to the thigh. */
export type Limb = readonly [number, number];

export type PropKind = 'glass' | 'club' | 'thumb' | 'finger' | 'flagIT' | 'flagYU' | 'newspaper' | 'basket' | 'bouquet';
export type Face = 'ecstatic' | 'happy' | 'neutral' | 'grumpy' | 'furious' | 'shocked';

export interface PuppetPose {
  readonly lean?: number;
  readonly head?: number;
  readonly armF: Limb;
  readonly armB: Limb;
  readonly legF: Limb;
  readonly legB: Limb;
  /** Extra lift above the ground (hops). */
  readonly bob?: number;
  /** IK target for the front hand, relative to the hip; overrides `armF`. */
  readonly reachF?: Vec;
  readonly bendF?: 1 | -1;
  readonly prop?: PropKind;
  /** The front hand is tucked inside the coat: `drawPuppet` skips the hand and draws a lapel flap over the wrist. */
  readonly hideHandF?: boolean;
  readonly mouthOpen?: boolean;
  /** Overrides the mood's face (e.g. a startled face). */
  readonly face?: Face;
}

export interface ArmJoints {
  readonly el: Vec;
  readonly hand: Vec;
}
export interface LegJoints {
  readonly kn: Vec;
  readonly foot: Vec;
}

export interface PuppetJoints {
  readonly hip: Vec;
  readonly neck: Vec;
  readonly head: Vec;
  readonly shoulder: Vec;
  readonly lean: number;
  readonly headTilt: number;
  readonly armF: ArmJoints;
  readonly armB: ArmJoints;
  readonly legF: LegJoints;
  readonly legB: LegJoints;
  readonly prop: PropKind | null;
  readonly hideHandF: boolean;
  readonly mouthOpen: boolean;
  readonly face: Face | null;
}

/** Forward kinematics (plus IK for `reachF`); the lowest foot is put on the ground, then lifted by `bob`. */
export function solvePuppet(p: PuppetPose): PuppetJoints {
  const hip: Vec = [0, 0];
  const t = p.lean ?? 0;
  const neck = step(hip, t, BONES.torso);
  const head = step(neck, t + (p.head ?? 0), BONES.neck + BONES.head);
  const shoulder = step(hip, t, BONES.torso * BONES.shoulderAt);
  const arm = ([s, e]: Limb): ArmJoints => {
    const ua = t + s;
    const el = step(shoulder, ua, BONES.upper);
    return { el, hand: step(el, ua + e, BONES.fore) };
  };
  const armTo = (target: Vec, bend: 1 | -1): ArmJoints => {
    const [ua, la] = reach(shoulder, target, BONES.upper, BONES.fore, bend);
    const el = step(shoulder, ua, BONES.upper);
    return { el, hand: step(el, la, BONES.fore) };
  };
  const leg = ([h, k]: Limb): LegJoints => {
    const kn = step(hip, h, BONES.thigh);
    return { kn, foot: step(kn, h + k, BONES.shin) };
  };
  const af = p.reachF ? armTo(p.reachF, p.bendF ?? -1) : arm(p.armF);
  const ab = arm(p.armB);
  const lf = leg(p.legF);
  const lb = leg(p.legB);
  const lift = -Math.min(lf.foot[1], lb.foot[1]) + (p.bob ?? 0);
  const up = (v: Vec): Vec => [v[0], v[1] + lift];
  return {
    hip: up(hip),
    neck: up(neck),
    head: up(head),
    shoulder: up(shoulder),
    lean: t,
    headTilt: t + (p.head ?? 0),
    armF: { el: up(af.el), hand: up(af.hand) },
    armB: { el: up(ab.el), hand: up(ab.hand) },
    legF: { kn: up(lf.kn), foot: up(lf.foot) },
    legB: { kn: up(lb.kn), foot: up(lb.foot) },
    prop: p.prop ?? null,
    hideHandF: p.hideHandF ?? false,
    mouthOpen: p.mouthOpen ?? false,
    face: p.face ?? null,
  };
}

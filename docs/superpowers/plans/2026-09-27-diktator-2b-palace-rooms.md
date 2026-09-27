# Diktátor — Plan 2b: The palace rooms as a picture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every palace room as a stage — the approved puppets, per-room furniture, crowds whose size is the group's strength and whose pose is its mood, Zog's portrait reacting to the mood, the rebels' campfire map, the envoys, the treasury's gold — driven by a pure view model of the game state, and shown on a preview page where each room can be inspected with strength and mood sliders.

**Architecture:** Pure modules first (shared kinematics, puppet skeleton, poses, looks, crowd layout, portrait rules, room styles, the palace view model), each tested; then two canvas modules (puppet drawing, room scene) ported from the approved sketch; then a dev preview page. No interaction with the game yet — plan 2c adds the split screen, room jumping, menus and shared screens on top of `palaceView`.

**Tech Stack:** TypeScript (strict), Canvas 2D, Vite multi-page, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` §5 (palace, ten mood levels, rooms), §11 (puppets first, look later). **Approved design:** the puppet sketch https://claude.ai/artifact/V16DNcQoyMtcwBz6DQVNfh version 2 (source: session scratchpad `puppets/puppets.html`); user feedback folded in: arms always start at the shoulder in the torso; salute = hand to the temple via IK; fright shown by the face only; Queen Mother in a Victorian-level dress; envoys in national colours (Italy flag + tricolour sash + borsalino, Britain top hat + monocle, Yugoslavia šajkača + blue-white-red sash + flag).

**Coordinate conventions (all puppet code):** world units, ground at y = 0, **y up**; angles in degrees, 0° = up, positive = clockwise, the figure faces +x. Canvas drawing flips y, so **every `ctx.rotate` of a world angle uses the negative angle** (this sign was the sketch's shoulder bug).

---

## File structure

| File | Responsibility |
|---|---|
| `src/shared/rig/kinematics.ts` (new) | `Vec`, `dir`, `step`, `rotate`, `angleTo`, `reach` — moved from the spy rig |
| `src/games/spy-vs-spy/render/rig/skeleton.ts` | imports and re-exports the moved functions (spy tests unchanged) |
| `src/games/diktator/render/puppet/skeleton.ts` (new) | proportions, `PuppetPose`, `PuppetJoints`, `solvePuppet` (FK + IK) |
| `src/games/diktator/render/puppet/poses.ts` (new) | named poses, the ten mood poses, faces per mood |
| `src/games/diktator/render/puppet/looks.ts` (new) | character looks and which look each group wears |
| `src/games/diktator/render/puppet/draw.ts` (new) | `drawPuppet` on a canvas |
| `src/games/diktator/render/rooms/styles.ts` (new) | per-room colours, furniture and what the room shows |
| `src/games/diktator/render/rooms/crowd.ts` (new) | positions of 0–9 people on the stage |
| `src/games/diktator/render/rooms/portrait.ts` (new) | how Zog's portrait looks at each mood |
| `src/games/diktator/render/rooms/scene.ts` (new) | `drawRoom` — background, furniture, portrait, crowd, heroes, labels |
| `src/games/diktator/ui/palace-view.ts` (new) | pure view model: what a hero sees in a room, and the palace strip |
| `src/games/diktator/dev/rooms.html`, `rooms.ts` (new) | the preview page |
| `src/games/diktator/logic/turn.ts` | carry-over fix: `refreshSeen` after the treasury is settled |
| `vite.config.ts` | preview page entry |
| tests: `tests/shared/kinematics.test.ts`, `tests/diktator/puppet.test.ts`, `tests/diktator/rooms.test.ts`, `tests/diktator/palace-view.test.ts`, `tests/diktator/tariffs.test.ts` or `palace-actions.test.ts` (carry-over) |

Conventions: pure modules have no DOM; canvas modules take a `CanvasRenderingContext2D`; Czech only in user-facing strings; commits `feat(diktator): …` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer in the body. Run `npx vitest run` and `npx tsc --noEmit` before every commit.

---

### Task 1: Carry-over — refresh what is seen after the treasury

The plan-2a final review parked this: `startQuarter` calls `refreshSeen` before `settleTreasury`, so in a bankrupt quarter the commander's first view of the police (who share his starting room, the guardroom) shows popularity one point too high until the next action.

**Files:** Modify `src/games/diktator/logic/turn.ts`; Test `tests/diktator/palace-actions.test.ts`

- [ ] **Step 1: Failing test** — append to `tests/diktator/palace-actions.test.ts`:

```ts
describe('seen popularity at the start of a quarter', () => {
  it('is refreshed after the treasury is settled (bankruptcy lowers the police first)', () => {
    let s = day();
    s = { ...s, treasury: -50 };
    s = play(s, { type: 'endDay', hero: 'zogu' }, { type: 'endDay', hero: 'velitel' });
    if (s.phase.kind !== 'audience') return; // a crisis ended the quarter differently; nothing to check
    expect(s.palace!.seenPop.policie).toBe(s.pop.policie);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run tests/diktator/palace-actions.test.ts` — expected FAIL (seenPop.policie is one higher).
- [ ] **Step 3:** In `startQuarter`, keep `s.palace = newPalaceDay(sc.palace!)` where it is but move `refreshSeen(sc, s)` to directly after `settleTreasury(s, events);`, guarded by `if (s.palace)`.
- [ ] **Step 4:** Run the tests — PASS. If seed 4's first evening ends in a crisis so the test returns early, change `day()`'s seed in this test only to one whose first evening survives (try 5, 6, …) and say so in a comment.
- [ ] **Step 5:** Commit `fix(diktator): the palace sees popularity after the treasury is settled`.

---

### Task 2: Shared kinematics

**Files:** Create `src/shared/rig/kinematics.ts`; Modify `src/games/spy-vs-spy/render/rig/skeleton.ts`; Test `tests/shared/kinematics.test.ts`

- [ ] **Step 1: Failing test** — `tests/shared/kinematics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { angleTo, dir, reach, rotate, step } from '../../src/shared/rig/kinematics';

const close = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('kinematics (0° = up, clockwise positive)', () => {
  it('dir and step', () => {
    close(dir(0), [0, 1]);
    close(dir(90), [1, 0]);
    close(step([1, 1], 180, 2), [1, -1]);
  });
  it('rotate and angleTo', () => {
    close(rotate([0, 1], 90), [1, 0]);
    expect(angleTo([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });
  it('reach puts the end of a two-bone chain on a reachable target', () => {
    const root = [0, 0] as const;
    const target = [5, 12] as const;
    const [upper, lower] = reach(root, target, 8, 7, -1);
    close(step(step(root, upper, 8), lower, 7), target);
  });
});
```

- [ ] **Step 2:** Run — FAIL (module missing).
- [ ] **Step 3:** Create `src/shared/rig/kinematics.ts`:

```ts
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
```

- [ ] **Step 4:** In `src/games/spy-vs-spy/render/rig/skeleton.ts` delete the bodies of `dir`, `step`, `rotate`, `angleTo`, `reach` and the local `RAD` constant if nothing else uses it, and add near the top:

```ts
import { angleTo, dir, reach, rotate, step } from '../../../../shared/rig/kinematics';

export { angleTo, dir, reach, rotate, step };
```

Keep every other export (`BONES`, `SHOE`, `soleY`, `solve`, …) and behaviour unchanged. Spy tests import these names from `render/rig/skeleton` and must pass untouched.

- [ ] **Step 5:** `npx vitest run && npx tsc --noEmit` — all green (spy rig tests included).
- [ ] **Step 6:** Commit `refactor(rig): move the bone math to src/shared/rig`.

---

### Task 3: Puppet skeleton

**Files:** Create `src/games/diktator/render/puppet/skeleton.ts`; Test `tests/diktator/puppet.test.ts`

- [ ] **Step 1: Failing test** — `tests/diktator/puppet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BONES, solvePuppet, type PuppetPose } from '../../src/games/diktator/render/puppet/skeleton';

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
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Create `src/games/diktator/render/puppet/skeleton.ts`:

```ts
// The Diktátor puppet: a side-view cartoon figure ("DuckTales" proportions — a big head on a small body).
// World units, ground at y = 0, y up; 0° = up, clockwise positive; the figure faces +x. Pure.

import { reach, step, type Vec } from '../../../../shared/rig/kinematics';

export const BONES = { thigh: 15, shin: 14, torso: 28, neck: 3, head: 15, upper: 12, fore: 11, shoulderAt: 0.9 } as const;

/** Standing height from the soles to the top of the head. */
export const FIGURE_HEIGHT = BONES.thigh + BONES.shin + BONES.torso + BONES.neck + BONES.head * 2;

/** [upper, lower] angles. Arms: shoulder relative to the torso, elbow relative to the upper arm; 180 = hanging.
 * Legs: hip absolute, knee relative to the thigh. */
export type Limb = readonly [number, number];

export type PropKind = 'glass' | 'club' | 'thumb' | 'finger' | 'flagIT' | 'flagYU';
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
    mouthOpen: p.mouthOpen ?? false,
    face: p.face ?? null,
  };
}
```

- [ ] **Step 4:** Run — PASS. **Step 5:** Commit `feat(diktator): puppet skeleton with IK`.

---

### Task 4: Poses, moods and looks

**Files:** Create `src/games/diktator/render/puppet/poses.ts`, `src/games/diktator/render/puppet/looks.ts`; Test `tests/diktator/puppet.test.ts` (extend)

- [ ] **Step 1: Failing test** — append:

```ts
import { GROUP_LOOK, LOOKS } from '../../src/games/diktator/render/puppet/looks';
import { MOOD_FACES, MOODS, POSES, faceForMood, type PoseName } from '../../src/games/diktator/render/puppet/poses';
import { GROUPS } from '../../src/games/diktator/logic/groups';

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
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Create `src/games/diktator/render/puppet/poses.ts`:

```ts
// Named poses and the ten mood poses of the approved puppet sketch (version 2). Pure; every pose is a function
// of time in seconds so idle motion (bouncing, fist shaking) lives with the pose.

import type { Face, PuppetPose } from './skeleton';

export type PoseFn = (t: number) => PuppetPose;

const STAND: PuppetPose = { lean: 0, head: 0, armF: [172, -8], armB: [188, 8], legF: [176, 2], legB: [184, -2] };

export const POSES = {
  stand: () => STAND,
  walk: (t: number) => {
    const s = Math.sin(t * 7);
    return {
      ...STAND,
      lean: 3,
      armF: [180 - s * 28, -18],
      armB: [180 + s * 28, -18],
      legF: [180 + s * 24, -Math.max(0, s) * 30],
      legB: [180 - s * 24, -Math.max(0, -s) * 30],
      bob: Math.abs(s) * 1.5,
    } satisfies PuppetPose;
  },
  talk: (t: number) => ({ ...STAND, head: 4, armF: [120 + Math.sin(t * 5) * 12, -40], mouthOpen: Math.sin(t * 12) > 0 }) satisfies PuppetPose,
  bow: () => ({ ...STAND, lean: 32, head: 12, armF: [158, -12], armB: [150, -10], legF: [172, 10], legB: [178, 8] }) satisfies PuppetPose,
  salute: () => ({ ...STAND, head: -2, reachF: [7, 46], bendF: -1 }) satisfies PuppetPose,
  point: () => ({ ...STAND, lean: 4, armF: [92, 0], head: 2 }) satisfies PuppetPose,
  shocked: () => ({ ...STAND, lean: -3, head: -6, face: 'shocked' }) satisfies PuppetPose,
  /** Wagging a finger at you: upper arm forward, forearm up from the elbow, index finger up, shaking. */
  warn: (t: number) =>
    ({ ...STAND, head: 4, armF: [82, -88 + Math.sin(t * 9) * 14], prop: 'finger', mouthOpen: Math.sin(t * 10) > 0.2 }) satisfies PuppetPose,
  clasp: () => ({ ...STAND, head: 5, armF: [150, -65], armB: [160, -62] }) satisfies PuppetPose,
} as const satisfies Record<string, PoseFn>;

export type PoseName = keyof typeof POSES;

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

/** Czech mood names, index = popularity. */
export const MOOD_NAMES = ['vzbouření', 'zuřiví', 'rozzlobení', 'reptají', 'nejistí', 'vlažní', 'klidní', 'spokojení', 'oddaní', 'nadšení'] as const;

/** Five faces, each shared by two neighbouring moods. */
export const MOOD_FACES: readonly Face[] = ['furious', 'furious', 'grumpy', 'grumpy', 'neutral', 'neutral', 'happy', 'happy', 'ecstatic', 'ecstatic'];

export function faceForMood(level: number): Face {
  return MOOD_FACES[Math.max(0, Math.min(9, Math.round(level)))];
}
```

(`MOOD_NAMES` duplicates the spec's labels on purpose here; plan 2c moves user-facing strings to `cs.diktator.moods` and imports them.)

- [ ] **Step 4:** Create `src/games/diktator/render/puppet/looks.ts`:

```ts
// Sketch colours of the characters (the final skin comes from generated part sheets, plan 5). Data only.

import type { GroupId } from '../../logic/groups';
import type { PropKind } from './skeleton';

export type HatKind = 'kepi' | 'cap' | 'plis' | 'fez' | 'borsalino' | 'tophat' | 'sajkaca' | 'bun' | 'none';

export interface Look {
  readonly coat: string;
  readonly trim: string;
  readonly legs: string;
  readonly boots: string;
  readonly hat: HatKind;
  readonly hatColor: string;
  readonly moustache?: boolean;
  readonly thinMoustache?: boolean;
  readonly monocle?: boolean;
  readonly belly?: boolean;
  /** A long dress: no legs drawn, a bell skirt to the floor. */
  readonly dress?: boolean;
  readonly shirt?: string;
  /** Diagonal sash stripes, top to bottom. */
  readonly sash?: readonly string[];
  /** Carried when the pose has no prop of its own. */
  readonly prop?: PropKind;
}

export const LOOKS = {
  zogu: { coat: '#5d6b4c', trim: '#c9a44a', legs: '#4a563c', boots: '#231a12', hat: 'kepi', hatColor: '#5d6b4c', moustache: true },
  velitel: { coat: '#7a6a45', trim: '#8c2f2a', legs: '#5f5335', boots: '#2a1d12', hat: 'cap', hatColor: '#6b5c3b', moustache: true },
  mother: { coat: '#2b2231', trim: '#e2d8c6', legs: '#2b2231', boots: '#141012', hat: 'bun', hatColor: '#b9b1a7', dress: true },
  officer: { coat: '#56613f', trim: '#b8963f', legs: '#454f33', boots: '#231a12', hat: 'cap', hatColor: '#56613f', moustache: true },
  peasant: { coat: '#7b5a3a', trim: '#d9cfb8', legs: '#e6dcc4', boots: '#5b4027', hat: 'plis', hatColor: '#f0ebdd', shirt: '#ece4d2' },
  bey: { coat: '#2e2a33', trim: '#8f1d24', legs: '#2a2630', boots: '#16110c', hat: 'fez', hatColor: '#a8202a', moustache: true, belly: true },
  gendarme: { coat: '#2c3a55', trim: '#c9a44a', legs: '#23304a', boots: '#14100b', hat: 'kepi', hatColor: '#2c3a55' },
  italy: {
    coat: '#3b3a44', trim: '#1f8a3b', legs: '#34333c', boots: '#231812', hat: 'borsalino', hatColor: '#6e5a45',
    thinMoustache: true, sash: ['#1f8a3b', '#f4f1e8', '#c8102e'], prop: 'flagIT',
  },
  britain: { coat: '#4a4d55', trim: '#8c2a2a', legs: '#3d4048', boots: '#15151a', hat: 'tophat', hatColor: '#1b1b20', monocle: true, moustache: true },
  yugo: {
    coat: '#1f2f5c', trim: '#c8102e', legs: '#1a2748', boots: '#1a140e', hat: 'sajkaca', hatColor: '#243565',
    moustache: true, sash: ['#1d3f8f', '#f4f1e8', '#c8102e'], prop: 'flagYU',
  },
  treasurer: { coat: '#3a3228', trim: '#c9a44a', legs: '#2f281f', boots: '#16110c', hat: 'none', hatColor: '#000000' },
} as const satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;

/** What the people of each group wear on stage. */
export const GROUP_LOOK: Readonly<Record<GroupId, LookId>> = {
  armada: 'officer',
  rolnici: 'peasant',
  statkari: 'bey',
  povstalci: 'peasant',
  jugoslavie: 'yugo',
  policie: 'gendarme',
  italie: 'italy',
  britanie: 'britain',
};
```

- [ ] **Step 5:** Run — PASS. **Step 6:** Commit `feat(diktator): puppet poses, ten moods and character looks`.

---

### Task 5: Drawing a puppet

**Files:** Create `src/games/diktator/render/puppet/draw.ts`

No unit test (Canvas and `Path2D` do not exist in the Node test environment); verified on the preview page in Task 9. Port the approved sketch's drawing exactly, typed, with the **negative-angle rotation** rule.

- [ ] **Step 1:** Create `src/games/diktator/render/puppet/draw.ts`:

```ts
// Draws a puppet on a canvas in world units (y up). The caller sets the transform: origin at the figure's
// ground point, scale s, and y flipped (setTransform(s·facing, 0, 0, −s, x, groundY)). Because y is flipped,
// every ctx.rotate of a world angle uses the NEGATIVE angle.

import { BONES, type Face, type PuppetJoints } from './skeleton';
import type { Look } from './looks';
import type { Vec } from '../../../../shared/rig/kinematics';

const RAD = Math.PI / 180;
const SKIN = '#e2b98f';
const LINE = '#120c07';
const GREY: Partial<Look> & { shirt: string } = { coat: '#8d8d8d', trim: '#a6a6a6', legs: '#7a7a7a', boots: '#5c5c5c', hatColor: '#9a9a9a', shirt: '#b3b3b3' };

export interface DrawOptions {
  /** Plain grey puppet (the model without its colours). */
  readonly grey?: boolean;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function capsule(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number, color: string): void {
  capsule(ctx, a, b, r + 1.4, LINE);
  capsule(ctx, a, b, r, color);
}

function circle(ctx: CanvasRenderingContext2D, c: Vec, r: number, fill: string, line = true): void {
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }
}

function inHeadFrame(ctx: CanvasRenderingContext2D, J: PuppetJoints, draw: () => void): void {
  ctx.save();
  ctx.translate(J.head[0], J.head[1]);
  ctx.rotate(-J.headTilt * RAD);
  draw();
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, J: PuppetJoints, L: Look): void {
  if (L.hat === 'none') return;
  const r = BONES.head;
  inHeadFrame(ctx, J, () => {
    ctx.fillStyle = L.hatColor;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.4;
    const path = new Path2D();
    switch (L.hat) {
      case 'kepi': path.rect(-r * 0.8, r * 0.55, r * 1.55, r * 0.75); break;
      case 'cap': path.ellipse(0, r * 0.85, r * 1.15, r * 0.45, 0, 0, Math.PI * 2); break;
      case 'plis': path.ellipse(0, r * 0.62, r * 0.95, r * 0.55, 0, 0, Math.PI); break;
      case 'fez':
        path.moveTo(-r * 0.7, r * 0.55); path.lineTo(-r * 0.55, r * 1.45); path.lineTo(r * 0.55, r * 1.45); path.lineTo(r * 0.7, r * 0.55); path.closePath();
        break;
      case 'borsalino':
        path.moveTo(-r * 1.15, r * 0.62); path.lineTo(r * 1.2, r * 0.62); path.lineTo(r * 0.7, r * 0.78);
        path.quadraticCurveTo(r * 0.75, r * 1.45, 0, r * 1.35); path.quadraticCurveTo(-r * 0.8, r * 1.45, -r * 0.7, r * 0.78); path.closePath();
        break;
      case 'tophat': path.rect(-r * 0.7, r * 0.6, r * 1.4, r * 1.3); path.rect(-r * 1.1, r * 0.55, r * 2.2, r * 0.18); break;
      case 'sajkaca': path.moveTo(-r * 0.95, r * 0.55); path.quadraticCurveTo(0, r * 1.5, r * 0.95, r * 0.55); path.closePath(); break;
      case 'bun': path.ellipse(-r * 0.05, r * 0.45, r * 0.95, r * 0.6, 0, 0, Math.PI); path.ellipse(-r * 0.85, r * 0.35, r * 0.42, r * 0.42, 0, 0, Math.PI * 2); break;
    }
    ctx.fill(path);
    ctx.stroke(path);
    if (L.hat === 'kepi' || L.hat === 'cap') {
      ctx.fillStyle = '#1a140d';
      ctx.fillRect(r * 0.1, r * 0.42, r * 1.05, r * 0.16);
      ctx.fillStyle = L.trim;
      ctx.fillRect(-r * 0.7, r * 0.6, r * 1.4, r * 0.12);
    }
    if (L.hat === 'fez') {
      ctx.strokeStyle = '#1a140d';
      ctx.beginPath(); ctx.moveTo(0, r * 1.45); ctx.quadraticCurveTo(-r * 0.7, r * 1.3, -r * 0.6, r * 0.8); ctx.stroke();
    }
  });
}

function drawFace(ctx: CanvasRenderingContext2D, J: PuppetJoints, L: Look, face: Face): void {
  const r = BONES.head;
  inHeadFrame(ctx, J, () => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.fillStyle = shade(SKIN, 0.9);
    ctx.beginPath(); ctx.ellipse(r * 0.98, -r * 0.05, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (const [ex, ey, s] of [[r * 0.55, r * 0.22, 1], [r * 0.05, r * 0.2, 0.8]] as const) {
      ctx.fillStyle = LINE;
      if (face === 'ecstatic') {
        ctx.beginPath(); ctx.arc(ex, ey - 1, 2.6 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else if (face === 'shocked') {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 3.2 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = LINE; ctx.beginPath(); ctx.arc(ex + 0.5, ey, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(ex, ey, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      }
      const tilt = face === 'furious' ? -0.55 : face === 'grumpy' ? -0.3 : face === 'ecstatic' ? 0.25 : face === 'happy' ? 0.12 : face === 'shocked' ? 0.35 : 0;
      const by = ey + 5 + (face === 'ecstatic' ? 1.5 : face === 'shocked' ? 2.5 : 0);
      ctx.beginPath(); ctx.moveTo(ex - 3.2 * s, by - tilt * 3); ctx.lineTo(ex + 3.2 * s, by + tilt * 3); ctx.stroke();
    }
    const mx = r * 0.45, my = -r * 0.5;
    ctx.beginPath();
    if (face === 'shocked') {
      ctx.fillStyle = '#5a1f1a'; ctx.ellipse(mx, my - 1, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (J.mouthOpen || face === 'furious') {
      ctx.fillStyle = '#5a1f1a'; ctx.ellipse(mx, my, 3.4, face === 'furious' ? 4 : 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (face === 'ecstatic' || face === 'happy') {
      ctx.arc(mx, my + 3.5, face === 'ecstatic' ? 5 : 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (face === 'grumpy') {
      ctx.arc(mx, my - 4, 4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    } else {
      ctx.moveTo(mx - 3.5, my); ctx.lineTo(mx + 3.5, my); ctx.stroke();
    }
    if (L.moustache) { ctx.fillStyle = '#2a1b12'; ctx.beginPath(); ctx.ellipse(r * 0.62, -r * 0.3, r * 0.42, r * 0.13, -0.1, 0, Math.PI * 2); ctx.fill(); }
    if (L.thinMoustache) { ctx.fillStyle = '#1a120c'; ctx.fillRect(r * 0.32, -r * 0.33, r * 0.6, 1.4); }
    if (L.monocle) {
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(r * 0.55, r * 0.22, 4.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.22 - 4.2); ctx.quadraticCurveTo(r * 0.2, -r * 0.8, -r * 0.1, -r * 1.05); ctx.stroke();
    }
    if (face === 'furious') { ctx.fillStyle = 'rgba(200,40,30,0.18)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  });
}

function drawProp(ctx: CanvasRenderingContext2D, J: PuppetJoints): void {
  const h = J.armF.hand;
  switch (J.prop) {
    case 'glass':
      ctx.fillStyle = 'rgba(230,220,180,0.85)'; ctx.strokeStyle = LINE; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(h[0] - 3, h[1] + 9); ctx.lineTo(h[0] + 3, h[1] + 9); ctx.lineTo(h[0] + 1, h[1] + 2); ctx.lineTo(h[0] - 1, h[1] + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'thumb': {
      limb(ctx, [h[0], h[1] + 1], [h[0] - 0.5, h[1] + 5.5], 1.3, SKIN);
      break;
    }
    case 'finger': {
      // the index finger continues the forearm's direction
      const dx = h[0] - J.armF.el[0], dy = h[1] - J.armF.el[1];
      const len = Math.hypot(dx, dy) || 1;
      limb(ctx, h, [h[0] + (dx / len) * 7, h[1] + (dy / len) * 7], 1.2, SKIN);
      break;
    }
    case 'flagIT':
    case 'flagYU': {
      const top: Vec = [h[0] + 1, h[1] + 26];
      limb(ctx, [h[0], h[1] - 4], top, 0.9, '#6b4a2a');
      const fw = 13, fh = 9, fx = top[0], fy = top[1] - fh;
      const cols = J.prop === 'flagIT' ? ['#1f8a3b', '#f4f1e8', '#c8102e'] : ['#1d3f8f', '#f4f1e8', '#c8102e'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        if (J.prop === 'flagIT') ctx.fillRect(fx + (fw / 3) * i, fy, fw / 3 + 0.2, fh);
        else ctx.fillRect(fx, fy + fh - (fh / 3) * (i + 1), fw, fh / 3 + 0.2);
      }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(fx, fy, fw, fh);
      break;
    }
    case 'club': {
      const a = Math.atan2(h[0] - J.armF.el[0], h[1] - J.armF.el[1]);
      limb(ctx, h, [h[0] + Math.sin(a) * 18, h[1] + Math.cos(a) * 18], 2.4, '#6b4a2a');
      break;
    }
    case null:
      break;
  }
}

/** Draws one puppet. `face` is the mood's face; a pose's own `face` (e.g. startled) wins. */
export function drawPuppet(ctx: CanvasRenderingContext2D, joints: PuppetJoints, look: Look, face: Face, opts: DrawOptions = {}): void {
  const L: Look = opts.grey ? { ...look, ...GREY } : look;
  const J: PuppetJoints = !joints.prop && look.prop ? { ...joints, prop: look.prop } : joints;
  const skin = opts.grey ? '#c9c9c9' : SKIN;
  const back = (c: string) => shade(c, 0.78);

  if (!L.dress) {
    limb(ctx, J.hip, J.legB.kn, 4.6, back(L.legs)); limb(ctx, J.legB.kn, J.legB.foot, 4.2, back(L.legs));
    ctx.fillStyle = back(L.boots); ctx.beginPath(); ctx.ellipse(J.legB.foot[0] + 2.5, J.legB.foot[1] + 1.5, 5.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  limb(ctx, J.shoulder, J.armB.el, 3.8, back(L.coat)); limb(ctx, J.armB.el, J.armB.hand, 3.4, back(L.coat));
  circle(ctx, J.armB.hand, 3.6, back(opts.grey ? '#bdbdbd' : SKIN));

  // torso: a rounded coat from hip to shoulders, rotated with the lean (negative angle, y is flipped)
  ctx.save();
  ctx.translate(J.hip[0], J.hip[1]);
  ctx.rotate(-J.lean * RAD);
  const w = L.belly ? 13 : L.dress ? 9 : 11;
  const T = BONES.torso;
  const body = new Path2D();
  body.moveTo(-w, -4); body.lineTo(w + (L.belly ? 3 : 0), -4);
  body.quadraticCurveTo(w + (L.belly ? 7 : 2), T * 0.45, w - 1, T * 0.92);
  body.quadraticCurveTo(0, T * 1.02, -w + 1, T * 0.92);
  body.quadraticCurveTo(-w - 2, T * 0.45, -w, -4);
  ctx.fillStyle = L.coat; ctx.fill(body); ctx.lineWidth = 1.4; ctx.strokeStyle = LINE; ctx.stroke(body);
  if (L.shirt) { ctx.fillStyle = L.shirt; ctx.fillRect(1, T * 0.35, 5, T * 0.55); }
  if (L.sash && !opts.grey) {
    ctx.save(); ctx.translate(0, T * 0.55); ctx.rotate(0.75);
    L.sash.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-16, -3 + i * 2, 32, 2); });
    ctx.restore();
  }
  if (L.dress) { ctx.fillStyle = L.trim; ctx.beginPath(); ctx.ellipse(0, T * 0.93, 8, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke(); }
  else { ctx.fillStyle = L.trim; ctx.fillRect(-w + 1, T * 0.28, w * 2 - 2, 2.2); }
  if (L.hat === 'kepi' || L.hat === 'cap') { ctx.fillStyle = L.trim; ctx.fillRect(w - 5, T * 0.86, 4, 2); ctx.fillRect(-w + 1, T * 0.86, 4, 2); }
  ctx.restore();

  if (L.dress) {
    const g = Math.min(J.legF.foot[1], J.legB.foot[1]);
    const x = J.hip[0], y = J.hip[1];
    const skirt = new Path2D();
    skirt.moveTo(x - 10, y + 3); skirt.lineTo(x + 10, y + 3);
    skirt.quadraticCurveTo(x + 15, y - 12, x + 20, g); skirt.quadraticCurveTo(x, g - 2, x - 20, g); skirt.quadraticCurveTo(x - 15, y - 12, x - 10, y + 3);
    ctx.fillStyle = L.coat; ctx.fill(skirt); ctx.lineWidth = 1.4; ctx.strokeStyle = LINE; ctx.stroke(skirt);
    ctx.strokeStyle = shade(L.coat, 1.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 8, g + 1); ctx.moveTo(x + 5, y); ctx.lineTo(x + 10, g + 1); ctx.stroke();
  } else {
    limb(ctx, J.hip, J.legF.kn, 4.8, L.legs); limb(ctx, J.legF.kn, J.legF.foot, 4.4, L.legs);
    ctx.fillStyle = L.boots; ctx.beginPath(); ctx.ellipse(J.legF.foot[0] + 2.5, J.legF.foot[1] + 1.5, 5.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  circle(ctx, J.neck, 4, skin);
  circle(ctx, J.head, BONES.head, skin);
  inHeadFrame(ctx, J, () => circle(ctx, [-BONES.head * 0.62, -BONES.head * 0.12], 2.6, shade(opts.grey ? '#c9c9c9' : SKIN, 0.9)));
  drawFace(ctx, J, L, J.face ?? face);
  drawHat(ctx, J, L);

  limb(ctx, J.shoulder, J.armF.el, 4, L.coat); limb(ctx, J.armF.el, J.armF.hand, 3.6, L.coat);
  drawProp(ctx, J);
  circle(ctx, J.armF.hand, 3.8, skin);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` — clean. **Step 3:** Commit `feat(diktator): puppet drawing ported from the approved sketch`.

---

### Task 6: Room styles, crowd layout and the portrait

**Files:** Create `src/games/diktator/render/rooms/styles.ts`, `crowd.ts`, `portrait.ts`; Test `tests/diktator/rooms.test.ts`

The stage is `STAGE_W × STAGE_H = 480 × 200` logical units (y down), floor line at `FLOOR_Y = 168`. The visiting heroes stand on the left (x 60–150); a room's people stand on the right (x 250–465), facing left.

- [ ] **Step 1: Failing test** — `tests/diktator/rooms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { crowdSlots, CROWD_MAX_X, CROWD_MIN_X } from '../../src/games/diktator/render/rooms/crowd';
import { portraitFor } from '../../src/games/diktator/render/rooms/portrait';
import { ROOM_STYLES } from '../../src/games/diktator/render/rooms/styles';
import { albania } from '../../src/games/diktator/scenario/albania';

describe('room styles', () => {
  it('styles every room of the palace grid', () => {
    for (const room of albania.palace!.grid.flat()) expect(ROOM_STYLES[room], room).toBeDefined();
  });
  it('marks the special rooms', () => {
    expect(ROOM_STYLES.straznice.shows).toBe('map');
    expect(ROOM_STYLES.pokladna.shows).toBe('gold');
    expect(ROOM_STYLES.pracovna.shows).toBe('seal');
    expect(ROOM_STYLES.nadvori.shows).toBe('plane');
  });
});

describe('crowdSlots', () => {
  it('places one person per point of strength, clamped to 0..9', () => {
    expect(crowdSlots(0)).toEqual([]);
    expect(crowdSlots(4)).toHaveLength(4);
    expect(crowdSlots(9)).toHaveLength(9);
    expect(crowdSlots(12)).toHaveLength(9);
  });
  it('fills the front row first, keeps everybody on the right side, and orders back row first for drawing', () => {
    const slots = crowdSlots(9);
    expect(slots.filter((s) => s.row === 0)).toHaveLength(5);
    expect(slots.filter((s) => s.row === 1)).toHaveLength(4);
    for (const s of slots) expect(s.x >= CROWD_MIN_X && s.x <= CROWD_MAX_X).toBe(true);
    const firstFront = slots.findIndex((s) => s.row === 0);
    expect(slots.slice(0, firstFront).every((s) => s.row === 1)).toBe(true);
    expect(slots.find((s) => s.row === 1)!.scale).toBeLessThan(1);
  });
});

describe('portraitFor (Zog on the wall, spec §5.2)', () => {
  it('follows the ten mood levels', () => {
    expect(portraitFor(9)).toMatchObject({ laurel: true, bunting: true, tilt: 0 });
    expect(portraitFor(8)).toMatchObject({ laurel: true, bunting: false });
    expect(portraitFor(6)).toMatchObject({ laurel: false, tilt: 0, turned: false });
    expect(portraitFor(4).tilt).toBe(6);
    expect(portraitFor(3).tilt).toBe(12);
    expect(portraitFor(2)).toMatchObject({ turned: true });
    expect(portraitFor(1)).toMatchObject({ fallen: true, brokenChair: true });
    expect(portraitFor(0)).toMatchObject({ defaced: true, brokenChair: true, barricade: true });
  });
  it('shows a plain portrait while the mood is unknown', () => {
    expect(portraitFor(null)).toMatchObject({ tilt: 0, laurel: false, turned: false, defaced: false });
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Create `src/games/diktator/render/rooms/styles.ts`:

```ts
// How each palace room looks: colours, furniture on the stage (x in stage units), and the one thing the room
// shows from the game state. Presentation data only; the rules never read it.

import type { RoomId } from '../../logic/palace';

export type FurnitureKind =
  | 'throne' | 'desk' | 'armchair' | 'teaTable' | 'mapTable' | 'bench' | 'stove' | 'sofa' | 'fireplace'
  | 'rifleRack' | 'roundTable' | 'safe' | 'bookshelf' | 'toyChest' | 'rockingHorse' | 'column' | 'fountain';

export interface Furniture {
  readonly kind: FurnitureKind;
  /** Centre on the stage, 0..480. */
  readonly x: number;
}

export type RoomShows = 'map' | 'gold' | 'seal' | 'plane' | null;

export interface RoomStyle {
  readonly wall: string;
  readonly wainscot: string;
  readonly floor: string;
  readonly accent: string;
  readonly windows: number;
  /** Zog's portrait hangs here and reacts to the room's mood. */
  readonly portrait: boolean;
  readonly shows: RoomShows;
  readonly furniture: readonly Furniture[];
}

export const ROOM_STYLES: Readonly<Record<RoomId, RoomStyle>> = {
  trunni: { wall: '#5a2a2a', wainscot: '#3d1c1c', floor: '#4a3522', accent: '#d9b45a', windows: 2, portrait: false, shows: null, furniture: [{ kind: 'throne', x: 240 }] },
  pracovna: { wall: '#3a2f22', wainscot: '#2a2118', floor: '#3b2c1c', accent: '#c9a44a', windows: 1, portrait: true, shows: 'seal', furniture: [{ kind: 'desk', x: 300 }, { kind: 'bookshelf', x: 420 }] },
  matka: { wall: '#3e3450', wainscot: '#2c2438', floor: '#3a2c2a', accent: '#d6c7e0', windows: 1, portrait: false, shows: null, furniture: [{ kind: 'armchair', x: 330 }, { kind: 'teaTable', x: 400 }] },
  herna: { wall: '#4d5a3a', wainscot: '#36402a', floor: '#5a4630', accent: '#e8c56a', windows: 2, portrait: false, shows: null, furniture: [{ kind: 'rockingHorse', x: 320 }, { kind: 'toyChest', x: 410 }] },
  armada: { wall: '#34422a', wainscot: '#26311f', floor: '#3a2e20', accent: '#b8963f', windows: 1, portrait: true, shows: null, furniture: [{ kind: 'mapTable', x: 250 }] },
  nadvori: { wall: '#8aa0b5', wainscot: '#b9a98a', floor: '#9c8a6c', accent: '#f1e6c8', windows: 0, portrait: false, shows: 'plane', furniture: [{ kind: 'column', x: 40 }, { kind: 'fountain', x: 250 }, { kind: 'column', x: 450 }] },
  vyslanci: { wall: '#2a3440', wainscot: '#1f2730', floor: '#3a2e24', accent: '#c9b27a', windows: 2, portrait: false, shows: null, furniture: [{ kind: 'roundTable', x: 240 }] },
  knihovna: { wall: '#3b2a1e', wainscot: '#2b1f16', floor: '#3a2a1c', accent: '#c9a44a', windows: 1, portrait: false, shows: null, furniture: [{ kind: 'bookshelf', x: 280 }, { kind: 'bookshelf', x: 380 }, { kind: 'armchair', x: 220 }] },
  rolnici: { wall: '#6b5a3e', wainscot: '#4d4030', floor: '#5a4632', accent: '#e6d9b8', windows: 1, portrait: true, shows: null, furniture: [{ kind: 'bench', x: 300 }, { kind: 'stove', x: 440 }] },
  statkari: { wall: '#4a3a1e', wainscot: '#35291a', floor: '#3f2e1e', accent: '#d9b45a', windows: 2, portrait: true, shows: null, furniture: [{ kind: 'sofa', x: 300 }, { kind: 'fireplace', x: 430 }] },
  straznice: { wall: '#2a2a2a', wainscot: '#1d1d1d', floor: '#2f2a24', accent: '#c9a44a', windows: 0, portrait: true, shows: 'map', furniture: [{ kind: 'rifleRack', x: 200 }] },
  pokladna: { wall: '#4a3c14', wainscot: '#35290d', floor: '#3a2e1c', accent: '#f0d27a', windows: 0, portrait: false, shows: 'gold', furniture: [{ kind: 'safe', x: 420 }] },
};
```

- [ ] **Step 4:** Create `src/games/diktator/render/rooms/crowd.ts`:

```ts
// Where a room's people stand: strength 0–9 = number of people; front row of 5, back row of 4 (smaller,
// higher). Returned back row first so the caller can draw in order. Pure.

export const STAGE_W = 480;
export const STAGE_H = 200;
export const FLOOR_Y = 168;
export const CROWD_MIN_X = 250;
export const CROWD_MAX_X = 465;
const FRONT = 5;
const BACK = 4;

export interface CrowdSlot {
  readonly x: number;
  /** Ground line of this person, stage units (y down). */
  readonly ground: number;
  readonly scale: number;
  /** 0 = front, 1 = back. */
  readonly row: 0 | 1;
  /** Phase offset so idle animations do not move in lockstep. */
  readonly phase: number;
}

export function crowdSlots(strength: number): CrowdSlot[] {
  const n = Math.max(0, Math.min(FRONT + BACK, Math.round(strength)));
  const front = Math.min(n, FRONT);
  const back = n - front;
  const slots: CrowdSlot[] = [];
  for (let i = 0; i < back; i++) slots.push({ x: 285 + i * 44, ground: FLOOR_Y - 14, scale: 0.82, row: 1, phase: 0.37 * (i + 5) });
  for (let i = 0; i < front; i++) slots.push({ x: 262 + i * 44, ground: FLOOR_Y, scale: 1, row: 0, phase: 0.37 * i });
  return slots;
}
```

- [ ] **Step 5:** Create `src/games/diktator/render/rooms/portrait.ts`:

```ts
// Zog's portrait on a faction's wall reacts to the room's mood (spec §5.2: laurels at the top, turned to the
// wall at 2, defaced at 0). Pure.

export interface PortraitState {
  readonly tilt: number;
  readonly laurel: boolean;
  readonly bunting: boolean;
  readonly turned: boolean;
  readonly fallen: boolean;
  readonly defaced: boolean;
  readonly brokenChair: boolean;
  readonly barricade: boolean;
}

const PLAIN: PortraitState = { tilt: 0, laurel: false, bunting: false, turned: false, fallen: false, defaced: false, brokenChair: false, barricade: false };

/** `null` = nobody has seen the room's mood this quarter. */
export function portraitFor(mood: number | null): PortraitState {
  if (mood === null) return PLAIN;
  const m = Math.max(0, Math.min(9, Math.round(mood)));
  if (m === 9) return { ...PLAIN, laurel: true, bunting: true };
  if (m === 8) return { ...PLAIN, laurel: true };
  if (m >= 5) return PLAIN;
  if (m === 4) return { ...PLAIN, tilt: 6 };
  if (m === 3) return { ...PLAIN, tilt: 12 };
  if (m === 2) return { ...PLAIN, turned: true };
  if (m === 1) return { ...PLAIN, tilt: 35, fallen: true, brokenChair: true };
  return { ...PLAIN, defaced: true, brokenChair: true, barricade: true };
}
```

- [ ] **Step 6:** Run — PASS. **Step 7:** Commit `feat(diktator): room styles, crowd layout and the reacting portrait`.

---

### Task 7: The palace view model

**Files:** Create `src/games/diktator/ui/palace-view.ts`; Test `tests/diktator/palace-view.test.ts`

What a hero sees in a room. **Mood rule:** if any hero stands in the room, the live popularity is shown (they see the people); otherwise the last-seen value (`palace.seenPop`) or `null` if never seen this quarter. **Strength** is always visible.

- [ ] **Step 1: Failing test** — `tests/diktator/palace-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { roomView, stripView } from '../../src/games/diktator/ui/palace-view';

function day(): GameState {
  return advance(albania, newGame(albania, 4, undefined, { palace: true }).state, { type: 'answer', answer: 'no' }).state;
}

describe('roomView', () => {
  it('shows the throne room with Zogu in it and no crowd', () => {
    const v = roomView(albania, day(), 'trunni');
    expect(v.name).toBe('Trůnní sál');
    expect(v.heroes).toEqual(['zogu']);
    expect(v.crowds).toEqual([]);
  });

  it('shows the guardroom: the commander, the gendarmes (count = strength, mood live) and the rebels’ fires', () => {
    const s = day();
    const v = roomView(albania, s, 'straznice');
    expect(v.heroes).toEqual(['velitel']);
    expect(v.crowds).toEqual([{ group: 'policie', count: s.str.policie, mood: s.pop.policie, look: 'gendarme' }]);
    expect(v.rebelFires).toBe(s.str.povstalci);
  });

  it('hides the mood of a room nobody has visited, but shows its strength', () => {
    const s = day();
    const v = roomView(albania, s, 'armada');
    expect(v.crowds[0]).toEqual({ group: 'armada', count: s.str.armada, mood: null, look: 'officer' });
    expect(v.portraitMood).toBeNull();
  });

  it('remembers the last seen mood after the hero leaves', () => {
    let s = day();
    for (const dir of ['left', 'left', 'down', 'up'] as const) s = advance(albania, s, { type: 'move', hero: 'zogu', dir }).state;
    expect(s.palace!.at.zogu).toBe('matka');
    const v = roomView(albania, s, 'armada');
    expect(v.crowds[0].mood).toBe(s.pop.armada);
    expect(v.portraitMood).toBe(s.pop.armada);
  });

  it('shows one envoy per power in the salon', () => {
    const v = roomView(albania, day(), 'vyslanci');
    expect(v.crowds.map((c) => [c.group, c.count, c.look])).toEqual([
      ['jugoslavie', 1, 'yugo'],
      ['italie', 1, 'italy'],
      ['britanie', 1, 'britain'],
    ]);
  });

  it('shows the gold in the treasury and the seal lying in the study', () => {
    const s = day();
    expect(roomView(albania, s, 'pokladna').treasury).toBe(s.treasury);
    expect(roomView(albania, s, 'pracovna').sealLying).toBe(true);
    expect(roomView(albania, s, 'trunni').sealLying).toBe(false);
  });
});

describe('stripView', () => {
  it('mirrors the grid with heroes, crowd sizes and seen moods', () => {
    const s = day();
    const strip = stripView(albania, s);
    expect(strip.map((row) => row.map((c) => c.room))).toEqual(albania.palace!.grid);
    const guard = strip[2][2];
    expect(guard.heroes).toEqual(['velitel']);
    expect(guard.count).toBe(s.str.policie);
    expect(guard.mood).toBe(s.pop.policie);
    expect(strip[1][0].mood).toBeNull();
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Create `src/games/diktator/ui/palace-view.ts`:

```ts
// The palace as a hero sees it (spec §5.2): who stands in a room, how many people a group has there (strength,
// always visible) and their mood (live if a hero is present, else last seen this quarter, else unknown).
// Pure: reads the game state, never changes it. Plan 2c renders it.

import { GROUPS, hasStrength, type GroupId } from '../logic/groups';
import { HEROES, roomOfGroup, type Hero, type RoomId } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { GameState } from '../logic/state';
import { GROUP_LOOK, type LookId } from '../render/puppet/looks';
import { ROOM_STYLES } from '../render/rooms/styles';

export interface CrowdView {
  readonly group: GroupId;
  /** People on stage: strength for groups that have one, 1 for a foreign power's envoy. */
  readonly count: number;
  /** Popularity 0–9, or null when nobody has seen it this quarter. */
  readonly mood: number | null;
  readonly look: LookId;
}

export interface RoomView {
  readonly id: RoomId;
  readonly name: string;
  readonly heroes: readonly Hero[];
  readonly crowds: readonly CrowdView[];
  /** Guardroom map: campfires = rebel strength. */
  readonly rebelFires: number | null;
  /** Treasury room: the gold on the floor. */
  readonly treasury: number | null;
  /** Study: the seal lies on its stand. */
  readonly sealLying: boolean;
  /** Courtyard: the escape plane stands ready. */
  readonly plane: boolean;
  /** Mood the portrait on the wall reacts to (the room's faction), null if unknown or no portrait. */
  readonly portraitMood: number | null;
}

export interface StripCell {
  readonly room: RoomId;
  readonly name: string;
  readonly heroes: readonly Hero[];
  /** People in the room (sum over its groups). */
  readonly count: number;
  /** Mood of the room's main group as known now, null if unknown or nobody lives there. */
  readonly mood: number | null;
}

const ENVOY_ORDER: readonly GroupId[] = ['jugoslavie', 'italie', 'britanie'];

function moodOf(sc: Scenario, s: GameState, g: GroupId): number | null {
  const p = s.palace;
  if (!p) return s.pop[g];
  const room = roomOfGroup(sc.palace!, g);
  if (HEROES.some((h) => p.at[h] === room)) return s.pop[g];
  return p.seenPop[g] ?? null;
}

function crowdsIn(sc: Scenario, s: GameState, room: RoomId): CrowdView[] {
  const L = sc.palace!;
  const groups = GROUPS.filter((g) => g !== 'povstalci' && roomOfGroup(L, g) === room);
  const ordered = room === L.envoys ? ENVOY_ORDER.filter((g) => groups.includes(g)) : groups;
  return ordered.map((g) => ({
    group: g,
    count: room === L.envoys ? 1 : hasStrength(g) ? s.str[g] : 1,
    mood: moodOf(sc, s, g),
    look: GROUP_LOOK[g],
  }));
}

export function roomView(sc: Scenario, s: GameState, room: RoomId): RoomView {
  const L = sc.palace;
  if (!L) throw new Error(`scenario ${sc.id} has no palace`);
  const style = ROOM_STYLES[room];
  const crowds = crowdsIn(sc, s, room);
  return {
    id: room,
    name: L.names[room],
    heroes: s.palace ? HEROES.filter((h) => s.palace!.at[h] === room) : [],
    crowds,
    rebelFires: room === L.guardroom ? s.str.povstalci : null,
    treasury: style?.shows === 'gold' ? s.treasury : null,
    sealLying: style?.shows === 'seal' && s.palace !== null && s.palace.seal === null,
    plane: style?.shows === 'plane' && s.hasPlane,
    portraitMood: style?.portrait && crowds.length > 0 ? crowds[0].mood : null,
  };
}

export function stripView(sc: Scenario, s: GameState): StripCell[][] {
  const L = sc.palace;
  if (!L) throw new Error(`scenario ${sc.id} has no palace`);
  return L.grid.map((row) =>
    row.map((room) => {
      const v = roomView(sc, s, room);
      return {
        room,
        name: v.name,
        heroes: v.heroes,
        count: v.crowds.reduce((n, c) => n + c.count, 0),
        mood: room === L.envoys ? null : (v.crowds[0]?.mood ?? null),
      };
    }),
  );
}
```

- [ ] **Step 4:** Run — PASS. If the route test's moves do not end in `matka` (the grid is: row 0 matka, pracovna, trunni, herna; row 1 armada, nadvori, vyslanci, knihovna; row 2 rolnici, statkari, straznice, pokladna — trunni → left pracovna → left matka → down armada → up matka), report rather than change the route.
- [ ] **Step 5:** Commit `feat(diktator): palace view model — rooms and the palace strip`.

---

### Task 8: Drawing a room

**Files:** Create `src/games/diktator/render/rooms/scene.ts`

No unit test (canvas); verified on the preview page. The scene draws in stage units (480 × 200, y down); the caller scales the context.

- [ ] **Step 1:** Create `src/games/diktator/render/rooms/scene.ts`:

```ts
// One palace room as a stage (spec §5.1): wall, windows, floor and furniture from the room's style, Zog's
// portrait reacting to the mood, the room's special object (the rebels' map, the gold, the seal, the plane),
// the room's people on the right (count = strength, pose = mood; unknown mood = grey figures and a "?"),
// and the visiting heroes on the left. Stage units 480 × 200, y down; the caller scales the context.

import { FIGURE_HEIGHT, solvePuppet } from '../puppet/skeleton';
import { drawPuppet } from '../puppet/draw';
import { LOOKS } from '../puppet/looks';
import { MOODS, POSES, faceForMood } from '../puppet/poses';
import type { CrowdView, RoomView } from '../../ui/palace-view';
import { crowdSlots, FLOOR_Y, STAGE_H, STAGE_W } from './crowd';
import { portraitFor } from './portrait';
import { ROOM_STYLES, type Furniture, type RoomStyle } from './styles';

/** Puppet world units → stage units: a standing figure is ~95 stage units tall. */
const PUPPET_SCALE = 95 / FIGURE_HEIGHT;
const INK = '#120c07';

function puppetAt(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, facing: 1 | -1, draw: () => void): void {
  ctx.save();
  ctx.transform(PUPPET_SCALE * scale * facing, 0, 0, -PUPPET_SCALE * scale, x, ground);
  draw();
  ctx.restore();
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);
}

function drawBackground(ctx: CanvasRenderingContext2D, st: RoomStyle): void {
  ctx.fillStyle = st.wall;
  ctx.fillRect(0, 0, STAGE_W, FLOOR_Y);
  ctx.fillStyle = st.wainscot;
  ctx.fillRect(0, FLOOR_Y - 34, STAGE_W, 34);
  ctx.fillStyle = st.accent;
  ctx.fillRect(0, FLOOR_Y - 35, STAGE_W, 1.5);
  ctx.fillRect(0, 14, STAGE_W, 1.5);
  ctx.fillStyle = st.floor;
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let x = 0; x < STAGE_W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x - 16, STAGE_H); ctx.stroke();
  }
  for (let i = 0; i < st.windows; i++) {
    const x = 60 + i * 150;
    ctx.fillStyle = '#9fb4c6';
    ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x, 50); ctx.arc(x + 20, 50, 20, Math.PI, 0); ctx.lineTo(x + 40, 110); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = st.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, 30); ctx.lineTo(x + 20, 110); ctx.moveTo(x, 75); ctx.lineTo(x + 40, 75); ctx.stroke();
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture, st: RoomStyle, t: number): void {
  const x = f.x;
  const y = FLOOR_Y;
  switch (f.kind) {
    case 'throne':
      box(ctx, x - 22, y - 70, 44, 70, '#7a1f24');
      box(ctx, x - 26, y - 30, 52, 8, st.accent);
      ctx.fillStyle = st.accent; ctx.beginPath(); ctx.moveTo(x - 22, y - 70); ctx.lineTo(x, y - 86); ctx.lineTo(x + 22, y - 70); ctx.fill();
      break;
    case 'desk': box(ctx, x - 40, y - 34, 80, 8, '#6a4a2a'); box(ctx, x - 36, y - 26, 10, 26, '#5a3e22'); box(ctx, x + 26, y - 26, 10, 26, '#5a3e22'); break;
    case 'armchair': box(ctx, x - 16, y - 40, 32, 24, '#6e4a6e'); box(ctx, x - 20, y - 18, 40, 18, '#5d3d5d'); break;
    case 'teaTable': box(ctx, x - 14, y - 22, 28, 4, '#6a4a2a'); box(ctx, x - 2, y - 18, 4, 18, '#5a3e22'); break;
    case 'mapTable':
      box(ctx, x - 45, y - 30, 90, 6, '#6a4a2a'); box(ctx, x - 40, y - 24, 6, 24, '#5a3e22'); box(ctx, x + 34, y - 24, 6, 24, '#5a3e22');
      ctx.fillStyle = '#d8c9a0'; ctx.fillRect(x - 38, y - 33, 76, 3);
      break;
    case 'bench': box(ctx, x - 50, y - 20, 100, 6, '#6e5234'); box(ctx, x - 46, y - 14, 5, 14, '#5a4028'); box(ctx, x + 41, y - 14, 5, 14, '#5a4028'); break;
    case 'stove': box(ctx, x - 18, y - 50, 36, 50, '#8a4a36'); ctx.fillStyle = `rgba(255,160,60,${0.5 + 0.3 * Math.sin(t * 6)})`; ctx.fillRect(x - 8, y - 20, 16, 10); break;
    case 'sofa': box(ctx, x - 45, y - 34, 90, 16, '#7a2430'); box(ctx, x - 48, y - 18, 96, 18, '#6a1f28'); break;
    case 'fireplace':
      box(ctx, x - 28, y - 62, 56, 62, '#6a5a4a'); ctx.fillStyle = '#1a120c'; ctx.fillRect(x - 16, y - 34, 32, 34);
      ctx.fillStyle = `rgba(255,150,50,${0.55 + 0.35 * Math.sin(t * 7)})`; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x, y - 26, x + 10, y); ctx.fill();
      break;
    case 'rifleRack':
      box(ctx, x - 30, y - 80, 60, 6, '#5a3e22');
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 22 + i * 11, y - 76); ctx.lineTo(x - 22 + i * 11, y - 10); ctx.stroke(); }
      break;
    case 'roundTable': ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(x, y - 26, 40, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); box(ctx, x - 3, y - 26, 6, 26, '#5a3e22'); break;
    case 'safe': box(ctx, x - 24, y - 56, 48, 56, '#3a3a40'); ctx.fillStyle = st.accent; ctx.beginPath(); ctx.arc(x, y - 30, 7, 0, Math.PI * 2); ctx.fill(); break;
    case 'bookshelf':
      box(ctx, x - 28, y - 110, 56, 110, '#4a3020');
      for (let r = 0; r < 4; r++) for (let b = 0; b < 7; b++) { ctx.fillStyle = ['#7a2430', '#2f4a6a', '#6a5a2a', '#3a5a3a'][(r + b) % 4]; ctx.fillRect(x - 24 + b * 7, y - 104 + r * 26, 5, 20); }
      break;
    case 'toyChest': box(ctx, x - 22, y - 26, 44, 26, '#8a5a2a'); ctx.fillStyle = st.accent; ctx.fillRect(x - 22, y - 16, 44, 3); break;
    case 'rockingHorse':
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 4, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      box(ctx, x - 18, y - 36, 36, 12, '#c0a070'); box(ctx, x + 14, y - 50, 10, 16, '#c0a070');
      break;
    case 'column': box(ctx, x - 10, 20, 20, FLOOR_Y - 20, '#d8ccb0'); box(ctx, x - 14, 14, 28, 8, '#cfc2a4'); break;
    case 'fountain':
      ctx.fillStyle = '#b9ad90'; ctx.beginPath(); ctx.ellipse(x, y - 8, 46, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(160,200,230,${0.6 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x, y - 48, x + 20, y - 14); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x, y - 48, x - 20, y - 14); ctx.stroke();
      break;
  }
}

function drawPortrait(ctx: CanvasRenderingContext2D, st: RoomStyle, mood: number | null): void {
  const p = portraitFor(mood);
  const x = 200, y = 58;
  ctx.save();
  ctx.translate(x, p.fallen ? y + 60 : y);
  ctx.rotate((p.tilt * Math.PI) / 180);
  if (p.turned) {
    box(ctx, -18, -24, 36, 48, '#6a5a44');
    ctx.strokeStyle = '#4a3c2c'; ctx.beginPath(); ctx.moveTo(-18, -24); ctx.lineTo(18, 24); ctx.moveTo(18, -24); ctx.lineTo(-18, 24); ctx.stroke();
  } else {
    box(ctx, -18, -24, 36, 48, st.accent);
    box(ctx, -14, -20, 28, 40, '#3b3f33');
    ctx.fillStyle = '#e2b98f'; ctx.beginPath(); ctx.arc(0, -4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d6b4c'; ctx.fillRect(-7, -15, 14, 5); ctx.fillRect(-10, 6, 20, 14);
    ctx.fillStyle = '#2a1b12'; ctx.fillRect(-4, 0, 8, 2);
    if (p.defaced) { ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, 20); ctx.moveTo(14, -20); ctx.lineTo(-14, 20); ctx.stroke(); }
  }
  ctx.restore();
  if (p.laurel) {
    ctx.strokeStyle = '#6a9a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + 2, 26, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + 2, 26, Math.PI * 1.6, Math.PI * 0.4); ctx.stroke();
  }
  if (p.bunting) {
    const cols = ['#c8102e', '#111111'];
    for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(i * 30, 16); ctx.lineTo(i * 30 + 30, 16); ctx.lineTo(i * 30 + 15, 30); ctx.fill(); }
  }
  if (p.brokenChair) {
    ctx.save(); ctx.translate(360, FLOOR_Y - 6); ctx.rotate(1.2); box(ctx, -12, -3, 24, 5, '#6a4a2a'); ctx.restore();
    box(ctx, 380, FLOOR_Y - 10, 18, 4, '#6a4a2a');
  }
  if (p.barricade) {
    for (let i = 0; i < 3; i++) box(ctx, 420 + i * 12, FLOOR_Y - 40 + i * 6, 40, 8, '#5a3e22');
  }
}

function drawSpecial(ctx: CanvasRenderingContext2D, v: RoomView, st: RoomStyle, t: number): void {
  if (v.rebelFires !== null) {
    // the guardroom's wall map of the mountains, one campfire per point of rebel strength
    box(ctx, 300, 28, 150, 84, '#d8c9a0');
    ctx.fillStyle = '#8a6a4a';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(305 + i * 24, 108); ctx.lineTo(317 + i * 24, 60 + (i % 2) * 12); ctx.lineTo(329 + i * 24, 108); ctx.fill(); }
    for (let i = 0; i < v.rebelFires; i++) {
      const fx = 312 + (i % 5) * 28, fy = 100 - Math.floor(i / 5) * 30;
      ctx.fillStyle = `rgba(230,90,30,${0.7 + 0.3 * Math.sin(t * 8 + i)})`;
      ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.quadraticCurveTo(fx, fy - 12 - Math.sin(t * 9 + i) * 2, fx + 4, fy); ctx.fill();
    }
    ctx.fillStyle = INK; ctx.font = '9px Georgia, serif'; ctx.fillText('Hory', 306, 40);
  }
  if (v.treasury !== null) {
    const h = Math.max(2, Math.min(70, v.treasury / 10));
    ctx.fillStyle = st.accent;
    ctx.beginPath(); ctx.moveTo(250, FLOOR_Y); ctx.quadraticCurveTo(300, FLOOR_Y - h * 2, 350, FLOOR_Y); ctx.fill();
    ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#f7e9b0'; ctx.font = '11px Georgia, serif';
    ctx.fillText(`${v.treasury.toLocaleString('cs-CZ')} tis.`, 262, FLOOR_Y - h - 6);
  }
  if (v.sealLying) {
    box(ctx, 290, FLOOR_Y - 46, 20, 12, '#6a4a2a');
    ctx.fillStyle = '#b01e24'; ctx.beginPath(); ctx.arc(300, FLOOR_Y - 50, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
  }
  if (v.plane) {
    ctx.fillStyle = '#cfd6dc'; ctx.fillRect(320, 60, 100, 14); ctx.fillRect(360, 44, 14, 46); ctx.fillRect(412, 54, 8, 26);
    ctx.strokeStyle = INK; ctx.strokeRect(320, 60, 100, 14);
  }
}

function drawCrowd(ctx: CanvasRenderingContext2D, crowd: CrowdView, t: number, xShift: number): void {
  const known = crowd.mood !== null;
  const mood = crowd.mood ?? 6;
  for (const slot of crowdSlots(crowd.count)) {
    const pose = MOODS[mood](t + slot.phase);
    puppetAt(ctx, slot.x + xShift, slot.ground, slot.scale, -1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[crowd.look], faceForMood(mood), { grey: !known }));
  }
  if (!known && crowd.count > 0) {
    ctx.fillStyle = 'rgba(21,16,10,0.35)'; ctx.fillRect(240, 20, 235, FLOOR_Y - 20);
    ctx.fillStyle = '#efe4c4'; ctx.font = '28px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('?', 360, 60); ctx.textAlign = 'start';
  }
}

function drawEnvoys(ctx: CanvasRenderingContext2D, crowds: readonly CrowdView[], t: number): void {
  crowds.forEach((c, i) => {
    const mood = c.mood ?? 6;
    const pose = MOODS[mood](t + i * 0.7);
    puppetAt(ctx, 300 + i * 60, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[c.look], faceForMood(mood), { grey: c.mood === null }));
  });
}

/** Draws the room; heroes present stand on the left facing right. `t` is seconds (animation). */
export function drawRoom(ctx: CanvasRenderingContext2D, v: RoomView, t: number): void {
  const st = ROOM_STYLES[v.id];
  drawBackground(ctx, st);
  if (st.portrait) drawPortrait(ctx, st, v.portraitMood);
  for (const f of st.furniture) drawFurniture(ctx, f, st, t);
  drawSpecial(ctx, v, st, t);
  const envoysRoom = v.crowds.length > 1 && v.crowds.every((c) => c.count === 1);
  if (envoysRoom) drawEnvoys(ctx, v.crowds, t);
  else v.crowds.forEach((c, i) => drawCrowd(ctx, c, t, i * 12));
  if (v.id === 'matka') {
    puppetAt(ctx, 380, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS.mother, 'neutral'));
  }
  if (v.id === 'pokladna') {
    puppetAt(ctx, 380, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS.treasurer, 'neutral'));
  }
  v.heroes.forEach((h, i) => {
    const pose = POSES.stand(t);
    puppetAt(ctx, 90 + i * 55, FLOOR_Y, 1, 1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[h], 'neutral'));
  });
  ctx.fillStyle = '#efe4c4';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(v.name, 10, 11);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` — clean. **Step 3:** Commit `feat(diktator): palace room scenes`.

---

### Task 9: Room preview page

**Files:** Create `src/games/diktator/dev/rooms.html`, `src/games/diktator/dev/rooms.ts`; Modify `vite.config.ts`

A developer page (and the source of the user's review artifact): a canvas stage, a room picker, a strength slider, a mood slider with "neviděno" (unseen), hero toggles, and the palace strip below.

- [ ] **Step 1:** Create `src/games/diktator/dev/rooms.html`:

```html
<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Diktátor — místnosti paláce</title>
    <style>
      body { margin: 0; background: #15100a; color: #efe4c4; font: 16px Georgia, serif; }
      main { max-width: 980px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      canvas { width: 100%; aspect-ratio: 480 / 200; background: #000; border: 1px solid #8a6a24; }
      .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
      .controls label { display: flex; gap: 6px; align-items: center; }
      .strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
      .strip button { font: inherit; font-size: 13px; text-align: left; background: #221a10; color: #efe4c4; border: 1px solid #8a6a24; padding: 6px; cursor: pointer; }
      .strip button.here { border-color: #d9b45a; }
    </style>
  </head>
  <body>
    <main>
      <canvas id="stage"></canvas>
      <div class="controls">
        <label>Síla <input type="range" id="strength" min="0" max="9" step="1" /> <span id="strength-out"></span></label>
        <label>Nálada <input type="range" id="mood" min="-1" max="9" step="1" /> <span id="mood-out"></span></label>
        <label><input type="checkbox" id="zogu" checked /> Zogu</label>
        <label><input type="checkbox" id="velitel" /> Kovář</label>
        <label><input type="checkbox" id="plane" /> letadlo</label>
      </div>
      <div class="strip" id="strip"></div>
    </main>
    <script type="module" src="./rooms.ts"></script>
  </body>
</html>
```

- [ ] **Step 2:** Create `src/games/diktator/dev/rooms.ts`:

```ts
// Preview of the palace rooms (plan 2b): pick a room on the strip, set the room group's strength and mood,
// place the heroes. Builds a palace game state and edits it directly — a dev tool, not the game.

import { newGame } from '../logic/turn';
import type { GameState } from '../logic/state';
import { roomOfGroup, type Hero } from '../logic/palace';
import { GROUPS, hasStrength } from '../logic/groups';
import { albania } from '../scenario/albania';
import { MOOD_NAMES } from '../render/puppet/poses';
import { drawRoom } from '../render/rooms/scene';
import { STAGE_H, STAGE_W } from '../render/rooms/crowd';
import { roomView, stripView } from '../ui/palace-view';

const sc = albania;
const L = sc.palace!;
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const strength = $<HTMLInputElement>('strength');
const mood = $<HTMLInputElement>('mood');

let room = 'armada';
let base: GameState = newGame(sc, 1, undefined, { palace: true }).state;

function groupsHere() {
  return GROUPS.filter((g) => g !== 'povstalci' && roomOfGroup(L, g) === room);
}

function state(): GameState {
  const s: GameState = structuredClone(base);
  const p = s.palace!;
  const heroes: Hero[] = [];
  if ($<HTMLInputElement>('zogu').checked) heroes.push('zogu');
  if ($<HTMLInputElement>('velitel').checked) heroes.push('velitel');
  p.at.zogu = heroes.includes('zogu') ? room : 'knihovna';
  p.at.velitel = heroes.includes('velitel') ? room : 'knihovna';
  const m = Number(mood.value);
  for (const g of groupsHere()) {
    if (hasStrength(g)) s.str[g] = Number(strength.value);
    if (m >= 0) { s.pop[g] = m; p.seenPop[g] = m; } else delete p.seenPop[g];
  }
  if (room === L.guardroom) s.str.povstalci = Number(strength.value);
  if (m < 0 && heroes.length > 0) { p.at.zogu = 'knihovna'; p.at.velitel = 'knihovna'; }
  s.hasPlane = $<HTMLInputElement>('plane').checked;
  return s;
}

function renderStrip(s: GameState): void {
  const strip = $('strip');
  strip.replaceChildren();
  for (const row of stripView(sc, s)) {
    for (const cell of row) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${cell.name} · ${cell.count} · ${cell.mood === null ? '?' : MOOD_NAMES[cell.mood]}`;
      if (cell.room === room) b.classList.add('here');
      b.addEventListener('click', () => { room = cell.room; update(); });
      strip.append(b);
    }
  }
}

function update(): void {
  const m = Number(mood.value);
  $('strength-out').textContent = strength.value;
  $('mood-out').textContent = m < 0 ? 'neviděno' : `${m} · ${MOOD_NAMES[m]}`;
  renderStrip(state());
}

function frame(now: number): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * STAGE_H * dpr) / STAGE_W);
  }
  const k = canvas.width / STAGE_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  drawRoom(ctx, roomView(sc, state(), room), now / 1000);
  requestAnimationFrame(frame);
}

strength.value = '6';
mood.value = '7';
for (const id of ['strength', 'mood', 'zogu', 'velitel', 'plane']) $(id).addEventListener('input', update);
base = { ...base };
update();
requestAnimationFrame(frame);
```

- [ ] **Step 3:** In `vite.config.ts` add the entry `'diktator-rooms': 'src/games/diktator/dev/rooms.html',` to `rollupOptions.input`.
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` — clean; `dist/src/games/diktator/dev/rooms.html` exists.
- [ ] **Step 5:** Manual check (`npm run dev`, open `/src/games/diktator/dev/rooms.html`): every room renders; strength 0–9 changes the number of people; mood 9 → 0 changes poses, faces and the portrait (laurels … turned … defaced, broken chair, barricade); "neviděno" shows grey figures and "?"; the guardroom map shows one fire per strength point; the treasury shows gold and the amount; the study shows the seal; the courtyard shows the plane when ticked; heroes appear on the left. Report what you saw (the controller also checks it).
- [ ] **Step 6:** Commit `feat(diktator): palace room preview page`.

---

## Self-review notes

- **Spec coverage:** §5.1 rooms with furniture and roles, rebels on the guardroom map, envoys one per power → Tasks 6–8; §5.2 strength = people, mood = pose + face + portrait, unseen = "?" and grey, live when a hero is present, last seen otherwise → Tasks 4, 6, 7, 8; §11 puppets first (rig → grey → skin), smooth cut-out look → Tasks 3–5, with the approved sketch's fixes (shoulder on the torso via the rotation sign, salute IK, fright in the face, Mother's dress, envoys' colours). The split screen, room jumping, menus, strip overlay, transitions, shared screens → plan 2c.
- **Type names:** `Vec`, `dir`, `step`, `rotate`, `angleTo`, `reach` (Task 2); `BONES`, `FIGURE_HEIGHT`, `Limb`, `PropKind`, `Face`, `PuppetPose`, `PuppetJoints`, `solvePuppet` (Task 3); `POSES`, `PoseName`, `PoseFn`, `MOODS`, `MOOD_NAMES`, `MOOD_FACES`, `faceForMood`, `Look`, `HatKind`, `LOOKS`, `LookId`, `GROUP_LOOK` (Task 4); `drawPuppet` (Task 5); `ROOM_STYLES`, `RoomStyle`, `Furniture`, `FurnitureKind`, `RoomShows`, `crowdSlots`, `CrowdSlot`, `STAGE_W`, `STAGE_H`, `FLOOR_Y`, `CROWD_MIN_X`, `CROWD_MAX_X`, `portraitFor`, `PortraitState` (Task 6); `roomView`, `stripView`, `RoomView`, `CrowdView`, `StripCell` (Task 7); `drawRoom` (Task 8).

// Frames of the cartoon trap deaths (round 6 §6), rendered once at load from the rig like SPY_FRAMES: the shock poses
// and their X-ray skeletons, the sooty spy with and without his hat (and the hat's pixels as crumbling pieces), the
// stretched and flattened spring flights, and the shot spy swaying and falling with a hole in his hat. Pure: rows of
// palette characters, no DOM.

import { PISTOL_TILTS, SPLAT_SQUASH } from './death-phases';
import { renderRig, RIG_H, RIG_POSES, RIG_W, type RigPose } from './rig';
import { renderXray } from './rig/xray';
import { SPY_PALETTES } from './sprite-data';

/** A death frame: its rows, the column its body's centre line is on, and the head's brim pixel. */
export interface DeathFrame {
  readonly rows: readonly string[];
  readonly cx: number;
  readonly brim: readonly [number, number];
}

// ---------- poses (facing right; see rig/skeleton.ts for the angles) ----------

/** Electrocuted: stiff as a board, arms flung up and out, legs apart; the two frames jitter. */
const ZAP: readonly RigPose[] = [
  {
    spine: -2, neck: 0, head: -8,
    armFront: [118, -8], armBack: [-116, 8],
    legFront: [156, 2], legBack: [204, -2],
  },
  {
    spine: 2, neck: 2, head: -2,
    armFront: [102, 10], armBack: [-104, -10],
    legFront: [150, 6], legBack: [210, -6], footFront: 10, footBack: 10,
    rootY: 1,
  },
];

/** Sooty after the bang: arms hanging slightly away from the body, stunned. */
const SOOT: RigPose = {
  spine: 0, neck: 0, head: 0,
  armFront: [166, -8], armBack: [194, 8],
  legFront: [174, 4], legBack: [186, -3],
};

/** Shot: arms thrown out a little in surprise. */
const SHOT: RigPose = {
  spine: -3, neck: -2, head: -6,
  armFront: [146, -20], armBack: [214, 20],
  legFront: [172, 4], legBack: [188, -3],
};

/** Shot up by the spring: arms straight up, legs together, toes pointed. */
const JUMP: RigPose = {
  spine: 0, neck: 0, head: -6,
  armFront: [14, 0], armBack: [-12, 0],
  legFront: [178, 0], legBack: [184, 0], footFront: 50, footBack: 50,
};

/** Spread-eagle, as he hits the ceiling. */
const SPLAT: RigPose = {
  spine: 0, neck: 0, head: 0,
  armFront: [64, -10], armBack: [-64, 10],
  legFront: [146, 0], legBack: [214, 0],
};

export const DEATH_POSES = { zap1: ZAP[0], zap2: ZAP[1], soot: SOOT, shot: SHOT, jump: JUMP, splat: SPLAT } as const;

// ---------- frames ----------

const FRAME = { w: RIG_W, h: RIG_H } as const;

function rig(pose: RigPose, opts: Parameters<typeof renderRig>[1] = FRAME): DeathFrame {
  const f = renderRig(pose, opts);
  return { rows: f.rows, cx: opts.cx ?? Math.floor(opts.w / 2), brim: f.brim };
}

/** Big white eyes on the sooty face: the eye dot grows one pixel up, into the black face. */
function bigEye(rows: readonly string[]): string[] {
  const out = rows.map((r) => [...r]);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === 'd' && y > 0 && (out[y - 1][x] === 's' || out[y - 1][x] === 'S')) out[y - 1][x] = 'd';
  }));
  return out.map((r) => r.join(''));
}

/** The shock frames, their X-rays (same pose, same placement) and the sooty frames. */
function build() {
  const zap = ZAP.map((p) => rig(p));
  const xray = ZAP.map((p, i) => ({ rows: renderXray(p, FRAME), cx: FRAME.w / 2, brim: zap[i].brim }));
  const sootHat = rig(SOOT);
  const sootBare = rig(SOOT, { ...FRAME, hat: false });
  const soot = { hat: { ...sootHat, rows: bigEye(sootHat.rows) }, bare: { ...sootBare, rows: bigEye(sootBare.rows) } };
  // tall frame for the stretched flight, wide and low ones for the flattened spy
  const jump = rig(JUMP, { w: RIG_W, h: 52, squash: 1.18, scale: 0.9 });
  const splat = rig(SPLAT, { w: 60, h: 20, squash: SPLAT_SQUASH, scale: 1.3 });
  const slide = rig(SPLAT, { w: 60, h: 24, squash: SPLAT_SQUASH + 0.1, scale: 1.2 });
  // the shot spy: upright with and without the hole, then tilted about his feet (wide: he ends up lying down)
  const shot = rig(SHOT, { w: 88, h: 44, cx: 46 });
  const tilts = Object.fromEntries(
    PISTOL_TILTS.map((t) => [t, rig(SHOT, { w: 88, h: 44, cx: 46, tilt: t, hatHole: true })]),
  ) as Record<number, DeathFrame>;
  return {
    zap, xray, soot, jump, splat, slide, shot, tilts,
    hatPieces: hatPieces(soot.hat.rows, soot.bare.rows),
    /** the standing game frame's brim, where the falling bucket lands */
    standBrim: renderRig(RIG_POSES.stand).brim,
  };
}

/** A pixel of a crumbling hat piece. */
export interface PiecePixel {
  readonly x: number;
  readonly y: number;
  readonly ch: string;
}

/** The hat crumbles into chunks of up to this many pixels square. */
export const HAT_CHUNK = 3;

/**
 * The hat's pixels (drawn in the hatted frame, not in the bare one), cut into HAT_CHUNK-square chunks on a grid,
 * listed in a fixed shuffled order (so neighbours don't fall one after another).
 */
export function hatPieces(hat: readonly string[], bare: readonly string[]): PiecePixel[][] {
  const chunks = new Map<string, PiecePixel[]>();
  hat.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.' || ch === bare[y][x] || (ch !== 'b' && ch !== 'o')) return;
    const key = `${Math.floor(y / HAT_CHUNK)}:${Math.floor(x / HAT_CHUNK)}`;
    const list = chunks.get(key) ?? [];
    list.push({ x, y, ch });
    chunks.set(key, list);
  }));
  // a lone outline pixel is not a piece
  const pieces = [...chunks.values()].filter((p) => p.some((q) => q.ch === 'b'));
  // a fixed shuffle: ordered by a hash of each chunk's grid cell
  const hash = (p: PiecePixel): number => ((p.x * 73856093) ^ (p.y * 19349663)) >>> 0;
  return pieces.sort((a, b) => hash(a[0]) - hash(b[0]));
}

export const DEATH_FRAMES = build();

// ---------- props ----------

/** The bucket, upside down (it lands on the head that way); the rim is the bottom row but one. */
export const BUCKET: readonly string[] = [
  '...ooooo...',
  '..oGGgGGo..',
  '..oGgglGo..',
  '.oGggglgGo.',
  '.oGggglgGo.',
  'oGgggggglGo',
  'oLLLLLLLLLo',
  'ooooooooooo',
];

/** The smoking heap of ash left after the shock: glowing embers and his two shoes sticking out. */
export const HEAP: readonly string[] = [
  '......oooooo......',
  '....ooaaAaaaoo....',
  '...oaaaaaaaaaao...',
  '..oaaAaaaaaaAaao..',
  '.oaaaaaaaaAaaaaao.',
  'okkoaaaAaaaaaaokko',
  'okkkooooooooookkko',
  '.ooo..........ooo.',
];

export const PROP_PALETTE: Readonly<Record<string, string>> = {
  o: '#1a1a1a', G: '#5f666e', g: '#98a2ab', l: '#d6dce2', L: '#c2c9d0',
  a: '#4a4646', A: '#ff7a2a', k: '#0a0a0a',
};

// ---------- palettes ----------

type Pal = Readonly<Record<string, string>>;

/**
 * Palettes of the death frames, by spy: his own colours (plus the bullet hole), the sooty ones (black face, big white
 * eyes; `sootBlink` shuts them) and the X-ray.
 */
export function deathPalettes(spy: 'white' | 'black'): { own: Pal; soot: Pal; sootBlink: Pal; xray: Pal } {
  const own = SPY_PALETTES[spy];
  const soot = {
    ...own,
    b: spy === 'white' ? '#8e8e8e' : '#2a2a2a',
    s: '#161616', S: '#0c0c0c', d: '#ffffff', k: '#000000',
    o: spy === 'white' ? '#000000' : '#8a8a8a',
  };
  return {
    own: { ...own, O: spy === 'white' ? '#101010' : '#e8e8e8' },
    soot,
    sootBlink: { ...soot, d: soot.s },
    xray: { o: '#8fe8ff', x: '#17203a', w: '#f6f6f2', W: '#8e9ab4', e: '#17203a' },
  };
}

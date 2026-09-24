import { RULES } from '../logic/rules';
import type { Dir } from '../logic/state';
import { r } from './draw';
import { VIEW, project, wallX } from './geometry';
import { bake } from './sprites';

type Ctx = CanvasRenderingContext2D;

// The airport guard (spec §9), facing right: a 1930s uniform — peaked cap with a gold badge, dark blue
// tunic with gold buttons and a brown belt, moustache, black boots. In `kick` the front leg is raised
// straight out, the boot sole first. Body centre is column GUARD_CENTER_X; the kicking leg reaches right.

const W = 24;
const GUARD_CENTER_X = 8;

const HEAD = [
  '.....oooooo',
  '....occCCcco',
  '...occccgccco',
  '...occccccccco',
  '...okkkkkkkkkko',
  '....osssskkkkkkko',
  '....osssssssso',
  '....ossssssksso',
  '....osssssssssso',
  '....ossssmmmmmo',
  '....osssssssso',
  '.....ossssso',
];

const TUNIC = [
  '...oocccccccoo',
  '..occcccccgccco',
  '..occcccccccccco',
  '..occCcccccgccco',
  '..occCccccccccco',
  '..occCcccccgccco',
  '..obbbbbbbbbbbbo',
  '..occCccccgccco',
  '..occCcccccccco',
  '..ossccccccccco',
  '...occcccccco',
];

const STAND_LEGS = [
  '....ottttttto',
  ...Array<string>(7).fill('....otttottto'),
  '....okkkokkkkko',
  '....okkkokkkkko',
  '....ooooooooooo',
];

const KICK_LEGS = [
  '....ottttttttttttttokkko',
  '....otttottttttttttokkko',
  '....otttooooooooooookkko',
  '....otttoo.........ooooo',
  ...Array<string>(4).fill('....ottto'),
  '....okkkkko',
  '....okkkkko',
  '....ooooooo',
];

const pad = (rows: readonly string[]): string[] => rows.map((row) => row.padEnd(W, '.'));

export const GUARD_FRAMES = {
  stand: pad([...HEAD, ...TUNIC, ...STAND_LEGS]),
  kick: pad([...HEAD, ...TUNIC, ...KICK_LEGS]),
} satisfies Record<string, readonly string[]>;

export type GuardFrame = keyof typeof GUARD_FRAMES;

export const GUARD_PALETTE: Record<string, string> = {
  o: '#0d0f1a', c: '#22336a', C: '#34498c', k: '#141414', g: '#e8c547',
  s: '#e6b089', m: '#3b2414', t: '#1a2446', b: '#6a4420',
};

/** When the boot is up, seconds into the kick. */
const KICK_FROM = 0.08;
const KICK_UNTIL = 0.45;

/** The guard's frame `elapsed` seconds after the `bounced` event. */
export function guardFrame(elapsed: number): GuardFrame {
  return elapsed >= KICK_FROM && elapsed < KICK_UNTIL ? 'kick' : 'stand';
}

/**
 * Where the guard stands (screen, feet) for an exit on wall `dir`, and whether he faces left (`flip`) — always into
 * the room; at the back or front door he faces the kicked spy (`spyX`, logic units).
 */
export function guardSpot(dir: Dir, spyX: number): { x: number; y: number; flip: boolean } {
  const towardsSpy = spyX < RULES.roomW / 2;
  switch (dir) {
    case 'W': {
      const p = project(0, RULES.roomD / 2);
      return { x: p.sx + 2, y: p.sy, flip: false };
    }
    case 'E': {
      const p = project(RULES.roomW, RULES.roomD / 2);
      return { x: p.sx - 2, y: p.sy, flip: true };
    }
    case 'N':
      return { x: wallX(RULES.roomW / 2), y: VIEW.backY, flip: towardsSpy };
    case 'S':
      return { x: project(RULES.roomW / 2, RULES.roomD).sx, y: VIEW.bottom + 8, flip: towardsSpy };
  }
}

/** Draws the guard in the exit doorway, `elapsed` seconds into the kick (call inside the room clip). */
export function drawGuard(ctx: Ctx, dir: Dir, spyX: number, elapsed: number): void {
  const { x, y, flip } = guardSpot(dir, spyX);
  const frame = guardFrame(elapsed);
  const rows = GUARD_FRAMES[frame];
  const img = bake(`guard:${frame}`, rows, GUARD_PALETTE);
  const left = Math.round(x - (flip ? W - 1 - GUARD_CENTER_X : GUARD_CENTER_X));
  const top = Math.round(y - rows.length);
  const t = elapsed / RULES.guardKickTime;
  ctx.save();
  // steps in out of the doorway and back
  ctx.globalAlpha = Math.max(0, Math.min(1, elapsed / 0.06, (1 - t) / 0.15));
  if (flip) {
    ctx.translate(left + W, top);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(img, left, top);
  }
  ctx.restore();
  if (frame === 'kick' && elapsed < KICK_FROM + 0.15) {
    // impact burst at the sole of the boot
    const bx = flip ? left : left + W - 1;
    const by = top + HEAD.length + TUNIC.length + 1;
    const d = 2 + Math.round((elapsed - KICK_FROM) * 20);
    const side = flip ? -1 : 1;
    for (const [dx, dy] of [[1, 0], [0.7, -0.7], [0.7, 0.7], [0, -1], [0, 1]] as const) {
      r(ctx, bx + side * Math.round(dx * d), by + Math.round(dy * d), 1, 1, dx === 1 ? '#ffffff' : '#ffe27a');
    }
  }
}

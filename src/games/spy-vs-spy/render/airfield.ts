import { disc, line, poly, r } from './draw';

type Ctx = CanvasRenderingContext2D;

/** A 1930s grass airfield in one 320×100 half: pale sky, drifting clouds, far-off Prague spires, a hangar, a windsock. */
export function drawAirfield(ctx: Ctx, now: number): void {
  const sky = ['#86b6dc', '#98c2e2', '#acd0ea', '#c2def0'];
  sky.forEach((c, i) => r(ctx, 0, i * 15, 320, 15, c));
  for (const [k, y, w] of [[0, 12, 26], [170, 22, 34], [300, 8, 20]] as const) {
    const x = ((now * 4 + k) % 400) - 40;
    r(ctx, x, y, w, 4, '#f4f8fa');
    r(ctx, x + 4, y - 3, w - 10, 3, '#f4f8fa');
    r(ctx, x + 2, y + 4, w - 4, 1, '#d8e6ee');
  }
  // distant hills and, far away, the towers and spires of Prague
  r(ctx, 0, 54, 320, 8, '#8aa6a0');
  const haze = '#7a8e9a';
  r(ctx, 208, 49, 16, 5, haze);
  for (const [x, h] of [[200, 10], [203, 13], [206, 13], [214, 8], [226, 6], [236, 9], [252, 7]] as const) {
    r(ctx, x, 54 - h, 2, h, haze);
    r(ctx, x + 0.5, 53 - h, 1, 1, haze);
  }
  for (let x = 0; x < 320; x += 7) r(ctx, x, 57 + ((x * 7) % 3), 7, 6, '#4a6a3a');
  // grass with mown stripes
  r(ctx, 0, 62, 320, 38, '#6a9a48');
  for (let i = 0; i < 6; i += 2) r(ctx, 0, 64 + i * 6, 320, 6, '#74a452');
  // hangar: arched corrugated roof over open sliding doors
  const hx = 2, hw = 74, hy = 70;
  for (let i = 0; i <= hw; i++) {
    const u = (i / hw) * 2 - 1;
    const top = hy - 30 - Math.round(12 * Math.sqrt(Math.max(0, 1 - u * u)));
    r(ctx, hx + i, top, 1, hy - top, i % 3 === 0 ? '#8a8a82' : '#a4a298');
  }
  r(ctx, hx + 12, hy - 26, hw - 24, 26, '#26262a');
  r(ctx, hx + 4, hy - 26, 9, 26, '#b4b2a6');
  r(ctx, hx + hw - 12, hy - 26, 9, 26, '#b4b2a6');
  r(ctx, hx + 4, hy - 27, hw - 8, 1, '#6a6a64');
  // windsock on its pole, flapping
  const wx = 304;
  r(ctx, wx, 40, 1, 32, '#8a8a8a');
  const flap = Math.floor(now * 4) % 2;
  for (let i = 0; i < 5; i++) {
    const h = 5 - Math.floor(i / 2);
    r(ctx, wx + 1 + i * 3, 41 + (i > 2 ? flap : 0) + Math.floor((5 - h) / 2), 3, h, i % 2 === 0 ? '#e0502a' : '#f4f4f0');
  }
}

/** Nose-up attitude of the taildragger standing on its tailwheel, radians. */
export const GROUND_ATTITUDE = 0.1;

/**
 * Generic 1930s three-engine airliner in side view — corrugated silver, low wing, nose engine plus the near wing
 * engine, spatted wheels, a tailwheel, no markings. (x, y) = the main wheels on the ground; `pitch` > 0 is nose up
 * (GROUND_ATTITUDE puts the tailwheel on the ground). `doorDx` is the cabin door relative to x; boarding steps show
 * while `parked`.
 */
export function drawAirliner(
  ctx: Ctx, x: number, y: number, pitch: number, now: number, doorDx: number, parked: boolean, doorOpen: boolean,
): void {
  const silver = '#c8ccd0', shadow = '#a4a8ae', dark = '#3a3a3e', navy = '#2a4a8a';
  const ox = Math.round(x), oy = Math.round(y);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-pitch);
  // tail: fin, rudder and tailplane
  poly(ctx, [[-74, -34], [-71, -52], [-63, -52], [-50, -39]], silver);
  r(ctx, -72, -52, 3, 18, shadow);
  r(ctx, -80, -33, 20, 2, shadow);
  // fuselage tapering to the tail, corrugations, cheatline, cabin windows and cockpit glazing
  poly(ctx, [[-76, -34], [-40, -41], [48, -41], [56, -38], [60, -32], [56, -25], [48, -22], [-40, -23], [-76, -30]], silver);
  for (let i = -66; i < 50; i += 3) {
    const top = i < -40 ? -41 + ((-40 - i) * 7) / 36 : -41;
    const bottom = i < -40 ? -23 - ((-40 - i) * 7) / 36 : -23;
    r(ctx, i, top + 1, 1, bottom - top - 2, '#b8bcc2');
  }
  poly(ctx, [[-74, -33], [-40, -34], [54, -34], [54, -32], [-40, -32], [-74, -31]], navy);
  for (let i = 0; i < 9; i++) r(ctx, -32 + i * 8, -39, 4, 3, '#2a3a4a');
  poly(ctx, [[42, -40], [51, -40], [55, -36], [42, -36]], '#2a3a4a');
  // cabin door
  r(ctx, doorDx - 3, -39, 7, 15, doorOpen ? '#161616' : shadow);
  r(ctx, doorDx - 3, -39, 7, 1, '#8a8e94');
  // low wing with the near engine nacelle and its propeller
  poly(ctx, [[-20, -25], [34, -25], [30, -19], [-16, -19]], shadow);
  r(ctx, 6, -24, 18, 7, silver);
  r(ctx, 22, -25, 4, 9, dark);
  const spin = Math.floor(now * 30) % 2 === 0;
  r(ctx, 27, -36, 1, 22, spin ? '#e4e4e4' : '#9a9a9a');
  r(ctx, 26, -22, 2, 3, dark);
  // nose engine: cowling ring, hub, propeller blur
  r(ctx, 58, -37, 5, 12, dark);
  r(ctx, 63, -33, 2, 4, '#6a6a6a');
  r(ctx, 66, -46, 1, 29, spin ? '#9a9a9a' : '#e4e4e4');
  // fixed undercarriage: struts, wheel with a spat; tailwheel on a short strut
  line(ctx, 10, -19, 7, -6, dark);
  line(ctx, 14, -19, 11, -6, dark);
  disc(ctx, 8, -4, 4, '#1a1a1a');
  poly(ctx, [[2, -9], [15, -9], [13, -5], [3, -5]], silver);
  line(ctx, -68, -30, -68, -10, dark);
  disc(ctx, -68, -9, 2, '#1a1a1a');
  ctx.restore();
  if (parked) {
    // boarding steps from the door sill down to the grass (drawn upright, in screen space)
    const sx = ox + doorDx * Math.cos(pitch) + -24 * Math.sin(pitch);
    const sy = oy - doorDx * Math.sin(pitch) + -24 * Math.cos(pitch);
    const steps = Math.max(1, Math.round((oy - sy) / 4));
    for (let s = 0; s < steps; s++) r(ctx, sx - 4 - s * 2, sy + s * 4, 7, 1, '#6a6a6a');
    line(ctx, sx - 4 - steps * 2, oy, sx - 3, sy, '#4a4a4a');
    line(ctx, sx + 3 - steps * 2, oy, sx + 3, sy, '#4a4a4a');
  }
}

/**
 * The airfield's ticket office (pokladna, round 6 §5): a 1930s wooden booth with a hipped roof and a sign board, a
 * glazed window over a counter sill, and a clerk behind it (green eyeshade, round glasses, waistcoat). (x, y) = the
 * booth's bottom-left corner on the ground; `nod` lowers the clerk's head a pixel, `hand` shows his hand on the sill.
 */
export function drawTicketBooth(ctx: Ctx, x: number, y: number, nod: boolean, hand: boolean): void {
  const wood = '#7a4a24', plank = '#5e3718', light = '#a06a38', dark = '#2a1a10';
  const w = 32;
  // lower panelled body
  r(ctx, x, y - 24, w, 24, wood);
  for (let i = 4; i < w; i += 5) r(ctx, x + i, y - 22, 1, 22, plank);
  r(ctx, x, y - 1, w, 1, dark);
  // corner posts and the window opening
  r(ctx, x, y - 44, 3, 20, wood);
  r(ctx, x + w - 3, y - 44, 3, 20, wood);
  r(ctx, x + 3, y - 42, w - 6, 18, '#2c2420');
  // the clerk: shirt and waistcoat, head, eyeshade, glasses
  const cx = x + w / 2, hy = y - 39 + (nod ? 1 : 0);
  r(ctx, cx - 6, y - 30, 12, 6, '#f0ece0');
  r(ctx, cx - 6, y - 30, 3, 6, '#3a3a44');
  r(ctx, cx + 3, y - 30, 3, 6, '#3a3a44');
  r(ctx, cx - 1, y - 30, 2, 2, '#8a1a1a');
  r(ctx, cx - 3, hy, 7, 8, '#e6b089');
  r(ctx, cx - 4, hy - 1, 9, 2, '#3a2a1a');
  r(ctx, cx - 5, hy + 1, 11, 2, '#2f8a4a');
  r(ctx, cx - 2, hy + 4, 2, 2, '#9ab0c0');
  r(ctx, cx + 1, hy + 4, 2, 2, '#9ab0c0');
  r(ctx, cx - 1, hy + 6, 3, 1, '#a0604a');
  r(ctx, cx - 4, hy + 3, 1, 2, '#e6b089');
  // glass glint in the upper corner, sill in front
  r(ctx, x + 4, y - 41, 4, 1, '#c8d8e0');
  r(ctx, x + 4, y - 40, 1, 3, '#c8d8e0');
  r(ctx, x - 1, y - 25, w + 2, 2, light);
  if (hand) r(ctx, cx - 5, y - 27, 4, 2, '#e6b089');
  // hipped roof and the sign board
  poly(ctx, [[x - 4, y - 44], [x + w + 4, y - 44], [x + w - 2, y - 50], [x + 2, y - 50]], '#8a2a1e');
  r(ctx, x - 4, y - 44, w + 8, 1, '#5a1a12');
  r(ctx, x + 1, y - 58, w - 2, 8, '#efe4c4');
  r(ctx, x + 1, y - 58, w - 2, 1, dark);
  r(ctx, x + 1, y - 51, w - 2, 1, dark);
  ctx.save();
  ctx.fillStyle = '#6a1a12';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('POKLADNA', x + w / 2, y - 52, w - 4);
  ctx.restore();
}

/** Passport control's desk: a waist-high wooden lectern with an ink pad on top. (x, y) = bottom-left on the ground. */
export function drawControlDesk(ctx: Ctx, x: number, y: number): void {
  const w = 14;
  r(ctx, x, y - 16, w, 16, '#6b3e1e');
  r(ctx, x + 2, y - 13, w - 4, 10, '#7c4a26');
  r(ctx, x - 1, y - 17, w + 2, 2, '#a06a38');
  r(ctx, x + w - 5, y - 19, 4, 2, '#2a2a44');
  r(ctx, x, y - 1, w, 1, '#2a1a10');
}

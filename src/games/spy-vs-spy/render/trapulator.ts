import { cs } from '../../../shared/i18n/cs';
import { REMEDY_FOR } from '../logic/traps';
import { SECRETS, TRAPS, type DoorTrapKind, type FurnitureTrapKind, type GameState, type RemedyKind, type Spy } from '../logic/state';
import { HAND_COLORS } from './colors';
import { disc, line, r, roundRect, text } from './draw';
import { DEV, DEVICE, FRAME, type Rect } from './layout';
import { drawMiniMap } from './map';
import { drawIcon } from './sprites';

type Ctx = CanvasRenderingContext2D;
const D = cs.spy.device;

/** Seconds left under which the clock blinks, the warning light glows and the beep sounds. */
export const LOW_TIME = 60;

/** LED clock text `M:SS:hh` (hundredths). */
export function formatLed(seconds: number): string {
  const cs100 = Math.max(0, Math.round(seconds * 100));
  const m = Math.floor(cs100 / 6000);
  const s = Math.floor(cs100 / 100) % 60;
  const h = cs100 % 100;
  return `${m}:${String(s).padStart(2, '0')}:${String(h).padStart(2, '0')}`;
}

/** The trap a remedy defuses (inverse of `REMEDY_FOR`). */
export function defusedBy(remedy: RemedyKind): FurnitureTrapKind | DoorTrapKind {
  const hit = (Object.keys(REMEDY_FOR) as (FurnitureTrapKind | DoorTrapKind)[]).find((t) => REMEDY_FOR[t] === remedy);
  return hit!;
}

const BODY = '#a3a5ab';
const BODY_DARK = '#5a5c62';
const BODY_LIGHT = '#d0d2d6';
const LABEL = '#34343c';
const KEY = '#dedfe2';
const SLOT_BG = '#26282e';

function framed(ctx: Ctx, b: Rect, frame: string, fill: string): void {
  r(ctx, b.x, b.y, b.w, b.h, frame);
  r(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, fill);
}

/** Icon centred in a slot (icons are 8×8, drawn by bottom-centre). */
function iconIn(ctx: Ctx, name: Parameters<typeof drawIcon>[1], b: Rect): void {
  drawIcon(ctx, name, b.x + b.w / 2, b.y + Math.floor((b.h - 8) / 2) + 8);
}

/** Coiled cable from the device's left edge to the TV frame. */
export function drawCable(ctx: Ctx): void {
  const x0 = FRAME.x + FRAME.w;
  const x1 = DEVICE.x;
  const y0 = 30;
  const y1 = 72;
  r(ctx, x1 - 1, y0 - 2, 2, 4, '#2a2a2e');
  r(ctx, x0, y1 - 2, 2, 4, '#2a2a2e');
  for (let y = y0; y < y1; y += 3) {
    line(ctx, x1 - 0.5, y, x0 + 0.5, y + 1.5, '#1e1e22');
    line(ctx, x0 + 0.5, y + 1.5, x1 - 0.5, y + 3, '#4a4a52');
  }
}

export function drawDevice(ctx: Ctx, state: GameState, spy: Spy, now: number): void {
  // body with a darker bevel and a light top-left edge
  ctx.beginPath();
  roundRect(ctx, DEVICE.x, DEVICE.y, DEVICE.w, DEVICE.h, 4);
  ctx.fillStyle = BODY_DARK;
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, DEVICE.x + 1, DEVICE.y + 1, DEVICE.w - 2, DEVICE.h - 2, 3);
  ctx.fillStyle = BODY;
  ctx.fill();
  r(ctx, DEVICE.x + 4, DEVICE.y + 1, DEVICE.w - 8, 1, BODY_LIGHT);
  r(ctx, DEVICE.x + 1, DEVICE.y + 4, 1, DEVICE.h - 8, BODY_LIGHT);

  drawLed(ctx, spy, now);
  drawButtons(ctx, spy);
  drawRemedy(ctx, spy);
  drawSecrets(ctx, spy, now);

  const m = DEV.minimap;
  framed(ctx, m, BODY_DARK, '#14161c');
  drawMiniMap(ctx, state, spy, now);
}

function drawLed(ctx: Ctx, spy: Spy, now: number): void {
  const b = DEV.led;
  framed(ctx, b, '#3a0c0c', '#140404');
  const low = spy.clock < LOW_TIME;
  const tx = b.x + b.w / 2;
  const ty = b.y + b.h - 2;
  // unlit segments behind the digits, like a real LED display
  text(ctx, '8:88:88', tx, ty, '#3a0e0e', 9, 'center');
  if (!low || Math.floor(now * 2) % 2 === 0) text(ctx, formatLed(spy.clock), tx, ty, '#ff3a2a', 9, 'center');
  const w = DEV.warn;
  const cx = w.x + Math.floor(w.w / 2);
  const cy = w.y + Math.floor(w.h / 2);
  disc(ctx, cx, cy, 4, BODY_DARK);
  disc(ctx, cx, cy, 3, low ? '#ff2a1a' : '#4a1410');
  if (low) r(ctx, cx - 1, cy - 2, 1, 1, '#ffd0c0');
}

/** The trap buttons with their stock; the trap in hand and MAPA (while held open) light up (round 4 §7). */
function drawButtons(ctx: Ctx, spy: Spy): void {
  text(ctx, D.traps, DEV.traps[0].x, DEV.buttonLabelY, LABEL, 5);
  text(ctx, D.map, DEV.map.x + DEV.map.w / 2, DEV.buttonLabelY, LABEL, 5, 'center');
  TRAPS.forEach((trap, i) => {
    const b = DEV.traps[i];
    const lit = spy.selected === trap;
    framed(ctx, b, HAND_COLORS.trap, lit ? '#ffe27a' : KEY);
    drawIcon(ctx, trap, b.x + b.w / 2, b.y + 9);
    const stock = spy.stock[trap];
    text(ctx, String(stock), b.x + b.w / 2, b.y + b.h - 1, stock > 0 ? '#1a1a1a' : '#9a9aa0', 5, 'center');
  });

  const m = DEV.map;
  framed(ctx, m, '#3a3a44', spy.mapOpen ? '#ffe27a' : KEY);
  // a little folded map: 3×2 rooms with a blue exit
  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 3; gx++) r(ctx, m.x + 2 + gx * 3, m.y + 4 + gy * 3, 2, 2, gx === 2 && gy === 0 ? '#2e7dd1' : '#5a5c62');
  }
  r(ctx, m.x + 2, m.y + 11, 9, 1, '#9a9aa0');
}

function drawRemedy(ctx: Ctx, spy: Spy): void {
  const b = DEV.remedy;
  text(ctx, D.remedy, DEV.traps[0].x, DEV.remedyLabelY, LABEL, 5);
  framed(ctx, b, HAND_COLORS.remedy, SLOT_BG);
  if (spy.hand?.kind !== 'remedy') return;
  iconIn(ctx, spy.hand.remedy, b);
  const h = DEV.remedyHint;
  framed(ctx, h, BODY_DARK, KEY);
  iconIn(ctx, defusedBy(spy.hand.remedy), h);
  line(ctx, h.x + 1, h.y + h.h - 1, h.x + h.w - 1, h.y + 1, HAND_COLORS.trap);
  line(ctx, h.x + 1, h.y + h.h - 2, h.x + h.w - 2, h.y + 1, HAND_COLORS.trap);
}

function drawSecrets(ctx: Ctx, spy: Spy, now: number): void {
  text(ctx, D.secrets, DEV.traps[0].x, DEV.secretsLabelY, LABEL, 5);
  const hand = spy.hand;
  const inCase = hand?.kind === 'kufrik' ? hand.contents : [];
  const loose = hand?.kind === 'secret' ? hand.secret : null;
  const flashOn = Math.floor(now * 4) % 2 === 0;
  SECRETS.forEach((secret, i) => {
    const b = DEV.secrets[i];
    framed(ctx, b, HAND_COLORS.secret, SLOT_BG);
    if (inCase.includes(secret) || (loose === secret && flashOn)) iconIn(ctx, secret, b);
  });
  const k = DEV.kufrik;
  framed(ctx, k, HAND_COLORS.kufrik, SLOT_BG);
  if (hand?.kind === 'kufrik') iconIn(ctx, 'kufrik', k);
}

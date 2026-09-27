// Draws Pochod na Tiranu (spec 2026-09-27-diktator-pochod-design §7), 960 × 540, y down. Reads the state, never
// changes it. Owns its canvas state (save/restore balanced). The map is drawn in the style of the 1921 atlas; the
// people are the palace puppets as small standees (scale 0.34).

import { cs } from '../../../../shared/i18n/cs';
import type { Hero } from '../../logic/palace';
import { drawPuppet } from '../../render/puppet/draw';
import { LOOKS, type Look } from '../../render/puppet/looks';
import { POSES } from '../../render/puppet/poses';
import { solvePuppet, type Face, type PuppetPose } from '../../render/puppet/skeleton';
import { albaniaMap } from '../../render/rooms/images';
import { ARENA_H, ARENA_W } from '../arena';
import { ATLAS_VIEW, mapHeight, mapWidth, terrainAt, tileCentre, worldToAtlas, type MarchMap, type Terrain } from './map';
import { barracksLocked, zoguPlace } from './places';
import { MARCH } from './rules';
import { cameraOf, dateOf, dist, type Foe, type MarchState, type PlaceState, type Point } from './state';

/** What the canvas shows: the start card's atlas, the march, the result card's atlas, the poster. */
export type MarchView = 'intro' | 'play' | 'result' | 'poster';

/** What the drawing needs besides the state (MarchGame satisfies it). */
export interface MarchScene {
  readonly state: MarchState;
  readonly view: MarchView;
  readonly active: Hero;
  readonly actionKey: string;
  readonly toasts: readonly { readonly text: string; readonly until: number }[];
}

const P = cs.diktator.pochod;
const RAD = Math.PI / 180;
/** Puppet scale on the map: FIGURE_HEIGHT 90 × 0.34 ≈ 31 px (spec §5.1). */
export const STANDEE = 0.34;
const PAPER = '#eadcbf';
const INK = '#3b2a1a';
const GOLD = '#c9a44a';
const RED = '#b0302a';
const MAX_CHUNKS = 6;
const FOLLOWER_GAP = 20;
const MAX_FOLLOWERS = 12;

// ---------- terrain in the atlas style, cached in 960 × 540 chunks ----------

interface Offscreen {
  readonly canvas: CanvasImageSource;
  readonly ctx: CanvasRenderingContext2D;
}

function makeOffscreen(w: number, h: number): Offscreen | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** A stable pseudo-random 0..1 per tile and salt (hachures, trees, stipple), so chunks redraw identically. */
function hash(c: number, r: number, k: number): number {
  return (((c * 73856093) ^ (r * 19349663) ^ (k * 83492791)) >>> 0) % 1000 / 1000;
}

const WATER = '#86abc9';

function isWater(map: MarchMap, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  const ch = map.terrain[r][c];
  return ch === '~' || ch === 'w' || ch === 'o' || ch === 'b';
}

function drawTile(ctx: CanvasRenderingContext2D, map: MarchMap, c: number, r: number): void {
  const T = map.tile;
  const x = c * T;
  const y = r * T;
  const ch = map.terrain[r][c] as Terrain;
  ctx.fillStyle = ch === 's' ? '#f3eee3' : ch === 'm' ? '#d2bf98' : PAPER;
  ctx.fillRect(x, y, T, T);
  switch (ch) {
    case 'f':
      for (let k = 0; k < 3; k++) {
        const tx = x + 10 + hash(c, r, k) * 40;
        const ty = y + 14 + hash(c, r, k + 7) * 36;
        ctx.fillStyle = '#6f7f4a';
        ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a4630';
        ctx.fillRect(tx - 1, ty + 5, 2, 5);
      }
      break;
    case 's':
      ctx.fillStyle = '#9aa3ad';
      for (let k = 0; k < 9; k++) ctx.fillRect(x + hash(c, r, k) * T, y + hash(c, r, k + 20) * T, 1.5, 1.5);
      break;
    case 'm':
      ctx.strokeStyle = '#8a6e4a';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const hx = x + hash(c, r, k) * (T - 12);
        const hy = y + 8 + hash(c, r, k + 11) * (T - 16);
        ctx.beginPath(); ctx.moveTo(hx, hy + 8); ctx.lineTo(hx + 6, hy); ctx.lineTo(hx + 12, hy + 8); ctx.stroke();
      }
      break;
    case '~': case 'w': case 'o': case 'b':
      ctx.fillStyle = ch === 'o' ? '#a9c4d8' : WATER;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = '#4f7ea6';
      ctx.lineWidth = 2;
      for (const [dc, dr, x0, y0, x1, y1] of [[0, -1, 0, 0, T, 0], [0, 1, 0, T, T, T], [-1, 0, 0, 0, 0, T], [1, 0, T, 0, T, T]] as const) {
        if (!isWater(map, c + dc, r + dr)) { ctx.beginPath(); ctx.moveTo(x + x0, y + y0); ctx.lineTo(x + x1, y + y1); ctx.stroke(); }
      }
      if (ch === 'b') {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x, y + T * 0.3, T, T * 0.4);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + k * 10, y + T * 0.3); ctx.lineTo(x + k * 10, y + T * 0.7); ctx.stroke(); }
      }
      break;
    default:
      break;
  }
}

function drawRoads(ctx: CanvasRenderingContext2D, map: MarchMap): void {
  ctx.save();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  for (const road of map.roads) {
    ctx.beginPath();
    road.forEach((at, i) => {
      const [x, y] = tileCentre(map, at);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the terrain and roads of a world rectangle into `ctx` (already in world coordinates). */
function drawTerrain(ctx: CanvasRenderingContext2D, map: MarchMap, x0: number, y0: number, w: number, h: number): void {
  const c0 = Math.max(0, Math.floor(x0 / map.tile));
  const r0 = Math.max(0, Math.floor(y0 / map.tile));
  const c1 = Math.min(map.cols - 1, Math.floor((x0 + w) / map.tile));
  const r1 = Math.min(map.rows - 1, Math.floor((y0 + h) / map.tile));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) drawTile(ctx, map, c, r);
  drawRoads(ctx, map);
}

const chunkCaches = new WeakMap<MarchMap, Map<string, Offscreen>>();

/** A 960 × 540 terrain chunk, built lazily; at most 6 kept, least recently used dropped first. Null without a DOM. */
function chunk(map: MarchMap, cx: number, cy: number): Offscreen | null {
  let cache = chunkCaches.get(map);
  if (!cache) chunkCaches.set(map, (cache = new Map()));
  const key = `${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const off = makeOffscreen(ARENA_W, ARENA_H);
  if (!off) return null;
  off.ctx.save();
  off.ctx.translate(-cx * ARENA_W, -cy * ARENA_H);
  drawTerrain(off.ctx, map, cx * ARENA_W, cy * ARENA_H, ARENA_W, ARENA_H);
  off.ctx.restore();
  cache.set(key, off);
  if (cache.size > MAX_CHUNKS) cache.delete(cache.keys().next().value!);
  return off;
}

function drawGround(ctx: CanvasRenderingContext2D, map: MarchMap, ox: number, oy: number): void {
  for (let cy = Math.floor(oy / ARENA_H); cy * ARENA_H < oy + ARENA_H; cy++) {
    for (let cx = Math.floor(ox / ARENA_W); cx * ARENA_W < ox + ARENA_W; cx++) {
      const off = chunk(map, cx, cy);
      if (off) ctx.drawImage(off.canvas, cx * ARENA_W, cy * ARENA_H);
      else drawTerrain(ctx, map, Math.max(ox, cx * ARENA_W), Math.max(oy, cy * ARENA_H), ARENA_W, ARENA_H);
    }
  }
}

// ---------- places ----------

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 13): void {
  ctx.font = `${size}px 'Poiret One', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = PAPER;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wall: string): void {
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#9a4a2a';
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 3, y - h); ctx.lineTo(x, y - h - w * 0.45); ctx.lineTo(x + w / 2 + 3, y - h); ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** The red flag with the black eagle over a won place. */
function flag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(x, y - 30, 18, 12);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(x + 9, y - 24, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlace(ctx: CanvasRenderingContext2D, p: PlaceState): void {
  if (p.def.kind === 'messenger') return; // drawn as a standee
  const { x, y } = p;
  switch (p.def.kind) {
    case 'village': case 'volunteers': house(ctx, x - 10, y, 16, 12, '#efe3c8'); house(ctx, x + 10, y + 4, 14, 10, '#e6d6b4'); break;
    case 'home': house(ctx, x, y, 30, 18, '#e0cfa6'); ctx.fillStyle = '#cdb98e'; ctx.fillRect(x + 10, y - 34, 10, 16); break;
    case 'tower': ctx.fillStyle = '#e4d3ae'; ctx.fillRect(x - 9, y - 34, 18, 34); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x - 9, y - 34, 18, 34); ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 28, 6, 4); break;
    case 'barracks': house(ctx, x, y, 44, 14, '#d9c9a2'); ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x + 26, y); ctx.lineTo(x + 26, y - 30); ctx.stroke(); break;
    case 'stable': house(ctx, x, y, 34, 14, '#c9a77a'); break;
  }
  if (p.won) flag(ctx, x + 16, y - 6);
  label(ctx, P.places[p.def.id], x, y + 18);
}

/** The golden ring over Zogu's head; a padlock on a locked barracks, a struck coin on a tower he cannot pay. */
function drawRing(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const i = zoguPlace(s);
  if (i < 0 || s.places[i].won) return;
  const p = s.places[i];
  const z = s.heroes.zogu;
  const cx = z.x;
  const cy = z.y - 48;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
  if (p.def.kind === 'barracks' && barracksLocked(s, i)) {
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 5, cy - 2, 10, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 2, 4, Math.PI, 0); ctx.stroke();
    return;
  }
  if (p.def.kind === 'tower' && s.gold < p.bribe) {
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.stroke();
    return;
  }
  // Clockwise from the top: canvas angles grow clockwise with y down.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.progress) / p.ring); ctx.stroke();
}

// ---------- figures ----------

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(40, 28, 16, 0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
}

/** One puppet as a small standee with its feet at (x, y); `lying` turns it on its back (a knocked-out gendarme). */
export function drawStandee(
  ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, pose: PuppetPose, face: Face, facing: 1 | -1, lying = false,
): void {
  shadow(ctx, x, y);
  ctx.save();
  ctx.translate(x, y);
  if (lying) ctx.rotate(-90 * RAD * facing);
  ctx.transform(STANDEE * facing, 0, 0, -STANDEE, 0, 0);
  drawPuppet(ctx, solvePuppet(pose), look, face);
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = '#f2c230';
  for (let k = 0; k < 3; k++) {
    const a = t * 4 + (k * Math.PI * 2) / 3;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
  }
}

/** The point `back` units behind Zogu along his trail (the followers walk there). Pure. */
export function trailPoint(s: MarchState, back: number): Point {
  let prev: Point = s.heroes.zogu;
  let left = back;
  for (let i = s.trail.length - 1; i >= 0; i--) {
    const q = { x: s.trail[i][0], y: s.trail[i][1] };
    const d = dist(prev, q);
    if (d >= left && d > 0) return { x: prev.x + ((q.x - prev.x) * left) / d, y: prev.y + ((q.y - prev.y) * left) / d };
    left -= d;
    prev = q;
  }
  return prev;
}

/** The column behind Zogu (render only): 3 Russians, a peasant per village won and per volunteer group, a soldier per
 * gate guard who joined; at most 12. */
export function followerLooks(s: MarchState): Look[] {
  const out: Look[] = [LOOKS.russian, LOOKS.russian, LOOKS.russian];
  for (let i = 0; i < s.villages + (s.volunteers ? 2 : 0); i++) out.push(LOOKS.peasant);
  for (let i = 0; i < s.joined; i++) out.push(LOOKS.officer);
  return out.slice(0, MAX_FOLLOWERS);
}

function foePose(f: Foe, t: number): { pose: PuppetPose; face: Face; lying: boolean } {
  switch (f.mode) {
    case 'stunned': return { pose: POSES.shocked(t), face: 'shocked', lying: false };
    case 'down': return { pose: POSES.stand(t), face: 'shocked', lying: true };
    case 'surrender': return { pose: POSES.handsUp(t), face: 'shocked', lying: false };
    case 'post': return { pose: POSES.stand(t), face: 'grumpy', lying: false };
    default: return { pose: f.moving ? POSES.walk(t) : POSES.stand(t), face: f.mode === 'chase' ? 'furious' : 'grumpy', lying: false };
  }
}

function drawFigures(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  const s = scene.state;
  const items: { y: number; draw: () => void }[] = [];
  followerLooks(s).forEach((look, k) => {
    const p = trailPoint(s, FOLLOWER_GAP * (k + 2));
    const moving = s.heroes.zogu.moving;
    items.push({ y: p.y, draw: () => drawStandee(ctx, p.x, p.y, look, moving ? POSES.walk(t + k * 0.3) : POSES.stand(t), 'neutral', s.heroes.zogu.facing) });
  });
  for (const h of ['zogu', 'velitel'] as const) {
    const f = s.heroes[h];
    let pose = f.moving ? POSES.walk(t) : POSES.stand(t);
    let face: Face = 'neutral';
    if (h === 'zogu' && s.now < f.frozenUntil) { pose = POSES.shocked(t); face = 'shocked'; }
    else if (h === 'zogu' && (s.now < f.actUntil || s.negotiating >= 0)) { pose = POSES.talk(t); face = 'happy'; }
    else if (h === 'velitel' && s.now < f.actUntil) { pose = POSES.point(t); face = 'furious'; }
    items.push({ y: f.y, draw: () => drawStandee(ctx, f.x, f.y, LOOKS[h], pose, face, f.facing) });
  }
  for (const f of s.foes) {
    const { pose, face, lying } = foePose(f, t);
    const look = f.kind === 'guard' ? LOOKS.officer : LOOKS.gendarme;
    items.push({
      y: f.y,
      draw: () => {
        drawStandee(ctx, f.x, f.y, look, pose, face, f.facing, lying);
        if (f.mode === 'stunned' || f.mode === 'down') stars(ctx, f.x, f.y - (lying ? 12 : 34), t);
      },
    });
  }
  for (const p of s.places) {
    if (p.def.kind === 'messenger') {
      items.push({ y: p.y, draw: () => drawStandee(ctx, p.x, p.y, LOOKS.italy, POSES.walk(t), 'happy', p.dir === 1 ? -1 : 1) });
    }
  }
  if (s.negotiating >= 0 && s.places[s.negotiating].def.kind === 'tower') {
    const p = s.places[s.negotiating];
    items.push({ y: p.y + 1, draw: () => drawStandee(ctx, p.x + 22, p.y + 1, LOOKS.bey, POSES.talk(t), 'grumpy', -1) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

function drawRope(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const z = s.heroes.zogu;
  const v = s.heroes.velitel;
  const d = dist(z, v);
  if (d < MARCH.rope * MARCH.ropeTaut) return;
  ctx.strokeStyle = d >= MARCH.rope - 1 ? RED : GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(z.x, z.y - 14);
  ctx.quadraticCurveTo((z.x + v.x) / 2, (z.y + v.y) / 2 - 6 + (MARCH.rope - d) * 0.3, v.x, v.y - 14);
  ctx.stroke();
}

function drawCaches(ctx: CanvasRenderingContext2D, s: MarchState): void {
  s.map.caches.forEach((at, i) => {
    if (s.caches[i]) return;
    const [x, y] = tileCentre(s.map, at);
    ctx.fillStyle = '#7a4e26';
    ctx.fillRect(x - 7, y - 6, 14, 9);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 1.5, y - 4, 3, 3);
  });
}

// ---------- screen-space overlays ----------

function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = '14px Georgia, serif';
  const w = text.length * 7 + 20;
  ctx.fillStyle = 'rgba(250, 244, 228, 0.95)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - w / 2, y - 18, w, 26);
  ctx.strokeRect(x - w / 2, y - 18, w, 26);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHud(ctx: CanvasRenderingContext2D, s: MarchState): void {
  ctx.fillStyle = 'rgba(28, 20, 12, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, 34);
  ctx.fillStyle = PAPER;
  ctx.font = '18px Georgia, serif';
  ctx.fillText(P.date(dateOf(s.t)), 14, 23);
  // The sun arc for the day.
  const f = (s.t % MARCH.day) / MARCH.day;
  ctx.strokeStyle = 'rgba(234, 220, 191, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(190, 30, 24, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath(); ctx.arc(190 - Math.cos(f * Math.PI) * 24, 30 - Math.sin(f * Math.PI) * 24, 4, 0, Math.PI * 2); ctx.fill();
  // The purse and the tallies.
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(250, 17, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.fillText(String(s.gold), 264, 23);
  const tallies: [string, string][] = [
    ['⌂', `${s.villages}/4`], ['♜', `${s.towers}/4`], ['⚑', `${s.barracks}/4`], ['✋', String(s.captured)],
  ];
  tallies.forEach(([icon, n], k) => ctx.fillText(`${icon} ${n}`, 340 + k * 90, 23));
  drawMiniMap(ctx, s);
}

const MINI = { x: 790, y: 40, w: 160, h: 90 } as const;

function drawMiniMap(ctx: CanvasRenderingContext2D, s: MarchState): void {
  const kx = MINI.w / mapWidth(s.map);
  const ky = MINI.h / mapHeight(s.map);
  ctx.fillStyle = 'rgba(234, 220, 191, 0.9)';
  ctx.fillRect(MINI.x, MINI.y, MINI.w, MINI.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(MINI.x, MINI.y, MINI.w, MINI.h);
  for (const p of s.places) {
    // Only the 12 places; the optional benefits are found by exploring (spec §4.5).
    if (p.def.kind === 'messenger' || p.def.kind === 'stable' || p.def.kind === 'volunteers') continue;
    ctx.fillStyle = p.won ? '#2f6a3a' : RED;
    ctx.fillRect(MINI.x + p.x * kx - 2, MINI.y + p.y * ky - 2, 4, 4);
  }
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  ctx.fillStyle = GOLD;
  ctx.font = '12px Georgia, serif';
  ctx.fillText('★', MINI.x + gx * kx - 5, MINI.y + gy * ky + 4);
  const z = s.heroes.zogu;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(MINI.x + z.x * kx, MINI.y + z.y * ky, 3, 0, Math.PI * 2); ctx.fill();
}

function drawOverlays(ctx: CanvasRenderingContext2D, scene: MarchScene, ox: number, oy: number): void {
  const s = scene.state;
  // Dusk over the last 3 s of each day.
  const dusk = (s.t % MARCH.day) - (MARCH.day - 3);
  if (dusk > 0 && !s.ending) {
    ctx.fillStyle = `rgba(40, 30, 70, ${(0.28 * dusk) / 3})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
  // Falling snow while the camera looks at snow.
  const cam = cameraOf(s);
  if (terrainAt(s.map, cam.x, cam.y) === 's' || terrainAt(s.map, s.heroes.zogu.x, s.heroes.zogu.y) === 's') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let k = 0; k < 40; k++) {
      const x = (hash(k, 1, 3) * ARENA_W + s.now * 12) % ARENA_W;
      const y = (hash(k, 2, 5) * ARENA_H + s.now * (30 + hash(k, 3, 7) * 30)) % ARENA_H;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  // "Drž F — vyjednávat" over Zogu in an unfinished place.
  const i = zoguPlace(s);
  if (i >= 0 && !s.places[i].won && s.negotiating < 0 && s.now >= s.heroes.zogu.frozenUntil) {
    bubble(ctx, P.holdToNegotiate(scene.actionKey), s.heroes.zogu.x - ox, s.heroes.zogu.y - oy - 70);
  }
  // The solo marker over the steered hero.
  if (s.solo) {
    const a = s.heroes[scene.active];
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(a.x - ox - 5, a.y - oy - 42); ctx.lineTo(a.x - ox + 5, a.y - oy - 42); ctx.lineTo(a.x - ox, a.y - oy - 35); ctx.closePath(); ctx.fill();
  }
  // The day banner, the toasts, the catch caption and the ending.
  if (s.t >= MARCH.day && s.t % MARCH.day < 2 && !s.ending) bubble(ctx, P.date(dateOf(s.t)), ARENA_W / 2, 80);
  scene.toasts.forEach((tt, k) => bubble(ctx, tt.text, ARENA_W / 2, ARENA_H - 30 - k * 32));
  // A capture that ends the march (the timeout hits while Zogu is still frozen) shows only the ending caption
  // (fix wave, item 5): no doubled "caught" + "timeout" bubbles.
  if (s.now < s.heroes.zogu.frozenUntil && !s.ending) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    bubble(ctx, P.caught, ARENA_W / 2, ARENA_H / 2);
  }
  if (s.ending) bubble(ctx, s.ending.kind === 'arrived' ? P.arrived : P.timeout, ARENA_W / 2, ARENA_H / 2);
}

function drawPlay(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  const s = scene.state;
  const cam = cameraOf(s);
  const ox = Math.round(cam.x - ARENA_W / 2);
  const oy = Math.round(cam.y - ARENA_H / 2);
  ctx.save();
  ctx.translate(-ox, -oy);
  drawGround(ctx, s.map, ox, oy);
  drawCaches(ctx, s);
  for (const p of s.places) drawPlace(ctx, p);
  const [gx, gy] = tileCentre(s.map, s.map.goal);
  house(ctx, gx - 14, gy, 22, 16, '#efe3c8');
  house(ctx, gx + 12, gy + 6, 26, 18, '#e6d6b4');
  label(ctx, P.tirana, gx, gy + 24, 16);
  drawRope(ctx, s);
  drawFigures(ctx, scene, t);
  drawRing(ctx, s);
  ctx.restore();
  drawOverlays(ctx, scene, ox, oy);
  drawHud(ctx, s);
}

// ---------- the cards' backdrops ----------

/** Atlas image pixels → canvas, for the part of the 1921 map the cards show. */
function atlasToCanvas(px: number, py: number): [number, number] {
  return [((px - ATLAS_VIEW.sx) * ARENA_W) / ATLAS_VIEW.sw, ((py - ATLAS_VIEW.sy) * ARENA_H) / ATLAS_VIEW.sh];
}

function drawAtlas(ctx: CanvasRenderingContext2D): void {
  const img = albaniaMap();
  if (img) ctx.drawImage(img, ATLAS_VIEW.sx, ATLAS_VIEW.sy, ATLAS_VIEW.sw, ATLAS_VIEW.sh, 0, 0, ARENA_W, ARENA_H);
  else {
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

function polyline(ctx: CanvasRenderingContext2D, map: MarchMap, pts: readonly (readonly [number, number])[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const [cx, cy] = atlasToCanvas(...worldToAtlas(map, x, y));
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();
}

function drawIntro(ctx: CanvasRenderingContext2D, s: MarchState): void {
  drawAtlas(ctx);
  const route = [s.map.start, s.map.goal].map((at) => tileCentre(s.map, at));
  polyline(ctx, s.map, route, RED, 6);
  const [ex, ey] = atlasToCanvas(...worldToAtlas(s.map, ...route[1]));
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 22, ey - 6); ctx.lineTo(ex + 14, ey + 14); ctx.closePath(); ctx.fill();
}

function drawResult(ctx: CanvasRenderingContext2D, s: MarchState): void {
  drawAtlas(ctx);
  polyline(ctx, s.map, s.trail, RED, 4);
}

/** The placeholder poster (parent spec §11: a sepia frame with its id and caption until the art exists). */
function drawPoster(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#d9c7a0';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.strokeStyle = '#6b5433';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 30, ARENA_W - 80, ARENA_H - 60);
  ctx.fillStyle = '#3b2a1a';
  ctx.textAlign = 'center';
  ctx.font = "44px 'Limelight', Georgia, serif";
  ctx.fillText(P.posterTitle, ARENA_W / 2, ARENA_H / 2 - 10);
  ctx.font = '18px Georgia, serif';
  ctx.fillText(P.posterCaption, ARENA_W / 2, ARENA_H / 2 + 30);
  ctx.font = '12px monospace';
  ctx.fillText('poster-tirana-1924', ARENA_W / 2, ARENA_H - 50);
  ctx.textAlign = 'left';
}

export function drawMarch(ctx: CanvasRenderingContext2D, scene: MarchScene, t: number): void {
  ctx.save();
  switch (scene.view) {
    case 'intro': drawIntro(ctx, scene.state); break;
    case 'play': drawPlay(ctx, scene, t); break;
    case 'result': drawResult(ctx, scene.state); break;
    case 'poster': drawPoster(ctx); break;
  }
  ctx.restore();
}

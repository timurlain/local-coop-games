// Pochod na Tiranu — walking over terrain and the rope (spec 2026-09-27-diktator-pochod-design §6.2, §6.3). Pure.

import { passable, speedAt, type MarchMap } from './map';
import type { Figure, Point } from './state';

/**
 * Moves a figure by (dx, dy), x first, then y. A move into an impassable tile is cancelled on that axis only, so
 * figures slide along walls. Returns the distance actually moved.
 */
export function moveFigure(map: MarchMap, f: Point, dx: number, dy: number): number {
  const x0 = f.x;
  const y0 = f.y;
  if (dx !== 0 && passable(map, f.x + dx, f.y)) f.x += dx;
  if (dy !== 0 && passable(map, f.x, f.y + dy)) f.y += dy;
  return Math.hypot(f.x - x0, f.y - y0);
}

/**
 * Walks a figure for `dt` s along the direction (mx, my) — clamped to length 1 — at `speed` units/s times the terrain
 * factor under its feet. Updates `facing` (last horizontal direction) and `moving`. Returns the distance moved.
 */
export function walk(map: MarchMap, f: Figure, mx: number, my: number, speed: number, dt: number): number {
  const len = Math.hypot(mx, my);
  if (len === 0) {
    f.moving = false;
    return 0;
  }
  const k = (Math.min(1, len) / len) * speed * speedAt(map, f.x, f.y) * dt;
  const moved = moveFigure(map, f, mx * k, my * k);
  if (mx !== 0) f.facing = mx > 0 ? 1 : -1;
  f.moving = moved > 1e-6;
  return moved;
}

/** Walks a figure straight towards (tx, ty), never overshooting. Returns the distance moved. */
export function walkTo(map: MarchMap, f: Figure, tx: number, ty: number, speed: number, dt: number): number {
  const d = Math.hypot(tx - f.x, ty - f.y);
  if (d < 1e-6) {
    f.moving = false;
    return 0;
  }
  const step = speed * speedAt(map, f.x, f.y) * dt;
  const k = Math.min(1, d / Math.max(step, 1e-9));
  return walk(map, f, ((tx - f.x) / d) * k, ((ty - f.y) / d) * k, speed, dt);
}

/**
 * The rope (§6.3): if Zogu and Vlček ended the tick more than `rope` apart, the pair is pulled back to exactly `rope`
 * along the line between them. The hero who moved away takes the correction (split by how far each moved away). If
 * the pull would put a hero into rock or water, the other takes it all; if neither can, both return to where they
 * were before the tick (which was within the rope). So the gap never exceeds `rope`, and sideways moves stay free.
 */
export function applyRope(map: MarchMap, z: Point, v: Point, prevZ: Point, prevV: Point, rope: number): void {
  const dx = v.x - z.x;
  const dy = v.y - z.y;
  const d = Math.hypot(dx, dy);
  if (d <= rope) return;
  const ux = dx / d;
  const uy = dy / d;
  const awayV = Math.max(0, (v.x - prevV.x) * ux + (v.y - prevV.y) * uy);
  const awayZ = Math.max(0, -((z.x - prevZ.x) * ux + (z.y - prevZ.y) * uy));
  const excess = d - rope;
  const tryPull = (shareV: number): boolean => {
    const vx = v.x - ux * excess * shareV;
    const vy = v.y - uy * excess * shareV;
    const zx = z.x + ux * excess * (1 - shareV);
    const zy = z.y + uy * excess * (1 - shareV);
    if (!passable(map, vx, vy) || !passable(map, zx, zy)) return false;
    v.x = vx;
    v.y = vy;
    z.x = zx;
    z.y = zy;
    return true;
  };
  const share = awayV + awayZ > 0 ? awayV / (awayV + awayZ) : 0.5;
  if (tryPull(share) || tryPull(1) || tryPull(0)) return;
  v.x = prevV.x;
  v.y = prevV.y;
  z.x = prevZ.x;
  z.y = prevZ.y;
}

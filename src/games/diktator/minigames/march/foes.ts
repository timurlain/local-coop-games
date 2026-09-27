// Pochod na Tiranu — Noli's gendarmes, the barracks gate guards and Vlček's blow
// (spec 2026-09-27-diktator-pochod-design §6.5, §6.6). Pure; randomness only from `s.rng`.

import { randInt } from '../../../../shared/rng';
import { speedAt, tileCentre } from './map';
import { moveFigure, walkTo } from './move';
import { MARCH } from './rules';
import { cameraOf, dateOf, dist, type Foe, type MarchEvent, type MarchInput, type MarchState } from './state';

/** Gendarmes per patrol by date: 1 on 13–16 Dec, 2 on 17–20 Dec, 3 on 21–24 Dec. */
export function squadSize(date: number): number {
  return date <= 16 ? 1 : date <= 20 ? 2 : 3;
}

/** `n` gate posts on a half ring in front of (south of) a barracks at (x, y), `MARCH.gateRadius` away. */
export function gatePosts(x: number, y: number, n: number): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI * (0.15 + 0.7 * (n === 1 ? 0.5 : k / (n - 1)));
    return [x + Math.cos(a) * MARCH.gateRadius, y + Math.sin(a) * MARCH.gateRadius];
  });
}

function newFoe(s: MarchState, f: Omit<Foe, 'id' | 'facing' | 'moving' | 'hits' | 'stuck'>): Foe {
  return { ...f, id: s.nextFoeId++, facing: -1, moving: false, hits: 0, stuck: 0 };
}

/** Each barracks gets its seeded number of gate guards (Peshkopi 3–4, Kukës 4–5, Burrel 2–3, Krujë 3–4). */
export function createGateGuards(s: MarchState): void {
  s.places.forEach((p, i) => {
    if (p.def.kind !== 'barracks' || !p.def.guards) return;
    const [lo, hi] = p.def.guards;
    const n = lo + randInt(s.rng, hi - lo + 1);
    for (const [x, y] of gatePosts(p.x, p.y, n)) {
      s.foes.push(newFoe(s, {
        kind: 'guard', x, y, mode: 'post', until: 0, route: -1, wp: 0, dir: 1, squad: -1, place: i, homeX: x, homeY: y,
      }));
    }
  });
}

/** Every 8–12 s: a new patrol at a route end 600–1400 units from the camera, if fewer than 6 gendarmes are about. */
function trySpawn(s: MarchState, events: MarchEvent[]): void {
  if (s.now < s.nextSpawnAt) return;
  s.nextSpawnAt = s.now + MARCH.spawnEvery + randInt(s.rng, MARCH.spawnSpread);
  const alive = s.foes.filter((f) => f.kind === 'gendarme').length;
  if (alive >= MARCH.maxAlive) return;
  const cam = cameraOf(s);
  const ends: { route: number; end: number }[] = [];
  s.map.patrols.forEach((route, i) => {
    for (const end of [0, route.length - 1]) {
      const [x, y] = tileCentre(s.map, route[end]);
      const d = Math.hypot(x - cam.x, y - cam.y);
      if (d >= MARCH.spawnMin && d <= MARCH.spawnMax) ends.push({ route: i, end });
    }
  });
  if (ends.length === 0) return;
  const { route, end } = ends[randInt(s.rng, ends.length)];
  const dir: 1 | -1 = end === 0 ? 1 : -1;
  const [x, y] = tileCentre(s.map, s.map.patrols[route][end]);
  const size = Math.min(squadSize(dateOf(s.t)), MARCH.maxAlive - alive);
  const squad = s.nextSquad++;
  for (let k = 0; k < size; k++) {
    // The members walk in a line, 24 units apart: each one sets off a little later.
    s.foes.push(newFoe(s, {
      kind: 'gendarme', x, y, mode: 'wait', until: s.now + (k * MARCH.patrolGap) / MARCH.speed.gendarme,
      route, wp: end + dir, dir, squad, place: -1, homeX: x, homeY: y,
    }));
  }
  events.push({ type: 'spawned', squad, size });
}

/** Walks the patrol route back and forth. */
function patrol(s: MarchState, f: Foe, dt: number): void {
  const route = s.map.patrols[f.route];
  const [tx, ty] = tileCentre(s.map, route[f.wp]);
  walkTo(s.map, f, tx, ty, MARCH.speed.gendarme, dt);
  if (Math.hypot(tx - f.x, ty - f.y) < 1) {
    if (f.wp + f.dir < 0 || f.wp + f.dir >= route.length) f.dir = f.dir === 1 ? -1 : 1;
    f.wp += f.dir;
  }
}

/** The index of the waypoint of the gendarme's route nearest to him. */
function nearestWaypoint(s: MarchState, f: Foe): number {
  const route = s.map.patrols[f.route];
  let best = 0;
  route.forEach((at, i) => {
    const [x, y] = tileCentre(s.map, at);
    const [bx, by] = tileCentre(s.map, route[best]);
    if (Math.hypot(x - f.x, y - f.y) < Math.hypot(bx - f.x, by - f.y)) best = i;
  });
  return best;
}

function giveUp(s: MarchState, f: Foe): void {
  f.mode = 'return';
  f.until = s.now + MARCH.blindAfterGiveUp;
  f.stuck = 0;
  f.wp = nearestWaypoint(s, f);
}

/** Walks towards a target and counts the time the terrain blocks him (moved under a quarter of his stride). */
function pursue(s: MarchState, f: Foe, tx: number, ty: number, dt: number): void {
  const before = Math.hypot(tx - f.x, ty - f.y);
  const stride = MARCH.speed.gendarme * speedAt(s.map, f.x, f.y) * dt;
  const moved = walkTo(s.map, f, tx, ty, MARCH.speed.gendarme, dt);
  f.stuck = moved < 0.25 * Math.min(stride, before) ? f.stuck + dt : 0;
}

/**
 * Zogu is caught (§6.5): 20 gold (never below 0), a whole day, the patrol walks away, Zogu is held 2 s and then
 * immune for 4 s.
 */
function catchZogu(s: MarchState, by: Foe, events: MarchEvent[]): void {
  const z = s.heroes.zogu;
  const ransom = Math.min(s.gold, MARCH.ransom);
  s.gold -= ransom;
  s.t += MARCH.day;
  s.caught += 1;
  z.frozenUntil = s.now + MARCH.frozen;
  z.immuneUntil = s.now + MARCH.frozen + MARCH.immune;
  for (const f of s.foes) {
    if (f.kind === 'gendarme' && f.squad === by.squad && ['wait', 'patrol', 'chase', 'return'].includes(f.mode)) {
      f.mode = 'leaving';
      f.until = s.now + MARCH.leaving;
    }
  }
  events.push({ type: 'caught' });
  if (ransom > 0) events.push({ type: 'coins', amount: -ransom });
}

/** Moves every gendarme and guard one tick, then checks for a catch. */
export function stepFoes(s: MarchState, dt: number, events: MarchEvent[]): void {
  trySpawn(s, events);
  const z = s.heroes.zogu;
  const sight = s.negotiating >= 0 ? MARCH.sightNegotiating : MARCH.sight;
  const gone = new Set<number>();
  for (const f of s.foes) {
    const dz = dist(f, z);
    switch (f.mode) {
      case 'wait':
        if (s.now >= f.until) f.mode = 'patrol';
        break;
      case 'patrol':
        if (dz <= sight) {
          f.mode = 'chase';
          f.stuck = 0;
        } else patrol(s, f, dt);
        break;
      case 'chase':
        if (dz > MARCH.giveUp || f.stuck >= MARCH.stuckGiveUp) giveUp(s, f);
        else pursue(s, f, z.x, z.y, dt);
        break;
      case 'return': {
        if (s.now >= f.until && dz <= sight) {
          f.mode = 'chase';
          f.stuck = 0;
          break;
        }
        const [tx, ty] = tileCentre(s.map, s.map.patrols[f.route][f.wp]);
        pursue(s, f, tx, ty, dt);
        if (Math.hypot(tx - f.x, ty - f.y) < 1) f.mode = 'patrol';
        else if (f.stuck >= MARCH.stuckGiveUp) gone.add(f.id); // wedged against a wall: he goes home, uncounted
        break;
      }
      case 'post':
        if (Math.hypot(f.homeX - f.x, f.homeY - f.y) > 2) walkTo(s.map, f, f.homeX, f.homeY, MARCH.speed.gendarme, dt);
        else f.moving = false;
        break;
      case 'stunned':
        f.moving = false;
        if (s.now >= f.until) {
          if (f.kind === 'guard') f.mode = 'post';
          else giveUp(s, f);
        }
        break;
      case 'down':
        f.moving = false;
        if (s.now >= f.until) {
          f.mode = 'surrender';
          f.until = s.now + MARCH.surrender;
          if (f.kind === 'gendarme') s.captured += 1;
          else s.joined += 1;
          events.push({ type: 'surrendered', kind: f.kind });
        }
        break;
      case 'surrender':
        f.moving = false;
        if (s.now >= f.until) gone.add(f.id);
        break;
      case 'leaving': {
        const d = Math.max(1, dz);
        walkTo(s.map, f, f.x + ((f.x - z.x) / d) * 50, f.y + ((f.y - z.y) / d) * 50, MARCH.speed.gendarme, dt);
        if (s.now >= f.until) gone.add(f.id);
        break;
      }
    }
  }
  if (gone.size > 0) s.foes = s.foes.filter((f) => !gone.has(f.id));
  if (s.now < z.immuneUntil || s.now < z.frozenUntil) return;
  const catcher = s.foes.find(
    (f) => f.kind === 'gendarme' && (f.mode === 'patrol' || f.mode === 'chase') && dist(f, z) <= MARCH.catchRadius,
  );
  if (catcher) catchZogu(s, catcher, events);
}

/** Anyone Vlček can still hit: not knocked down, not surrendering, not waiting to set off, not already leaving. */
export function targetable(f: Foe): boolean {
  return f.mode !== 'down' && f.mode !== 'surrender' && f.mode !== 'wait' && f.mode !== 'leaving';
}

/**
 * Vlček's blow (§6.6): Action starts one if the cooldown is over. It hits the nearest foe within 56 units. The first
 * hit knocks him back 30 units and stuns him; the second puts him down (then he surrenders).
 */
export function strike(s: MarchState, vin: MarchInput, cooldown: number, events: MarchEvent[]): void {
  const v = s.heroes.velitel;
  if (!vin.action || s.now < v.cooldownUntil) return;
  v.cooldownUntil = s.now + cooldown;
  v.actUntil = s.now + MARCH.blowAnim;
  let target: Foe | null = null;
  for (const f of s.foes) {
    if (targetable(f) && dist(f, v) <= MARCH.blowReach && (!target || dist(f, v) < dist(target, v))) target = f;
  }
  events.push({ type: 'swing' });
  if (!target) return;
  v.facing = target.x >= v.x ? 1 : -1;
  target.hits += 1;
  if (target.hits >= 2) {
    target.mode = 'down';
    target.until = s.now + MARCH.down;
    events.push({ type: 'hit', down: true });
    return;
  }
  const d = Math.max(1, dist(target, v));
  moveFigure(s.map, target, ((target.x - v.x) / d) * MARCH.knockback, ((target.y - v.y) / d) * MARCH.knockback);
  target.mode = 'stunned';
  target.until = s.now + MARCH.stunned;
  events.push({ type: 'hit', down: false });
}

// Pochod na Tiranu — places and negotiation (spec 2026-09-27-diktator-pochod-design §4.3, §6.4, §4.5). Pure.

import { pick, randInt, type RngState } from '../../../../shared/rng';
import { tileCentre, type MarchMap } from './map';
import { MARCH } from './rules';
import { dist, type MarchEvent, type MarchInput, type MarchState, type PlaceState } from './state';

/** The places with their seeded variants: each village's ring (4–6 s) and each tower's bribe (30/40/50). */
export function createPlaces(map: MarchMap, rng: RngState): PlaceState[] {
  return map.places.map((def): PlaceState => {
    const [x, y] = tileCentre(map, def.at);
    const [lo, hi] = MARCH.villageRing;
    const ring = def.kind === 'village' ? lo + randInt(rng, hi - lo + 1) : MARCH.ring[def.kind];
    const bribe = def.kind === 'tower' ? pick(rng, MARCH.bribes) : 0;
    return { def, x, y, ring, bribe, progress: 0, won: false, wp: 1, dir: 1 };
  });
}

/** The place Zogu stands in (the nearest within 70 units), or -1. */
export function zoguPlace(s: MarchState): number {
  let best = -1;
  let bestD = Infinity;
  s.places.forEach((p, i) => {
    const d = dist(p, s.heroes.zogu);
    if (d <= MARCH.placeRadius && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** A barracks is locked while any of its gate guards still stands (not yet knocked down). */
export function barracksLocked(s: MarchState, place: number): boolean {
  return s.foes.some((f) => f.kind === 'guard' && f.place === place && (f.mode === 'post' || f.mode === 'stunned'));
}

function coins(s: MarchState, amount: number, events: MarchEvent[]): void {
  s.gold = Math.max(0, s.gold + amount);
  events.push({ type: 'coins', amount });
}

/** Books what a won place gives (§4.3, §4.5). */
function reward(s: MarchState, p: PlaceState, events: MarchEvent[]): void {
  switch (p.def.kind) {
    case 'village': s.villages += 1; break;
    case 'home': s.villages += 1; coins(s, MARCH.homeGold, events); break;
    case 'tower': s.towers += 1; coins(s, -p.bribe, events); break;
    case 'barracks': s.barracks += 1; coins(s, MARCH.barracksGold, events); break;
    case 'volunteers': s.volunteers = true; break;
    case 'stable': s.horses = true; s.horsesUntil = s.t + MARCH.horsesDays * MARCH.day; break;
    case 'messenger': s.messenger = true; break;
  }
}

/**
 * Zogu's Action (§6.4): held inside an unfinished place, it fills the ring (progress is kept when he lets go or
 * walks away). A tower needs its bribe in the purse; a barracks waits until its gate guards are down. Pressed
 * outside a place (or in a won one), it is a wave. Sets `s.negotiating`.
 */
export function stepPlaces(s: MarchState, zin: MarchInput, dt: number, events: MarchEvent[]): void {
  s.negotiating = -1;
  const z = s.heroes.zogu;
  if (s.now < z.frozenUntil) return;
  const i = zoguPlace(s);
  const p = i >= 0 ? s.places[i] : null;
  if (!p || p.won) {
    if (zin.action) z.actUntil = s.now + MARCH.wave;
    return;
  }
  if (!zin.held) return;
  if (p.def.kind === 'barracks' && barracksLocked(s, i)) {
    if (zin.action) events.push({ type: 'refused', place: i, reason: 'locked' });
    return;
  }
  if (p.def.kind === 'tower' && s.gold < p.bribe) {
    if (zin.action) events.push({ type: 'refused', place: i, reason: 'noGold' });
    return;
  }
  s.negotiating = i;
  const before = p.progress;
  p.progress = Math.min(p.ring, p.progress + dt);
  if (p.progress >= p.ring) {
    p.won = true;
    reward(s, p, events);
    events.push({ type: 'won', place: i });
  } else if (Math.floor(p.progress) > Math.floor(before)) {
    events.push({ type: 'tick' });
  }
}

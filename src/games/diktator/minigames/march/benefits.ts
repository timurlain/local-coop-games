// Pochod na Tiranu — the optional benefits (spec 2026-09-27-diktator-pochod-design §4.5): hidden supply caches and
// the Italian messenger walking his road. (The volunteers of Martanesh and the bey's stable at Homesh are places,
// won by negotiating — see places.ts; the horses' speed is in logic.ts.) Pure.

import { HEROES } from '../../logic/palace';
import { tileCentre } from './map';
import { walkTo } from './move';
import { MARCH } from './rules';
import { dist, type MarchEvent, type MarchState, type PlaceState } from './state';

/** Either hero stepping onto a cache takes it: +15 gold. */
function takeCaches(s: MarchState, events: MarchEvent[]): void {
  s.map.caches.forEach((at, i) => {
    if (s.caches[i]) return;
    const [x, y] = tileCentre(s.map, at);
    if (!HEROES.some((h) => dist(s.heroes[h], { x, y }) <= MARCH.cacheRadius)) return;
    s.caches[i] = true;
    s.gold += MARCH.cacheGold;
    events.push({ type: 'cache', index: i });
    events.push({ type: 'coins', amount: MARCH.cacheGold });
  });
}

/** The messenger walks his road back and forth, and waits while Zogu stands with him. */
function walkMessenger(s: MarchState, m: PlaceState, dt: number): void {
  if (dist(m, s.heroes.zogu) <= MARCH.placeRadius) return;
  const road = s.map.messengerRoad;
  const [tx, ty] = tileCentre(s.map, road[m.wp]);
  // A PlaceState has no facing; walk a scratch figure and copy the position back.
  const f = { x: m.x, y: m.y, facing: 1 as 1 | -1, moving: false };
  walkTo(s.map, f, tx, ty, MARCH.messengerSpeed, dt);
  m.x = f.x;
  m.y = f.y;
  if (Math.hypot(tx - m.x, ty - m.y) < 1) {
    if (m.wp + m.dir < 0 || m.wp + m.dir >= road.length) m.dir = m.dir === 1 ? -1 : 1;
    m.wp += m.dir;
  }
}

export function stepBenefits(s: MarchState, dt: number, events: MarchEvent[]): void {
  takeCaches(s, events);
  const m = s.places.find((p) => p.def.kind === 'messenger');
  if (m) walkMessenger(s, m, dt);
}

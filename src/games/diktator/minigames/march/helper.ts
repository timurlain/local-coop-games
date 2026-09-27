// Pochod na Tiranu — the solo helper (spec 2026-09-27-diktator-pochod-design §6.7): in solo play the hero the
// player is not steering follows the active one; helper Vlček intercepts chasing gendarmes and strikes on his own.
// Helper Zogu never negotiates. Pure, so the march stays deterministic.

import { other, type Hero } from '../../logic/palace';
import { targetable } from './foes';
import { MARCH } from './rules';
import { dist, type Foe, type MarchInput, type MarchState, type Point } from './state';

function towards(from: Point, to: Point): { moveX: number; moveY: number } {
  const d = dist(from, to);
  return d < 4 ? { moveX: 0, moveY: 0 } : { moveX: (to.x - from.x) / d, moveY: (to.y - from.y) / d };
}

export function helperInput(s: MarchState, hero: Hero): MarchInput {
  const me = s.heroes[hero];
  const lead = s.heroes[other(hero)];
  const follow = dist(me, lead) > MARCH.followStop ? towards(me, lead) : { moveX: 0, moveY: 0 };
  if (hero === 'zogu') return { ...follow, action: false, held: false };
  const z = s.heroes.zogu;
  let threat: Foe | null = null;
  for (const f of s.foes) {
    if (f.kind === 'gendarme' && f.mode === 'chase' && dist(f, z) <= MARCH.interceptRange && (!threat || dist(f, z) < dist(threat, z))) {
      threat = f;
    }
  }
  const move = threat ? towards(me, threat) : follow;
  const inReach = s.foes.some((f) => targetable(f) && f.mode !== 'leaving' && dist(f, me) <= MARCH.blowReach);
  return { ...move, action: inReach && s.now >= me.cooldownUntil, held: false };
}

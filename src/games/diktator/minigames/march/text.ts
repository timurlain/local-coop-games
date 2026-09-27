// Pochod na Tiranu — the result card's lines: every tally next to what it gives (spec 2026-09-27-diktator-pochod-design
// §2.9, §4.5). Pure; Czech text comes from `cs.diktator.pochod`.

import { cs } from '../../../../shared/i18n/cs';
import type { GroupId } from '../../logic/groups';
import { regimeFromMarch } from '../../logic/march-regime';
import { RULES } from '../../logic/rules';
import type { MarchEvent, MarchResult, MarchState } from './state';

export function marchCardLines(r: MarchResult, names: Readonly<Record<GroupId, string>>, cacheCount: number): string[] {
  const L = cs.diktator.pochod.lines;
  const g = regimeFromMarch(r);
  const pop = (id: GroupId) => g.pop?.[id] ?? RULES.start.pop;
  const str = (id: 'statkari' | 'armada' | 'povstalci' | 'policie') => g.str?.[id] ?? RULES.start.str;
  const when = r.arrivedDay === null ? L.afterChristmas : cs.diktator.pochod.date(r.arrivedDay);
  const lines = [
    L.villages(r.villages, names.rolnici, pop('rolnici')),
    L.towers(r.towers, names.statkari, pop('statkari'), str('statkari')),
    L.barracks(r.barracks, names.armada, pop('armada'), str('armada')),
    L.captured(r.captured, names.povstalci, str('povstalci')),
    L.arrival(when, names.policie, pop('policie'), str('policie')),
    L.gold(r.gold, g.treasury ?? RULES.start.treasury),
  ];
  if (r.caught > 0) lines.push(L.caught(r.caught));
  if (r.caches > 0) lines.push(L.caches(r.caches, cacheCount));
  if (r.volunteers) lines.push(L.volunteers(g.guard ?? RULES.start.guard));
  if (r.messenger) lines.push(L.messenger(names.italie, pop('italie')));
  if (r.horses) lines.push(L.horses);
  return lines;
}

/** The short bubble an event raises over the map (a won place's line, a refusal, a catch, a cache), or null. */
export function marchToast(e: MarchEvent, s: MarchState): string | null {
  const P = cs.diktator.pochod;
  switch (e.type) {
    case 'won': return P.won[s.places[e.place].def.id];
    case 'refused': return e.reason === 'noGold' ? P.noGold : P.locked;
    case 'cache': return P.cache;
    default: return null;
  }
}

// Pochod na Tiranu → the starting regime of the palace game (spec 2026-09-27-diktator-pochod-design §8). Pure.
// The historical march (2 villages, 2 towers, 2 barracks, 8 gendarmes captured, 200 gold, arrival on 24 December,
// no benefits) gives exactly `RULES.start`.

import type { MarchResult } from '../minigames/march/state';
import { RULES } from './rules';
import type { StartingRegime } from './state';

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/** The police [popularity, strength] by the arrival day (null = after Christmas). */
export function policeFromArrival(arrivedDay: number | null): readonly [number, number] {
  const M = RULES.march;
  if (arrivedDay === null) return M.policeAfterChristmas;
  const spare = M.christmasEve - arrivedDay;
  if (spare >= M.earlyFrom) return M.policeEarly;
  if (spare >= M.onTimeFrom) return M.policeOnTime;
  return M.policeLate;
}

export function regimeFromMarch(r: MarchResult): StartingRegime {
  const M = RULES.march;
  const S = RULES.start;
  const pop = (n: number) => Math.min(M.max, M.popBase + n);
  const str = (n: number) => Math.min(M.max, M.strBase + n);
  const [policePop, policeStr] = policeFromArrival(r.arrivedDay);
  return {
    pop: {
      rolnici: pop(r.villages),
      statkari: pop(r.towers),
      armada: pop(r.barracks),
      policie: policePop,
      ...(r.messenger ? { italie: S.pop + M.messengerItaly } : {}),
    },
    str: {
      statkari: str(r.towers),
      armada: str(r.barracks),
      povstalci: clamp(M.rebelsMin, M.rebelsFrom, M.rebelsFrom - Math.floor(r.captured / M.capturedPerRebel)),
      policie: policeStr,
    },
    treasury: clamp(M.treasuryMin, M.treasuryMax, M.treasuryBase + r.gold),
    ...(r.volunteers ? { guard: S.guard + M.volunteersGuard } : {}),
  };
}

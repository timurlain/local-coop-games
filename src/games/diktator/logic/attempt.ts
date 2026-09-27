// The Atentát mini-game's inputs from the rules (spec 2026-09-27-diktator-atentat-design §4). Pure.

import type { FactionId } from './groups';
import { RULES } from './rules';
import type { AttemptDifficulty, GameState, PlaceId } from './state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function attemptDifficulty(s: GameState, faction: FactionId): AttemptDifficulty {
  const A = RULES.attempt;
  const guarded = s.palace?.guarded ?? false;
  const seconds = clamp(
    A.baseSeconds + (guarded ? A.guardedBonus : 0) - A.strengthStep * Math.max(0, s.str[faction] - A.strongFrom),
    A.minSeconds,
    A.maxSeconds,
  );
  const hostile = s.pop.policie <= s.low;
  const clues = hostile ? 0 : 1 + (s.pop.policie >= A.loyalPolice ? 1 : 0) + (s.str.policie >= A.loyalPolice ? 1 : 0);
  const crowd = Math.min(A.maxCrowd, A.baseCrowd + s.str[faction]);
  return { seconds, clues, crowd, maxWrong: A.maxWrong };
}

export function attemptPlace(faction: FactionId): PlaceId {
  return faction === 'armada' ? 'dustojnici' : 'trziste';
}

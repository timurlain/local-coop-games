import { describe, expect, it } from 'vitest';
import { attemptDifficulty, attemptPlace } from '../../src/games/diktator/logic/attempt';
import { survivesUnfound } from '../../src/games/diktator/logic/assassination';
import { advance, validCommands } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { palaceDay, scriptedDice } from './helpers';

function allPlotting(s: GameState): GameState {
  s.plots = { armada: { kind: 'assassination' }, rolnici: { kind: 'assassination' }, statkari: { kind: 'assassination' } };
  return s;
}

/** Both heroes end the quarter with every faction plotting an assassination → the evening meets an attempt. */
function nightOfAttempt(): { before: GameState; after: GameState } {
  let s = allPlotting(palaceDay());
  s = advance(albania, s, { type: 'endDay', hero: 'velitel' }).state;
  const before = allPlotting(s);
  const after = advance(albania, before, { type: 'endDay', hero: 'zogu' }).state;
  return { before, after };
}

describe('attempt difficulty', () => {
  it('gives more time when Vlček guards and less against a strong faction, within 25–60 s', () => {
    const s = palaceDay();
    s.str.armada = 5;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(40);
    s.palace!.guarded = true;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(55);
    s.palace!.guarded = false;
    s.str.armada = 9;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(32);
    s.str.armada = 30;
    expect(attemptDifficulty(s, 'armada').seconds).toBe(25);
  });

  it('gives no clue when the police are hostile, up to three when they are loyal and strong', () => {
    const s = palaceDay();
    s.low = 3;
    s.pop.policie = 3;
    expect(attemptDifficulty(s, 'armada').clues).toBe(0);
    s.pop.policie = 5; s.str.policie = 5;
    expect(attemptDifficulty(s, 'armada').clues).toBe(1);
    s.pop.policie = 8; s.str.policie = 8;
    expect(attemptDifficulty(s, 'armada').clues).toBe(3);
  });

  it('grows the crowd with the plotters, at most 20; three wrong accusations', () => {
    const s = palaceDay();
    s.str.rolnici = 4;
    expect(attemptDifficulty(s, 'rolnici').crowd).toBe(14);
    s.str.rolnici = 15;
    expect(attemptDifficulty(s, 'rolnici').crowd).toBe(20);
    expect(attemptDifficulty(s, 'rolnici').maxWrong).toBe(3);
  });

  it('places the army in the officers’ mess, everyone else at the market', () => {
    expect(attemptPlace('armada')).toBe('dustojnici');
    expect(attemptPlace('rolnici')).toBe('trziste');
    expect(attemptPlace('statkari')).toBe('trziste');
  });
});

describe('the unfound gunman — the original odds', () => {
  it('is fatal when all three factions plot', () => {
    expect(survivesUnfound(allPlotting(palaceDay()), scriptedDice([]))).toBe(false);
  });
  it('is survived when the police are friendly or strong, without a coin', () => {
    const s = palaceDay();
    s.plots.armada = { kind: 'assassination' };
    s.low = 3; s.pop.policie = 5; s.str.policie = 2;
    expect(survivesUnfound(s, scriptedDice([]))).toBe(true);
  });
  it('otherwise tosses the coin, four-sided when Vlček guarded', () => {
    const s = palaceDay();
    s.plots.armada = { kind: 'assassination' };
    s.low = 5; s.pop.policie = 2; s.str.policie = 2;
    expect(survivesUnfound(s, scriptedDice([0]))).toBe(false);
    expect(survivesUnfound(s, scriptedDice([1]))).toBe(true);
    s.palace!.guarded = true;
    expect(survivesUnfound(s, scriptedDice([3]))).toBe(true);
  });
});

describe('the evening pauses for an attempt (palace mode)', () => {
  it('stops in the attempt phase with a place, a difficulty and a seed', () => {
    const { after } = nightOfAttempt();
    expect(after.phase.kind).toBe('attempt');
    if (after.phase.kind !== 'attempt') return;
    expect(['trziste', 'dustojnici']).toContain(after.phase.place);
    expect(after.phase.difficulty.maxWrong).toBe(3);
    expect(Number.isInteger(after.phase.seed)).toBe(true);
    expect(validCommands(albania, after)).toEqual([
      { type: 'attemptResult', found: true },
      { type: 'attemptResult', found: false },
    ]);
  });

  it('a found gunman saves Zogu, breaks that faction’s plot and lets the evening go on', () => {
    const { after } = nightOfAttempt();
    if (after.phase.kind !== 'attempt') throw new Error('no attempt');
    const faction = after.phase.faction;
    const r = advance(albania, after, { type: 'attemptResult', found: true });
    expect(r.events[0]).toEqual({ type: 'assassination', faction, survived: true, foiled: true });
    expect(r.state.phase.kind).not.toBe('attempt');
    expect(r.state.phase.kind === 'ended' && r.state.phase.ending.kind === 'killed' && r.state.phase.ending.cause === 'assassination').toBe(false);
  });

  it('a missed gunman with all three plotting ends the reign', () => {
    const { after } = nightOfAttempt();
    const r = advance(albania, after, { type: 'attemptResult', found: false });
    expect(r.state.phase).toEqual({ kind: 'ended', ending: { kind: 'killed', cause: 'assassination' } });
  });

  it('refuses attemptResult outside the attempt phase', () => {
    expect(() => advance(albania, palaceDay(), { type: 'attemptResult', found: true })).toThrow();
  });
});

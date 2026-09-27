import { describe, expect, it } from 'vitest';
import { deserialize, newSave, recordTurn, retryFromYear, serialize } from '../../src/games/diktator/logic/save';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';

function playQuarters(n: number): GameState[] {
  let { state } = newGame(albania, 3);
  const starts = [state];
  while (starts.length < n) {
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    state = advance(albania, state, { type: 'endDay' }).state;
    if (state.phase.kind !== 'audience') break;
    starts.push(state);
  }
  return starts;
}

describe('save file', () => {
  it('round-trips through JSON', () => {
    const { state } = newGame(albania, 1);
    const f = newSave('albania', state);
    expect(deserialize(serialize(f))).toEqual(f);
  });

  it('rejects garbage and other versions', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 99 }))).toBeNull();
    // version 3 (pre-tariffs, no `accepted`) is now a foreign version too (our addition, play-test change).
    expect(deserialize(JSON.stringify({ version: 3 }))).toBeNull();
  });

  it('keeps a checkpoint at the start of each year (Q1 audience)', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    expect(f.checkpoints.map((c) => c.quarter)).toEqual(starts.filter((s) => s.quarter % 4 === 1).map((s) => s.quarter));
    expect(f.current.quarter).toBe(starts[starts.length - 1].quarter);
  });

  it('retry goes back to the latest yearly checkpoint and counts the retry', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    const r = retryFromYear(f)!;
    expect(r.state.quarter % 4).toBe(1);
    expect(r.file.retries).toBe(1);
    expect(r.file.current).toEqual(r.state);
  });

  it('reseeds each retry so successive retries diverge', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    const first = retryFromYear(f)!;
    const second = retryFromYear(first.file)!;
    expect(second.state.rng.s).not.toBe(first.state.rng.s);
    expect(second.state.seed).toBe(first.state.seed);
  });

  it('retrying the same file object twice replays identically', () => {
    const starts = playQuarters(6);
    let f = newSave('albania', starts[0]);
    for (const s of starts.slice(1)) f = recordTurn(f, s);
    const a = retryFromYear(f)!;
    const b = retryFromYear(f)!;
    expect(a.state).toEqual(b.state);
  });

  it('does not treat a suggested Q1 audience as a new year start', () => {
    let base: GameState | undefined;
    let suggested: GameState | undefined;
    for (let seed = 1; seed <= 30 && !suggested; seed++) {
      const s = newGame(albania, seed).state;
      try {
        suggested = advance(albania, s, { type: 'answer', answer: 'suggestOther' }).state;
        base = s;
      } catch {
        // this seed's Q1 petition has no sibling from the same petitioner to suggest instead
      }
    }
    if (!base || !suggested) throw new Error('no seed in range produced a suggestOther-eligible Q1 petition');
    expect(base.quarter % 4).toBe(1);
    const f0 = newSave('albania', base);
    const f1 = recordTurn(f0, suggested);
    expect(f1.checkpoints).toEqual(f0.checkpoints);
  });

  it('keeps the quarter\'s FIRST state as the checkpoint, even across several audience-phase commands', () => {
    const { state: first } = newGame(albania, 7, undefined, { palace: true });
    let f = newSave('albania', first);
    const afterReport = advance(albania, f.current, { type: 'policeReport', hero: 'velitel' }).state;
    f = recordTurn(f, afterReport);
    const afterEndDay = advance(albania, afterReport, { type: 'endDay', hero: 'velitel' }).state;
    f = recordTurn(f, afterEndDay);
    expect(f.checkpoints.filter((c) => c.quarter === 1)).toHaveLength(1);
    expect(f.checkpoints.find((c) => c.quarter === 1)).toEqual(first);
    expect(first.palace!.hours.velitel).toBe(3);
    expect(first.palace!.done.velitel).toBe(false);
  });
});

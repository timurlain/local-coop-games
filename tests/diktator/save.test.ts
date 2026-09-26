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
});

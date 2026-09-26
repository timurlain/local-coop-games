import { describe, expect, it } from 'vitest';
import { advance, newGame, quarterLabel, validCommands } from '../../src/games/diktator/logic/turn';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { makeRng, randInt } from '../../src/shared/rng';

describe('quarterLabel', () => {
  it('maps turns to years and quarters', () => {
    expect(quarterLabel(1)).toEqual({ year: 1925, q: 1 });
    expect(quarterLabel(15)).toEqual({ year: 1928, q: 3 });
    expect(quarterLabel(57)).toEqual({ year: 1939, q: 1 });
  });
});

describe('newGame', () => {
  it('starts in the first quarter with an audience after paying costs', () => {
    const { state, events } = newGame(albania, 123);
    expect(state.quarter).toBe(1);
    expect(state.phase.kind).toBe('audience');
    expect(state.treasury).toBe(940);
    expect(events[0]).toEqual({ type: 'quarterStarted', quarter: 1 });
    expect(state.low).toBeGreaterThanOrEqual(2);
    expect(state.low).toBeLessThanOrEqual(4);
    expect(state.threshold).toBeGreaterThanOrEqual(10);
    expect(state.threshold).toBeLessThanOrEqual(12);
  });
});

describe('advance', () => {
  it('does not mutate its input', () => {
    const { state } = newGame(albania, 5);
    const before = JSON.stringify(state);
    advance(albania, state, { type: 'answer', answer: 'no' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('audience → day → next quarter', () => {
    let { state } = newGame(albania, 9);
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    expect(state.phase.kind).toBe('day');
    state = advance(albania, state, { type: 'endDay' }).state;
    expect(state.quarter).toBe(2);
    expect(state.phase.kind).toBe('audience');
    expect(state.decisionTaken).toBe(false);
  });

  it('rejects commands that are not valid in the phase', () => {
    const { state } = newGame(albania, 9);
    expect(() => advance(albania, state, { type: 'endDay' })).toThrow();
    expect(() => advance(albania, state, { type: 'fight' })).toThrow();
  });

  it('suggestOther works once per audience', () => {
    let { state } = newGame(albania, 11);
    state = advance(albania, state, { type: 'answer', answer: 'suggestOther' }).state;
    expect(state.phase).toMatchObject({ kind: 'audience', suggested: true });
    expect(() => advance(albania, state, { type: 'answer', answer: 'suggestOther' })).toThrow();
  });

  it('a decision is taken once per day', () => {
    let { state } = newGame(albania, 12);
    state = advance(albania, state, { type: 'answer', answer: 'no' }).state;
    state = advance(albania, state, { type: 'decide', decision: 'd35' }).state;
    expect(state.decisionTaken).toBe(true);
    expect(() => advance(albania, state, { type: 'decide', decision: 'd35' })).toThrow();
  });

  it('is deterministic: same seed and commands give the same state', () => {
    const run = () => {
      let { state } = newGame(albania, 77);
      for (let i = 0; i < 10 && state.phase.kind !== 'ended'; i++) {
        state = advance(albania, state, validCommands(albania, state)[0]).state;
      }
      return JSON.stringify(state);
    };
    expect(run()).toBe(run());
  });
});

/** Plays random valid commands until the game ends. */
function playRandom(seed: number): GameState {
  const pickRng = makeRng(seed ^ 0x5bd1e995);
  let { state } = newGame(albania, seed);
  for (let step = 0; step < 5000; step++) {
    if (state.phase.kind === 'ended') return state;
    const options: Command[] = validCommands(albania, state);
    state = advance(albania, state, options[randInt(pickRng, options.length)]).state;
  }
  throw new Error(`seed ${seed} did not end`);
}

describe('bot playthrough', () => {
  it('50 random games always end properly within the 57 quarters', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = playRandom(seed);
      expect(s.phase.kind).toBe('ended');
      expect(s.quarter).toBeGreaterThanOrEqual(1);
      expect(s.quarter).toBeLessThanOrEqual(57);
      for (const v of Object.values(s.pop)) expect(v >= 0 && v <= 9).toBe(true);
      for (const v of Object.values(s.str)) expect(v >= 0 && v <= 9).toBe(true);
    }
  });
});

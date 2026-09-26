import { describe, expect, it } from 'vitest';
import { advance, newGame, quarterLabel, validCommands } from '../../src/games/diktator/logic/turn';
import type { Command, GameEvent, GameState } from '../../src/games/diktator/logic/state';
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

describe('revolution phase', () => {
  it('flee always ends the game, escaped or killed', () => {
    const s: GameState = structuredClone(newGame(albania, 1).state);
    s.phase = { kind: 'revolution', faction: 'armada' };
    const { state, events } = advance(albania, s, { type: 'flee' });
    expect(state.phase.kind).toBe('ended');
    if (state.phase.kind === 'ended') expect(['escaped', 'killed']).toContain(state.phase.ending.kind);
    expect(events.some((e) => e.type === 'ended')).toBe(true);
  });

  it('fight with an eligible ally reaches chooseAlly; a hostile pick jokes and ends, a winning friendly pick punishes and advances the quarter', () => {
    // Hostile ally: joking, ends the game regardless of the dice.
    {
      const s: GameState = structuredClone(newGame(albania, 1).state);
      s.low = 2;
      s.pop.jugoslavie = 1; // hostile: pop <= low
      s.plots.armada = { kind: 'revolution', ally: 'rolnici' };
      s.phase = { kind: 'revolution', faction: 'armada' };
      const fight = advance(albania, s, { type: 'fight' });
      expect(fight.state.phase.kind).toBe('chooseAlly');
      const picked = advance(albania, fight.state, { type: 'ally', group: 'jugoslavie' });
      expect(picked.events.some((e) => e.type === 'joking')).toBe(true);
      expect(picked.state.phase.kind).toBe('ended');
    }
    // Friendly ally, engineered so the ruler's side always wins: punish then next quarter's audience.
    {
      const s: GameState = structuredClone(newGame(albania, 1).state);
      s.quarter = 5;
      s.low = 2;
      s.pop.policie = 9; // friendly: eligible ally
      s.str.armada = 0; // rebel faction strength
      s.str.rolnici = 0; // the rebels' own ally strength (plot.ally)
      s.guard = 9;
      s.str.policie = 9; // chosen ally strength
      s.plots.armada = { kind: 'revolution', ally: 'rolnici' };
      s.phase = { kind: 'revolution', faction: 'armada' };
      const fight = advance(albania, s, { type: 'fight' });
      expect(fight.state.phase.kind).toBe('chooseAlly');
      const chosen = advance(albania, fight.state, { type: 'ally', group: 'policie' });
      expect(chosen.state.phase).toEqual({ kind: 'punish', faction: 'armada', chosen: 'policie' });
      const punished = advance(albania, chosen.state, { type: 'punish', punish: true });
      expect(punished.state.phase.kind).toBe('audience');
      expect(punished.state.quarter).toBe(6);
    }
  });
});

describe('punish at the last quarter', () => {
  it('ends the game as survived', () => {
    const s: GameState = structuredClone(newGame(albania, 1).state);
    s.quarter = 57;
    s.plots.armada = { kind: 'none' };
    s.phase = { kind: 'punish', faction: 'armada', chosen: null };
    const { state } = advance(albania, s, { type: 'punish', punish: false });
    expect(state.phase).toEqual({ kind: 'ended', ending: { kind: 'survived' } });
  });
});

describe('evening event order', () => {
  function buildEveningState(seed: number): GameState {
    const s: GameState = structuredClone(newGame(albania, seed).state);
    s.quarter = 10;
    s.phase = { kind: 'day' };
    s.low = 2;
    s.pop.armada = 7;
    s.pop.rolnici = 7;
    s.pop.statkari = 7;
    s.pop.jugoslavie = 1; // hostile: war triggers
    s.pop.policie = 9; // friendly and strong: survives any assassination attempt
    s.str.jugoslavie = 2; // >= low: war triggers
    s.str.policie = 9;
    s.guard = 9; // home side always outnumbers the small guaranteed enemy strength
    s.plots = { armada: { kind: 'none' }, rolnici: { kind: 'none' }, statkari: { kind: 'assassination' } };
    return s;
  }

  it('emits assassination, then war, then optional news, then revolution/quarterStarted, in that order', () => {
    let events: readonly GameEvent[] | null = null;
    for (let seed = 1; seed <= 60 && !events; seed++) {
      const result = advance(albania, buildEveningState(seed), { type: 'endDay' });
      if (result.events[0]?.type === 'assassination' && result.events[0].survived) events = result.events;
    }
    if (!events) throw new Error('no seed in range picked the plotting faction for the assassination attempt');
    const idxAssassination = events.findIndex((e) => e.type === 'assassination');
    const idxWar = events.findIndex((e) => e.type === 'warThreat' || e.type === 'invasion');
    const idxNews = events.findIndex((e) => e.type === 'news');
    const idxNext = events.findIndex((e) => e.type === 'revolution' || e.type === 'quarterStarted');
    expect(idxWar).toBeGreaterThan(idxAssassination);
    if (idxNews >= 0) expect(idxNews).toBeGreaterThan(idxWar);
    expect(idxNext).toBeGreaterThan(idxNews >= 0 ? idxNews : idxWar);
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
      if (s.phase.kind === 'ended') {
        const kind = s.phase.ending.kind;
        expect(['killed', 'escaped', 'survived']).toContain(kind);
        if (kind === 'survived') expect(s.quarter).toBe(57);
      }
    }
  });
});

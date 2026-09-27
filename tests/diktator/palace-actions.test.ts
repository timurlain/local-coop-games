import { describe, expect, it } from 'vitest';
import { deserialize, newSave, serialize } from '../../src/games/diktator/logic/save';
import { advance, newGame, validCommands } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
import { palaceCommands } from '../../src/games/diktator/logic/palace-actions';
import { formPlots } from '../../src/games/diktator/logic/plot';
import { palaceAudience, palaceDay } from './helpers';

describe('palace mode', () => {
  it('newGame with palace starts a palace day; classic mode has none', () => {
    const palace = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palace.palace?.at).toEqual({ zogu: 'pracovna', velitel: 'straznice' });
    expect(palace.phase.kind).toBe('audience');
    expect(newGame(albania, 4).state.palace).toBeNull();
  });

  it('refuses palace mode for a scenario without a palace', () => {
    const noPalace = { ...albania, palace: undefined };
    expect(() => newGame(noPalace, 4, undefined, { palace: true })).toThrow();
  });

  it('saves and loads the palace state', () => {
    const { state } = newGame(albania, 4, undefined, { palace: true });
    const f = newSave('albania', state);
    expect(deserialize(serialize(f))).toEqual(f);
  });

  it('rejects version-1 saves', () => {
    const { state } = newGame(albania, 4);
    const old = { ...newSave('albania', state), version: 1 };
    expect(deserialize(JSON.stringify(old))).toBeNull();
  });
});

function play(s: GameState, ...cmds: Command[]): GameState {
  for (const c of cmds) s = advance(albania, s, c).state;
  return s;
}

/** A palace game past its first audience, in the day phase. */
function day(seed = 4): GameState {
  return palaceDay(seed);
}

describe('audience in the palace', () => {
  it('opens with Zogu in his study, free to move; the commander too', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(s.palace!.at).toEqual({ zogu: 'pracovna', velitel: 'straznice' });
    expect(s.phase.kind).toBe('audience');
    const r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    expect(r.state.palace!.at.zogu).toBe('matka');
  });

  it('answering needs Zogu in the throne room', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'answer', answer: 'no' })).toThrow();
    expect(validCommands(albania, s).some((c) => c.type === 'answer')).toBe(false);
    const there = palaceAudience();
    expect(validCommands(albania, there).some((c) => c.type === 'answer')).toBe(true);
    expect(advance(albania, there, { type: 'answer', answer: 'no' }).state.phase.kind).toBe('day');
  });

  it("Mother's advice about the petition is asked in her room and costs Zogu an hour", () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'advice' })).toThrow();
    const atMother = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' }).state;
    const r = advance(albania, atMother, { type: 'advice' });
    expect(r.state.phase.kind).toBe('audience');
    expect(r.state.palace!.hours.zogu).toBe(2);
    expect(r.events).toEqual([{ type: 'advised', subject: 'petition', id: (s.phase as { petition: string }).petition }]);
  });

  it('Zogu cannot end his quarter while the petitioner waits; the commander can', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'endDay', hero: 'zogu' })).toThrow();
    expect(palaceCommands(albania, s, 'zogu').some((c) => c.type === 'endDay')).toBe(false);
    const r = advance(albania, s, { type: 'endDay', hero: 'velitel' });
    expect(r.state.palace!.done.velitel).toBe(true);
    expect(r.state.phase.kind).toBe('audience');
  });

  it('a decision may be sealed before the audience', () => {
    let s = newGame(albania, 4, undefined, { palace: true }).state;
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    const d = palaceCommands(albania, s, 'zogu').find((c) => c.type === 'decide');
    expect(d).toBeDefined();
    const r = advance(albania, s, d!);
    expect(r.state.decisionTaken || r.events.some((e) => e.type === 'decisionUnaffordable')).toBe(true);
    expect(r.state.phase.kind).toBe('audience');
  });
});

describe('moving', () => {
  it('refuses a wall', () => {
    expect(() => advance(albania, day(), { type: 'move', hero: 'zogu', dir: 'up' })).toThrow();
  });
});

describe('steps cost hours', () => {
  it('10 back-and-forth moves cost exactly one hour and reset steps to 0; 9 moves cost none', () => {
    let s = day();
    s.palace!.at.zogu = 'nadvori'; // both a left and a right door
    s.palace!.steps.zogu = 0; // isolate from the step the walk into the throne room already spent
    const hoursBefore = s.palace!.hours.zogu;
    for (let i = 0; i < 9; i++) s = play(s, { type: 'move', hero: 'zogu', dir: i % 2 === 0 ? 'right' : 'left' });
    expect(s.palace!.hours.zogu).toBe(hoursBefore);
    expect(s.palace!.steps.zogu).toBe(9);
    s = play(s, { type: 'move', hero: 'zogu', dir: 9 % 2 === 0 ? 'right' : 'left' });
    expect(s.palace!.hours.zogu).toBe(hoursBefore - 1);
    expect(s.palace!.steps.zogu).toBe(0);
  });

  it('a hero with no hours left cannot move, and palaceCommands lists no move for him', () => {
    let s = day();
    // walking back and forth drains his hours (a second/third police report is free once read this quarter, so it
    // no longer drains hours — play-test round 6a)
    for (let i = 0; i < 30 && s.palace!.hours.velitel > 0 && !s.palace!.done.velitel; i++) {
      s = play(s, { type: 'move', hero: 'velitel', dir: i % 2 === 0 ? 'up' : 'down' });
    }
    expect(s.palace!.hours.velitel).toBe(0);
    expect(() => advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' })).toThrow();
    expect(palaceCommands(albania, s, 'velitel').some((c) => c.type === 'move')).toBe(false);
  });

  it('summons Zogu to the throne room once his hours run out, away from it', () => {
    let s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(s.palace!.at.zogu).toBe('pracovna');
    let r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    for (let i = 1; i < 30; i++) {
      r = advance(albania, r.state, { type: 'move', hero: 'zogu', dir: i % 2 === 0 ? 'left' : 'right' });
    }
    expect(r.state.palace!.hours.zogu).toBe(0);
    expect(r.state.palace!.at.zogu).toBe('trunni');
    expect(r.events.slice(-2)).toEqual([
      { type: 'moved', hero: 'zogu', from: 'pracovna', to: 'trunni' },
      { type: 'summoned' },
    ]);
    expect(validCommands(albania, r.state).some((c) => c.type === 'answer')).toBe(true);
  });

  it('does not summon outside the audience: Zogu with no hours simply stays where he is', () => {
    let s = day();
    expect(s.palace!.at.zogu).toBe('trunni');
    let sawSummons = false;
    for (let i = 0; i < 30 && s.palace!.hours.zogu > 0; i++) {
      const r = advance(albania, s, { type: 'move', hero: 'zogu', dir: i % 2 === 0 ? 'down' : 'up' });
      if (r.events.some((e) => e.type === 'summoned')) sawSummons = true;
      s = r.state;
    }
    expect(s.palace!.hours.zogu).toBe(0);
    expect(sawSummons).toBe(false);
  });
});

describe('the guard follows the king', () => {
  it('after guard, the commander follows every room change Zogu makes, at no cost to himself', () => {
    let s = day();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' });
    expect(s.palace!.at.velitel).toBe(s.palace!.at.zogu);
    s = play(s, { type: 'guard' });
    expect(s.palace!.guarded).toBe(true);
    const stepsBefore = s.palace!.steps.velitel; // walking to Zogu's side already spent some of his own steps

    const r1 = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    expect(r1.events.filter((e) => e.type === 'moved')).toHaveLength(2);
    expect(r1.state.palace!.at.velitel).toBe(r1.state.palace!.at.zogu);
    expect(r1.state.palace!.steps.velitel).toBe(stepsBefore); // following costs him nothing

    const r2 = advance(albania, r1.state, { type: 'move', hero: 'zogu', dir: 'right' });
    expect(r2.events.filter((e) => e.type === 'moved')).toHaveLength(2);
    expect(r2.state.palace!.at.velitel).toBe(r2.state.palace!.at.zogu);
    expect(r2.state.palace!.steps.velitel).toBe(stepsBefore);
  });
});

describe('the seal', () => {
  it('is taken in the study and given only in the same room', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'takeSeal', hero: 'zogu' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'takeSeal', hero: 'zogu' });
    expect(s.palace!.seal).toBe('zogu');
    expect(() => advance(albania, s, { type: 'giveSeal', hero: 'zogu' })).toThrow();
    // commander: guardroom → envoys' salon → throne room → study
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'left' });
    expect(s.palace!.at.velitel).toBe('pracovna');
    const r = advance(albania, s, { type: 'giveSeal', hero: 'zogu' });
    expect(r.state.palace!.seal).toBe('velitel');
    expect(r.events).toEqual([{ type: 'seal', holder: 'velitel' }]);
  });

  it('a decision needs the seal and the right room, and costs no hour', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'decide', decision: 'd35', hero: 'velitel' })).toThrow();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    expect(() => advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'right' }, { type: 'move', hero: 'zogu', dir: 'down' });
    expect(s.palace!.at.zogu).toBe('straznice');
    const r = advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' });
    expect(r.state.guard).toBe(6);
    expect(r.state.palace!.hours.zogu).toBe(3);
    expect(r.state.decisionTaken).toBe(true);
  });

  it('a hero who ended the day cannot take, give, or use the seal', () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    expect(s.palace!.at.zogu).toBe('straznice');
    s = play(s, { type: 'endDay', hero: 'zogu' });
    expect(() => advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' })).toThrow();
    expect(() => advance(albania, s, { type: 'giveSeal', hero: 'zogu' })).toThrow();

    let t = day();
    t = play(
      t,
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'left' },
    );
    expect(t.palace!.at.velitel).toBe('pracovna');
    t = play(t, { type: 'endDay', hero: 'velitel' });
    expect(() => advance(albania, t, { type: 'takeSeal', hero: 'velitel' })).toThrow();
  });

  it('cannot be given to a hero who has ended the day', () => {
    let s = day();
    // velitel walks to the study, ends his day there and goes to bed
    s = play(
      s,
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'left' },
      { type: 'endDay', hero: 'velitel' },
    );
    expect(s.palace!.at.velitel).toBe('loznice');
    expect(s.palace!.done.velitel).toBe(true);
    // Zogu walks to the study too and takes the seal
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'takeSeal', hero: 'zogu' });
    expect(s.palace!.seal).toBe('zogu');
    expect(s.palace!.at.zogu).toBe('pracovna');
    expect(palaceCommands(albania, s, 'zogu')).not.toContainEqual({ type: 'giveSeal', hero: 'zogu' });
    expect(() => advance(albania, s, { type: 'giveSeal', hero: 'zogu' })).toThrow();
  });

  it("endDay drops a held seal back to the study, and sends the hero to bed", () => {
    let s = day();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'takeSeal', hero: 'zogu' });
    expect(s.palace!.seal).toBe('zogu');
    const r = advance(albania, s, { type: 'endDay', hero: 'zogu' });
    expect(r.state.palace!.seal).toBeNull();
    expect(r.state.palace!.at.zogu).toBe('loznice');
    expect(r.events).toEqual([
      { type: 'moved', hero: 'zogu', from: 'pracovna', to: 'loznice' },
      { type: 'seal', holder: null },
      { type: 'heroDone', hero: 'zogu' },
    ]);
  });

  it("endDay sends the hero straight to bed even without a seal", () => {
    let s = day();
    expect(s.palace!.at.velitel).toBe('straznice');
    const r = advance(albania, s, { type: 'endDay', hero: 'velitel' });
    expect(r.state.palace!.at.velitel).toBe('loznice');
    expect(r.events).toEqual([
      { type: 'moved', hero: 'velitel', from: 'straznice', to: 'loznice' },
      { type: 'heroDone', hero: 'velitel' },
    ]);
  });

  it("a guarding commander follows Zogu to bed when Zogu ends his quarter (both are then done, so the evening starts)", () => {
    let s = day();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'guard' });
    expect(s.palace!.guarded).toBe(true);
    expect(s.palace!.at.velitel).toBe(s.palace!.at.zogu);
    const r = advance(albania, s, { type: 'endDay', hero: 'zogu' });
    const moved = r.events.filter((e) => e.type === 'moved' && e.to === 'loznice');
    expect(moved).toEqual([
      { type: 'moved', hero: 'zogu', from: 'trunni', to: 'loznice' },
      { type: 'moved', hero: 'velitel', from: 'trunni', to: 'loznice' },
    ]);
    // both heroes are now done, so the evening runs and the palace resets for the next quarter
    expect(['audience', 'revolution', 'ended']).toContain(r.state.phase.kind);
  });

  it("guard drops a held seal back to the study", () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'left' },
      { type: 'takeSeal', hero: 'velitel' },
    );
    expect(s.palace!.seal).toBe('velitel');
    s = play(s, { type: 'move', hero: 'velitel', dir: 'right' });
    expect(s.palace!.at.velitel).toBe('trunni');
    expect(s.palace!.at.zogu).toBe('trunni');
    const r = advance(albania, s, { type: 'guard' });
    expect(r.state.palace!.guarded).toBe(true);
    expect(r.state.palace!.seal).toBeNull();
    expect(r.events).toEqual([{ type: 'guarding' }, { type: 'seal', holder: null }, { type: 'heroDone', hero: 'velitel' }]);
  });
});

describe('bedtime (play-test round 6a: a hero out of hours goes to bed)', () => {
  it('a hero who spends his last hour walking is sent to bed, done, with a toBed event', () => {
    let s = day();
    s.palace!.hours.velitel = 1;
    s.palace!.steps.velitel = 9; // one more step spends the last hour
    const r = advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' });
    expect(r.state.palace!.hours.velitel).toBe(0);
    expect(r.state.palace!.at.velitel).toBe('loznice');
    expect(r.state.palace!.done.velitel).toBe(true);
    expect(r.events.some((e) => e.type === 'toBed' && e.hero === 'velitel')).toBe(true);
    expect(r.events.some((e) => e.type === 'heroDone' && e.hero === 'velitel')).toBe(true);
  });

  it('Zogu out of hours during the audience is summoned, not sent to bed, and goes to bed right after answering', () => {
    let s = newGame(albania, 4, undefined, { palace: true }).state;
    let r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    for (let i = 1; i < 30 && r.state.palace!.hours.zogu > 0; i++) {
      r = advance(albania, r.state, { type: 'move', hero: 'zogu', dir: i % 2 === 0 ? 'left' : 'right' });
    }
    expect(r.state.palace!.hours.zogu).toBe(0);
    expect(r.state.palace!.at.zogu).toBe('trunni');
    expect(r.state.palace!.done.zogu).toBe(false);
    expect(r.events.some((e) => e.type === 'toBed')).toBe(false);
    const answered = advance(albania, r.state, { type: 'answer', answer: 'no' });
    expect(answered.state.palace!.at.zogu).toBe('loznice');
    expect(answered.state.palace!.done.zogu).toBe(true);
    expect(answered.events.some((e) => e.type === 'toBed' && e.hero === 'zogu')).toBe(true);
  });

  it('the evening runs once the last hour sends both heroes to bed', () => {
    let s = day();
    s.palace!.hours.zogu = 0; // not yet done — the next palace command should send him to bed too
    s.palace!.hours.velitel = 1;
    s.palace!.steps.velitel = 9; // one more step spends his last hour too
    const r = advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' });
    expect(r.events.filter((e) => e.type === 'toBed').map((e) => (e as { hero: string }).hero).sort()).toEqual(['velitel', 'zogu']);
    expect(r.events.filter((e) => e.type === 'heroDone')).toHaveLength(2);
    // the evening runs once both are in bed, resetting the palace for the next quarter (or ending the game)
    expect(['audience', 'revolution', 'ended']).toContain(r.state.phase.kind);
    if (r.state.phase.kind === 'audience') expect(r.state.quarter).toBe(2);
  });
});

describe("Zogu's actions", () => {
  it('talking to the army says how it feels, then names the decision it would welcome most', () => {
    const s = play(day(), { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'down' });
    expect(s.palace!.at.zogu).toBe('armada');
    const r = advance(albania, s, { type: 'talk' });
    expect(r.events).toEqual([
      { type: 'feeling', group: 'armada', mood: s.pop.armada },
      { type: 'wish', group: 'armada', decision: 'd25' },
    ]);
    expect(r.state.palace!.hours.zogu).toBe(2);
  });

  it("advice about a decision needs Mother's room", () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'advice', decision: 'd41' })).toThrow();
    s = play(s, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'left' });
    const r = advance(albania, s, { type: 'advice', decision: 'd41' });
    expect(r.events).toEqual([{ type: 'advised', subject: 'decision', id: 'd41' }]);
  });

  it('advice on an already-sealed, non-reusable decision is refused', () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'left' },
    );
    expect(s.palace!.at.zogu).toBe('armada');
    s = play(s, { type: 'decide', decision: 'd41', hero: 'zogu' });
    s = play(s, { type: 'move', hero: 'zogu', dir: 'up' });
    expect(s.palace!.at.zogu).toBe('matka');
    expect(() => advance(albania, s, { type: 'advice', decision: 'd41' })).toThrow();
  });

  it('the envoys state their base offers', () => {
    const s = play(day(), { type: 'move', hero: 'zogu', dir: 'down' });
    const r = advance(albania, s, { type: 'envoys' });
    expect(r.events).toEqual([{ type: 'envoys', offers: { italie: 210, britanie: 210 } }]);
  });
});

describe("the commander's actions", () => {
  it('investigating a faction reveals its plot', () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'investigate' })).toThrow();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'left' }, { type: 'move', hero: 'velitel', dir: 'left' });
    expect(s.palace!.at.velitel).toBe('rolnici');
    const r = advance(albania, s, { type: 'investigate' });
    expect(r.events).toEqual([{ type: 'investigated', faction: 'rolnici', plot: { kind: 'none' } }]);
    expect(r.state.palace!.investigated.rolnici).toEqual({ kind: 'none' });
    expect(r.state.palace!.hours.velitel).toBe(2);
  });

  it('the police report costs an hour and money, in the guardroom only', () => {
    const s = day();
    const r = advance(albania, s, { type: 'policeReport', hero: 'velitel' });
    expect(r.state.palace!.hours.velitel).toBe(2);
    expect(r.state.treasury).toBe(s.treasury - 1);
    expect(r.events[0].type).toBe('policeReport');
    expect(() => advance(albania, s, { type: 'policeReport', hero: 'zogu' })).toThrow();
  });

  it('re-reading the same report this quarter is free and returns the same snapshot (play-test round 6a)', () => {
    const s = day();
    const first = advance(albania, s, { type: 'policeReport', hero: 'velitel' });
    expect(first.events[0]).toEqual({ type: 'policeReport', report: first.state.palace!.report });
    const second = advance(albania, first.state, { type: 'policeReport', hero: 'velitel' });
    expect(second.state.palace!.hours.velitel).toBe(first.state.palace!.hours.velitel);
    expect(second.state.treasury).toBe(first.state.treasury);
    expect(second.events).toEqual([{ type: 'policeReport', report: first.state.palace!.report, again: true }]);
    // the menu offers the free re-read, worded differently
    expect(palaceCommands(albania, first.state, 'velitel')).toContainEqual({ type: 'policeReport', hero: 'velitel' });
  });

  it('hours run out', () => {
    let s = day();
    for (let i = 0; i < 30 && s.palace!.hours.velitel > 0 && !s.palace!.done.velitel; i++) {
      s = play(s, { type: 'move', hero: 'velitel', dir: i % 2 === 0 ? 'up' : 'down' });
    }
    expect(s.palace!.hours.velitel).toBe(0);
    expect(() => advance(albania, s, { type: 'policeReport', hero: 'velitel' })).toThrow();
    // play-test round 4: walking now costs hours too, so with none left he cannot move either (was "moving is
    // still free" before this change).
    expect(() => advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' })).toThrow();
  });

  it("guarding costs one hour, needs Zogu's room, and ends the commander's day", () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'guard' })).toThrow();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' });
    const hoursBefore = s.palace!.hours.velitel;
    const r = advance(albania, s, { type: 'guard' });
    expect(r.state.palace!.guarded).toBe(true);
    expect(r.state.palace!.hours.velitel).toBe(hoursBefore - 1);
    expect(r.state.palace!.done.velitel).toBe(true);
    expect(r.events).toEqual([{ type: 'guarding' }, { type: 'heroDone', hero: 'velitel' }]);
  });
});

describe('ending the day', () => {
  it('the evening starts only when both heroes end their day, then the palace resets', () => {
    let s = play(day(), { type: 'move', hero: 'zogu', dir: 'left' });
    s = play(s, { type: 'endDay', hero: 'zogu' });
    expect(s.phase.kind).toBe('day');
    expect(() => advance(albania, s, { type: 'move', hero: 'zogu', dir: 'right' })).toThrow();
    s = play(s, { type: 'endDay', hero: 'velitel' });
    if (s.phase.kind === 'audience') {
      expect(s.quarter).toBe(2);
      expect(s.palace!.at).toEqual({ zogu: 'pracovna', velitel: 'straznice' });
      expect(s.palace!.hours).toEqual({ zogu: 3, velitel: 3 });
    } else {
      expect(['revolution', 'ended']).toContain(s.phase.kind);
    }
  });

  it('classic commands without a hero are refused in palace mode, palace commands in classic mode', () => {
    expect(() => advance(albania, day(), { type: 'endDay' })).toThrow();
    const classic = play(newGame(albania, 4).state, { type: 'answer', answer: 'no' });
    expect(() => advance(albania, classic, { type: 'move', hero: 'zogu', dir: 'left' })).toThrow();
  });
});

describe('palaceCommands', () => {
  it('at the start Zogu has only his exits and the seal in the study; no endDay', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palaceCommands(albania, s, 'zogu')).toEqual([
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'takeSeal', hero: 'zogu' },
    ]);
    expect(palaceCommands(albania, s, 'velitel')).toEqual([
      { type: 'move', hero: 'velitel', dir: 'up' },
      { type: 'move', hero: 'velitel', dir: 'left' },
      { type: 'move', hero: 'velitel', dir: 'right' },
      { type: 'policeReport', hero: 'velitel' },
      { type: 'endDay', hero: 'velitel' },
    ]);
  });

  it('in the day, with the seal in the guardroom, the holder may seal the guardroom decisions', () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    const cmds = palaceCommands(albania, s, 'zogu');
    const decisions = cmds.filter((c) => c.type === 'decide').map((c) => (c as { decision: string }).decision);
    expect(decisions).toEqual(['d33', 'd34', 'd35', 'd36']);
    expect(cmds).toContainEqual({ type: 'talk' });
    expect(cmds).toContainEqual({ type: 'giveSeal', hero: 'zogu' });
    expect(cmds[cmds.length - 1]).toEqual({ type: 'endDay', hero: 'zogu' });
  });

  it('validCommands in palace mode lists the answers, once Zogu stands in the throne room, plus both heroes\' commands', () => {
    const start = newGame(albania, 4, undefined, { palace: true }).state;
    expect(validCommands(albania, start).some((c) => c.type === 'answer')).toBe(false);
    const s = palaceAudience();
    const cmds = validCommands(albania, s);
    expect(cmds.filter((c) => c.type === 'answer').length).toBeGreaterThanOrEqual(3);
    expect(cmds).toContainEqual({ type: 'move', hero: 'zogu', dir: 'left' });
    expect(cmds).toContainEqual({ type: 'move', hero: 'velitel', dir: 'up' });
    expect(cmds).toContainEqual({ type: 'endDay', hero: 'velitel' });
    expect(cmds).not.toContainEqual({ type: 'endDay', hero: 'zogu' });
  });

  it('every command palaceCommands offers is accepted by advance', () => {
    let s = day(7);
    for (let i = 0; i < 40 && s.phase.kind === 'day'; i++) {
      for (const hero of ['zogu', 'velitel'] as const) {
        for (const c of palaceCommands(albania, s, hero)) expect(() => advance(albania, s, c), JSON.stringify(c)).not.toThrow();
      }
      const moves = palaceCommands(albania, s, 'velitel').filter((c) => c.type === 'move');
      if (moves.length === 0) break;
      s = advance(albania, s, moves[i % moves.length]).state;
    }
  });
});

describe('palace knowledge (seenPop, investigated, report, offers, wishes)', () => {
  it('entering a room updates seenPop for the groups seen there', () => {
    const s = day();
    expect(s.palace!.seenPop.armada).toBeUndefined();
    expect(s.palace!.seenPop.policie).toBe(s.pop.policie);
    const r = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    expect(r.palace!.at.zogu).toBe('armada');
    expect(r.palace!.seenPop.armada).toBe(r.pop.armada);
  });

  it("a sealed decision that changes a group's pop updates seenPop while a hero stands in its room", () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'takeSeal', hero: 'zogu' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'move', hero: 'zogu', dir: 'down' },
    );
    expect(s.palace!.at.zogu).toBe('straznice');
    expect(s.palace!.at.velitel).toBe('straznice');
    const before = s.pop.policie;
    const r = advance(albania, s, { type: 'decide', decision: 'd35', hero: 'zogu' });
    expect(r.state.pop.policie).not.toBe(before);
    expect(r.state.palace!.seenPop.policie).toBe(r.state.pop.policie);
  });

  it('investigated keeps the old plot snapshot even after plots re-form', () => {
    let s = day();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'left' }, { type: 'move', hero: 'velitel', dir: 'left' });
    expect(s.palace!.at.velitel).toBe('rolnici');
    const r = advance(albania, s, { type: 'investigate' });
    expect(r.state.palace!.investigated.rolnici).toEqual({ kind: 'none' });
    const mutated: GameState = structuredClone(r.state);
    mutated.quarter = 5;
    mutated.pop.rolnici = 1;
    mutated.low = 3;
    mutated.plotPauseUntil = 0;
    formPlots(mutated);
    expect(mutated.plots.rolnici.kind).not.toBe('none');
    expect(mutated.palace!.investigated.rolnici).toEqual({ kind: 'none' });
  });

  it('report, offers and wishes are stored and survive a serialize/deserialize round trip', () => {
    let s = day();
    s = play(
      s,
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'move', hero: 'zogu', dir: 'left' },
      { type: 'move', hero: 'zogu', dir: 'down' },
      { type: 'talk' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'move', hero: 'zogu', dir: 'right' },
      { type: 'envoys' },
      { type: 'policeReport', hero: 'velitel' },
    );
    expect(s.palace!.wishes.armada).toBe('d25');
    expect(s.palace!.offers).toEqual({ italie: 210, britanie: 210 });
    expect(s.palace!.report).not.toBeNull();
    expect(s.palace!.report!.pop).toEqual(s.pop);
    const f = newSave('albania', s);
    expect(deserialize(serialize(f))).toEqual(f);
  });
});

describe('seen popularity at the start of a quarter', () => {
  it('is refreshed after the treasury is settled (bankruptcy lowers the police first)', () => {
    let s = day();
    const before = s.pop.policie;
    s = { ...s, treasury: -50 };
    s = play(s, { type: 'endDay', hero: 'zogu' }, { type: 'endDay', hero: 'velitel' });
    expect(s.phase.kind).toBe('audience');
    expect(s.pop.policie).toBe(before - 1);
    expect(s.palace!.seenPop.policie).toBe(s.pop.policie);
  });
});

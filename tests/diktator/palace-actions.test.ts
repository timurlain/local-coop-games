import { describe, expect, it } from 'vitest';
import { deserialize, newSave, serialize } from '../../src/games/diktator/logic/save';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';
import type { Command, GameState } from '../../src/games/diktator/logic/state';

describe('palace mode', () => {
  it('newGame with palace starts a palace day; classic mode has none', () => {
    const palace = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palace.palace?.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
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
  return play(newGame(albania, seed, undefined, { palace: true }).state, { type: 'answer', answer: 'no' });
}

describe('audience in the palace', () => {
  it('Zogu cannot leave the throne room during the audience; the commander can move', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' })).toThrow();
    const r = advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' });
    expect(r.state.palace!.at.velitel).toBe('vyslanci');
    expect(r.events).toEqual([{ type: 'moved', hero: 'velitel', from: 'straznice', to: 'vyslanci' }]);
    expect(r.state.palace!.seen.vyslanci).toBe(true);
  });

  it("Mother's advice about the petition costs Zogu an hour and keeps the audience open", () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    const r = advance(albania, s, { type: 'advice' });
    expect(r.state.phase.kind).toBe('audience');
    expect(r.state.palace!.hours.zogu).toBe(2);
    expect(r.events).toEqual([{ type: 'advised', subject: 'petition', id: (s.phase as { petition: string }).petition }]);
  });

  it('the day cannot end and nothing can be sealed during the audience', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    expect(() => advance(albania, s, { type: 'endDay', hero: 'velitel' })).toThrow();
    expect(() => advance(albania, s, { type: 'decide', decision: 'd31', hero: 'zogu' })).toThrow();
  });
});

describe('moving', () => {
  it('refuses a wall', () => {
    expect(() => advance(albania, day(), { type: 'move', hero: 'zogu', dir: 'up' })).toThrow();
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
});

describe("Zogu's actions", () => {
  it('talking to the army names the decision it would welcome most', () => {
    const s = play(day(), { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'left' }, { type: 'move', hero: 'zogu', dir: 'down' });
    expect(s.palace!.at.zogu).toBe('armada');
    const r = advance(albania, s, { type: 'talk' });
    expect(r.events).toEqual([{ type: 'wish', group: 'armada', decision: 'd25' }]);
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
    expect(r.state.palace!.investigated.rolnici).toBe(true);
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

  it('hours run out', () => {
    let s = day();
    for (let i = 0; i < 3; i++) s = play(s, { type: 'policeReport', hero: 'velitel' });
    expect(s.palace!.hours.velitel).toBe(0);
    expect(() => advance(albania, s, { type: 'policeReport', hero: 'velitel' })).toThrow();
    // moving is still free
    expect(advance(albania, s, { type: 'move', hero: 'velitel', dir: 'up' }).state.palace!.at.velitel).toBe('vyslanci');
  });

  it("guarding needs Zogu's room and ends the commander's day", () => {
    let s = day();
    expect(() => advance(albania, s, { type: 'guard' })).toThrow();
    s = play(s, { type: 'move', hero: 'velitel', dir: 'up' }, { type: 'move', hero: 'velitel', dir: 'up' });
    const r = advance(albania, s, { type: 'guard' });
    expect(r.state.palace!.guarded).toBe(true);
    expect(r.state.palace!.hours.velitel).toBe(0);
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
      expect(s.palace!.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
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

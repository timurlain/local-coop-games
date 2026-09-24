import { describe, expect, it } from 'vitest';
import { updateAction, updateSearching } from '../../src/games/spy-vs-spy/logic/interact';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { doorKey, type GameEvent, type GameState, type Spy, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { atFurniture, firstFurniture, input, kufrik, openGame, place, remedy, secret } from './fixtures';

function act(s: GameState, spy: Spy, inp: SpyInput, dt: number, ev: GameEvent[]) {
  updateAction(s, spy, inp, dt, ev);
  spy.prev = inp;
}

describe('tap = search', () => {
  it('press starts a hold, release starts the search, search finds the thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('pas');
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.holdTarget).toBe(f.id);
    act(s, spy, input(), 1 / 60, ev);
    expect(spy.mode).toBe('searching');
    expect(ev).toContainEqual({ type: 'searchStart', spy: 0 });
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: secret('pas'), furniture: f.id });
  });

  it('searching a trapped furniture kills at the start of the search', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    expect(spy.mode).toBe('dead');
    expect(ev).toContainEqual({ type: 'died', spy: 0, cause: 'bomba' });
  });

  it('pressing away from furniture does nothing', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.holdTarget).toBeNull();
    expect(ev).toEqual([]);
  });
});

describe('hold = hide', () => {
  it('hides the hand item after holding long enough', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('klic');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev); // press: hold starts, no time yet
    act(s, spy, input({ action: true }), 0.25, ev);
    act(s, spy, input({ action: true }), 0.25, ev);
    expect(spy.hand).toBeNull();
    expect(f.hidden).toEqual(secret('klic'));
    expect(ev).toContainEqual({ type: 'hidden', spy: 0, thing: secret('klic'), furniture: f.id });
    expect(spy.mode).toBe('normal');
  });

  it('falls back to a search when hiding is impossible', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f); // empty hand
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input({ action: true }), 0.25, ev);
    act(s, spy, input({ action: true }), 0.25, ev);
    expect(spy.mode).toBe('searching');
  });

  it('holding onto an occupied piece falls back to a search that swaps (user decision)', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('klic');
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input({ action: true }), 0.25, ev);
    act(s, spy, input({ action: true }), 0.25, ev);
    expect(spy.mode).toBe('searching');
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'swapped', spy: 0, gave: secret('pas'), took: secret('klic'), furniture: f.id });
    expect(ev.filter((e) => e.type === 'found')).toHaveLength(0);
  });
});

describe('search outcome events (spec §7)', () => {
  it('nothing found emits found with a null thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: null, furniture: f.id });
  });

  it('a swap emits swapped with gave and took, not found', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('klic');
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'swapped', spy: 0, gave: secret('pas'), took: secret('klic'), furniture: f.id });
    expect(ev.filter((e) => e.type === 'found')).toHaveLength(0);
  });

  it('a secret going into the held kufrik emits stored', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('klic');
    const spy = atFurniture(s, 0, f);
    spy.hand = kufrik('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'stored', spy: 0, secret: 'klic', furniture: f.id });
    expect(ev.filter((e) => e.type === 'found')).toHaveLength(0);
  });

  it('taking the kufrik while holding a secret also emits stored', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = kufrik('plany');
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('penize');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'stored', spy: 0, secret: 'penize', furniture: f.id });
    expect(spy.hand).toEqual(kufrik('plany', 'penize'));
  });

  it('putting back a source own remedy emits found with a null thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.source = 'voda';
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input(), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: null, furniture: f.id });
    expect(spy.hand).toBeNull();
  });
});

describe('armed traps', () => {
  it('places an armed bomba on the furniture in reach', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.armed = 'bomba';
    act(s, spy, input({ action: true }), 1 / 60, []);
    expect(f.trap).toEqual({ kind: 'bomba', owner: 0 });
    expect(spy.holdTarget).toBeNull();
  });

  it('fails when there is no valid target and keeps the trap armed', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    spy.armed = 'bomba';
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(ev).toEqual([{ type: 'trapFailed', spy: 0 }]);
    expect(spy.armed).toBe('bomba');
  });

  it('places an armed door trap on the door in reach', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.armed = 'elektrina';
    act(s, spy, input({ action: true }), 1 / 60, []);
    expect(s.doorTraps[doorKey(4, 1)]).toEqual({ kind: 'elektrina', owner: 0 });
  });
});

describe('fight takes priority', () => {
  it('swings instead of searching when the opponent is in range', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    place(s, 1, 0, f.x + 10, 0);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.holdTarget).toBeNull();
    expect(ev[0]).toEqual({ type: 'swing', spy: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { updateAction, updateSearching } from '../../src/games/spy-vs-spy/logic/interact';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { doorKey, type GameEvent, type GameState, type Spy, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { atFurniture, firstFurniture, input, kufrik, openGame, place, remedy, secret, taken } from './fixtures';

function act(s: GameState, spy: Spy, inp: SpyInput, dt: number, ev: GameEvent[]) {
  updateAction(s, spy, inp, dt, ev);
  spy.prev = inp;
}

describe('Akce at furniture always searches (round 4 §2)', () => {
  it('press starts the search immediately — no hold, tap and hold are the same', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('pas');
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.mode).toBe('searching');
    expect(ev).toContainEqual({ type: 'searchStart', spy: 0 });
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.hand).toEqual(taken(secret('pas'), 0));
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: taken(secret('pas'), 0), furniture: f.id });
  });

  it('holding the button down (no release) behaves exactly like a tap', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('pas');
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    act(s, spy, input({ action: true }), 1 / 60, ev); // held, not released — nothing extra happens
    expect(spy.mode).toBe('searching');
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.hand).toEqual(taken(secret('pas'), 0));
  });

  it('searching a trapped furniture kills at the start of the search', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.mode).toBe('dead');
    expect(ev).toContainEqual({ type: 'died', spy: 0, cause: 'bomba' });
  });

  it('pressing away from furniture does nothing', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.mode).toBe('normal');
    expect(ev).toEqual([]);
  });
});

describe('something in hand + empty furniture → hidden (round 4 §2)', () => {
  it('holding a secret at empty furniture puts it in — hidden event, hand empty, no shrug', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f); // empty furniture
    spy.hand = secret('klic');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(spy.mode).toBe('searching');
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.hand).toBeNull();
    expect(f.hidden).toEqual(secret('klic'));
    expect(ev).toContainEqual({ type: 'hidden', spy: 0, thing: secret('klic'), furniture: f.id });
    expect(ev.filter((e) => e.type === 'found')).toHaveLength(0);
    expect(spy.mode).toBe('normal');
  });

  it('holding a kufrik at empty furniture puts it in', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = kufrik('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.hand).toBeNull();
    expect(f.hidden).toEqual(kufrik('pas'));
    expect(ev).toContainEqual({ type: 'hidden', spy: 0, thing: kufrik('pas'), furniture: f.id });
  });

  it('holding a remedy at empty furniture puts it in', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('destnik');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(spy.hand).toBeNull();
    expect(f.hidden).toEqual(remedy('destnik'));
    expect(ev).toContainEqual({ type: 'hidden', spy: 0, thing: remedy('destnik'), furniture: f.id });
  });

  it('holding a secret at furniture that already holds a secret swaps instead (unchanged table)', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('klic');
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'swapped', spy: 0, gave: secret('pas'), took: taken(secret('klic'), 0), furniture: f.id });
    expect(ev.filter((e) => e.type === 'found' || e.type === 'hidden')).toHaveLength(0);
  });
});

describe('empty hand + empty furniture → shrug', () => {
  it('nothing found emits found with a null thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: null, furniture: f.id });
    expect(ev.filter((e) => e.type === 'hidden')).toHaveLength(0);
  });
});

describe('search outcome events (spec §7)', () => {
  it('a swap emits swapped with gave and took, not found', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('klic');
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'swapped', spy: 0, gave: secret('pas'), took: taken(secret('klic'), 0), furniture: f.id });
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
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'stored', spy: 0, secret: 'penize', furniture: f.id });
    expect(spy.hand).toEqual(taken(kufrik('plany', 'penize'), 0));
  });

  it('putting back a source own remedy emits found with a null thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.source = 'voda';
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    updateSearching(s, spy, RULES.searchTime, ev);
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: null, furniture: f.id });
    expect(spy.hand).toBeNull();
  });
});

describe('a trap in hand (round 4 §1)', () => {
  it('Akce with bomba in hand starts placing it on the furniture in reach (no search/hide)', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.selected = 'bomba';
    act(s, spy, input({ action: true }), 1 / 60, []);
    expect(spy.placing).toEqual({ trap: 'bomba', target: { on: 'furniture', furniture: f.id }, timer: RULES.placeTime });
    expect(f.trap).toBeNull(); // only after the placing time
    expect(spy.mode).toBe('normal');
  });

  it('refuses when there is no valid target and keeps the trap in hand', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    spy.selected = 'bomba';
    const ev: GameEvent[] = [];
    act(s, spy, input({ action: true }), 1 / 60, ev);
    expect(ev).toEqual([{ type: 'refused', spy: 0 }]);
    expect(spy.selected).toBe('bomba');
    expect(spy.placing).toBeNull();
    expect(spy.refuseTimer).toBe(RULES.refuseTime);
  });

  it('Akce with a door trap in hand starts placing it on the door in reach, without opening it', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.selected = 'elektrina';
    act(s, spy, input({ action: true }), 1 / 60, []);
    expect(spy.placing?.target).toEqual({ on: 'door', key: doorKey(4, 1) });
    expect(spy.doorOpening).toBeNull();
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
    expect(spy.mode).toBe('normal');
    expect(ev[0]).toEqual({ type: 'swing', spy: 0 });
  });
});

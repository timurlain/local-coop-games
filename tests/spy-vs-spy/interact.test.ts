import { describe, expect, it } from 'vitest';
import { updateAction, updateSearching } from '../../src/games/spy-vs-spy/logic/interact';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { doorKey, type GameEvent, type GameState, type Spy, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import {
  akceAndWait, atFurniture, firstFurniture, input, kufrik, openGame, place, remedy, run, secret, taken, TICK,
} from './fixtures';

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
    const spy = place(s, 0, 4, 70, 34); // in reach of nothing, whatever the layout
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
    const spy = place(s, 0, 4, 70, 34); // in reach of nothing, whatever the layout
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

describe('round 4 fix: in a shared room, Akce is only ever a door or an attack — never a refusal', () => {
  it('at a door with a trap selected: opens the door regardless of the opponent (spy 0, Bílý)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0); // at the N door
    place(s, 1, 4, 40, 20); // shares the room, far from the door
    spy.selected = 'bomba';
    const key = doorKey(4, 1);
    const ev = run(s, [input({ action: true }), input()], RULES.doorOpenTime + TICK * 3);
    expect(s.doorOpen[key]?.phase).toBe('open');
    expect(ev).toContainEqual({ type: 'doorOpened', spy: 0, key });
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
    expect(ev.filter((e) => e.type === 'swing')).toEqual([]);
    expect(spy.selected).toBe('bomba'); // the selection is untouched
    expect(spy.placing).toBeNull();
  });

  it('at a door with a trap selected: opens the door regardless of the opponent (spy 1, Černý)', () => {
    const s = openGame();
    place(s, 0, 4, 40, 20);
    const spy = place(s, 1, 4, 100, 0); // at the N door
    spy.selected = 'elektrina';
    const key = doorKey(4, 1);
    const ev = run(s, [input(), input({ action: true })], RULES.doorOpenTime + TICK * 3);
    expect(s.doorOpen[key]?.phase).toBe('open');
    expect(ev).toContainEqual({ type: 'doorOpened', spy: 1, key });
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
    expect(spy.selected).toBe('elektrina');
  });

  it('far apart with a trap selected: starts a swing instead of refusing, and the strike misses', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 40, 20);
    place(s, 1, 4, 160, 20); // shares the room, well out of fight range
    spy.selected = 'bomba';
    const ev = run(s, [input({ action: true }), input()], RULES.swingWindup + TICK * 2);
    expect(ev).toContainEqual({ type: 'swing', spy: 0 });
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
    expect(ev.filter((e) => e.type === 'hit')).toEqual([]);
    expect(spy.placing).toBeNull();
    expect(spy.selected).toBe('bomba'); // still in hand for later
  });

  it('in fight range with a trap selected: hits, same as without one', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    const opp = place(s, 1, 4, 110, 20);
    spy.selected = 'bomba';
    const ev = run(s, [input({ action: true }), input()], RULES.swingWindup + TICK * 2);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
    expect(opp.health).toBe(RULES.health - RULES.jabDamage);
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
  });

  it('the selected trap works again once the opponent leaves the room', () => {
    const s = openGame();
    const f = firstFurniture(s, 4); // x = 65, well clear of the N/S door zone
    const spy = atFurniture(s, 0, f);
    place(s, 1, 4, f.x + 100, 20); // shares the room, far away
    spy.selected = 'bomba';
    const ev1 = step(s, [input({ action: true }), input()], TICK);
    expect(ev1).toContainEqual({ type: 'swing', spy: 0 });
    expect(ev1.filter((e) => e.type === 'refused')).toEqual([]);
    expect(spy.placing).toBeNull(); // ignored while shared, not placed either
    step(s, [input(), input()], TICK); // release Akce
    place(s, 1, 5, 0, 0); // opponent leaves the room
    const ev2 = akceAndWait(s);
    expect(f.trap).toEqual({ kind: 'bomba', owner: 0 });
    expect(ev2.filter((e) => e.type === 'refused')).toEqual([]);
  });
});

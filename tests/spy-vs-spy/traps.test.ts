import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import {
  nextSelection, triggerDoorTrap, triggerFurnitureTrap, updateTimeBombs,
} from '../../src/games/spy-vs-spy/logic/traps';
import {
  TRAPS, doorKey,
  type GameEvent, type GameState, type TrapKind,
} from '../../src/games/spy-vs-spy/logic/state';
import {
  OPEN_RULES, TICK, akceAndWait, atFurniture, firstFurniture, input, kufrik, openGame, place, remedy, run, select, tap,
} from './fixtures';

const IDLE = input();


describe('furniture traps', () => {
  it('no trap → survives', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    expect(triggerFurnitureTrap(s, s.spies[0], f, [])).toBe(true);
  });

  it('bomba without remedy kills and is used up', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, atFurniture(s, 0, f), f, ev)).toBe(false);
    expect(s.spies[0].mode).toBe('dead');
    expect(s.spies[0].deathCause).toBe('bomba');
    expect(f.trap).toBeNull();
  });

  it('bomba with voda is disarmed and the remedy consumed', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, spy, f, ev)).toBe(true);
    expect(spy.hand).toBeNull();
    expect(spy.mode).toBe('normal');
    expect(f.trap).toBeNull();
    expect(ev).toEqual([{ type: 'disarmed', spy: 0, trap: 'bomba' }]);
  });

  it('pruzina with the wrong remedy kills', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'pruzina', owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    expect(triggerFurnitureTrap(s, spy, f, [])).toBe(false);
    expect(spy.deathCause).toBe('pruzina');
  });

  it('the owner falls into their own trap', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 0 };
    expect(triggerFurnitureTrap(s, atFurniture(s, 0, f), f, [])).toBe(false);
  });
});

describe('door traps', () => {
  it('pistole kills without nuzky and survives with them', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = remedy('nuzky');
    expect(triggerDoorTrap(s, spy, key, [])).toBe(true);
    expect(s.doorTraps[key]).toBeUndefined();

    s.doorTraps[key] = { kind: 'elektrina', owner: 1 };
    expect(triggerDoorTrap(s, spy, key, [])).toBe(false);
    expect(spy.deathCause).toBe('elektrina');
  });
});

describe('remedies disarm every trap (spec §8)', () => {
  it.each([
    ['bomba', 'voda'],
    ['pruzina', 'kleste'],
  ] as const)('furniture trap %s disarmed by %s', (trap, cure) => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: trap, owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy(cure);
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, spy, f, ev)).toBe(true);
    expect(spy.mode).toBe('normal');
    expect(spy.hand).toBeNull();
    expect(f.trap).toBeNull();
    expect(ev).toEqual([{ type: 'disarmed', spy: 0, trap }]);
  });

  it.each([
    ['elektrina', 'destnik'],
    ['pistole', 'nuzky'],
  ] as const)('door trap %s disarmed by %s', (trap, cure) => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: trap, owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = remedy(cure);
    const ev: GameEvent[] = [];
    expect(triggerDoorTrap(s, spy, key, ev)).toBe(true);
    expect(spy.mode).toBe('normal');
    expect(spy.hand).toBeNull();
    expect(s.doorTraps[key]).toBeUndefined();
    expect(ev).toEqual([{ type: 'disarmed', spy: 0, trap }]);
  });
});

describe('trap hand: tap the Trapulator to cycle (round 4 §1)', () => {
  it('cycles null → bomba → pruzina → elektrina → pistole → casovana → null', () => {
    const s = openGame();
    const spy = s.spies[0];
    expect(spy.selected).toBeNull();
    const seen: (TrapKind | null)[] = [];
    for (let i = 0; i < 6; i++) {
      tap(s);
      seen.push(spy.selected);
    }
    expect(seen).toEqual(['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana', null]);
  });

  it('skips kinds with stock 0', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.stock.pruzina = 0;
    spy.stock.pistole = 0;
    const seen: (TrapKind | null)[] = [];
    for (let i = 0; i < 4; i++) {
      tap(s);
      seen.push(spy.selected);
    }
    expect(seen).toEqual(['bomba', 'elektrina', 'casovana', null]);
  });

  it('stays empty when every stock is 0', () => {
    const s = openGame();
    const spy = s.spies[0];
    for (const t of TRAPS) spy.stock[t] = 0;
    tap(s);
    expect(spy.selected).toBeNull();
  });

  it('nextSelection is the pure cycle rule', () => {
    const stock = { bomba: 1, pruzina: 0, elektrina: 0, pistole: 2, casovana: 0 };
    expect(nextSelection(null, stock)).toBe('bomba');
    expect(nextSelection('bomba', stock)).toBe('pistole');
    expect(nextSelection('pistole', stock)).toBeNull();
  });

  it('is decided on release, not on press', () => {
    const s = openGame();
    const spy = s.spies[0];
    step(s, [input({ trap: true }), IDLE], TICK);
    expect(spy.selected).toBeNull();
    step(s, [IDLE, IDLE], TICK);
    expect(spy.selected).toBe('bomba');
  });

  it('does not freeze the spy: he keeps walking while tapping', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    tap(s, 0, { moveX: 1 });
    expect(spy.x).toBeGreaterThan(100);
    expect(spy.selected).toBe('bomba');
  });

  it('a press held just under the tap limit still counts as a tap', () => {
    const s = openGame();
    const spy = s.spies[0];
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax - 2 * TICK);
    step(s, [IDLE, IDLE], TICK);
    expect(spy.selected).toBe('bomba');
    expect(spy.mapOpen).toBe(false);
  });

  it('cycling is still allowed in a shared room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 40, 20);
    place(s, 1, 4, 160, 20);
    const ev = tap(s);
    expect(spy.selected).toBe('bomba');
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
  });
});

describe('map: hold the Trapulator (round 4 §1)', () => {
  it('opens after the tap limit, costs 5 s and 70 points once, and never changes the hand', () => {
    const s = openGame();
    const spy = s.spies[0];
    tap(s); // bomba in hand
    const clock = spy.clock;
    const ev = run(s, [input({ trap: true }), IDLE], 1.5);
    expect(spy.mapOpen).toBe(true);
    expect(ev.filter((e) => e.type === 'mapOpened')).toEqual([{ type: 'mapOpened', spy: 0 }]);
    expect(spy.clock).toBeCloseTo(clock - 1.5 - RULES.mapCost, 6);
    expect(spy.score).toBe(-70);
    step(s, [IDLE, IDLE], TICK); // release
    expect(spy.mapOpen).toBe(false);
    expect(spy.selected).toBe('bomba');
  });

  it('is not open before the tap limit', () => {
    const s = openGame();
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax - 2 * TICK);
    expect(s.spies[0].mapOpen).toBe(false);
  });

  it('charges again for a second opening', () => {
    const s = openGame();
    const ev = run(s, [input({ trap: true }), IDLE], 1);
    step(s, [IDLE, IDLE], TICK);
    ev.push(...run(s, [input({ trap: true }), IDLE], 1));
    expect(ev.filter((e) => e.type === 'mapOpened')).toHaveLength(2);
  });

  it('holds the spy still while it is open', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax + TICK);
    const x = spy.x;
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 0.5);
    expect(spy.mapOpen).toBe(true);
    expect(spy.x).toBe(x);
  });

  it('clamps the map cost at 0 clock', () => {
    const s = openGame();
    s.spies[0].clock = 1;
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax + TICK);
    expect(s.spies[0].clock).toBe(0);
  });

  it('is refused in a shared room: a head shake, no map, no cost', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 40, 20);
    place(s, 1, 4, 160, 20);
    const clock = spy.clock;
    const ev = run(s, [input({ trap: true }), IDLE], 1);
    expect(spy.mapOpen).toBe(false);
    expect(ev.filter((e) => e.type === 'refused')).toEqual([{ type: 'refused', spy: 0 }]);
    expect(ev.filter((e) => e.type === 'mapOpened')).toEqual([]);
    expect(spy.clock).toBeCloseTo(clock - 1, 6);
    step(s, [IDLE, IDLE], TICK); // the release of a refused hold is no tap
    expect(spy.selected).toBeNull();
  });

  it('closes when the opponent walks in', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 40, 20);
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax + TICK);
    expect(spy.mapOpen).toBe(true);
    place(s, 1, 4, 160, 20);
    step(s, [input({ trap: true }), IDLE], TICK);
    expect(spy.mapOpen).toBe(false);
  });
});

describe('placing a trap from the hand (round 4 §1)', () => {
  it('bomba on the furniture in reach: 0.4 s immobile, then stock −1, clock −3, +30, hand empty', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    select(s, 'bomba');
    const clock = spy.clock;
    const ev = step(s, [input({ action: true }), IDLE], TICK);
    expect(spy.placing).not.toBeNull();
    // immobile meanwhile, even when pushing
    run(s, [input({ moveX: 1 }), IDLE], RULES.placeTime - 3 * TICK);
    expect(spy.x).toBe(f.x);
    expect(f.trap).toBeNull();
    ev.push(...run(s, [IDLE, IDLE], 4 * TICK)); // one tick of slack: 24 × 1/60 is not exactly 0.4 in floats
    expect(f.trap).toEqual({ kind: 'bomba', owner: 0 });
    expect(spy.placing).toBeNull();
    expect(spy.selected).toBeNull();
    expect(spy.stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba - 1);
    expect(spy.clock).toBeCloseTo(clock - (1 + Math.round((RULES.placeTime - 3 * TICK) / TICK) + 4) * TICK - RULES.trapSetCost, 6);
    expect(ev.filter((e) => e.type === 'trapSet')).toEqual([{ type: 'trapSet', spy: 0, trap: 'bomba' }]);
    expect(spy.score).toBe(30);
    expect(spy.holdTarget).toBeNull();
    expect(spy.mode).toBe('normal');
  });

  it('pruzina goes on furniture too', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    atFurniture(s, 0, f);
    select(s, 'pruzina');
    akceAndWait(s);
    expect(f.trap).toEqual({ kind: 'pruzina', owner: 0 });
  });

  it.each(['elektrina', 'pistole'] as const)('%s goes on the door in reach', (kind) => {
    const s = openGame();
    place(s, 0, 4, 100, 0);
    select(s, kind);
    akceAndWait(s);
    expect(s.doorTraps[doorKey(4, 1)]).toEqual({ kind, owner: 0 });
    expect(s.doorOpen[doorKey(4, 1)]).toBeUndefined(); // placing never opens the door
  });

  it('casovana is placed at the feet after the placing time', () => {
    const s = openGame();
    place(s, 0, 4, 80, 30);
    select(s, 'casovana');
    step(s, [input({ action: true }), IDLE], TICK);
    expect(s.timeBombs).toEqual([]);
    run(s, [IDLE, IDLE], RULES.placeTime + 0.05);
    expect(s.timeBombs).toHaveLength(1);
    expect(s.timeBombs[0]).toMatchObject({ room: 4, x: 80, z: 30, owner: 0 });
    expect(s.spies[0].stock.casovana).toBe(OPEN_RULES.trapStockPerSpy.casovana - 1);
    expect(s.spies[0].selected).toBeNull();
  });

  it('a trap in hand keeps the carried thing', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = kufrik('pas');
    select(s, 'bomba');
    akceAndWait(s);
    expect(f.trap).not.toBeNull();
    expect(spy.hand).toEqual(kufrik('pas'));
    expect(f.hidden).toBeNull(); // no search, no hide
  });
});

describe('refused: the head shake (round 4 §1)', () => {
  /** Akce with `kind` in hand; asserts a refusal that spends nothing and leaves the hand as it was. */
  function expectRefused(s: GameState, kind: TrapKind): GameEvent[] {
    const spy = s.spies[0];
    const stock = spy.stock[kind];
    const clock = spy.clock;
    const traps = JSON.stringify([s.doorTraps, s.furniture.map((f) => f.trap), s.timeBombs]);
    const ev = akceAndWait(s);
    expect(ev.filter((e) => e.type === 'refused')).toEqual([{ type: 'refused', spy: 0 }]);
    expect(ev.filter((e) => e.type === 'trapSet')).toEqual([]);
    expect(spy.stock[kind]).toBe(stock);
    expect(spy.clock).toBeCloseTo(clock - TICK - Math.round((RULES.placeTime + 0.05) / TICK) * TICK, 6);
    expect(spy.selected).toBe(kind);
    expect(spy.placing).toBeNull();
    expect(JSON.stringify([s.doorTraps, s.furniture.map((f) => f.trap), s.timeBombs])).toBe(traps);
    return ev;
  }

  it('furniture trap with no furniture in reach', () => {
    const s = openGame();
    place(s, 0, 4, 100, 20);
    select(s, 'bomba');
    expectRefused(s, 'bomba');
  });

  it('furniture trap at a door (and the door does not open)', () => {
    const s = openGame();
    place(s, 0, 4, 100, 0);
    select(s, 'pruzina');
    expectRefused(s, 'pruzina');
    expect(s.doorOpen[doorKey(4, 1)]).toBeUndefined();
  });

  it('door trap at furniture (and no search starts)', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    atFurniture(s, 0, f);
    select(s, 'elektrina');
    const ev = expectRefused(s, 'elektrina');
    expect(ev.filter((e) => e.type === 'searchStart')).toEqual([]);
  });

  it('furniture already trapped', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'pruzina', owner: 1 };
    atFurniture(s, 0, f);
    select(s, 'bomba');
    expectRefused(s, 'bomba');
    expect(f.trap).toEqual({ kind: 'pruzina', owner: 1 });
  });

  it('door already trapped', () => {
    const s = openGame();
    s.doorTraps[doorKey(4, 1)] = { kind: 'pistole', owner: 1 };
    place(s, 0, 4, 100, 0);
    select(s, 'elektrina');
    expectRefused(s, 'elektrina');
  });

  it('shared room, opponent out of fight range — even casovana', () => {
    const s = openGame();
    place(s, 0, 4, 40, 20);
    place(s, 1, 4, 160, 20);
    select(s, 'casovana');
    expectRefused(s, 'casovana');
  });

  it('shared room in fight range swings instead of refusing', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 110, 20);
    select(s, 'bomba');
    const ev = step(s, [input({ action: true }), IDLE], TICK);
    expect(ev).toContainEqual({ type: 'swing', spy: 0 });
    expect(ev.filter((e) => e.type === 'refused')).toEqual([]);
    expect(spy.placing).toBeNull();
  });

  it('the opponent walking in while placing refuses the placement', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    select(s, 'bomba');
    step(s, [input({ action: true }), IDLE], TICK);
    place(s, 1, 0, 190, 30);
    const ev = run(s, [IDLE, IDLE], RULES.placeTime);
    expect(ev.filter((e) => e.type === 'refused')).toEqual([{ type: 'refused', spy: 0 }]);
    expect(f.trap).toBeNull();
    expect(spy.placing).toBeNull();
    expect(spy.selected).toBe('bomba');
  });

  it('shows the shake for refuseTime without blocking movement', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    select(s, 'bomba');
    step(s, [input({ action: true }), IDLE], TICK);
    expect(spy.refuseTimer).toBe(RULES.refuseTime);
    step(s, [input({ moveX: 1 }), IDLE], TICK);
    expect(spy.x).toBeGreaterThan(100);
    expect(spy.refuseTimer).toBeCloseTo(RULES.refuseTime - TICK, 9);
    run(s, [IDLE, IDLE], RULES.refuseTime);
    expect(spy.refuseTimer).toBe(0);
  });
});

describe('selection across death, timeout and entering (round 4 §1)', () => {
  it('death keeps the trap in hand but cancels placing and the map', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    select(s, 'bomba');
    step(s, [input({ action: true }), IDLE], TICK);
    expect(spy.placing).not.toBeNull();
    s.timeBombs.push({ room: 0, x: 100, z: 20, fuse: TICK / 2, owner: 1 });
    step(s, [IDLE, IDLE], TICK);
    expect(spy.mode).toBe('dead');
    expect(spy.placing).toBeNull();
    expect(spy.mapOpen).toBe(false);
    expect(spy.selected).toBe('bomba');
    expect(spy.stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba);
    expect(f.trap).toBeNull();
  });

  it('timeout keeps the selection and cancels placing', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 80, 20);
    select(s, 'casovana');
    step(s, [input({ action: true }), IDLE], TICK);
    spy.clock = TICK / 2;
    run(s, [IDLE, IDLE], RULES.placeTime);
    expect(spy.mode).toBe('out');
    expect(spy.placing).toBeNull();
    expect(spy.selected).toBe('casovana');
    expect(s.timeBombs).toEqual([]);
  });
});


describe('time bombs', () => {
  it('ticks every second and kills everyone in the room after the fuse', () => {
    const s = openGame();
    place(s, 0, 4, 50, 20);
    place(s, 1, 4, 150, 20);
    s.timeBombs.push({ room: 4, x: 100, z: 20, fuse: RULES.timeBombFuse, owner: 0 });
    const ev: GameEvent[] = [];
    // Ticks fire on each whole-second crossing; the last half-second before the fuse ends explodes instead.
    const stepsBeforeExplosion = RULES.timeBombFuse * 2 - 1;
    for (let i = 0; i < stepsBeforeExplosion; i++) updateTimeBombs(s, 0.5, ev);
    expect(ev.filter((e) => e.type === 'tick')).toHaveLength(RULES.timeBombFuse - 1);
    expect(s.spies[0].mode).toBe('normal');
    updateTimeBombs(s, 0.5, ev);
    expect(ev).toContainEqual({ type: 'explode', room: 4 });
    expect(s.spies[0].mode).toBe('dead');
    expect(s.spies[1].mode).toBe('dead');
    expect(s.spies[0].deathCause).toBe('casovana');
    expect(s.timeBombs).toHaveLength(0);
  });

  it('spares spies in other rooms', () => {
    const s = openGame();
    place(s, 0, 4, 50, 20);
    place(s, 1, 5, 150, 20);
    s.timeBombs.push({ room: 4, x: 100, z: 20, fuse: 0.5, owner: 1 });
    updateTimeBombs(s, 0.5, []);
    expect(s.spies[1].mode).toBe('normal');
  });
});

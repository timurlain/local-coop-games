import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import {
  placeDoorTrap, placeFurnitureTrap, triggerDoorTrap, triggerFurnitureTrap, updateTimeBombs, updateTrapMenu,
} from '../../src/games/spy-vs-spy/logic/traps';
import {
  doorKey, MENU_MAP, type GameEvent, type GameState, type Spy, type SpyInput,
} from '../../src/games/spy-vs-spy/logic/state';
import { atFurniture, firstFurniture, input, openGame, place, remedy } from './fixtures';

function menu(s: GameState, spy: Spy, inp: SpyInput, ev: GameEvent[]) {
  updateTrapMenu(s, spy, inp, ev);
  spy.prev = inp;
}

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

describe('placing traps', () => {
  it('places a furniture trap, spends stock, disarms the hand and costs clock', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.armed = 'bomba';
    const clock = spy.clock;
    const ev: GameEvent[] = [];
    placeFurnitureTrap(spy, f, 'bomba', ev);
    expect(f.trap).toEqual({ kind: 'bomba', owner: 0 });
    expect(spy.stock.bomba).toBe(RULES.trapStock.bomba - 1);
    expect(spy.armed).toBeNull();
    expect(spy.clock).toBe(clock - RULES.trapSetCost);
    expect(ev).toEqual([{ type: 'trapSet', spy: 0, trap: 'bomba' }]);
  });

  it('refuses an occupied target without spending stock or clock', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'pruzina', owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.armed = 'bomba';
    const clock = spy.clock;
    const ev: GameEvent[] = [];
    placeFurnitureTrap(spy, f, 'bomba', ev);
    expect(f.trap).toEqual({ kind: 'pruzina', owner: 1 });
    expect(spy.stock.bomba).toBe(RULES.trapStock.bomba);
    expect(spy.armed).toBe('bomba');
    expect(spy.clock).toBe(clock);
    expect(ev).toEqual([{ type: 'trapFailed', spy: 0 }]);
  });

  it('places a door trap on the shared door key and costs clock', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.armed = 'elektrina';
    const clock = spy.clock;
    placeDoorTrap(s, spy, doorKey(4, 1), 'elektrina', []);
    expect(s.doorTraps[doorKey(1, 4)]).toEqual({ kind: 'elektrina', owner: 0 });
    expect(spy.stock.elektrina).toBe(RULES.trapStock.elektrina - 1);
    expect(spy.clock).toBe(clock - RULES.trapSetCost);
  });

  it('refuses a door trap on an occupied key without spending clock', () => {
    const s = openGame();
    const key = doorKey(4, 1);
    const spy = place(s, 0, 4, 100, 0);
    spy.armed = 'elektrina';
    s.doorTraps[key] = { kind: 'pistole', owner: 1 };
    const clock = spy.clock;
    const ev: GameEvent[] = [];
    placeDoorTrap(s, spy, key, 'elektrina', ev);
    expect(spy.clock).toBe(clock);
    expect(ev).toEqual([{ type: 'trapFailed', spy: 0 }]);
  });
});

describe('Trapulator menu', () => {
  it('moves the cursor on direction presses and wraps over 6 entries (5 traps + MAPA)', () => {
    const s = openGame();
    const spy = s.spies[0];
    const ev: GameEvent[] = [];
    menu(s, spy, input({ trap: true }), ev);
    expect(spy.menuOpen).toBe(true);
    menu(s, spy, input({ trap: true, moveX: -1 }), ev);
    expect(spy.menuCursor).toBe(MENU_MAP);
    menu(s, spy, input({ trap: true, moveX: -1 }), ev); // still held → no move
    expect(spy.menuCursor).toBe(MENU_MAP);
    menu(s, spy, input({ trap: true }), ev);
    menu(s, spy, input({ trap: true, moveX: 1 }), ev);
    expect(spy.menuCursor).toBe(0);
  });

  it('MENU_MAP is the 6th entry, right after the 5 traps', () => {
    expect(MENU_MAP).toBe(5);
  });

  it('arms the selected trap on Akce', () => {
    const s = openGame();
    const spy = s.spies[0];
    menu(s, spy, input({ trap: true }), []);
    menu(s, spy, input({ trap: true, moveX: 1 }), []);
    menu(s, spy, input({ trap: true, action: true }), []);
    expect(spy.armed).toBe('pruzina');
  });

  it('refuses an empty stock', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.stock.bomba = 0;
    const ev: GameEvent[] = [];
    menu(s, spy, input({ trap: true, action: true }), ev);
    expect(spy.armed).toBeNull();
    expect(ev).toEqual([{ type: 'trapFailed', spy: 0 }]);
  });

  it('picking the armed trap again unarms it without spending clock', () => {
    const s = openGame();
    const spy = s.spies[0];
    const clock = spy.clock;
    menu(s, spy, input({ trap: true, action: true }), []); // arm bomba (cursor 0)
    expect(spy.armed).toBe('bomba');
    menu(s, spy, input({ trap: true }), []); // release Akce
    menu(s, spy, input({ trap: true, action: true }), []); // press Akce again
    expect(spy.armed).toBeNull();
    expect(spy.stock.bomba).toBe(RULES.trapStock.bomba);
    expect(spy.clock).toBe(clock);
  });

  it('places the time bomb immediately and costs clock', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 80, 30);
    spy.menuCursor = 4;
    const clock = spy.clock;
    menu(s, spy, input({ trap: true, action: true }), []);
    expect(s.timeBombs).toEqual([{ room: 4, x: 80, z: 30, fuse: RULES.timeBombFuse, owner: 0 }]);
    expect(spy.stock.casovana).toBe(RULES.trapStock.casovana - 1);
    expect(spy.armed).toBeNull();
    expect(spy.clock).toBe(clock - RULES.trapSetCost);
  });

  it('Akce on MAPA opens the map, costs 5 s once and emits mapOpened', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.menuCursor = MENU_MAP;
    const clock = spy.clock;
    const ev: GameEvent[] = [];
    menu(s, spy, input({ trap: true, action: true }), ev);
    expect(spy.mapOpen).toBe(true);
    expect(spy.clock).toBe(clock - RULES.mapCost);
    expect(ev).toEqual([{ type: 'mapOpened', spy: 0 }]);
    // pressing Akce again while already open does not charge a second time
    menu(s, spy, input({ trap: true }), ev); // release
    menu(s, spy, input({ trap: true, action: true }), ev); // press again
    expect(spy.clock).toBe(clock - RULES.mapCost);
    expect(ev.filter((e) => e.type === 'mapOpened')).toHaveLength(1);
  });

  it('clamps the map cost at 0 clock', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.menuCursor = MENU_MAP;
    spy.clock = 1;
    menu(s, spy, input({ trap: true, action: true }), []);
    expect(spy.clock).toBe(0);
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

import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { triggerDoorTrap, triggerFurnitureTrap, updateTimeBombs } from '../../src/games/spy-vs-spy/logic/traps';
import { doorKey, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { OPEN_RULES, atFurniture, firstFurniture, input, openGame, place, remedy, run } from './fixtures';

describe('round 6 §4: salvaging a disarmed trap', () => {
  it.each([
    ['bomba', 'voda'],
    ['pruzina', 'kleste'],
  ] as const)("the opponent's %s disarmed with %s: +1 %s stock and a salvaged event", (trap, cure) => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: trap, owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy(cure);
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, spy, f, ev)).toBe(true);
    expect(spy.stock[trap]).toBe(OPEN_RULES.trapStockPerSpy[trap] + 1);
    expect(s.spies[1].stock[trap]).toBe(OPEN_RULES.trapStockPerSpy[trap]);
    expect(ev).toEqual([
      { type: 'disarmed', spy: 0, trap, remedy: cure },
      { type: 'salvaged', spy: 0, trap },
    ]);
    expect(spy.stockFlash).toEqual({ trap, timer: RULES.stockFlashTime });
  });

  it.each([
    ['elektrina', 'destnik'],
    ['pistole', 'nuzky'],
  ] as const)("the opponent's %s on a door disarmed with %s: +1 stock", (trap, cure) => {
    const s = openGame();
    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: trap, owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = remedy(cure);
    const ev: GameEvent[] = [];
    expect(triggerDoorTrap(s, spy, key, ev)).toBe(true);
    expect(spy.stock[trap]).toBe(OPEN_RULES.trapStockPerSpy[trap] + 1);
    expect(ev).toEqual([
      { type: 'disarmed', spy: 0, trap, remedy: cure },
      { type: 'salvaged', spy: 0, trap },
    ]);
  });

  it('gives nothing for disarming his own trap', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 0 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, spy, f, ev)).toBe(true);
    expect(spy.stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba);
    expect(ev).toEqual([{ type: 'disarmed', spy: 0, trap: 'bomba', remedy: 'voda' }]);
    expect(spy.stockFlash).toBeNull();

    const key = doorKey(4, 1);
    s.doorTraps[key] = { kind: 'pistole', owner: 0 };
    place(s, 0, 4, 100, 0).hand = remedy('nuzky');
    const ev2: GameEvent[] = [];
    triggerDoorTrap(s, spy, key, ev2);
    expect(spy.stock.pistole).toBe(OPEN_RULES.trapStockPerSpy.pistole);
    expect(ev2.map((e) => e.type)).toEqual(['disarmed']);
  });

  it('gives nothing when the trap kills (wrong or no remedy)', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'pruzina', owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    expect(triggerFurnitureTrap(s, spy, f, ev)).toBe(false);
    expect(spy.stock.pruzina).toBe(OPEN_RULES.trapStockPerSpy.pruzina);
    expect(ev.some((e) => e.type === 'salvaged')).toBe(false);
  });

  it('never salvages a časovaná (it has no remedy)', () => {
    const s = openGame();
    const spy = place(s, 0, 0, 100, 20);
    spy.hand = remedy('voda');
    s.timeBombs.push({ room: 0, x: 100, z: 20, fuse: 0.01, owner: 1 });
    const ev: GameEvent[] = [];
    updateTimeBombs(s, 0.05, ev);
    expect(spy.mode).toBe('dead');
    expect(spy.stock.casovana).toBe(OPEN_RULES.trapStockPerSpy.casovana);
    expect(ev.some((e) => e.type === 'salvaged')).toBe(false);
  });

  it('works through a real search, and the stock flash runs out', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    atFurniture(s, 0, f).hand = remedy('voda');
    const ev = run(s, [input({ action: true }), input()], 0.05);
    expect(ev.filter((e) => e.type === 'salvaged')).toEqual([{ type: 'salvaged', spy: 0, trap: 'bomba' }]);
    expect(s.spies[0].stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba + 1);
    run(s, [input(), input()], RULES.stockFlashTime + 0.05);
    expect(s.spies[0].stockFlash).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { kill, updateDead } from '../../src/games/spy-vs-spy/logic/death';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { OPEN_RULES, kufrik, openGame, place, remedy, secret } from './fixtures';

describe('kill', () => {
  it('marks the spy dead, costs 30 s and emits died', () => {
    const s = openGame();
    const spy = s.spies[0];
    const ev: GameEvent[] = [];
    kill(s, spy, 'bomba', ev);
    expect(spy.mode).toBe('dead');
    expect(spy.clock).toBe(OPEN_RULES.clockSeconds - RULES.deathPenalty);
    expect(spy.deathCause).toBe('bomba');
    expect(spy.modeTimer).toBe(RULES.respawnTime);
    expect(ev).toEqual([{ type: 'died', spy: 0, cause: 'bomba' }]);
  });

  it('never drops the clock below zero', () => {
    const s = openGame();
    s.spies[0].clock = 10;
    kill(s, s.spies[0], 'fight', []);
    expect(s.spies[0].clock).toBe(0);
  });

  it('does nothing to a spy that is already dead', () => {
    const s = openGame();
    const ev: GameEvent[] = [];
    kill(s, s.spies[0], 'bomba', ev);
    kill(s, s.spies[0], 'bomba', ev);
    expect(ev).toHaveLength(1);
    expect(s.spies[0].clock).toBe(OPEN_RULES.clockSeconds - RULES.deathPenalty);
  });

  it('clears the map, a placement, the Trapulator press and a pending hold, but keeps the trap in hand', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.mapOpen = true;
    spy.trapPress = 0.7;
    spy.selected = 'bomba';
    spy.placing = { trap: 'bomba', target: { on: 'furniture', furniture: 0 }, timer: 0.2 };
    spy.refuseTimer = 0.3;
    spy.holdTarget = 3;
    kill(s, spy, 'pistole', []);
    expect(spy.mapOpen).toBe(false);
    expect(spy.trapPress).toBeNull();
    expect(spy.placing).toBeNull();
    expect(spy.refuseTimer).toBe(0);
    expect(spy.selected).toBe('bomba');
    expect(spy.stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba);
    expect(spy.holdTarget).toBeNull();
  });

  it('re-hides the hand item in a free furniture of the same room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    spy.hand = kufrik('pas', 'klic');
    kill(s, spy, 'bomba', []);
    expect(spy.hand).toBeNull();
    const holders = s.furniture.filter((f) => f.hidden !== null);
    expect(holders).toHaveLength(1);
    expect(holders[0].room).toBe(4);
    expect(holders[0].hidden).toEqual(kufrik('pas', 'klic'));
  });

  it('falls back to the nearest room when the room is full', () => {
    const s = openGame();
    for (const id of s.rooms[0].furniture) s.furniture[id].hidden = remedy('voda');
    const spy = place(s, 0, 0, 100, 20);
    spy.hand = secret('pas');
    kill(s, spy, 'bomba', []);
    const holder = s.furniture.find((f) => f.hidden?.kind === 'secret')!;
    expect([1, 3]).toContain(holder.room);
  });

  it('discards a remedy when the whole embassy is full', () => {
    const s = openGame();
    for (const f of s.furniture) f.hidden = secret('klic');
    const spy = s.spies[0];
    spy.hand = remedy('nuzky');
    kill(s, spy, 'bomba', []);
    expect(spy.hand).toBeNull();
    expect(s.furniture.some((f) => f.hidden?.kind === 'remedy')).toBe(false);
  });

  it('overwrites a hidden remedy when a secret has nowhere else to go', () => {
    const s = openGame();
    for (const f of s.furniture) f.hidden = remedy('voda');
    const spy = s.spies[0];
    spy.hand = secret('plany');
    kill(s, spy, 'bomba', []);
    const holder = s.furniture.find((f) => f.hidden?.kind === 'secret')!;
    expect(holder.room).toBe(0);
  });
});

describe('updateDead', () => {
  it('respawns in the room centre with full health after the respawn time', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 10, 5);
    spy.health = 1;
    kill(s, spy, 'fight', []);
    const ev: GameEvent[] = [];
    updateDead(s, spy, RULES.respawnTime - 0.5, ev);
    expect(spy.mode).toBe('dead');
    updateDead(s, spy, 0.5, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.room).toBe(4);
    expect(spy.x).toBe(RULES.roomW / 2);
    expect(spy.z).toBe(RULES.roomD / 2);
    expect(spy.health).toBe(RULES.health);
    expect(spy.deathCause).toBeNull();
    expect(ev).toEqual([{ type: 'respawn', spy: 0 }]);
  });
});

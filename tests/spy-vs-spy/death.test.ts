import { describe, expect, it } from 'vitest';
import { kill, respawnRoom, updateDead } from '../../src/games/spy-vs-spy/logic/death';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { makeRng } from '../../src/shared/rng';
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

  it('clears the map, a placement and the Trapulator press, but keeps the trap in hand', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.mapOpen = true;
    spy.trapPress = 0.7;
    spy.selected = 'bomba';
    spy.placing = { trap: 'bomba', target: { on: 'furniture', furniture: 0 }, timer: 0.2 };
    spy.refuseTimer = 0.3;
    kill(s, spy, 'pistole', []);
    expect(spy.mapOpen).toBe(false);
    expect(spy.trapPress).toBeNull();
    expect(spy.placing).toBeNull();
    expect(spy.refuseTimer).toBe(0);
    expect(spy.selected).toBe('bomba');
    expect(spy.stock.bomba).toBe(OPEN_RULES.trapStockPerSpy.bomba);
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
  it('respawns with full health after the respawn time, at the centre of another room (round 5 §2)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 10, 5);
    spy.health = 1;
    kill(s, spy, 'fight', []);
    const ev: GameEvent[] = [];
    updateDead(s, spy, RULES.respawnTime - 0.5, ev);
    expect(spy.mode).toBe('dead');
    expect(spy.room).toBe(4); // the death animation plays where he died
    s.tick = 77;
    updateDead(s, spy, 0.5, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.room).not.toBe(4);
    expect(spy.x).toBe(RULES.roomW / 2);
    expect(spy.z).toBe(RULES.roomD / 2);
    expect(spy.enteredAt).toBe(77);
    expect(spy.visited[spy.room]).toBe(true);
    expect(spy.health).toBe(RULES.health);
    expect(spy.deathCause).toBeNull();
    expect(ev).toEqual([{ type: 'respawn', spy: 0 }]);
  });
});

describe('respawnRoom (round 5 §2)', () => {
  it("never picks the room of death, the opponent's room or the exit room", () => {
    const rooms = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = openGame();
      s.rng = makeRng(seed);
      place(s, 1, 5, 100, 20);
      const room = respawnRoom(s, s.spies[0], 4);
      expect([4, 5, 2]).not.toContain(room);
      rooms.add(room);
    }
    // spread over all the others: 0, 1, 3, 6, 7, 8
    expect([...rooms].sort()).toEqual([0, 1, 3, 6, 7, 8]);
  });

  it('is decided by the gameplay RNG, deterministically', () => {
    const a = openGame();
    const b = openGame();
    expect(respawnRoom(a, a.spies[0], 4)).toBe(respawnRoom(b, b.spies[0], 4));
    expect(a.rng).toEqual(b.rng);
  });

  it("falls back to any room but the opponent's when nothing else is left", () => {
    const s = createGame(1, 1);
    // a hypothetical 1×3 corridor: death room 0, opponent in 1, exit in 2
    s.rooms = s.rooms.slice(0, 3);
    s.rooms[2].exit = 'E';
    for (const r of s.rooms) if (r.id !== 2) r.exit = null;
    place(s, 1, 1, 100, 20);
    for (let seed = 1; seed <= 20; seed++) {
      s.rng = makeRng(seed);
      expect([0, 2]).toContain(respawnRoom(s, s.spies[0], 0));
    }
  });
});

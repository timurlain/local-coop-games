import { describe, expect, it } from 'vitest';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { EXIT_KEY, doorKey, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { input, kufrik, openGame, place, remedy, secret } from './fixtures';

const TICK = 1 / 60;

describe('walking', () => {
  it('moves by speed × dt and turns to face the direction', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    updateMovement(s, spy, input({ moveX: -1, moveY: 1 }), 0.5, []);
    expect(spy.x).toBe(100 - RULES.speedX * 0.5);
    expect(spy.z).toBe(20 + RULES.speedZ * 0.5);
    expect(spy.facing).toBe(-1);
  });

  it('is clamped to the floor', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 50, 5);
    updateMovement(s, spy, input({ moveX: -1, moveY: -1 }), 5, []);
    expect(spy.x).toBe(0);
    expect(spy.z).toBe(0);
    expect(spy.room).toBe(4); // (0,0) is a corner, not a door
  });
});

describe('doors', () => {
  it('goes north through the back-wall door into the front of the next room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.room).toBe(1);
    expect(spy.x).toBe(RULES.roomW / 2);
    expect(spy.z).toBe(RULES.roomD - 1);
    expect(spy.visited[1]).toBe(true);
    expect(ev).toEqual([{ type: 'door', spy: 0 }]);
  });

  it('goes east and south', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 200, 20);
    updateMovement(s, spy, input({ moveX: 1 }), TICK, []);
    expect(spy.room).toBe(5);
    expect(spy.x).toBe(1);
    place(s, 0, 4, 100, 40);
    updateMovement(s, spy, input({ moveY: 1 }), TICK, []);
    expect(spy.room).toBe(7);
    expect(spy.z).toBe(1);
  });

  it('does not pass a wall without a door', () => {
    const s = openGame();
    s.rooms[4].doors.N = false;
    s.rooms[1].doors.S = false;
    const spy = place(s, 0, 4, 100, 0);
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    expect(spy.room).toBe(4);
  });

  it('a door trap kills and the spy stays in the room', () => {
    const s = openGame();
    s.doorTraps[doorKey(4, 1)] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    expect(spy.room).toBe(4);
    expect(spy.mode).toBe('dead');
    expect(s.doorTraps[doorKey(4, 1)]).toBeUndefined();
  });

  it('the matching remedy disarms the door trap and the spy walks through', () => {
    const s = openGame();
    s.doorTraps[doorKey(4, 1)] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = remedy('nuzky');
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    expect(spy.room).toBe(1);
    expect(spy.hand).toBeNull();
  });
});

describe('meeting: entering a room (spec §3)', () => {
  it('drops the hand (secret) into the room when entering the active opponent', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20); // opponent already active in room 1
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.room).toBe(1);
    expect(spy.hand).toBeNull();
    const holder = s.furniture.find((f) => f.room === 1 && f.hidden?.kind === 'secret');
    expect(holder).toBeDefined();
    expect(ev).toContainEqual({ type: 'dropped', spy: 0, thing: secret('pas'), furniture: holder!.id });
  });

  it('clears an armed trap without spending its stock', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, 100, 0);
    spy.armed = 'bomba';
    const stockBefore = spy.stock.bomba;
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    expect(spy.armed).toBeNull();
    expect(spy.stock.bomba).toBe(stockBefore);
  });

  it('loses a held remedy with nothing to refund and furniture null', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = remedy('voda');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.hand).toBeNull();
    expect(ev).toContainEqual({ type: 'dropped', spy: 0, thing: remedy('voda'), furniture: null });
  });

  it('emits dropped with a null thing when entering empty-handed', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, 100, 0);
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(ev).toContainEqual({ type: 'dropped', spy: 0, thing: null, furniture: null });
  });

  it('does not drop when entering an empty room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('does not drop when entering a room with a dead opponent', () => {
    const s = openGame();
    const other = place(s, 1, 1, 100, 20);
    other.mode = 'dead';
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('does not drop when entering a room with an out opponent', () => {
    const s = openGame();
    const other = place(s, 1, 1, 100, 20);
    other.mode = 'out';
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = secret('pas');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('re-hides a kufrik into a free furniture in the same room, keeping only sound/animation logic external', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, 100, 0);
    spy.hand = kufrik('pas', 'klic');
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    const holders = s.furniture.filter((f) => f.hidden !== null);
    expect(holders).toHaveLength(1);
    expect(holders[0].room).toBe(1);
    expect(holders[0].hidden).toEqual(kufrik('pas', 'klic'));
  });
});

describe('exit', () => {
  it('stays locked without the full kufrik and says so once per second', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.room).toBe(2);
    expect(ev).toEqual([{ type: 'locked', spy: 0 }]);
    expect(spy.lockedMsg).toBe(RULES.lockedMsgTime);
  });

  it('lets the spy escape with all four secrets in the kufrik', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('escaped');
    expect(ev).toEqual([{ type: 'escaped', spy: 0 }]);
  });

  it('a trapped exit still kills an escaping spy', () => {
    const s = openGame();
    s.doorTraps[EXIT_KEY] = { kind: 'elektrina', owner: 1 };
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    updateMovement(s, spy, input({ moveX: 1 }), TICK, []);
    expect(spy.mode).toBe('dead');
  });
});

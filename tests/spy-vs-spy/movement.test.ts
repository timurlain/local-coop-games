import { describe, expect, it } from 'vitest';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { doorKey, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { input, kufrik, openDoor, openGame, place } from './fixtures';

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
  it('goes north through the back-wall door into the front of the next room, once open', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    openDoor(s, 0, 'N');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.room).toBe(1);
    expect(spy.x).toBe(RULES.roomW / 2);
    expect(spy.z).toBe(RULES.roomD - 1);
    expect(spy.visited[1]).toBe(true);
    expect(ev).toEqual([{ type: 'door', spy: 0 }]);
  });

  it('goes east and south, once each door is open', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 200, 20);
    openDoor(s, 0, 'E');
    updateMovement(s, spy, input({ moveX: 1 }), TICK, []);
    expect(spy.room).toBe(5);
    expect(spy.x).toBe(1);
    place(s, 0, 4, 100, 40);
    openDoor(s, 0, 'S');
    updateMovement(s, spy, input({ moveY: 1 }), TICK, []);
    expect(spy.room).toBe(7);
    expect(spy.z).toBe(1);
  });

  it('does not pass a wall without a door', () => {
    const s = openGame();
    s.rooms[4].doors.N = false;
    s.rooms[1].doors.S = false;
    const spy = place(s, 0, 4, 100, 0);
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    expect(spy.room).toBe(4);
    expect(ev).toEqual([]); // a wall never bumps — only a real, closed door does (spec §5)
  });

  it('a closed door blocks the pass and bumps once per push, not every tick held', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    spy.prev = input({ moveY: -1 });
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev); // still held: no repeat
    expect(spy.room).toBe(4);
    expect(ev).toEqual([{ type: 'bump', spy: 0 }]);
  });

  it('bumps again after releasing and pushing again', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev);
    spy.prev = input(); // released
    updateMovement(s, spy, input({ moveY: -1 }), TICK, ev); // pressed again: a fresh push
    expect(ev).toEqual([{ type: 'bump', spy: 0 }, { type: 'bump', spy: 0 }]);
  });

  it('a door trap does not trigger when passing an already-open door (spec §5: opening only)', () => {
    const s = openGame();
    s.doorTraps[doorKey(4, 1)] = { kind: 'pistole', owner: 1 };
    const spy = place(s, 0, 4, 100, 0);
    openDoor(s, 0, 'N');
    updateMovement(s, spy, input({ moveY: -1 }), TICK, []);
    expect(spy.room).toBe(1);
    expect(spy.mode).toBe('normal');
    expect(s.doorTraps[doorKey(4, 1)]).toEqual({ kind: 'pistole', owner: 1 });
  });
});

// Entering-drop behaviour (spec §3) moved out of `updateMovement` (it now only returns whether a
// door was passed) and is judged by `step` once both spies have moved this tick — see
// tests/spy-vs-spy/step.test.ts, describe('meeting: entering is judged at the end of the tick').

describe('exit', () => {
  it('stays locked without the full kufrik and says so once per second (once open)', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    openDoor(s, 0, 'E');
    spy.hand = kufrik('pas', 'klic', 'penize');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.room).toBe(2);
    expect(ev).toEqual([{ type: 'locked', spy: 0 }]);
    expect(spy.lockedMsg).toBe(RULES.lockedMsgTime);
  });

  it('lets the spy escape with all four secrets in the kufrik, once the exit is open', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    openDoor(s, 0, 'E');
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('escaped');
    expect(ev).toEqual([{ type: 'escaped', spy: 0 }]);
  });

  it('a closed exit just bumps, even with the full kufrik', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('normal');
    expect(ev).toEqual([{ type: 'bump', spy: 0 }]);
  });
});

import { describe, expect, it } from 'vitest';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { EXIT_KEY, doorKey, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { input, kufrik, openGame, place, remedy } from './fixtures';

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

// Entering-drop behaviour (spec §3) moved out of `updateMovement` (it now only returns whether
// a door was passed) and is judged by `step` once both spies have moved this tick — see
// tests/spy-vs-spy/step.test.ts, describe('meeting: entering is judged at the end of the tick').
// The unit tests that used to live here (drops a secret/remedy/kufřík/nothing on entering, clears
// an armed trap, and the three "does not drop" cases for an empty/dead-opponent/out-opponent
// room) are superseded by that describe block plus the existing movement-only "does not pass a
// wall" / door-trap tests above; asserting them again via `updateMovement` alone no longer
// exercises real behaviour, since `updateMovement` no longer drops anything by itself.

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

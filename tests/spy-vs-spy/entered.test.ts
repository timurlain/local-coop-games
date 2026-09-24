import { describe, expect, it } from 'vitest';
import { kill, updateDead } from '../../src/games/spy-vs-spy/logic/death';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { input, openDoor, openGame, place, run } from './fixtures';

describe('enteredAt (spec §2)', () => {
  it('is the same for both spies at the start of a match', () => {
    const s = createGame(42, 3);
    expect(s.spies[0].enteredAt).toBe(s.tick);
    expect(s.spies[1].enteredAt).toBe(s.spies[0].enteredAt);
  });

  it('is set to the current tick when a spy passes a door into a new room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    s.tick = 77;
    openDoor(s, 0, 'N');
    updateMovement(s, spy, input({ moveY: -1 }), 1 / 60, []);
    expect(spy.room).toBe(1);
    expect(spy.enteredAt).toBe(77);
  });

  it('is not touched by walking inside a room or by bumping a closed door', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    spy.enteredAt = 5;
    s.tick = 90;
    updateMovement(s, spy, input({ moveY: -1 }), 1 / 60, []); // door closed: bump
    updateMovement(s, spy, input({ moveX: 1 }), 1 / 60, []);
    expect(spy.room).toBe(4);
    expect(spy.enteredAt).toBe(5);
  });

  it('is set by step on the tick of the pass', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 0);
    openDoor(s, 0, 'N');
    step(s, [input({ moveY: -1 }), input()], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.enteredAt).toBe(s.tick);
  });

  it('is set to the current tick on respawn', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 10, 5);
    spy.enteredAt = 3;
    kill(s, spy, 'bomba', []);
    s.tick = 500;
    const ev: GameEvent[] = [];
    updateDead(s, spy, RULES.respawnTime, ev);
    expect(spy.mode).toBe('normal');
    expect(spy.enteredAt).toBe(500);
  });

  it('respawning through step stamps the tick of the respawn', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 10, 5);
    kill(s, spy, 'bomba', []);
    run(s, [input(), input()], RULES.respawnTime + 0.1);
    expect(spy.mode).toBe('normal');
    expect(spy.enteredAt).toBeGreaterThan(0);
    expect(spy.enteredAt).toBeLessThanOrEqual(s.tick);
  });
});

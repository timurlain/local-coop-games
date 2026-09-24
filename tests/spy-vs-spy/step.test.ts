import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { atFurniture, firstFurniture, input, kufrik, openGame, place, run, secret } from './fixtures';

const IDLE = input();

describe('clock', () => {
  it('runs down while playing', () => {
    const s = openGame();
    run(s, [IDLE, IDLE], 1, 0.25);
    expect(s.spies[0].clock).toBe(RULES.defaultClock - 1);
  });

  it('times a spy out, drops the hand item, and the other keeps playing', () => {
    const s = openGame();
    s.spies[0].clock = 0.1;
    s.spies[0].hand = kufrik('pas');
    const ev = run(s, [IDLE, IDLE], 0.25, 0.25);
    expect(s.spies[0].mode).toBe('out');
    expect(s.spies[0].hand).toBeNull();
    expect(s.furniture.some((f) => f.hidden?.kind === 'kufrik')).toBe(true);
    expect(ev).toContainEqual({ type: 'timeout', spy: 0 });
    expect(s.result).toBeNull();
  });

  it('declares a draw when both clocks run out', () => {
    const s = openGame();
    s.spies[0].clock = 0.1;
    s.spies[1].clock = 0.1;
    const ev = run(s, [IDLE, IDLE], 0.25, 0.25);
    expect(s.result).toEqual({ kind: 'draw' });
    expect(ev).toContainEqual({ type: 'draw' });
  });
});

describe('result', () => {
  it('a spy escaping wins and the game stops', () => {
    const s = openGame();
    const spy = place(s, 1, 2, 200, 20);
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    step(s, [IDLE, input({ moveX: 1 })], 1 / 60);
    expect(s.result).toEqual({ kind: 'win', winner: 1 });
    const clock = s.spies[0].clock;
    expect(step(s, [IDLE, IDLE], 1)).toEqual([]);
    expect(s.spies[0].clock).toBe(clock);
  });
});

describe('orchestration', () => {
  it('holding Akce searches only once', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    atFurniture(s, 0, f);
    const ev = run(s, [input({ action: true }), IDLE], 2);
    expect(ev.filter((e) => e.type === 'searchStart')).toHaveLength(1);
  });

  it('a tap searches and picks up the item', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('plany');
    atFurniture(s, 0, f);
    step(s, [input({ action: true }), IDLE], 1 / 60);
    run(s, [IDLE, IDLE], 1);
    expect(s.spies[0].hand).toEqual(secret('plany'));
  });

  it('the spy cannot walk while the Trapulator is open', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 0.5);
    expect(spy.x).toBe(100);
    expect(spy.menuOpen).toBe(true);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(spy.menuOpen).toBe(false);
  });

  it('a dead spy respawns after the respawn time', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    atFurniture(s, 0, f);
    step(s, [input({ action: true }), IDLE], 1 / 60);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(s.spies[0].mode).toBe('dead');
    const ev = run(s, [IDLE, IDLE], RULES.respawnTime + 0.1);
    expect(s.spies[0].mode).toBe('normal');
    expect(ev).toContainEqual({ type: 'respawn', spy: 0 });
  });

  it('counts down swing cooldown and locked message', () => {
    const s = openGame();
    s.spies[0].swingCooldown = 0.4;
    s.spies[0].lockedMsg = 1;
    run(s, [IDLE, IDLE], 0.5, 0.25);
    expect(s.spies[0].swingCooldown).toBe(0);
    expect(s.spies[0].lockedMsg).toBe(0.5);
  });

  it('time bombs go off through step', () => {
    const s = openGame();
    place(s, 1, 4, 100, 20);
    s.timeBombs.push({ room: 4, x: 100, z: 20, fuse: 0.5, owner: 0 });
    run(s, [IDLE, IDLE], 0.5, 0.25);
    expect(s.spies[1].mode).toBe('dead');
  });
});

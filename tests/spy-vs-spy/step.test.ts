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

  it('releasing the Trapulator button closes the map', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    spy.menuCursor = 5; // MENU_MAP
    step(s, [input({ trap: true, action: true }), IDLE], 1 / 60);
    expect(spy.mapOpen).toBe(true);
    step(s, [IDLE, IDLE], 1 / 60); // release the Trapulator button
    expect(spy.mapOpen).toBe(false);
  });

  it('death closes the map', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const spy = atFurniture(s, 0, f);
    spy.mapOpen = true;
    step(s, [input({ action: true }), IDLE], 1 / 60);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(spy.mode).toBe('dead');
    expect(spy.mapOpen).toBe(false);
  });

  it('timeout closes the map', () => {
    const s = openGame();
    s.spies[0].clock = 0.1;
    s.spies[0].mapOpen = true;
    run(s, [IDLE, IDLE], 0.25, 0.25);
    expect(s.spies[0].mode).toBe('out');
    expect(s.spies[0].mapOpen).toBe(false);
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

  it('a searching spy cannot keep a stale block from before the search started', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy0 = atFurniture(s, 0, f);
    spy0.blocking = true; // stale flag from an earlier moment, before the opponent left
    step(s, [input({ action: true }), IDLE], 1 / 60); // press: starts the hold (spy 1 is far away in room 8)
    step(s, [input({ action: true }), IDLE], RULES.hideHold); // holds long enough; empty hand falls back to a search
    expect(spy0.mode).toBe('searching');
    expect(spy0.blocking).toBe(false);
    // spy 1 steps into range and swings while spy 0 is searching
    place(s, 1, 0, f.x + 10, 0);
    const ev = step(s, [IDLE, input({ action: true })], 1 / 60);
    expect(ev).toContainEqual({ type: 'hit', spy: 0 });
    expect(ev).not.toContainEqual({ type: 'blocked', spy: 0 });
  });
});

describe('meeting: shared room (spec §3)', () => {
  it('ignores Trapulator input and keeps the menu closed while sharing a room', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 130, 20);
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 0.5);
    expect(spy.menuOpen).toBe(false);
    expect(spy.armed).toBeNull();
  });

  it('the map cannot be opened while sharing a room (spec §3, §5)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 130, 20);
    spy.menuCursor = 5; // MENU_MAP
    run(s, [input({ trap: true, action: true }), IDLE], 0.5);
    expect(spy.mapOpen).toBe(false);
  });

  it('Akce out of fight range does nothing while sharing a room: no search, hide or trap placement', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    place(s, 1, 4, f.x + RULES.fightRangeX + 1, 0); // same room, out of range
    const ev = run(s, [input({ action: true }), IDLE], RULES.hideHold + 0.1);
    expect(spy.mode).toBe('normal');
    expect(spy.holdTarget).toBeNull();
    expect(ev.filter((e) => e.type === 'searchStart' || e.type === 'hidden')).toHaveLength(0);
  });

  it('swings when in range even while sharing a room', () => {
    const s = openGame();
    place(s, 0, 4, 100, 20);
    place(s, 1, 4, 110, 20);
    const ev = step(s, [input({ action: true }), IDLE], 1 / 60);
    expect(ev).toContainEqual({ type: 'swing', spy: 0 });
  });

  it('a search already running completes even after the opponent walks in', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = secret('pas');
    const spy = atFurniture(s, 0, f); // spy 1 starts far away in room 8
    step(s, [input({ action: true }), IDLE], 1 / 60); // press: starts the hold
    step(s, [IDLE, IDLE], 1 / 60); // release: search starts
    expect(spy.mode).toBe('searching');
    place(s, 1, 0, f.x + 50, 20); // opponent walks into the room mid-search
    const ev = run(s, [IDLE, IDLE], RULES.searchTime + 0.1);
    expect(spy.mode).toBe('normal');
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: secret('pas') });
  });

  it('normal behaviour returns once the opponent leaves the room', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    const other = place(s, 1, 4, 100, 20);
    run(s, [input({ action: true }), IDLE], RULES.hideHold + 0.1);
    expect(spy.mode).toBe('normal'); // blocked while shared
    other.room = 7; // opponent leaves
    step(s, [IDLE, IDLE], 1 / 60); // release Akce so the next press is a fresh edge
    const ev = run(s, [input({ action: true }), IDLE], RULES.hideHold + 0.1);
    expect(ev.filter((e) => e.type === 'searchStart')).toHaveLength(1);
  });
});

describe('health recovery', () => {
  it('recovers health over time after a hit, via step', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.health = RULES.health - 2;
    spy.sinceHit = 0;
    run(s, [IDLE, IDLE], RULES.regenDelay + 0.01);
    expect(spy.health).toBe(RULES.health - 1);
  });

  it('resets sinceHit on respawn so recovery starts fresh', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    atFurniture(s, 0, f);
    step(s, [input({ action: true }), IDLE], 1 / 60);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(s.spies[0].mode).toBe('dead');
    // Step tick-by-tick and check right on the respawn tick, before further ticks grow sinceHit again.
    const dt = 1 / 60;
    for (let elapsed = 0; s.spies[0].mode === 'dead' && elapsed < RULES.respawnTime + 1; elapsed += dt) {
      step(s, [IDLE, IDLE], dt);
    }
    expect(s.spies[0].mode).toBe('normal');
    expect(s.spies[0].sinceHit).toBe(0);
    expect(s.spies[0].health).toBe(RULES.health);
  });
});

describe('fairness', () => {
  it('alternates processing order each tick so neither spy always wins a simultaneous trade', () => {
    function duel(burnIdleTick: boolean): ReturnType<typeof openGame> {
      const s = openGame();
      const a = place(s, 0, 4, 100, 20);
      const b = place(s, 1, 4, 110, 20);
      a.health = 1;
      b.health = 1;
      if (burnIdleTick) step(s, [IDLE, IDLE], 1 / 60);
      const swing = input({ action: true });
      step(s, [swing, swing], 1 / 60);
      return s;
    }
    const game1 = duel(false);
    const game2 = duel(true);
    const survivor1 = game1.spies[0].mode === 'dead' ? 1 : 0;
    const survivor2 = game2.spies[0].mode === 'dead' ? 1 : 0;
    expect(survivor1).not.toBe(survivor2);
  });
});

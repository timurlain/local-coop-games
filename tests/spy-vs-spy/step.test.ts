import { describe, expect, it } from 'vitest';
import { kill } from '../../src/games/spy-vs-spy/logic/death';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { OPEN_RULES, atFurniture, firstFurniture, input, kufrik, openDoor, openGame, place, remedy, run, secret, taken } from './fixtures';

const IDLE = input();

describe('clock', () => {
  it('runs down while playing', () => {
    const s = openGame();
    run(s, [IDLE, IDLE], 1, 0.25);
    expect(s.spies[0].clock).toBe(OPEN_RULES.clockSeconds - 1);
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
    openDoor(s, 1, 'E');
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    step(s, [IDLE, input({ moveX: 1 })], 1 / 60);
    expect(s.result).toEqual({ kind: 'win', winner: 1 });
    const clock = s.spies[0].clock;
    expect(step(s, [IDLE, IDLE], 1)).toEqual([]);
    expect(s.spies[0].clock).toBe(clock);
  });
});

describe('score (spec §7): step applies scoreDeltas after events', () => {
  it('a placed trap credits the placer\'s running score', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.selected = 'bomba';
    const ev = step(s, [input({ action: true }), IDLE], 1 / 60);
    ev.push(...run(s, [IDLE, IDLE], RULES.placeTime + 0.05));
    expect(ev).toContainEqual({ type: 'trapSet', spy: 0, trap: 'bomba' });
    expect(s.spies[0].score).toBe(30);
    expect(s.spies[1].score).toBe(0);
  });

  it('escaping credits the full win bonus, computed from the clock at the moment of escape', () => {
    const s = openGame();
    const spy = place(s, 1, 2, 200, 20);
    openDoor(s, 1, 'E');
    spy.hand = kufrik('pas', 'klic', 'penize', 'plany');
    const dt = 1 / 60;
    const clockAtEscape = Math.floor(s.spies[1].clock - dt);
    step(s, [IDLE, input({ moveX: 1 })], dt);
    expect(s.spies[1].score).toBe(1000 + 5 * clockAtEscape);
  });

  it('a steal on take credits the taker once the search resolves', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.hidden = { kind: 'secret', secret: 'klic', lastHolder: 1 };
    const spy = atFurniture(s, 0, f);
    step(s, [input({ action: true }), IDLE], 1 / 60); // press: hold starts
    step(s, [IDLE, IDLE], 1 / 60); // release: search starts
    run(s, [IDLE, IDLE], RULES.searchTime + 0.1);
    expect(spy.hand).toEqual(taken(secret('klic'), 0));
    expect(s.spies[0].score).toBe(60);
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
    expect(s.spies[0].hand).toEqual(taken(secret('plany'), 0));
  });

  it('the spy walks while the Trapulator is pressed, until the map opens (round 4 §1)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    run(s, [input({ trap: true, moveX: 1 }), IDLE], RULES.trapTapMax - 2 / 60);
    expect(spy.x).toBeGreaterThan(100);
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 3 / 60);
    expect(spy.mapOpen).toBe(true);
    const x = spy.x;
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 0.3);
    expect(spy.x).toBe(x);
  });

  it('releasing the Trapulator button closes the map', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    run(s, [input({ trap: true }), IDLE], RULES.trapTapMax + 1 / 60);
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

  it('counts down swing cooldown and the guard kick', () => {
    const s = openGame();
    s.spies[0].swingCooldown = 0.4;
    s.spies[0].kickTimer = 1;
    run(s, [IDLE, IDLE], 0.5, 0.25);
    expect(s.spies[0].swingCooldown).toBe(0);
    expect(s.spies[0].kickTimer).toBe(0.5);
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
    step(s, [input({ action: true }), IDLE], 1 / 60); // press starts the search immediately (spy 1 is far away in room 8)
    expect(spy0.mode).toBe('searching');
    expect(spy0.blocking).toBe(false);
    // spy 1 steps into range and swings while spy 0 is searching
    place(s, 1, 0, f.x + 10, 0);
    const ev = step(s, [IDLE, input({ action: true })], 1 / 60);
    ev.push(...run(s, [IDLE, IDLE], RULES.swingWindup + 0.05)); // the jab lands at the end of its wind-up
    expect(ev).toContainEqual({ type: 'hit', spy: 0 });
    expect(ev).not.toContainEqual({ type: 'blocked', spy: 0 });
  });
});

describe('meeting: shared room (spec §3)', () => {
  it('a Trapulator tap does not cycle the hand while sharing a room (play test 5)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 130, 20);
    step(s, [input({ trap: true }), IDLE], 1 / 60);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(spy.selected).toBeNull();
  });

  it('holding the Trapulator blocks and stands still in a shared room (play test 5)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 160, 20);
    run(s, [input({ trap: true, moveX: 1 }), IDLE], 0.3);
    expect(spy.blocking).toBe(true);
    expect(spy.x).toBe(100);
    expect(spy.mapOpen).toBe(false);
  });

  it('holding the Trapulator in a shared room never opens the map, and costs no clock (play test 5)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 160, 20);
    const clock = spy.clock;
    const ev1 = run(s, [input({ trap: true }), IDLE], 1.5);
    expect(ev1.filter((e) => e.type === 'mapOpened' || e.type === 'refused')).toEqual([]);
    // release and hold again: still nothing
    step(s, [IDLE, IDLE], 1 / 60);
    const ev2 = run(s, [input({ trap: true }), IDLE], 1);
    expect(ev2.filter((e) => e.type === 'mapOpened' || e.type === 'refused')).toEqual([]);
    expect(spy.mapOpen).toBe(false);
    expect(spy.clock).toBeCloseTo(clock - 2.5 - 1 / 60, 6);
  });

  it('the map cannot be opened while sharing a room (spec §3, §5)', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 20);
    place(s, 1, 4, 130, 20);
    run(s, [input({ trap: true }), IDLE], 1);
    expect(spy.mapOpen).toBe(false);
  });

  it('Akce out of fight range does nothing while sharing a room: no search, hide or trap placement', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    place(s, 1, 4, f.x + RULES.fightRangeX + 1, 0); // same room, out of range
    const ev = run(s, [input({ action: true }), IDLE], 0.1);
    expect(spy.mode).toBe('normal');
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
    step(s, [input({ action: true }), IDLE], 1 / 60); // press starts the search immediately
    expect(spy.mode).toBe('searching');
    place(s, 1, 0, f.x + 50, 20); // opponent walks into the room mid-search
    const ev = run(s, [IDLE, IDLE], RULES.searchTime + 0.1);
    expect(spy.mode).toBe('normal');
    expect(ev).toContainEqual({ type: 'found', spy: 0, thing: taken(secret('pas'), 0), furniture: f.id });
  });

  it('normal behaviour returns once the opponent leaves the room', () => {
    const s = openGame();
    const f = firstFurniture(s, 4);
    const spy = atFurniture(s, 0, f);
    const other = place(s, 1, 4, 100, 20);
    run(s, [input({ action: true }), IDLE], 0.1);
    expect(spy.mode).toBe('normal'); // blocked while shared
    other.room = 7; // opponent leaves
    step(s, [IDLE, IDLE], 1 / 60); // release Akce so the next press is a fresh edge
    const ev = run(s, [input({ action: true }), IDLE], 0.1);
    expect(ev.filter((e) => e.type === 'searchStart')).toHaveLength(1);
  });
});

describe('two attacks and ducking (spec §8)', () => {
  function duel() {
    const s = openGame();
    const a = place(s, 0, 4, 100, 20);
    const b = place(s, 1, 4, 110, 20);
    return { s, a, b };
  }

  it('Akce is a jab: 1 damage, only after the wind-up', () => {
    const { s, a, b } = duel();
    step(s, [input({ action: true }), IDLE], 1 / 60);
    expect(a.attack).toBe('jab');
    expect(b.health).toBe(RULES.health);
    const ev = run(s, [IDLE, IDLE], RULES.swingWindup + 0.02);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
    expect(b.health).toBe(RULES.health - 1);
  });

  it('Akce while holding up is a head bash: 2 damage after 0.3 s, through a block', () => {
    const { s, a, b } = duel();
    const block = input({ trap: true });
    step(s, [input({ action: true, moveY: -1 }), block], 1 / 60);
    expect(a.attack).toBe('bash');
    run(s, [IDLE, block], RULES.swingWindup + 0.02);
    expect(b.health).toBe(RULES.health);
    expect(b.blocking).toBe(true);
    run(s, [IDLE, block], RULES.bashWindup - RULES.swingWindup);
    expect(b.health).toBe(RULES.health - 2);
  });

  it('holding the Trapulator + down in a shared room ducks: no movement, and the head bash is stopped', () => {
    const { s, a, b } = duel();
    const duck = input({ trap: true, moveY: 1 });
    step(s, [input({ action: true, moveY: -1 }), duck], 1 / 60);
    const ev = run(s, [IDLE, duck], RULES.bashWindup + 0.05);
    expect(b.ducking).toBe(true);
    expect(b.z).toBe(20);
    expect(b.health).toBe(RULES.health);
    expect(ev).toContainEqual({ type: 'blocked', spy: 1, kind: 'bash' });
    expect(a.swingCooldown).toBeGreaterThan(0);
  });

  it('down alone in fight range walks instead of ducking (round 6 §1)', () => {
    const { s, b } = duel();
    const ev = run(s, [IDLE, input({ moveY: 1 })], 0.2);
    expect(b.ducking).toBe(false);
    expect(b.z).toBeGreaterThan(20);
    expect(ev).not.toContainEqual({ type: 'blocked', spy: 1 });
  });

  it('the Trapulator alone (without down) blocks and stops a jab (round 6 §1)', () => {
    const { s, b } = duel();
    step(s, [input({ action: true }), input({ trap: true })], 1 / 60);
    const ev = run(s, [IDLE, input({ trap: true })], RULES.swingWindup + 0.02);
    expect(b.blocking).toBe(true);
    expect(b.ducking).toBe(false);
    expect(b.health).toBe(RULES.health);
    expect(ev).toContainEqual({ type: 'blocked', spy: 1, kind: 'jab' });
  });

  it('the Trapulator + down is not a block, so a jab lands (round 6 §1)', () => {
    const { s, b } = duel();
    step(s, [input({ action: true }), input({ trap: true, moveY: 1 })], 1 / 60);
    const ev = run(s, [IDLE, input({ trap: true, moveY: 1 })], RULES.swingWindup + 0.02);
    expect(b.blocking).toBe(false);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
    expect(b.health).toBe(RULES.health - 1);
  });

  it('ducking does not stop a jab', () => {
    const { s, b } = duel();
    const duck = input({ trap: true, moveY: 1 });
    step(s, [input({ action: true }), duck], 1 / 60);
    run(s, [IDLE, duck], RULES.swingWindup + 0.05);
    expect(b.health).toBe(RULES.health - 1);
  });

  it('a ducking spy that stands up is hit by the bash', () => {
    const { s, b } = duel();
    step(s, [input({ action: true, moveY: -1 }), input({ trap: true, moveY: 1 })], 1 / 60);
    run(s, [IDLE, IDLE], RULES.bashWindup + 0.05);
    expect(b.ducking).toBe(false);
    expect(b.health).toBe(RULES.health - 2);
  });

  it('a bash landing this tick is dodged when the target starts ducking this same tick, even '
    + 'when the target is processed second in the alternating order (spec §8)', () => {
    const { s, a, b } = duel();
    // Force the order this tick to process the attacker (0) first, the target (1) second —
    // the case where a stance judged only after the attacker's turn would be too late.
    s.tick = 1;
    a.attack = 'bash';
    a.strikeIn = 0.001; // lands this tick
    const ev = step(s, [IDLE, input({ trap: true, moveY: 1 })], 1 / 60);
    expect(b.ducking).toBe(true);
    expect(b.health).toBe(RULES.health);
    expect(ev).toContainEqual({ type: 'blocked', spy: 1, kind: 'bash' });
  });

  it('holding down outside a shared room still walks towards the front', () => {
    const s = openGame();
    const spy = place(s, 0, 4, 100, 10);
    run(s, [input({ moveY: 1 }), IDLE], 0.2);
    expect(spy.ducking).toBe(false);
    expect(spy.z).toBeGreaterThan(10);
  });

  it('holding the Trapulator + down in a shared room with the opponent out of fight range walks towards the '
    + 'front and out the S door instead of ducking (L3 review)', () => {
    const { s, b } = duel();
    b.x = RULES.roomW - 5; // far from a in x: out of fight range even though sharing the room
    b.z = 10;
    openDoor(s, 1, 'S');
    const ev = run(s, [IDLE, input({ trap: true, moveY: 1 })], 1);
    expect(b.ducking).toBe(false);
    expect(b.z).toBeGreaterThan(10);
    expect(ev).not.toContainEqual({ type: 'blocked', spy: 1 });
  });

  it('a bash misses a far opponent holding down in the same room: they walk instead of ducking', () => {
    const { s, b } = duel();
    b.x = RULES.roomW - 5;
    b.z = 20;
    step(s, [input({ action: true, moveY: -1 }), input({ moveY: 1 })], 1 / 60);
    const ev = run(s, [IDLE, input({ moveY: 1 })], RULES.bashWindup + 0.05);
    expect(b.ducking).toBe(false);
    expect(ev).not.toContainEqual({ type: 'blocked', spy: 1 });
    expect(ev).not.toContainEqual({ type: 'hit', spy: 1 });
  });

  it('block (play test 5): holding the Trapulator in a shared room stands his ground, no movement', () => {
    const { s, b } = duel(); // a at 100, b at 110, sharing the room
    const block = input({ trap: true, moveX: 1 }); // still pushing a direction, but blocking wins
    const ev = run(s, [IDLE, block], 0.3);
    expect(b.blocking).toBe(true);
    expect(b.x).toBe(110); // stands his ground, doesn't walk off
    expect(ev.filter((e) => e.type === 'bump')).toHaveLength(0);
  });

  it('holding away from the opponent is now plain walking, not a block (play test 5)', () => {
    const { s, b } = duel(); // a at 100, b at 110, within fight range
    const away = input({ moveX: 1 }); // b holds away from a, without the Trapulator
    run(s, [IDLE, away], 0.3);
    expect(b.blocking).toBe(false);
    expect(b.x).toBeGreaterThan(110);
  });

  it('holding away from an opponent out of fight range just walks (round 4 §2)', () => {
    const { s, b } = duel();
    b.x = RULES.roomW - 5; // shares the room, but out of fight range
    const away = input({ moveX: 1 });
    run(s, [IDLE, away], 0.2);
    expect(b.blocking).toBe(false);
    expect(b.x).toBeGreaterThan(RULES.roomW - 5);
  });

  it('a spy swinging while holding down is not ducking', () => {
    const { s, a } = duel();
    step(s, [input({ action: true, moveY: 1 }), IDLE], 1 / 60);
    expect(a.attack).toBe('jab');
    expect(a.ducking).toBe(false);
  });

  it('the cooldown runs from the strike, not the press', () => {
    const { s, a } = duel();
    step(s, [input({ action: true, moveY: -1 }), IDLE], 1 / 60);
    run(s, [IDLE, IDLE], RULES.bashWindup + 1 / 60);
    expect(a.swingCooldown).toBeGreaterThan(RULES.swingCooldown - 0.05);
  });

  it('a spy killed during its wind-up never strikes', () => {
    const { s, a, b } = duel();
    b.health = 1;
    a.health = 1;
    step(s, [input({ action: true, moveY: -1 }), IDLE], 1 / 60); // slow bash
    step(s, [IDLE, input({ action: true })], 1 / 60); // quick jab answers
    run(s, [IDLE, IDLE], RULES.bashWindup + 0.05);
    expect(a.mode).toBe('dead');
    expect(b.mode).toBe('normal');
    expect(b.health).toBe(1);
  });
});

describe('meeting: carried things stay with the spy through a fight (round 6 play test)', () => {
  it('keeps hand and trap selection when passing the opponent through the same door in one tick', () => {
    const s = openGame();
    const a = place(s, 0, 4, RULES.roomW, RULES.roomD / 2);
    const b = place(s, 1, 5, 0, RULES.roomD / 2);
    openDoor(s, 0, 'E'); // shared key with room 5's W door
    a.hand = secret('klic');
    b.hand = secret('pas');
    const ev = step(s, [input({ moveX: 1 }), input({ moveX: -1 })], 1 / 60);
    expect(a.room).toBe(5);
    expect(b.room).toBe(4);
    expect(a.hand).toEqual(secret('klic'));
    expect(b.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('keeps both hands when both spies enter the same empty room from different doors in one tick', () => {
    const s = openGame();
    const a = place(s, 0, 1, RULES.roomW / 2, RULES.roomD);
    const b = place(s, 1, 3, RULES.roomW, RULES.roomD / 2);
    openDoor(s, 0, 'S');
    openDoor(s, 1, 'E');
    a.hand = secret('klic');
    b.hand = secret('pas');
    const ev = step(s, [input({ moveY: 1 }), input({ moveX: 1 })], 1 / 60);
    expect(a.room).toBe(4);
    expect(b.room).toBe(4);
    expect(a.hand).toEqual(secret('klic'));
    expect(b.hand).toEqual(secret('pas'));
    expect(ev.filter((e) => e.type === 'dropped')).toHaveLength(0);
  });

  it('keeps the hand and selected trap when entering a room where the opponent already stands', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = secret('pas');
    spy.selected = 'bomba';
    const stockBefore = spy.stock.bomba;
    const ev = step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    expect(spy.selected).toBe('bomba');
    expect(spy.stock.bomba).toBe(stockBefore);
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('keeps a carried remedy through the meeting', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = remedy('voda');
    const ev = step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(remedy('voda'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('keeps a carried kufřík, still findable in hand, not re-hidden in furniture', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = kufrik('pas', 'klic');
    const ev = step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(kufrik('pas', 'klic'));
    expect(s.furniture.every((f) => f.hidden === null)).toBe(true);
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('the hand is still there once the opponent has left the shared room', () => {
    const s = openGame();
    const other = place(s, 1, 1, RULES.roomW, RULES.roomD / 2);
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = secret('pas');
    step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    // the opponent walks away to another room, ending the meeting
    openDoor(s, 1, 'E');
    const ev = step(s, [IDLE, input({ moveX: 1 })], 1 / 60);
    expect(other.room).not.toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('does not drop when entering a room with a dead opponent', () => {
    const s = openGame();
    const other = place(s, 1, 1, 100, 20);
    other.mode = 'dead';
    other.modeTimer = RULES.respawnTime;
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = secret('pas');
    const ev = step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('does not drop when entering a room with an out opponent', () => {
    const s = openGame();
    const other = place(s, 1, 1, 100, 20);
    other.mode = 'out';
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = secret('pas');
    const ev = step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('does not drop a respawning spy: the opponent sitting in the room of death sends it elsewhere', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    const spy = atFurniture(s, 0, f);
    step(s, [input({ action: true }), IDLE], 1 / 60);
    step(s, [IDLE, IDLE], 1 / 60);
    expect(spy.mode).toBe('dead');
    place(s, 1, 0, 100, 20); // opponent moves into spy 0's room while it is dead
    const dt = 1 / 60;
    let ev: ReturnType<typeof step> = [];
    for (let elapsed = 0; spy.mode === 'dead' && elapsed < RULES.respawnTime + 1; elapsed += dt) {
      ev = step(s, [IDLE, IDLE], dt);
    }
    expect(spy.mode).toBe('normal');
    expect(spy.room).not.toBe(0);
    expect(ev).toContainEqual({ type: 'respawn', spy: 0 });
    expect(ev).not.toContainEqual(expect.objectContaining({ type: 'dropped' }));
  });

  it('death in a fight still re-hides the carried secret in furniture with a dropped event', () => {
    const s = openGame();
    place(s, 1, 1, 100, 20);
    const spy = place(s, 0, 4, RULES.roomW / 2, 0);
    openDoor(s, 0, 'N');
    spy.hand = secret('pas');
    step(s, [input({ moveY: -1 }), IDLE], 1 / 60);
    expect(spy.room).toBe(1);
    expect(spy.hand).toEqual(secret('pas'));
    // still sharing the room (a fight), the opponent lands the killing strike
    const ev: GameEvent[] = [];
    kill(s, spy, 'fight', ev, 1);
    expect(spy.mode).toBe('dead');
    expect(spy.hand).toBeNull();
    const holders = s.furniture.filter((f) => f.hidden !== null);
    expect(holders).toHaveLength(1);
    expect(holders[0].hidden).toEqual(secret('pas'));
    expect(ev).toContainEqual({ type: 'dropped', spy: 0, thing: secret('pas'), furniture: holders[0].id });
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
      run(s, [IDLE, IDLE], RULES.swingWindup + 0.05); // both strikes land on the same tick
      return s;
    }
    const game1 = duel(false);
    const game2 = duel(true);
    const survivor1 = game1.spies[0].mode === 'dead' ? 1 : 0;
    const survivor2 = game2.spies[0].mode === 'dead' ? 1 : 0;
    expect(survivor1).not.toBe(survivor2);
  });
});

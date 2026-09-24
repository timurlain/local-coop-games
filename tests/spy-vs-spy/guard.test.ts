import { describe, expect, it } from 'vitest';
import { kill } from '../../src/games/spy-vs-spy/logic/death';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { EXIT_KEY, type Dir, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { spawnEffects, effectsIn, type EffectQueue } from '../../src/games/spy-vs-spy/render/effects';
import { GUARD_FRAMES, GUARD_PALETTE, guardFrame, guardSpot } from '../../src/games/spy-vs-spy/render/guard';
import { tumble } from '../../src/games/spy-vs-spy/render/spy';
import { input, kufrik, openDoor, openGame, place, run } from './fixtures';

const TICK = 1 / 60;
const IDLE = input();
const FULL = () => kufrik('klic', 'penize', 'pas', 'plany');
const OPENED = RULES.doorOpenTime + TICK * 3;

/** openGame with the exit moved to room 2's `dir` wall; spy 0 standing at it, pushing through. */
function atExit(dir: Dir) {
  const s = openGame();
  s.rooms[2].exit = dir;
  s.rooms[2].doors[dir] = false;
  const spot = { N: [100, 0], S: [100, RULES.roomD], E: [RULES.roomW, 20], W: [0, 20] }[dir];
  const spy = place(s, 0, 2, spot[0], spot[1]);
  openDoor(s, 0, dir);
  const push = { N: { moveY: -1 }, S: { moveY: 1 }, E: { moveX: 1 }, W: { moveX: -1 } }[dir] as Partial<ReturnType<typeof input>>;
  return { s, spy, push: input(push) };
}

describe('the airport guard (spec §9)', () => {
  it('kicks a spy without the full kufrik 30 units back into the room, with a bounced event', () => {
    const { s, spy, push } = atExit('E');
    spy.hand = kufrik('pas', 'klic', 'penize');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, push, TICK, ev);
    expect(ev).toEqual([{ type: 'bounced', spy: 0 }]);
    expect(spy.x).toBe(RULES.roomW - RULES.guardKick);
    expect(spy.z).toBe(20);
    expect(spy.room).toBe(2);
    expect(spy.mode).toBe('normal');
    expect(spy.kickTimer).toBe(RULES.guardKickTime);
    expect(RULES.guardKick).toBe(30);
    expect(RULES.guardKickTime).toBe(0.8);
  });

  it('kicks back away from every wall, clamped to the floor', () => {
    const cases: [Dir, number, number][] = [
      ['W', RULES.guardKick, 20],
      ['N', 100, RULES.guardKick],
      ['S', 100, RULES.roomD - RULES.guardKick],
    ];
    for (const [dir, x, z] of cases) {
      const { s, spy, push } = atExit(dir);
      updateMovement(s, spy, push, TICK, []);
      expect([spy.x, spy.z], dir).toEqual([x, z]);
    }
  });

  it('costs no time', () => {
    const { s, spy, push } = atExit('E');
    const clock = spy.clock;
    const ev = step(s, [push, IDLE], TICK);
    expect(ev).toContainEqual({ type: 'bounced', spy: 0 });
    expect(spy.clock).toBeCloseTo(clock - TICK, 9);
  });

  it('leaves the spy immobile for 0.8 s, then it walks again', () => {
    const { s, spy, push } = atExit('E');
    step(s, [push, IDLE], TICK);
    const x = spy.x;
    run(s, [input({ moveX: -1, action: true, trap: true }), IDLE], RULES.guardKickTime - TICK * 3);
    expect(spy.x).toBe(x);
    expect(spy.menuOpen).toBe(false);
    expect(spy.kickTimer).toBeGreaterThan(0);
    run(s, [input({ moveX: -1 }), IDLE], TICK * 10);
    expect(spy.kickTimer).toBe(0);
    expect(spy.x).toBeLessThan(x);
  });

  it('does not block or duck while tumbling', () => {
    const { s, spy, push } = atExit('E');
    step(s, [push, IDLE], TICK);
    place(s, 1, 2, spy.x - 10, 20);
    step(s, [input({ moveX: 1 }), IDLE], TICK); // away from the opponent = block, if free
    expect(spy.blocking).toBe(false);
    step(s, [input({ moveY: 1 }), IDLE], TICK);
    expect(spy.ducking).toBe(false);
  });

  it('a death or running out of time ends the kick', () => {
    const a = atExit('E');
    step(a.s, [a.push, IDLE], TICK);
    kill(a.s, a.spy, 'bomba', []);
    expect(a.spy.kickTimer).toBe(0);

    const b = atExit('E');
    step(b.s, [b.push, IDLE], TICK);
    b.spy.clock = TICK / 2;
    const ev = step(b.s, [IDLE, IDLE], TICK);
    expect(ev).toContainEqual({ type: 'timeout', spy: 0 });
    expect(b.spy.kickTimer).toBe(0);
  });

  it('never kicks a spy with the full kufrik: it escapes', () => {
    const { s, spy, push } = atExit('E');
    spy.hand = FULL();
    const ev = step(s, [push, IDLE], TICK);
    expect(ev).toContainEqual({ type: 'escaped', spy: 0 });
    expect(ev.some((e) => e.type === 'bounced')).toBe(false);
    expect(spy.mode).toBe('escaped');
  });

  it('only kicks through an open exit: Akce opens it, then the push is kicked back', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    const bump = step(s, [input({ moveX: 1 }), IDLE], TICK);
    expect(bump).toEqual([{ type: 'bump', spy: 0 }]);
    run(s, [input({ action: true }), IDLE], OPENED);
    expect(s.doorOpen[EXIT_KEY]?.phase).toBe('open');
    const ev = step(s, [input({ moveX: 1 }), IDLE], TICK);
    expect(ev).toContainEqual({ type: 'bounced', spy: 0 });
    expect(spy.x).toBe(RULES.roomW - RULES.guardKick);
  });

  it('no longer says „Zamčeno": there is no locked event', () => {
    const { s, push } = atExit('E');
    const ev = run(s, [push, IDLE], 2);
    expect(ev.some((e) => (e.type as string) === 'locked')).toBe(false);
  });

  it('never appears at a hidden airport: it is a wall', () => {
    const { s, spy, push } = atExit('E');
    s.hideAirport = true;
    spy.x = 190;
    const ev = run(s, [push, IDLE], 1);
    expect(ev.some((e) => e.type === 'bounced')).toBe(false);
    expect(spy.x).toBe(RULES.roomW);
    expect(spy.kickTimer).toBe(0);
  });
});

describe('guard rendering helpers', () => {
  it('a bounced event spawns a guard effect in the exit room lasting the kick', () => {
    const { s, spy, push } = atExit('E');
    const ev = step(s, [push, IDLE], TICK);
    const q: EffectQueue = [];
    spawnEffects(q, s, ev, 10);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: 'guard', spy: 0, room: 2, duration: RULES.guardKickTime });
    expect(effectsIn(q, 2, 10.5)).toHaveLength(1);
    expect(effectsIn(q, 2, 10 + RULES.guardKickTime + 0.01)).toHaveLength(0);
    expect(spy.room).toBe(2);
  });

  it('raises the boot early in the kick and stands for the rest', () => {
    expect(guardFrame(0)).toBe('stand');
    expect(guardFrame(0.3)).toBe('kick');
    expect(guardFrame(0.9)).toBe('stand');
  });

  it('stands in the doorway facing into the room', () => {
    expect(guardSpot('W', 100)).toMatchObject({ flip: false });
    expect(guardSpot('E', 100)).toMatchObject({ flip: true });
    const w = guardSpot('W', 100);
    const e = guardSpot('E', 100);
    expect(w.x).toBeLessThan(e.x);
    expect(guardSpot('N', 40).flip).toBe(true); // spy to the left of the door: kick left
    expect(guardSpot('N', 160).flip).toBe(false);
  });

  it('guard frames are rectangular and use only palette colours', () => {
    const h = GUARD_FRAMES.stand.length;
    const w = GUARD_FRAMES.stand[0].length;
    for (const rows of Object.values(GUARD_FRAMES)) {
      expect(rows).toHaveLength(h);
      for (const row of rows) {
        expect(row).toHaveLength(w);
        for (const ch of row) if (ch !== '.') expect(GUARD_PALETTE[ch], ch).toBeDefined();
      }
    }
  });

  it('tumbles back from the door over the first part of the kick, then lands', () => {
    const start = tumble(0);
    expect(start.back).toBe(1);
    expect(start.angle).toBe(0);
    const mid = tumble(RULES.guardKickTime * 0.25);
    expect(mid.back).toBeGreaterThan(0);
    expect(mid.back).toBeLessThan(1);
    expect(Math.abs(mid.angle)).toBeGreaterThan(0);
    const end = tumble(RULES.guardKickTime);
    expect(end.back).toBe(0);
    expect(end.angle).toBe(0);
  });
});

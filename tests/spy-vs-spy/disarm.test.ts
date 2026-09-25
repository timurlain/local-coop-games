import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import {
  DISARM_TIME, effectPose, effectsIn, spawnEffects, type EffectQueue,
} from '../../src/games/spy-vs-spy/render/effects';
import { atFurniture, firstFurniture, openGame, place, remedy, run, input } from './fixtures';

const W = RULES.roomW;

describe('disarm effect (round 4 §3)', () => {
  it.each([
    ['bomba', 'voda', 'placeTrap'],
    ['pruzina', 'kleste', 'placeTrap'],
  ] as const)('%s × %s: at the furniture, pose %s, 0.8 s', (trap, cure, pose) => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    const q: EffectQueue = [];
    const ev: GameEvent = { type: 'disarmed', spy: 0, trap, remedy: cure };
    spawnEffects(q, s, [ev], 2);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      kind: 'disarm', spy: 0, room: 0, x: spy.x, z: spy.z, start: 2, duration: DISARM_TIME,
      trap, remedy: cure, furniture: f.id, door: null,
    });
    expect(effectPose(q, 0, 2.1)).toBe(pose);
    expect(effectPose(q, 0, 2 + DISARM_TIME)).toBeNull();
  });

  it.each([
    ['elektrina', 'destnik', 'liftFind'],
    ['pistole', 'nuzky', 'liftFind'],
  ] as const)('%s × %s: at the door, pose %s, 0.8 s', (trap, cure, pose) => {
    const s = openGame();
    const spy = place(s, 0, 4, W / 2, 0);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'disarmed', spy: 0, trap, remedy: cure }], 0);
    expect(q[0]).toMatchObject({
      kind: 'disarm', room: 4, x: spy.x, z: spy.z, duration: DISARM_TIME, trap, remedy: cure, door: 'N', furniture: null,
    });
    expect(effectPose(q, 0, 0.4)).toBe(pose);
  });

  it('lasts 0.8 s and is visible in that room only (to anyone viewing it)', () => {
    expect(DISARM_TIME).toBe(0.8);
    const s = openGame();
    place(s, 0, 4, 0, RULES.roomD / 2);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'disarmed', spy: 0, trap: 'elektrina', remedy: 'destnik' }], 0);
    expect(q[0].door).toBe('W');
    expect(effectsIn(q, 4, 0.79).map((e) => e.kind)).toEqual(['disarm']);
    expect(effectsIn(q, 3, 0.4)).toEqual([]);
    expect(effectsIn(q, 4, 0.8)).toEqual([]);
  });

  it('a real search on a trapped piece, with the remedy, spawns it at that piece', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'bomba', owner: 1 };
    atFurniture(s, 0, f).hand = remedy('voda');
    const ev = run(s, [input({ action: true }), input()], 0.05);
    ev.push(...run(s, [input(), input()], 0.05));
    const q: EffectQueue = [];
    spawnEffects(q, s, ev, 0);
    const d = q.find((e) => e.kind === 'disarm');
    expect(d).toMatchObject({ trap: 'bomba', remedy: 'voda', furniture: f.id });
  });
});

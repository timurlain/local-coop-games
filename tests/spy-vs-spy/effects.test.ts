import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import {
  BLOCK_SPARK_TIME, EFFECT_TIME, LAUGH_TIME, activeEffects, effectPose, effectsIn, laugher, spawnEffects, type EffectQueue,
} from '../../src/games/spy-vs-spy/render/effects';
import { pickFrame } from '../../src/games/spy-vs-spy/render/spy';
import { atFurniture, firstFurniture, openGame, place, remedy, secret } from './fixtures';

function setup() {
  const s = openGame();
  const f = firstFurniture(s, 0);
  const spy = atFurniture(s, 0, f);
  return { s, f, spy };
}

describe('spawnEffects (spec §7 table)', () => {
  it('maps each outcome event to its effect, anchored at the spy in its room', () => {
    const { s, f, spy } = setup();
    const cases: [GameEvent, string][] = [
      [{ type: 'found', spy: 0, thing: secret('pas'), furniture: f.id }, 'found'],
      [{ type: 'found', spy: 0, thing: null, furniture: f.id }, 'nothing'],
      [{ type: 'hidden', spy: 0, thing: secret('pas'), furniture: f.id }, 'hidden'],
      [{ type: 'swapped', spy: 0, gave: secret('pas'), took: secret('klic'), furniture: f.id }, 'swapped'],
      [{ type: 'stored', spy: 0, secret: 'klic', furniture: f.id }, 'stored'],
      [{ type: 'dropped', spy: 0, thing: secret('pas'), furniture: f.id }, 'dropped'],
      [{ type: 'dropped', spy: 0, thing: remedy('voda'), furniture: null }, 'poof'],
    ];
    for (const [event, kind] of cases) {
      const q: EffectQueue = [];
      spawnEffects(q, s, [event], 10);
      expect(q, kind).toHaveLength(1);
      expect(q[0]).toMatchObject({ kind, spy: 0, room: 0, x: spy.x, z: spy.z, start: 10, duration: EFFECT_TIME });
    }
  });

  it('carries the things and furniture the animation needs', () => {
    const { s, f } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [
      { type: 'found', spy: 0, thing: secret('pas'), furniture: f.id },
      { type: 'swapped', spy: 0, gave: secret('pas'), took: secret('klic'), furniture: f.id },
      { type: 'stored', spy: 0, secret: 'klic', furniture: f.id },
      { type: 'hidden', spy: 0, thing: remedy('voda'), furniture: f.id },
    ], 0);
    expect(q[0]).toMatchObject({ thing: secret('pas'), furniture: f.id });
    expect(q[1]).toMatchObject({ thing: secret('pas'), took: secret('klic'), furniture: f.id });
    expect(q[2]).toMatchObject({ thing: secret('klic'), furniture: f.id });
    expect(q[3]).toMatchObject({ thing: remedy('voda'), furniture: f.id });
  });

  it('a drop flies to the furniture that received the item, in that furniture room', () => {
    const { s } = setup();
    const other = firstFurniture(s, 1);
    place(s, 0, 1, 20, 20);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'dropped', spy: 0, thing: secret('plany'), furniture: other.id }], 0);
    expect(q[0]).toMatchObject({ kind: 'dropped', room: 1, furniture: other.id, thing: secret('plany') });
  });

  it('a cross-room drop is anchored to the receiving room, not the spy, and falls from above', () => {
    const { s } = setup(); // spy 0 stays in room 0
    const other = firstFurniture(s, 1); // furniture in room 1
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'dropped', spy: 0, thing: secret('plany'), furniture: other.id }], 0);
    expect(q[0]).toMatchObject({ kind: 'dropped', room: 1, furniture: other.id, fromSpy: false });
    expect(effectsIn(q, 1, 0.1).map((e) => e.kind)).toEqual(['dropped']);
    expect(effectsIn(q, 0, 0.1)).toEqual([]);
  });

  it('a drop with nothing in hand shows nothing; a secret with no furniture poofs', () => {
    const { s } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'dropped', spy: 0, thing: null, furniture: null }], 0);
    expect(q).toHaveLength(0);
    spawnEffects(q, s, [{ type: 'dropped', spy: 0, thing: secret('pas'), furniture: null }], 0);
    expect(q[0].kind).toBe('poof');
  });

  it('ignores unrelated events', () => {
    const { s } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'searchStart', spy: 0 }, { type: 'door', spy: 1 }, { type: 'draw' }], 0);
    expect(q).toHaveLength(0);
  });
});

describe('blockSpark (round 4 §2: a blocked jab visibly stops)', () => {
  it('spawns at the midpoint between attacker and defender, in their shared room, for BLOCK_SPARK_TIME', () => {
    const s = openGame();
    const a = place(s, 0, 4, 100, 20);
    const b = place(s, 1, 4, 110, 20);
    const q: EffectQueue = [];
    const ev: GameEvent = { type: 'blocked', spy: 1, kind: 'jab' };
    spawnEffects(q, s, [ev], 10);
    expect(BLOCK_SPARK_TIME).toBe(0.3);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      kind: 'blockSpark', spy: 1, room: 4, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, start: 10, duration: BLOCK_SPARK_TIME,
    });
    expect(effectsIn(q, 4, 10.1).map((e) => e.kind)).toEqual(['blockSpark']);
    expect(activeEffects(q, 10 + BLOCK_SPARK_TIME - 0.01)).toHaveLength(1);
    expect(activeEffects(q, 10 + BLOCK_SPARK_TIME)).toHaveLength(0);
  });

  it('does not spark a bash stopped by ducking: no clubs meet', () => {
    const s = openGame();
    place(s, 0, 4, 100, 20);
    place(s, 1, 4, 110, 20);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'blocked', spy: 1, kind: 'bash' }], 0);
    expect(q).toHaveLength(0);
  });

  it('has no pose override (a spark is drawn, not a stance)', () => {
    const s = openGame();
    place(s, 0, 4, 100, 20);
    place(s, 1, 4, 110, 20);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'blocked', spy: 1, kind: 'jab' }], 0);
    expect(effectPose(q, 1, 0.1)).toBeNull();
  });

  it('lands between the two spies wherever they stand (RULES-driven, not a magic literal)', () => {
    const s = openGame();
    const a = place(s, 0, 4, 30, 5);
    const b = place(s, 1, 4, 30 + RULES.fightRangeX, 5 + RULES.fightRangeZ);
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'blocked', spy: 1, kind: 'jab' }], 0);
    expect(q[0]).toMatchObject({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  });
});

describe('activeEffects / effectsIn', () => {
  it('expires effects after their duration', () => {
    const { s, f } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'found', spy: 0, thing: null, furniture: f.id }], 5);
    expect(activeEffects(q, 5)).toHaveLength(1);
    expect(activeEffects(q, 5 + EFFECT_TIME - 0.01)).toHaveLength(1);
    expect(activeEffects(q, 5 + EFFECT_TIME)).toHaveLength(0);
    expect(q).toHaveLength(0);
  });

  it('only returns effects of the given room', () => {
    const { s, f } = setup();
    const other = firstFurniture(s, 1);
    const q: EffectQueue = [];
    spawnEffects(q, s, [
      { type: 'found', spy: 0, thing: null, furniture: f.id },
      { type: 'dropped', spy: 0, thing: secret('pas'), furniture: other.id },
    ], 0);
    expect(effectsIn(q, 0, 0.1).map((e) => e.kind)).toEqual(['nothing']);
    expect(effectsIn(q, 1, 0.1).map((e) => e.kind)).toEqual(['dropped']);
    expect(effectsIn(q, 2, 0.1)).toEqual([]);
  });
});

describe('effectPose', () => {
  const pose = (event: GameEvent, t: number) => {
    const { s } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [event], 0);
    return effectPose(q, 0, t);
  };

  it('picks the pose per outcome while the effect runs', () => {
    const f = 0;
    expect(pose({ type: 'found', spy: 0, thing: secret('pas'), furniture: f }, 0.1)).toBe('liftFind');
    expect(pose({ type: 'found', spy: 0, thing: null, furniture: f }, 0.1)).toBe('shrug');
    expect(pose({ type: 'hidden', spy: 0, thing: secret('pas'), furniture: f }, 0.1)).toBe('hidePut');
    expect(pose({ type: 'stored', spy: 0, secret: 'pas', furniture: f }, 0.1)).toBe('liftFind');
    expect(pose({ type: 'dropped', spy: 0, thing: secret('pas'), furniture: f }, 0.1)).toBeNull();
  });

  it('a swap puts the item in first and lifts the find at the end', () => {
    const ev: GameEvent = { type: 'swapped', spy: 0, gave: secret('pas'), took: secret('klic'), furniture: 0 };
    expect(pose(ev, 0.05)).toBe('hidePut');
    expect(pose(ev, EFFECT_TIME - 0.05)).toBe('liftFind');
  });

  it('ends with the effect and is per spy', () => {
    const ev: GameEvent = { type: 'found', spy: 0, thing: null, furniture: 0 };
    expect(pose(ev, EFFECT_TIME)).toBeNull();
    const { s } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [ev], 0);
    expect(effectPose(q, 1, 0.1)).toBeNull();
  });
});

describe('laugh on a trap death (spec §3)', () => {
  /** Spy 0 died of `cause`; spy 1 stands in room 8. */
  function death(cause: 'bomba' | 'pruzina' | 'elektrina' | 'pistole' | 'casovana' | 'fight') {
    const s = openGame();
    s.spies[0].mode = 'dead';
    const ev: GameEvent = { type: 'died', spy: 0, cause, ...(cause === 'fight' ? { killer: 1 as const } : {}) };
    return { s, ev };
  }

  it('the other spy laughs for 1.2 s, anchored at itself in its own room', () => {
    for (const cause of ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana'] as const) {
      const { s, ev } = death(cause);
      const q: EffectQueue = [];
      spawnEffects(q, s, [ev], 3);
      expect(q, cause).toHaveLength(1);
      expect(q[0]).toMatchObject({ kind: 'laugh', spy: 1, room: 8, x: s.spies[1].x, z: s.spies[1].z, start: 3, duration: LAUGH_TIME });
      expect(laugher(s, ev)).toBe(1);
    }
    expect(LAUGH_TIME).toBe(1.2);
  });

  it('nobody laughs at a fight death', () => {
    const { s, ev } = death('fight');
    const q: EffectQueue = [];
    spawnEffects(q, s, [ev], 0);
    expect(q).toHaveLength(0);
    expect(laugher(s, ev)).toBeNull();
  });

  it('nobody laughs when the other spy is not active', () => {
    for (const mode of ['dead', 'out', 'escaped'] as const) {
      const { s, ev } = death('bomba');
      s.spies[1].mode = mode;
      const q: EffectQueue = [];
      spawnEffects(q, s, [ev], 0);
      expect(q, mode).toHaveLength(0);
      expect(laugher(s, ev), mode).toBeNull();
    }
  });

  it('alternates laugh1/laugh2 at ~6 fps for the laugher only, then ends', () => {
    const { s, ev } = death('pistole');
    const q: EffectQueue = [];
    spawnEffects(q, s, [ev], 10);
    expect(effectPose(q, 1, 10)).toBe('laugh1');
    expect(effectPose(q, 1, 10 + 1 / 6 + 0.01)).toBe('laugh2');
    expect(effectPose(q, 1, 10 + 2 / 6 + 0.01)).toBe('laugh1');
    expect(effectPose(q, 1, 10 + LAUGH_TIME - 0.01)).not.toBeNull();
    expect(effectPose(q, 0, 10.1)).toBeNull();
    expect(effectPose(q, 1, 10 + LAUGH_TIME)).toBeNull();
  });

  it('walking cancels the laugh pose like the other poses', () => {
    const spy = openGame().spies[1];
    expect(pickFrame(spy, false, false, 0, 'laugh1')).toBe('laugh1');
    expect(pickFrame(spy, false, true, 0, 'laugh1')).not.toBe('laugh1');
  });
});

import { describe, expect, it } from 'vitest';
import { kill } from '../../src/games/spy-vs-spy/logic/death';
import { createGame, minFurniturePerRoom } from '../../src/games/spy-vs-spy/logic/generator';
import { hasAllSecrets, resolveSearch } from '../../src/games/spy-vs-spy/logic/hand';
import { updateAction, updateSearching } from '../../src/games/spy-vs-spy/logic/interact';
import { LEVELS, RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import { scoreDeltas } from '../../src/games/spy-vs-spy/logic/score';
import { SECRETS, type GameEvent, type GameState, type SecretKind } from '../../src/games/spy-vs-spy/logic/state';
import { spawnEffects, type EffectQueue } from '../../src/games/spy-vs-spy/render/effects';
import { atFurniture, firstFurniture, input, kufrik, openGame, place, remedy, secret, taken } from './fixtures';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 104729 + 3);

function secretsOf(s: GameState): SecretKind[] {
  return s.furniture.flatMap((f) => (f.hidden?.kind === 'secret' ? [f.hidden.secret] : [])).sort();
}

describe('round 6 §3: two money and two passports', () => {
  it('defines the copies of each kind in RULES: klíč 1, pas 2, peníze 2, plány 1', () => {
    expect(RULES.secretCopies).toEqual({ klic: 1, pas: 2, penize: 2, plany: 1 });
  });

  it('places 6 secret items and the kufřík on every level, across many seeds', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        expect(secretsOf(s), `level ${level} seed ${seed}`).toEqual(['klic', 'pas', 'pas', 'penize', 'penize', 'plany']);
        const cases = s.furniture.filter((f) => f.hidden?.kind === 'kufrik');
        expect(cases).toHaveLength(1);
        expect(cases[0].hidden).toEqual(kufrik());
      }
    }
  });

  it('keeps at most one secret item per room at the start, never in a fixture, on every level', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        const hidden = s.furniture.filter((f) => f.hidden !== null);
        expect(hidden).toHaveLength(7);
        expect(new Set(hidden.map((f) => f.room)).size, `level ${level} seed ${seed}`).toBe(7);
        for (const f of hidden) expect(f.source).toBeNull();
      }
    }
  });

  it('leaves every room at least one non-fixture piece, so the secret items always find distinct rooms', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        for (const r of s.rooms) {
          expect(r.furniture.some((id) => s.furniture[id].source === null), `level ${level} seed ${seed} room ${r.id}`).toBe(true);
        }
      }
    }
  });

  it('passes the capacity guard for every level (level 1 is 3×3: 7 things in 9 rooms)', () => {
    for (const level of LEVELS) {
      const { cols, rows } = levelRules(level);
      expect(() => minFurniturePerRoom(cols * rows), `level ${level}`).not.toThrow();
    }
  });

  it('is deterministic per seed', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 10)) {
        expect(createGame(seed, level).furniture).toEqual(createGame(seed, level).furniture);
      }
    }
  });
});

function setup() {
  const s = openGame();
  const f = firstFurniture(s, 0);
  const spy = atFurniture(s, 0, f);
  return { s, f, spy };
}

describe('round 6 §3: one of a kind (resolveSearch)', () => {
  it('a loose pas in hand cannot take a second pas: alreadyHave, both stay put', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = { kind: 'secret', secret: 'pas', lastHolder: 1 };
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'alreadyHave', found: null });
    expect(spy.hand).toEqual(secret('pas'));
    expect(f.hidden).toEqual({ kind: 'secret', secret: 'pas', lastHolder: 1 });
  });

  it('a loose pas in hand still swaps for a different kind', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = secret('penize');
    expect(resolveSearch(spy, f).outcome).toBe('swapped');
    expect(spy.hand).toEqual(taken(secret('penize'), 0));
    expect(f.hidden).toEqual(secret('pas'));
  });

  it('a kufřík that already holds peníze cannot take a second peníze: alreadyHave', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('penize', 'klic');
    f.hidden = secret('penize');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'alreadyHave', found: null });
    expect(spy.hand).toEqual(kufrik('penize', 'klic'));
    expect(f.hidden).toEqual(secret('penize'));
  });

  it('a kufřík still stores a kind it does not hold yet', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('penize');
    f.hidden = secret('pas');
    expect(resolveSearch(spy, f).outcome).toBe('stored');
    expect(spy.hand).toEqual(kufrik('penize', 'pas'));
  });

  it('a loose pas taking a kufřík that already holds pas: the kufřík is taken, the pas stays in the piece', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = { kind: 'kufrik', contents: ['pas', 'klic'], lastHolder: null };
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'swapped', found: taken(kufrik('pas', 'klic'), 0) });
    expect(spy.hand).toEqual(taken(kufrik('pas', 'klic'), 0));
    expect(f.hidden).toEqual(secret('pas'));
  });

  it('the kufřík swap is still a steal when the opponent held the kufřík last', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = { kind: 'kufrik', contents: ['pas'], lastHolder: 1 };
    expect(resolveSearch(spy, f).stolenFrom).toBe(1);
  });

  it('a loose secret with a different kind still goes into the found kufřík', () => {
    const { f, spy } = setup();
    spy.hand = secret('plany');
    f.hidden = kufrik('pas');
    expect(resolveSearch(spy, f).outcome).toBe('stored');
    expect(spy.hand).toEqual(taken(kufrik('pas', 'plany'), 0));
    expect(f.hidden).toBeNull();
  });

  it('a remedy in hand swaps for any secret (it is not a kind)', () => {
    const { f, spy } = setup();
    spy.hand = remedy('voda');
    f.hidden = secret('pas');
    expect(resolveSearch(spy, f).outcome).toBe('swapped');
  });

  it('stealing a kind you do not have still scores', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('klic');
    f.hidden = { kind: 'secret', secret: 'pas', lastHolder: 1 };
    const r = resolveSearch(spy, f);
    expect(r.outcome).toBe('stored');
    expect(r.stolenFrom).toBe(1);
  });
});

describe('round 6 §3: alreadyHave through the search', () => {
  function search(s: GameState, spyId: 0 | 1, furniture: number): GameEvent[] {
    const spy = s.spies[spyId];
    const ev: GameEvent[] = [];
    updateAction(s, spy, input({ action: true }), 1 / 60, ev);
    spy.prev = input({ action: true });
    updateSearching(s, spy, RULES.searchTime, ev);
    return ev;
  }

  it('emits alreadyHave (no score) and leaves the item hidden', () => {
    const { s, f } = setup();
    s.spies[0].hand = kufrik('pas');
    f.hidden = { kind: 'secret', secret: 'pas', lastHolder: 1 };
    const ev = search(s, 0, f.id);
    expect(ev).toContainEqual({ type: 'alreadyHave', spy: 0, furniture: f.id });
    expect(ev.some((e) => e.type === 'found' || e.type === 'stored' || e.type === 'swapped')).toBe(false);
    expect(scoreDeltas(s, ev)).toEqual([0, 0]);
    expect(f.hidden).toEqual({ kind: 'secret', secret: 'pas', lastHolder: 1 });
  });

  it('applies to a death drop: the dead spy’s pas cannot be picked up by a spy whose kufřík has one', () => {
    const s = openGame();
    const dead = place(s, 1, 4, 100, 20);
    dead.hand = secret('pas');
    const ev: GameEvent[] = [];
    kill(s, dead, 'bomba', ev);
    const drop = ev.find((e) => e.type === 'dropped');
    if (drop?.type !== 'dropped' || drop.furniture === null) throw new Error('no drop');
    const f = s.furniture[drop.furniture];
    const spy = atFurniture(s, 0, f);
    spy.hand = kufrik('pas', 'klic');
    const got = search(s, 0, f.id);
    expect(got).toContainEqual({ type: 'alreadyHave', spy: 0, furniture: f.id });
    expect(spy.hand).toEqual(kufrik('pas', 'klic'));
    expect(f.hidden).toEqual(secret('pas'));
  });

  it('a death-dropped kufřík holding pas, taken with a loose pas, leaves the pas in the piece', () => {
    const s = openGame();
    const dead = place(s, 1, 4, 100, 20);
    dead.hand = { kind: 'kufrik', contents: ['pas'], lastHolder: 1 };
    const ev: GameEvent[] = [];
    kill(s, dead, 'bomba', ev);
    const drop = ev.find((e) => e.type === 'dropped');
    if (drop?.type !== 'dropped' || drop.furniture === null) throw new Error('no drop');
    const f = s.furniture[drop.furniture];
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('pas');
    const got = search(s, 0, f.id);
    expect(got).toContainEqual({
      type: 'swapped', spy: 0, gave: secret('pas'), took: taken(kufrik('pas'), 0), furniture: f.id, stolenFrom: 1,
    });
    expect(f.hidden).toEqual(secret('pas'));
    expect(scoreDeltas(s, got)).toEqual([60, 0]);
  });

  it('renders alreadyHave as the shrug', () => {
    const { s, f } = setup();
    const q: EffectQueue = [];
    spawnEffects(q, s, [{ type: 'alreadyHave', spy: 0, furniture: f.id }], 0);
    expect(q[0]).toMatchObject({ kind: 'nothing', spy: 0, furniture: f.id });
  });
});

describe('round 6 §3: escape', () => {
  it('still needs the kufřík with one of each of the four kinds', () => {
    expect(hasAllSecrets(kufrik(...SECRETS))).toBe(true);
    expect(hasAllSecrets(kufrik('klic', 'pas', 'penize'))).toBe(false);
    expect(hasAllSecrets(secret('pas'))).toBe(false);
  });
});

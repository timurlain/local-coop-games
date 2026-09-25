import { describe, expect, it } from 'vitest';
import { armouryRoom, resupplyKind } from '../../src/games/spy-vs-spy/logic/armoury';
import { dropHand } from '../../src/games/spy-vs-spy/logic/death';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { LEVELS, RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { scoreDeltas } from '../../src/games/spy-vs-spy/logic/score';
import {
  ARMOURY_KIND, FIXTURE_KINDS, FURNITURE_KINDS, TRAPS, canHold,
  type GameEvent, type GameState, type PlayerId, type TrapKind,
} from '../../src/games/spy-vs-spy/logic/state';
import { stockFlashOn } from '../../src/games/spy-vs-spy/render/trapulator';
import { cs } from '../../src/shared/i18n/cs';
import {
  OPEN_RULES, TICK, atFurniture, firstFurniture, input, kufrik, makeArmoury, only, openGame, place, remedy, run, secret,
} from './fixtures';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7727 + 5);

function armouries(s: GameState) {
  return s.furniture.filter((f) => f.kind === ARMOURY_KIND);
}

/** One Akce press at the piece in reach, then waits out the search. */
function search(s: GameState, id: PlayerId): GameEvent[] {
  const ev = run(s, only(id, input({ action: true })), TICK);
  ev.push(...run(s, only(id, input()), RULES.searchTime + 0.05));
  return ev;
}

function stock(b: number, p: number, e: number, pi: number, c: number): Record<TrapKind, number> {
  return { bomba: b, pruzina: p, elektrina: e, pistole: pi, casovana: c };
}

describe('round 6 §4: the armoury cabinet in the generator', () => {
  it('is a furniture kind with a Czech name', () => {
    expect(FURNITURE_KINDS).toContain('zbrojnice');
    expect(cs.spy.furniture.zbrojnice).toBe('Zbrojní skříň');
  });

  it('stands exactly once per embassy, on the back wall, never in the exit room, holding nothing, on every level', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        const tag = `level ${level} seed ${seed}`;
        const [a, ...more] = armouries(s);
        expect(more, tag).toEqual([]);
        expect(a, tag).toBeDefined();
        expect(a.z, tag).toBe(0);
        expect(s.rooms[a.room].exit, tag).toBeNull();
        expect(a.source, tag).toBeNull();
        expect(a.hidden, tag).toBeNull();
        expect(a.trap, tag).toBeNull();
        expect(armouryRoom(s), tag).toBe(a.room);
      }
    }
  });

  it('keeps every guarantee on every level with the armoury in place', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        const tag = `level ${level} seed ${seed}`;
        const wanted = Math.max(2, Math.ceil(s.rooms.length / 5));
        for (const kind of FIXTURE_KINDS) expect(s.furniture.filter((f) => f.kind === kind), tag).toHaveLength(wanted);
        for (const r of s.rooms) {
          expect(r.furniture.length, tag).toBeGreaterThanOrEqual(2);
          expect(r.furniture.length, tag).toBeLessThanOrEqual(3);
          expect(r.furniture.some((id) => canHold(s.furniture[id])), `${tag} room ${r.id}`).toBe(true);
        }
        const hidden = s.furniture.filter((f) => f.hidden !== null);
        expect(hidden, tag).toHaveLength(7);
        expect(new Set(hidden.map((f) => f.room)).size, tag).toBe(7);
        for (const f of hidden) expect(canHold(f), tag).toBe(true);
      }
    }
  });

  it('is deterministic per seed', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 10)) {
        expect(armouries(createGame(seed, level))).toEqual(armouries(createGame(seed, level)));
      }
    }
  });

  it('lands in many different rooms across seeds', () => {
    const rooms = new Set(SEEDS.map((seed) => armouries(createGame(seed, 2))[0].room));
    expect(rooms.size).toBeGreaterThanOrEqual(7);
  });
});

describe('canHold', () => {
  it('is false for fixtures and the armoury, true for ordinary pieces', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    expect(canHold(f)).toBe(true);
    f.source = 'voda';
    expect(canHold(f)).toBe(false);
    f.source = null;
    f.kind = ARMOURY_KIND;
    expect(canHold(f)).toBe(false);
  });
});

describe('resupplyKind', () => {
  it('picks the kind the spy has the fewest of', () => {
    expect(resupplyKind(stock(2, 2, 1, 2, 2))).toBe('elektrina');
    expect(resupplyKind(stock(3, 3, 3, 3, 0))).toBe('casovana');
    expect(resupplyKind(stock(1, 0, 1, 1, 1))).toBe('pruzina');
  });

  it('breaks ties in the Trapulator cycle order bomba, pružina, elektřina, pistole, časovaná', () => {
    expect(resupplyKind(stock(0, 0, 0, 0, 0))).toBe('bomba');
    expect(resupplyKind(stock(1, 0, 1, 0, 0))).toBe('pruzina');
    expect(resupplyKind(stock(2, 2, 1, 1, 1))).toBe('elektrina');
    expect(resupplyKind(stock(2, 2, 2, 1, 1))).toBe('pistole');
    expect(TRAPS).toEqual(['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana']);
  });
});

describe('searching the armoury', () => {
  function setup() {
    const s = openGame();
    const a = makeArmoury(s, 0);
    atFurniture(s, 0, a);
    return { s, a };
  }

  it('gives +1 of the fewest kind, a resupplied event, and closes for 60 s', () => {
    const { s, a } = setup();
    s.spies[0].stock = stock(2, 2, 1, 1, 1);
    const ev = search(s, 0);
    expect(ev.filter((e) => e.type === 'resupplied')).toEqual([{ type: 'resupplied', spy: 0, trap: 'elektrina', furniture: a.id }]);
    expect(ev.some((e) => e.type === 'found')).toBe(false);
    expect(s.spies[0].stock).toEqual(stock(2, 2, 2, 1, 1));
    expect(RULES.armouryCooldown).toBe(60);
    expect(s.spies[0].armouryTimer).toBeGreaterThan(59);
    expect(s.spies[0].stockFlash).toMatchObject({ trap: 'elektrina' });
  });

  it('shrugs while closed for this spy, and opens again after 60 s', () => {
    const { s } = setup();
    search(s, 0);
    const before = { ...s.spies[0].stock };
    const ev = search(s, 0);
    expect(ev.filter((e) => e.type === 'found')).toEqual([{ type: 'found', spy: 0, thing: null, furniture: firstFurniture(s, 0).id }]);
    expect(ev.some((e) => e.type === 'resupplied')).toBe(false);
    expect(s.spies[0].stock).toEqual(before);

    run(s, [input(), input()], RULES.armouryCooldown - 2, 0.1);
    expect(search(s, 0).some((e) => e.type === 'resupplied')).toBe(false);
    run(s, [input(), input()], 2, 0.1);
    expect(s.spies[0].armouryTimer).toBe(0);
    expect(search(s, 0).some((e) => e.type === 'resupplied')).toBe(true);
  });

  it("keeps each spy's timer independent", () => {
    const { s, a } = setup();
    search(s, 0);
    place(s, 0, 4, 100, 30);
    atFurniture(s, 1, a);
    const ev = search(s, 1);
    // level 2 stock 2/2/1/1/1: the first of the fewest is elektřina
    expect(ev.filter((e) => e.type === 'resupplied')).toEqual([{ type: 'resupplied', spy: 1, trap: 'elektrina', furniture: a.id }]);
    expect(s.spies[1].stock.elektrina).toBe(OPEN_RULES.trapStockPerSpy.elektrina + 1);
    expect(s.spies[1].armouryTimer).toBeGreaterThan(59);
    expect(s.spies[0].armouryTimer).toBeLessThan(s.spies[1].armouryTimer);
  });

  it('never takes the thing in hand: open, he resupplies and keeps it; closed, he shrugs and keeps it', () => {
    const { s, a } = setup();
    s.spies[0].hand = secret('klic');
    search(s, 0);
    expect(s.spies[0].hand).toEqual(secret('klic'));
    expect(a.hidden).toBeNull();
    const ev = search(s, 0);
    expect(ev.filter((e) => e.type === 'found')).toEqual([{ type: 'found', spy: 0, thing: null, furniture: a.id }]);
    expect(ev.some((e) => e.type === 'hidden')).toBe(false);
    expect(s.spies[0].hand).toEqual(secret('klic'));
    expect(a.hidden).toBeNull();
  });

  it('scores nothing for a resupply', () => {
    const { s } = setup();
    const ev = search(s, 0);
    expect(scoreDeltas(s, ev)).toEqual([0, 0]);
  });

  it.each(['bomba', 'pruzina'] as const)('a %s placed on it triggers on search like on any furniture', (trap) => {
    const { s, a } = setup();
    a.trap = { kind: trap, owner: 1 };
    const ev = search(s, 0);
    expect(s.spies[0].mode).toBe('dead');
    expect(s.spies[0].deathCause).toBe(trap);
    expect(a.trap).toBeNull();
    expect(ev.some((e) => e.type === 'resupplied')).toBe(false);
  });

  it('can take a bomba from the Trapulator', () => {
    const s = openGame();
    const a = makeArmoury(s, 0);
    const spy = atFurniture(s, 0, a);
    spy.selected = 'bomba';
    run(s, only(0, input({ action: true })), TICK);
    run(s, only(0, input()), RULES.placeTime + 0.05);
    expect(a.trap).toEqual({ kind: 'bomba', owner: 0 });
  });

  it('a disarmed trap on it still lets the search resupply', () => {
    const { s, a } = setup();
    a.trap = { kind: 'bomba', owner: 1 };
    s.spies[0].hand = remedy('voda');
    const ev = search(s, 0);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['disarmed', 'salvaged', 'resupplied']));
    expect(s.spies[0].mode).toBe('normal');
  });
});

describe('dropping a thing never puts it in the armoury', () => {
  it('skips the armoury and fixtures for a death drop', () => {
    const s = openGame();
    const a = makeArmoury(s, 0);
    const room = s.rooms[0].furniture.map((id) => s.furniture[id]);
    for (const f of room) if (f !== a) f.source = 'voda';
    const spy = place(s, 0, 0, 100, 20);
    spy.hand = kufrik('klic');
    const to = dropHand(s, spy);
    expect(to).not.toBeNull();
    expect(s.furniture[to!].room).not.toBe(0);
    expect(a.hidden).toBeNull();
  });
});

describe('the stock digit blink on the Trapulator', () => {
  it('blinks only the kind that went up, while the flash lasts', () => {
    const s = openGame();
    const spy = s.spies[0];
    expect(stockFlashOn(spy, 'bomba', 0)).toBe(false);
    spy.stockFlash = { trap: 'bomba', timer: 1 };
    expect(stockFlashOn(spy, 'bomba', 0)).toBe(true);
    expect(stockFlashOn(spy, 'bomba', 1 / 6 + 0.01)).toBe(false);
    expect(stockFlashOn(spy, 'pruzina', 0)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { IQS, IQ_PARAMS, botMaxHealth, botRngSeed, isIq, type IqParams } from '../../src/games/spy-vs-spy/bot/iq';
import { botView, noticedEvents } from '../../src/games/spy-vs-spy/bot/view';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { doorKeyFor, itemRooms } from '../../src/games/spy-vs-spy/logic/places';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { DIRS, EXIT_KEY, type GameEvent, type GameState } from '../../src/games/spy-vs-spy/logic/state';
import { firstFurniture, kufrik, openGame, place, secret } from './fixtures';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const FAIR_LEVELS = [1, 3, 8];

/** Every opponent trap kind in the bot's (spy 0's) room, plus traps in every other room. */
function trapEverything(s: GameState): void {
  const room = s.spies[0].room;
  for (const f of s.furniture) f.trap = { kind: f.id % 2 === 0 ? 'bomba' : 'pruzina', owner: 1 };
  for (const r of s.rooms) {
    for (const d of DIRS) {
      if (r.doors[d] || r.exit === d) s.doorTraps[doorKeyFor(s, r.id, d)] = { kind: d === 'N' ? 'pistole' : 'elektrina', owner: 1 };
    }
  }
  s.timeBombs.push({ room, x: 50, z: 20, fuse: 7, owner: 1 });
}

describe('IQ table (spec §6)', () => {
  it('IQS are 1..5 and isIq accepts only them', () => {
    expect(IQS).toEqual([1, 2, 3, 4, 5]);
    for (const n of IQS) expect(isIq(n)).toBe(true);
    for (const n of [0, 6, 2.5, '3', null, undefined]) expect(isIq(n)).toBe(false);
  });

  it('health handicap: IQ 1 → 5, IQ 2 → 6, IQ 3–5 → RULES.health', () => {
    expect(botMaxHealth(1)).toBe(5);
    expect(botMaxHealth(2)).toBe(6);
    for (const iq of [3, 4, 5] as const) expect(botMaxHealth(iq)).toBe(RULES.health);
    expect(RULES.health).toBe(7);
  });

  const falling: (keyof IqParams)[] = ['reaction', 'thinkEvery', 'forgetPerMinute', 'noise', 'slipChance'];
  const rising: (keyof IqParams)[] = ['trapWill', 'glancePerSecond', 'duckChance', 'preBlock', 'punish'];
  const at = (k: keyof IqParams) => IQS.map((iq) => IQ_PARAMS[iq][k] as number);

  it.each(falling)('%s falls (never rises) with IQ, and does fall overall', (k) => {
    const v = at(k);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1]);
    expect(v[4]).toBeLessThan(v[0]);
  });

  it.each(rising)('%s rises (never falls) with IQ, and does rise overall', (k) => {
    const v = at(k);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
    expect(v[4]).toBeGreaterThan(v[0]);
  });

  it('IQ 1 never glances, IQ 5 never forgets; own traps forgotten only at IQ 1–2; smart traps from IQ 3', () => {
    expect(IQ_PARAMS[1].glancePerSecond).toBe(0);
    expect(IQ_PARAMS[5].forgetPerMinute).toBe(0);
    expect(IQS.map((iq) => IQ_PARAMS[iq].forgetOwnTraps)).toEqual([true, true, false, false, false]);
    expect(IQS.map((iq) => IQ_PARAMS[iq].smartTraps)).toEqual([false, false, true, true, true]);
  });

  it('fleeAt: IQ 1 never flees, the threshold rises with IQ', () => {
    expect(IQS.map((iq) => IQ_PARAMS[iq].fleeAt)).toEqual([null, 1, 2, 2, 3]);
  });

  it('botRngSeed differs per side and is stable', () => {
    for (const seed of [0, 1, 12345, 0xffffffff]) {
      expect(botRngSeed(seed, 0)).not.toBe(botRngSeed(seed, 1));
      expect(botRngSeed(seed, 0)).toBe(botRngSeed(seed, 0));
      expect(botRngSeed(seed, 0)).toBe((seed ^ 0x85ebca6b) >>> 0);
      expect(botRngSeed(seed, 1)).toBe((seed ^ 0x9e3779b9) >>> 0);
    }
  });
});

describe('botView fairness (spec §3)', () => {
  for (const level of FAIR_LEVELS) {
    it(`level ${level}: no trap, hidden thing, owner, fuse or foreign piece ever shows`, () => {
      for (const seed of SEEDS) {
        const s = createGame(seed, level);
        trapEverything(s);
        const view = botView(s, 0, false);
        const json = JSON.stringify(view);
        for (const key of ['"trap"', '"hidden"', '"owner"', '"fuse"']) expect(json).not.toContain(key);
        const own = new Set(s.rooms[s.spies[0].room].furniture);
        for (const p of view.pieces) expect(own.has(p.id)).toBe(true);
        expect(view.pieces.length).toBe(own.size);
        expect(view.itemRooms).toBeNull();
        expect(view.glance).toBeNull();
        const visited = s.spies[0].visited.flatMap((v, i) => (v ? [i] : []));
        expect(view.known.map((k) => k.id).sort((a, b) => a - b)).toEqual(visited);
      }
    });
  }

  it('the opponent is seen only in the same room, and only while active', () => {
    const s = openGame();
    place(s, 1, 8, 100, 20);
    expect(botView(s, 0, false).opponent).toBeNull();
    place(s, 1, 0, 100, 20);
    s.spies[1].hand = secret('pas');
    const seen = botView(s, 0, false).opponent;
    expect(seen).toMatchObject({ x: 100, z: 20, health: s.spies[1].health, mode: 'normal', carrying: true });
    s.spies[1].mode = 'dead';
    expect(botView(s, 0, false).opponent).toBeNull();
  });

  it('known lists only visited rooms', () => {
    const s = openGame();
    s.spies[0].visited[4] = true;
    expect(botView(s, 0, false).known.map((k) => k.id)).toEqual([0, 4]);
  });

  it('hideAirport: no exit anywhere until he holds the full kufřík', () => {
    for (const seed of SEEDS) {
      const s = createGame(seed, 3, { hideAirport: true });
      const exitRoom = s.rooms.find((r) => r.exit !== null)!;
      s.spies[0].visited.fill(true);
      place(s, 0, exitRoom.id, 100, 20);
      let view = botView(s, 0, false);
      expect(view.doors.some((d) => d.exit || d.key === EXIT_KEY)).toBe(false);
      expect(view.known.some((k) => k.exit !== null)).toBe(false);
      s.spies[0].hand = kufrik('klic', 'penize', 'pas', 'plany');
      view = botView(s, 0, false);
      expect(view.doors.filter((d) => d.exit)).toEqual([
        { dir: exitRoom.exit, key: EXIT_KEY, to: null, open: false, exit: true },
      ]);
      expect(view.known.find((k) => k.id === exitRoom.id)!.exit).toBe(exitRoom.exit);
    }
  });

  it('doors: neighbour, key and open state (only when fully open)', () => {
    const s = openGame();
    let doors = botView(s, 0, false).doors;
    expect(doors.map((d) => d.dir).sort()).toEqual(['E', 'S']);
    const east = doors.find((d) => d.dir === 'E')!;
    expect(east).toEqual({ dir: 'E', key: '0-1', to: 1, open: false, exit: false });
    s.doorOpen['0-1'] = { phase: 'opening', timer: 0.1 };
    expect(botView(s, 0, false).doors.find((d) => d.dir === 'E')!.open).toBe(false);
    s.doorOpen['0-1'] = { phase: 'open', timer: 1 };
    doors = botView(s, 0, false).doors;
    expect(doors.find((d) => d.dir === 'E')!.open).toBe(true);
  });

  it('pieces show fixture remedies and the armoury', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.kind = 'hasicak';
    f.source = 'voda';
    expect(botView(s, 0, false).pieces.find((p) => p.id === f.id)).toEqual({
      id: f.id, kind: 'hasicak', x: f.x, z: f.z, source: 'voda', armoury: false,
    });
    f.kind = 'zbrojnice';
    f.source = null;
    expect(botView(s, 0, false).pieces.find((p) => p.id === f.id)!.armoury).toBe(true);
    expect(botView(s, 0, false).armouryRoom).toBe(0);
  });

  it('itemRooms appear only while the big map is open, as itemRooms() lists them', () => {
    const s = openGame();
    s.spies[0].visited[1] = true;
    firstFurniture(s, 1).hidden = secret('klic');
    firstFurniture(s, 0).hidden = kufrik();
    expect(botView(s, 0, false).itemRooms).toBeNull();
    s.spies[0].mapOpen = true;
    const rooms = botView(s, 0, false).itemRooms!;
    expect([...rooms].sort()).toEqual([...itemRooms(s, s.spies[0])].sort());
    expect([...rooms].sort()).toEqual([0, 1]);
  });

  it('a glance shows the opponent’s room and hand, only when asked for', () => {
    const s = openGame();
    s.spies[1].hand = secret('plany');
    expect(botView(s, 0, false).glance).toBeNull();
    expect(botView(s, 0, true).glance).toEqual({ room: 8, hand: secret('plany') });
  });

  it('the view is a snapshot: changing it never touches the state', () => {
    const s = openGame();
    s.spies[0].hand = kufrik('klic');
    const view = botView(s, 0, false);
    (view.self.stock as Record<string, number>).bomba = 99;
    if (view.self.hand?.kind === 'kufrik') view.self.hand.contents.push('pas');
    expect(s.spies[0].stock.bomba).not.toBe(99);
    expect(s.spies[0].hand).toEqual(kufrik('klic'));
  });

  it('self carries his own state as drawn', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.maxHealth = 5;
    spy.health = 4;
    const self = botView(s, 0, false).self;
    expect(self).toMatchObject({
      id: 0, room: 0, x: spy.x, z: spy.z, facing: spy.facing, mode: 'normal', health: 4, maxHealth: 5,
      hand: null, selected: null, trapPress: null, mapOpen: false, clock: spy.clock, placing: false, doorOpening: false,
    });
    expect(botView(s, 0, false).time).toBe(s.time);
    expect([botView(s, 0, false).cols, botView(s, 0, false).rows]).toEqual([s.cols, s.rows]);
  });
});

describe('noticedEvents', () => {
  it('keeps his own events and the ones in his room, drops the opponent’s', () => {
    const events: GameEvent[] = [
      { type: 'found', spy: 0, thing: null, furniture: 3 },
      { type: 'found', spy: 1, thing: secret('pas'), furniture: 40 },
      { type: 'died', spy: 0, cause: 'bomba' },
      { type: 'disarmed', spy: 0, trap: 'bomba', remedy: 'voda' },
      { type: 'explode', room: 2 },
      { type: 'explode', room: 5 },
      { type: 'tick', room: 2 },
      { type: 'tick', room: 7 },
    ];
    expect(noticedEvents(events, 0, 2)).toEqual([events[0], events[2], events[3], events[4], events[6]]);
  });
});

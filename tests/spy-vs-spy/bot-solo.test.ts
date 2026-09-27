import { describe, expect, it } from 'vitest';
import { createBot, type Bot } from '../../src/games/spy-vs-spy/bot/bot';
import { IQ_PARAMS, type Iq } from '../../src/games/spy-vs-spy/bot/iq';
import { createGame, type GameOptions } from '../../src/games/spy-vs-spy/logic/generator';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { NO_INPUT, type GameEvent, type GameState, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { kufrik } from './fixtures';

const DT = 1 / 60;

/** Parks the opponent (side 1): 'out' never meets anyone and never ends the game on its own (a draw needs both out,
 *  a win an escape — ruling R3). */
function park(s: GameState): void {
  s.spies[1].mode = 'out';
}

interface Solo {
  escaped: boolean;
  ticks: number;
}

/** One level-1 game: side 0 the bot, side 1 parked, until he escapes or his clock runs out. `each` sees every tick. */
function solo(seed: number, iq: Iq, opts: GameOptions = {}, each?: (s: GameState, bot: Bot, events: GameEvent[]) => void): Solo {
  const s = createGame(seed, 1, opts);
  park(s);
  const bot = createBot(0, iq, seed);
  let events: GameEvent[] = [];
  let ticks = 0;
  const cap = Math.ceil(s.spies[0].clock / DT) + 60;
  while (s.result === null && s.spies[0].mode !== 'out' && ticks < cap) {
    const input = bot.think(s, events, DT);
    events = step(s, [input, NO_INPUT], DT);
    ticks++;
    each?.(s, bot, events);
  }
  return { escaped: s.spies[0].mode === 'escaped', ticks };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('the lone bot finds the items and escapes (spec bot §5, the milestone)', () => {
  it('IQ 5 escapes before his clock runs out in at least 18 of 20 level-1 games', () => {
    const results = SEEDS.map((seed) => solo(seed, 5));
    const escaped = results.filter((r) => r.escaped).length;
    expect(escaped).toBeGreaterThanOrEqual(18);
  });

  it('IQ 1 escapes in at least 8 of 20 (slower, not hopeless)', () => {
    const escaped = SEEDS.filter((seed) => solo(seed, 1).escaped).length;
    expect(escaped).toBeGreaterThanOrEqual(8);
  });

  it('the same seed twice plays the same game (identical tick count)', () => {
    expect(solo(7, 3).ticks).toBe(solo(7, 3).ticks);
    expect(solo(11, 1).ticks).toBe(solo(11, 1).ticks);
  });

  it('with „Skrýt letiště" on, IQ 5 still escapes in at least 9 of 10', () => {
    const escaped = SEEDS.slice(0, 10).filter((seed) => solo(seed, 5, { hideAirport: true }).escaped).length;
    expect(escaped).toBeGreaterThanOrEqual(9);
  });
});

describe('re-planning when the target changes under him (review focus 1)', () => {
  it('an item moved away from the piece he is fetching: he changes target soon after finding it empty', () => {
    const iq: Iq = 5;
    const { thinkEvery, reaction } = IQ_PARAMS[iq];
    let moved = 0;
    let checked = 0;
    for (const seed of SEEDS) {
      let movedFrom: number | null = null;
      let emptyAt: number | null = null;
      let changedAt: number | null = null;
      solo(seed, iq, {}, (s, bot, events) => {
        const goal = bot.goal;
        if (movedFrom === null && goal?.kind === 'fetch') {
          // Move what he is heading for into another piece that holds nothing, somewhere else.
          const from = s.furniture[goal.piece];
          const to = s.furniture.find((f) => f.hidden === null && f.source === null && f.kind !== 'zbrojnice' && f.room !== from.room);
          if (from.hidden !== null && to !== undefined) {
            to.hidden = from.hidden;
            from.hidden = null;
            movedFrom = from.id;
            moved++;
          }
        }
        if (movedFrom !== null && emptyAt === null
          && events.some((e) => e.type === 'found' && e.spy === 0 && e.furniture === movedFrom && e.thing === null)) {
          emptyAt = s.time;
        }
        if (emptyAt !== null && changedAt === null && !(goal !== null && 'piece' in goal && goal.piece === movedFrom)) {
          changedAt = s.time;
        }
      });
      if (emptyAt !== null) {
        checked++;
        expect(changedAt).not.toBeNull();
        expect(changedAt! - emptyAt).toBeLessThanOrEqual(thinkEvery + reaction + 0.1);
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(0);
  });

  it('never more than 10 Akce presses in a row without an event of his (bumps aside)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const iq of [1, 5] as const) {
        const s = createGame(seed, 1);
        park(s);
        const bot = createBot(0, iq, seed);
        let events: GameEvent[] = [];
        let presses = 0;
        let worst = 0;
        let prevAction = false;
        const cap = Math.ceil(s.spies[0].clock / DT) + 60;
        for (let t = 0; t < cap && s.result === null && s.spies[0].mode !== 'out'; t++) {
          const input = bot.think(s, events, DT);
          events = step(s, [input, NO_INPUT], DT);
          if (input.action && !prevAction) presses++;
          prevAction = input.action;
          if (events.some((e) => 'spy' in e && e.spy === 0 && e.type !== 'bump')) presses = 0;
          worst = Math.max(worst, presses);
        }
        expect(worst, `seed ${seed} IQ ${iq}`).toBeLessThanOrEqual(10);
      }
    }
  });
});

/** The longest stretch (game seconds) side 0 stood free ('normal', not opening a door, not reading the map) and the bot
 *  pressed nothing. */
function idleWatch() {
  let run = 0;
  let worst = 0;
  return {
    see(s: GameState, input: SpyInput) {
      const spy = s.spies[0];
      const free = spy.mode === 'normal' && spy.doorOpening === null && spy.kickTimer === 0;
      const none = input.moveX === 0 && input.moveY === 0 && !input.action && !input.trap;
      run = free && none ? run + DT : 0;
      worst = Math.max(worst, run);
    },
    get worst() {
      return worst;
    },
  };
}

describe('last resort: never idle when the notebook runs dry (fix round 1)', () => {
  it('(a) a missing secret put into a piece he already noted empty: he re-searches, gets it and escapes', () => {
    const iq: Iq = 5;
    const { thinkEvery, reaction } = IQ_PARAMS[iq];
    let escaped = 0;
    for (const seed of SEEDS.slice(0, 8)) {
      const s = createGame(seed, 1);
      park(s);
      // plány exist once: take them out of the game until he has left some piece empty, then hide them there.
      const home = s.furniture.find((f) => f.hidden?.kind === 'secret' && f.hidden.secret === 'plany')!;
      const plany = home.hidden!;
      home.hidden = null;
      let placed = false;
      const bot = createBot(0, iq, seed);
      const idle = idleWatch();
      let events: GameEvent[] = [];
      const cap = Math.ceil(s.spies[0].clock / DT) + 60;
      for (let t = 0; t < cap && s.result === null && s.spies[0].mode !== 'out'; t++) {
        const input = bot.think(s, events, DT);
        idle.see(s, input);
        events = step(s, [input, NO_INPUT], DT);
        // A piece he has just searched and left empty (found nothing, took the thing, or stored it): noted `empty`.
        for (const e of events) {
          if (placed || (e.type !== 'found' && e.type !== 'stored') || e.spy !== 0) continue;
          const f = s.furniture[e.furniture];
          if (f.source !== null || f.hidden !== null) continue;
          f.hidden = plany;
          placed = true;
        }
      }
      expect(placed, `seed ${seed} t=${s.time} mode=${s.spies[0].mode}`).toBe(true);
      expect(idle.worst, `seed ${seed}`).toBeLessThanOrEqual(thinkEvery + reaction + 0.1);
      if (s.spies[0].mode === 'escaped') escaped++;
    }
    expect(escaped).toBeGreaterThanOrEqual(7);
  });

  it('(b) the full kufřík, exit hidden until now, every room visited: he walks to the exit and escapes, never idle', () => {
    const iq: Iq = 5;
    const { thinkEvery, reaction } = IQ_PARAMS[iq];
    for (const seed of SEEDS.slice(0, 5)) {
      const s = createGame(seed, 1, { hideAirport: true });
      park(s);
      s.spies[0].hand = kufrik('klic', 'penize', 'pas', 'plany');
      s.spies[0].visited.fill(true);
      const bot = createBot(0, iq, seed);
      const idle = idleWatch();
      let events: GameEvent[] = [];
      for (let t = 0; t < 60 / DT && s.result === null; t++) {
        const input = bot.think(s, events, DT);
        idle.see(s, input);
        events = step(s, [input, NO_INPUT], DT);
      }
      expect(s.spies[0].mode, `seed ${seed}`).toBe('escaped');
      expect(idle.worst, `seed ${seed}`).toBeLessThanOrEqual(thinkEvery + reaction + 0.1);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createBot, type Bot } from '../../src/games/spy-vs-spy/bot/bot';
import { stillWorth } from '../../src/games/spy-vs-spy/bot/decide';
import { createFightMemo, fightInput } from '../../src/games/spy-vs-spy/bot/fight';
import { botMaxHealth, IQ_PARAMS, type Iq } from '../../src/games/spy-vs-spy/bot/iq';
import { createMemory } from '../../src/games/spy-vs-spy/bot/memory';
import type { BotView, OpponentView, SelfView } from '../../src/games/spy-vs-spy/bot/view';
import { inFightRange } from '../../src/games/spy-vs-spy/logic/fight';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { NO_INPUT, neighbor, type GameEvent, type GameState, type PlayerId, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { makeRng } from '../../src/shared/rng';

const DT = 1 / 60;
const MID_Z = RULES.roomD / 2;

/**
 * Both spies in createGame's shared start room, facing off near fight range: side 0 at x 80, side 1 at x 120. Health
 * per side as given (the bots' handicap by default for a bot side).
 */
function arena(seed: number, health: readonly [number, number]): GameState {
  const s = createGame(seed, 2, { maxHealth: health });
  const [a, b] = s.spies;
  b.room = a.room;
  a.x = 80;
  b.x = 120;
  a.z = MID_Z;
  b.z = MID_Z;
  return s;
}

/** A scripted opponent (side 1): keys from `script`, the bot (side 0) thinks; `each` sees every tick after the step. */
function duel(
  s: GameState, bot: Bot, seconds: number,
  script: (s: GameState, t: number) => SpyInput,
  each?: (s: GameState, events: GameEvent[], botInput: SpyInput, t: number) => boolean | void,
): void {
  let events: GameEvent[] = [];
  for (let t = 0; t < Math.round(seconds / DT); t++) {
    const botInput = bot.think(s, events, DT);
    events = step(s, [botInput, script(s, t)], DT);
    if (each?.(s, events, botInput, t) === true) return;
  }
}

/** Keys that walk side 1 to within `gap` of side 0 in x (and hold z). */
function closeIn(s: GameState, gap: number): SpyInput {
  const [a, b] = s.spies;
  const dx = a.x - b.x;
  return { ...NO_INPUT, moveX: Math.abs(dx) > gap ? (dx > 0 ? 1 : -1) : 0 };
}

/** Over 40 head bashes from a scripted basher (one a second, walking in to 38): how many the bot ducks. */
function bashesDucked(iq: Iq, seed: number): { bashes: number; ducked: number } {
  const s = arena(seed, [botMaxHealth(iq), RULES.health]);
  const bot = createBot(0, iq, seed);
  let bashes = 0;
  let ducked = 0;
  let lastPress = -Infinity;
  duel(s, bot, 120, (st, t) => {
    const [a, b] = st.spies;
    const keys = closeIn(st, 38);
    if (bashes < 40 && t - lastPress >= 60 && b.attack === null && b.swingCooldown === 0 && Math.abs(a.x - b.x) <= 42) {
      lastPress = t;
      bashes++;
      return { moveX: 0, moveY: -1, action: true, trap: false };
    }
    return keys;
  }, (st, events) => {
    // Nobody tires or runs: the scripted side is endless, the bot never low enough to flee.
    st.spies[0].health = st.spies[0].maxHealth;
    st.spies[1].health = st.spies[1].maxHealth;
    ducked += events.filter((e) => e.type === 'blocked' && e.spy === 0 && e.kind === 'bash').length;
    return bashes >= 40 && st.spies[1].attack === null;
  });
  return { bashes, ducked };
}

describe('the bot fights (spec bot §7)', () => {
  it('ducks a head bash: IQ 5 at least 32 of 40 (reads it), IQ 3 about half (guesses), IQ 1 at most 10', () => {
    const smart = bashesDucked(5, 3);
    const middling = bashesDucked(3, 3);
    const clumsy = bashesDucked(1, 3);
    expect([smart.bashes, middling.bashes, clumsy.bashes]).toEqual([40, 40, 40]);
    expect(smart.ducked).toBeGreaterThanOrEqual(32);
    expect(middling.ducked).toBeGreaterThanOrEqual(12);
    expect(middling.ducked).toBeLessThanOrEqual(28);
    expect(clumsy.ducked).toBeLessThanOrEqual(10);
    // Seeded exact numbers (recorded once; a change here means the fight behaviour changed).
    expect([smart.ducked, middling.ducked, clumsy.ducked]).toEqual([SMART_DUCKED, MIDDLING_DUCKED, CLUMSY_DUCKED]);
  });

  it('cannot react to a jab: his keys stay what they would have been for a reaction, and an unguarded jab lands', () => {
    const { reaction } = IQ_PARAMS[5];
    const react = Math.round(reaction / DT);
    let landed = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const at of [90, 150, 210]) {
        /** One run: side 1 stands in close and jabs once at tick `jab` (or never). */
        const run = (jab: number | null) => {
          const s = arena(seed, [RULES.health, RULES.health]);
          const bot = createBot(0, 5, seed);
          const inputs: SpyInput[] = [];
          const guard: boolean[] = [];
          const events: GameEvent[][] = [];
          const inRange: boolean[] = [];
          duel(s, bot, (at + 30) * DT, (st, t) => (t === jab ? { ...NO_INPUT, action: true } : closeIn(st, 36)), (st, ev, input) => {
            st.spies[0].health = st.spies[0].maxHealth;
            st.spies[1].health = st.spies[1].maxHealth;
            inputs.push(input);
            guard.push(st.spies[0].blocking);
            events.push(ev);
            inRange.push(inFightRange(st.spies[0], st.spies[1]));
          });
          return { inputs, guard, events, inRange };
        };
        const withJab = run(at);
        const without = run(null);
        // The ticks up to a reaction after the press: exactly the keys of the run without the jab.
        expect(withJab.inputs.slice(0, at + react)).toEqual(without.inputs.slice(0, at + react));
        const strike = withJab.events.findIndex((ev, t) => t >= at && ev.some((e) => (e.type === 'hit' || e.type === 'blocked') && e.spy === 0));
        if (strike < 0 || !withJab.inRange[strike]) continue;
        const blocked = withJab.events[strike].some((e) => e.type === 'blocked' && e.spy === 0);
        // Blocked only by a guard he would have held anyway (the run without the jab).
        expect(blocked).toBe(without.guard[strike]);
        if (!without.guard[strike]) landed++;
      }
    }
    expect(landed).toBeGreaterThan(0);
  });

  it('IQ 5 at health 2 against 6 leaves the room within 3 s; IQ 1 never leaves', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const iq of [5, 1] as const) {
        const s = arena(seed, [botMaxHealth(iq), 6]);
        s.spies[0].health = 2;
        const room = s.spies[0].room;
        const bot = createBot(0, iq, seed);
        let leftAt: number | null = null;
        duel(s, bot, 10, () => NO_INPUT, (st) => {
          st.spies[1].health = 6;
          if (st.spies[0].room !== room && leftAt === null) leftAt = st.time;
          return iq === 5 && leftAt !== null;
        });
        if (iq === 5) {
          expect(leftAt, `seed ${seed}`).not.toBeNull();
          expect(leftAt!, `seed ${seed}`).toBeLessThanOrEqual(3);
        } else {
          expect(leftAt, `seed ${seed}`).toBeNull();
        }
      }
    }
  });

  it('IQ 5 beats a passive opponent within 20 s', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = arena(seed, [RULES.health, RULES.health]);
      const bot = createBot(0, 5, seed);
      let won: number | null = null;
      duel(s, bot, 20, () => NO_INPUT, (st, events) => {
        if (events.some((e) => e.type === 'died' && e.spy === 1 && e.cause === 'fight')) won = st.time;
        return won !== null;
      });
      expect(won, `seed ${seed}`).not.toBeNull();
    }
  });

  it('bot against bot: IQ 5 beats IQ 1 in at least 80 % of 30 seeded fights', () => {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      // Sides alternate, so neither the start position nor the tick order favours him.
      const smartSide: PlayerId = seed % 2 === 0 ? 0 : 1;
      const iqs: [Iq, Iq] = smartSide === 0 ? [5, 1] : [1, 5];
      const s = arena(seed, [botMaxHealth(iqs[0]), botMaxHealth(iqs[1])]);
      const bots = [createBot(0, iqs[0], seed), createBot(1, iqs[1], seed)] as const;
      let events: GameEvent[] = [];
      let loser: PlayerId | null = null;
      for (let t = 0; t < 60 / DT && loser === null; t++) {
        const inputs = [bots[0].think(s, events, DT), bots[1].think(s, events, DT)] as const;
        events = step(s, inputs, DT);
        const died = events.find((e) => e.type === 'died' && e.cause === 'fight');
        if (died !== undefined && 'spy' in died) loser = died.spy;
      }
      if (loser !== null && loser !== smartSide) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(24);
    expect(wins).toBe(SMART_WINS);
  });
});

// Seeded exact numbers, recorded once from the first green run.
const SMART_DUCKED = 37;
const MIDDLING_DUCKED = 21;
const CLUMSY_DUCKED = 0;
const SMART_WINS = 30;

describe('fight details (spec bot §7, fix round 1)', () => {
  it('never swings from a door\'s zone (Akce there would open the door): lined up with an opponent by the south door', () => {
    for (const seed of [1, 2, 3]) {
      const s = arena(seed, [RULES.health, RULES.health]);
      const room = s.spies[0].room;
      const below = neighbor(s, room, 'S')!;
      s.rooms[room].doors.S = true;
      s.rooms[below].doors.N = true;
      // He stays parked (knockback undone) where the bot, at the edge of his reach in x, stands on the door's line.
      const park = (st: GameState) => {
        st.spies[1].x = 132;
        st.spies[1].z = RULES.roomD - 5;
      };
      s.spies[0].x = 100;
      park(s);
      const bot = createBot(0, 5, seed);
      let hits = 0;
      let inLine = 0;
      duel(s, bot, 8, () => NO_INPUT, (st, events) => {
        st.spies[1].health = st.spies[1].maxHealth;
        park(st);
        if (Math.abs(st.spies[0].x - RULES.roomW / 2) <= RULES.doorHalfX) inLine++;
        expect(st.spies[0].doorOpening, `seed ${seed} t=${st.time}`).toBeNull();
        expect(st.spies[0].room).toBe(room);
        hits += events.filter((e) => e.type === 'hit' && e.spy === 1).length;
      });
      expect(hits, `seed ${seed}`).toBeGreaterThan(0);
      // Most of the time on the door's line (the case that matters).
      expect(inLine, `seed ${seed}`).toBeGreaterThan(8 / DT / 2);
    }
  });

  /** A hand-made view of a fight: the bot at x 100, the opponent 36 to the right (within `STRIKE_AT`). */
  function fightView(time: number, self: Partial<SelfView> = {}, opp: Partial<OpponentView> = {}): BotView {
    return {
      time, cols: 3, rows: 3, hideAirport: false,
      self: {
        id: 0, room: 0, x: 100, z: MID_Z, facing: 1, mode: 'normal', health: 7, maxHealth: 7, hand: null,
        stock: { bomba: 0, pruzina: 0, elektrina: 0, pistole: 0, casovana: 0 }, selected: null, trapPress: null,
        mapOpen: false, clock: 200, armouryTimer: 0, swingCooldown: 0, attack: null, placing: false, placingAt: null,
        doorOpening: false, ...self,
      },
      pieces: [], doors: [],
      opponent: {
        x: 136, z: MID_Z, facing: -1, health: 7, mode: 'normal', attack: null, strikeIn: 0, blocking: false,
        ducking: false, carrying: false, ...opp,
      },
      known: [], armouryRoom: null, itemRooms: null, glance: null,
    };
  }

  /** Share of seeds (200) where the bot's next swing after the opponent's jab (landed or not) is a head bash. */
  function bashAfterJab(iq: Iq, failed: boolean): number {
    let bashes = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      const memo = createFightMemo();
      fightInput(fightView(1, {}, { attack: 'jab', strikeIn: RULES.swingWindup }), iq, rng, memo);
      // He sees the strike and, his swing ready and the opponent in his opening, presses at once.
      const keys = fightInput(fightView(1.15, { health: failed ? 7 : 6 }, { attack: 'jab', strikeIn: 0 }), iq, rng, memo);
      expect(keys.action).toBe(true);
      if (keys.moveY === -1) bashes++;
    }
    return bashes / 200;
  }

  it('punishes a failed jab with a head bash: IQ 5 nearly always, IQ 1 only by his usual mix', () => {
    expect(bashAfterJab(5, true)).toBeGreaterThanOrEqual(0.85);
    expect(bashAfterJab(5, false)).toBeLessThanOrEqual(0.65);
    const clumsy = bashAfterJab(1, true);
    expect(clumsy).toBeGreaterThanOrEqual(0.35);
    expect(clumsy).toBeLessThanOrEqual(0.65);
  });

  /** Share of seeds (200) where the bot holds block (trap, no down) while recovering from his own swing. */
  function guardRate(iq: Iq): number {
    let guards = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      const memo = createFightMemo();
      let t = 1;
      // Until he presses (a guessed duck may come first).
      while (!fightInput(fightView(t), iq, rng, memo).action) t += 1 / 60;
      const keys = fightInput(fightView(t + 1, { attack: 'jab', swingCooldown: RULES.swingCooldown }), iq, rng, memo);
      if (keys.trap && keys.moveY !== 1) guards++;
    }
    return guards / 200;
  }

  it('holds block while recovering: IQ 5 often (preBlock), IQ 1 never', () => {
    const smart = guardRate(5);
    expect(smart).toBeGreaterThanOrEqual(IQ_PARAMS[5].preBlock - 0.15);
    expect(smart).toBeLessThanOrEqual(IQ_PARAMS[5].preBlock + 0.15);
    expect(guardRate(1)).toBe(0);
  });

  it('fleeing from a fight is spent when its door is not in the room he stands in', () => {
    const view: BotView = { ...fightView(1), doors: [{ dir: 'W', key: '0-1', to: 1, open: false, exit: false }] };
    const mem = createMemory();
    expect(stillWorth(view, mem, { kind: 'flee', dir: 'W' }, 0, null)).toBe(true);
    expect(stillWorth(view, mem, { kind: 'flee', dir: 'E' }, 0, null)).toBe(false);
    expect(stillWorth({ ...view, opponent: null }, mem, { kind: 'flee', dir: 'W' }, 0, null)).toBe(false);
  });
});

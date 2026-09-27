import { rand, type RngState } from '../../../shared/rng';
import { RULES } from '../logic/rules';
import { NO_INPUT, type AttackKind, type Dir, type SpyInput } from '../logic/state';
import type { Scored } from './decide';
import { fleeDoor } from './decide-tactics';
import { type Iq, IQ_PARAMS } from './iq';
import type { Memory } from './memory';
import { atDoor } from './motor';
import type { BotView } from './view';

/**
 * The bot in a fight (spec bot §7): the same keys a person presses — Akce (jab), up + Akce (head bash), the trap key
 * (block), the trap key + down (duck) — decided on what he sees now. The motor delays them by his reaction, so a jab
 * (0.15 s) is only stopped by a guard he already held, while a bash (0.3 s) can be read and ducked at a good IQ (and
 * only guessed at below that).
 */

/** What he keeps between ticks of a fight: what he saw the opponent start, and what he decided about it. */
export interface FightMemo {
  /** the opponent's swing as seen last tick (a new one starts when it was null) */
  lastOpponentAttack: AttackKind | null;
  /** view time his last swing was pressed (a press is under way for a reaction after it) */
  decidedAt: number;
  /** whether he ducks the bash he sees coming (rolled once per bash, `duckChance`) */
  duck: boolean;
  /** view time the opponent's last swing started, and struck (his opening lies right after it) */
  opponentSwungAt: number;
  opponentStruckAt: number;
  /** his own health when the opponent's jab started: the same after its strike = it was blocked (or missed) */
  healthAtJab: number;
  /** his next swing is a bash, to punish a jab that failed (rolled with `punish`) */
  punishNext: boolean;
  /** he holds block while recovering from his own swing (rolled with `preBlock` at each swing) */
  guard: boolean;
  /** against an opponent who swings, he waits for the opening after the opponent's strike (rolled with `punish`) */
  counter: boolean;
  /** the opponent stood in reach with his swing ready last tick; a guessed duck is held until `guessUntil` */
  threat: boolean;
  guessUntil: number;
  /** view time `watchFight` last ran */
  watchedAt: number;
}

export function createFightMemo(): FightMemo {
  return {
    lastOpponentAttack: null, decidedAt: -Infinity, duck: false, opponentSwungAt: -Infinity, opponentStruckAt: -Infinity,
    healthAtJab: 0, punishNext: false, guard: false, counter: false, threat: false, guessUntil: -Infinity,
    watchedAt: -Infinity,
  };
}

/** Forgets a fight that is over: a new one starts from nothing (bot.ts, when the opponent comes into view). */
export function resetFightMemo(memo: FightMemo): void {
  Object.assign(memo, createFightMemo());
}

/** Fight and flee score above every goal but the escape and a ticking bomb (decide.ts): with the opponent in his room
 *  nothing else gets done (a fight drops nothing: what he carries stays with him). */
const FIGHT = 96;
const FLEE_FIGHT = 97;
/** Flee only while the opponent has at least this much health left (spec bot §7: "clearly losing"). */
const FLEE_OPPONENT = 4;

/** Where he stands between swings: just inside the opponent's reach (±`EDGE_SLACK`), one step from out of it. */
const EDGE = RULES.fightRangeX - 6;
const EDGE_SLACK = 3;
/** He steps in to this distance to swing, so the strike still reaches when the opponent drifts a little. */
const STRIKE_AT = RULES.fightRangeX - 10;
/** z further off where he wants to be than this: he lines up (the strike needs `fightRangeZ`; `STRIKE_Z` is as far
 *  off the opponent's z as he stays to keep out of a door's zone). */
const Z_ALIGN = 4;
const STRIKE_Z = RULES.fightRangeZ - 1;
/** Chance a swing is a head bash rather than a jab (when not punishing). */
const BASH_SHARE = 0.5;
/** The opponent swung within this long: he is pressing, worth waiting for his opening (`counter`). */
const PRESSURE = 1.5;
/** How long after the opponent's strike his opening lasts (his cooldown, less the time a press takes to arrive). */
const OPENING = 0.25;
/** A press is taken to have arrived a reaction plus this after it was made. */
const SETTLE = 0.05;
/** How long a guessed duck (`guessDuck`) is held: a bash's wind-up and half as much again. */
const GUESS_DUCK = 0.45;

/** Fight or flee, while the opponent is in his room: flee (IQ ≥ 2) when clearly losing and a door leads away. */
export function fightGoal(view: BotView, mem: Memory, iq: Iq): Scored | null {
  const opp = view.opponent;
  if (opp === null) return null;
  const { fleeAt } = IQ_PARAMS[iq];
  if (fleeAt !== null && view.self.health <= fleeAt && opp.health >= FLEE_OPPONENT) {
    const dir = fleeDoor(view, mem, false);
    if (dir !== null) return { goal: { kind: 'flee', dir }, score: FLEE_FIGHT };
  }
  return { goal: { kind: 'fight' }, score: FIGHT };
}

const sign = (d: number): -1 | 0 | 1 => (d > 0 ? 1 : d < 0 ? -1 : 0);

/** The door whose standing zone (x, z) is in (`motor.ts` `atDoor`, as `logic/places.ts` `doorAt`): Akce there opens
 *  it instead of swinging (`logic/interact.ts`). */
const doorHere = (view: BotView, x: number, z: number) => view.doors.find((d) => atDoor(d.dir, x, z)) ?? null;

/**
 * The z he lines up at: the opponent's — but, in line with a north or south door, outside its zone (Akce there opens
 * the door), with room for the drift of the keys still on their way, as far as the strike still reaches in z.
 */
function lineUpZ(view: BotView, x: number, oppZ: number, reaction: number): number {
  const margin = Z_ALIGN + RULES.speedZ * reaction;
  let z = oppZ;
  for (const d of view.doors) {
    if (d.dir === 'N' && atDoor('N', x, z)) z = RULES.doorReach + margin;
    if (d.dir === 'S' && atDoor('S', x, z)) z = RULES.roomD - RULES.doorReach - margin;
  }
  return Math.max(oppZ - STRIKE_Z, Math.min(oppZ + STRIKE_Z, z));
}

/** Keys that step out of the standing zone of the door at `dir`, into the room. */
function stepOut(dir: Dir): SpyInput {
  switch (dir) {
    case 'N': return { ...NO_INPUT, moveY: 1 };
    case 'S': return { ...NO_INPUT, moveY: -1 };
    case 'W': return { ...NO_INPUT, moveX: 1 };
    case 'E': return { ...NO_INPUT, moveX: -1 };
  }
}

/**
 * Notes what the opponent started and how it ended — as seen, event by event, one roll per event. Runs every tick the
 * opponent is in view, whatever he is doing himself (bot.ts), at most once per view time (`fightInput` calls it too).
 */
export function watchFight(view: BotView, iq: Iq, rng: RngState, memo: FightMemo): void {
  const opp = view.opponent;
  const t = view.time;
  if (opp === null || memo.watchedAt === t) return;
  memo.watchedAt = t;
  const p = IQ_PARAMS[iq];
  if (opp.attack !== null && memo.lastOpponentAttack === null) {
    memo.opponentSwungAt = t;
    if (opp.attack === 'bash') memo.duck = rand(rng) < p.duckChance;
    else memo.healthAtJab = view.self.health;
  }
  if (opp.attack !== null && opp.strikeIn <= 0 && memo.opponentStruckAt < memo.opponentSwungAt) {
    memo.opponentStruckAt = t;
    if (opp.attack === 'jab' && view.self.health >= memo.healthAtJab) memo.punishNext = rand(rng) < p.punish;
  }
  memo.lastOpponentAttack = opp.attack;
  // A guess, not a read (`guessDuck`): the moment the opponent stands in reach with his swing ready again (no swing
  // on, and the rules' cooldown run out since his strike, as seen), duck for a while in case a bash comes.
  const self = view.self;
  const threat = Math.abs(opp.x - self.x) <= RULES.fightRangeX && Math.abs(opp.z - self.z) <= RULES.fightRangeZ
    && opp.attack === null && t - memo.opponentStruckAt >= RULES.swingCooldown;
  if (threat && !memo.threat && p.guessDuck > 0 && rand(rng) < p.guessDuck) memo.guessUntil = t + GUESS_DUCK;
  memo.threat = threat;
}

/**
 * This tick's fight keys, decided on the view (the motor delays them by his reaction). In order: duck a bash he reads
 * (`duckChance`) or guesses (`guessDuck`); swing when his own swing is ready and he stands close enough (never from a
 * door's zone, where Akce opens the door) — a jab or a bash by a seeded mix, a bash after the opponent's jab failed
 * (`punish`), and against an opponent who keeps swinging only in the opening after the opponent's strike (`punish`
 * again); while recovering, hold block with the opponent in reach (`preBlock`); otherwise keep to the edge of the
 * opponent's reach.
 */
export function fightInput(view: BotView, iq: Iq, rng: RngState, memo: FightMemo): SpyInput {
  const opp = view.opponent;
  if (opp === null) {
    memo.lastOpponentAttack = null;
    return { ...NO_INPUT };
  }
  watchFight(view, iq, rng, memo);
  const p = IQ_PARAMS[iq];
  const self = view.self;
  const t = view.time;
  const dx = opp.x - self.x;
  const dz = opp.z - self.z;
  const dist = Math.abs(dx);
  const toward = sign(dx) || self.facing;
  const wantZ = lineUpZ(view, self.x, opp.z, p.reaction);
  const lineUp = Math.abs(wantZ - self.z) > Z_ALIGN ? sign(wantZ - self.z) : 0;
  const inReach = dist <= RULES.fightRangeX && Math.abs(dz) <= RULES.fightRangeZ;
  const winding = opp.attack !== null && opp.strikeIn > 0;

  const duck: SpyInput = { moveX: 0, moveY: 1, action: false, trap: true };
  if (winding && opp.attack === 'bash' && memo.duck) return duck;
  if (t < memo.guessUntil) return duck;

  // His own swing ready by the time a press arrives, and no press still on its way.
  const ready = self.attack === null && self.swingCooldown <= p.reaction
    && t - memo.decidedAt > p.reaction + SETTLE;
  const pressing = t - memo.opponentSwungAt < PRESSURE;
  const opening = opp.attack !== null && opp.strikeIn <= 0 || t - memo.opponentStruckAt < OPENING;
  if (ready && !winding && (!pressing || !memo.counter || opening)) {
    const door = doorHere(view, self.x, self.z);
    if (door !== null) return stepOut(door.dir);
    if (dist > STRIKE_AT || lineUp !== 0) return { moveX: dist > STRIKE_AT ? toward : 0, moveY: lineUp, action: false, trap: false };
    const kind: AttackKind = memo.punishNext || rand(rng) < BASH_SHARE ? 'bash' : 'jab';
    memo.punishNext = false;
    memo.decidedAt = t;
    memo.guard = rand(rng) < p.preBlock;
    memo.counter = rand(rng) < p.punish;
    return { moveX: 0, moveY: kind === 'bash' ? -1 : 0, action: true, trap: false };
  }

  if (memo.guard && inReach && !(winding && opp.attack === 'bash')) return { moveX: 0, moveY: 0, action: false, trap: true };
  const moveX: -1 | 0 | 1 = dist < EDGE - EDGE_SLACK ? (toward === 1 ? -1 : 1) : dist > EDGE + EDGE_SLACK ? toward : 0;
  return { moveX, moveY: lineUp, action: false, trap: false };
}

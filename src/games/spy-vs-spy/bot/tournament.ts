import { createGame } from '../logic/generator';
import { levelRules, scaledClock, type GameLengthMultiplier } from '../logic/rules';
import type { DeathCause, GameEvent, PlayerId, Spy, SpyInput } from '../logic/state';
import { step } from '../logic/step';
import { createBot } from './bot';
import { botMaxHealth, type Iq } from './iq';

/**
 * Headless bot-vs-bot games (spec bot §8): the tournament harness. Unlike the brain it creates and steps a
 * `GameState` itself (ruling R1); otherwise pure — the only clock is the one passed in, for measuring think time.
 */

/** How one game went. `result`: 'draw' is the game's own draw (both clocks ran out — `step` always settles this
 *  itself, the same tick the second spy goes out, so no separate both-out timeout case is reachable here);
 *  'capped' hit the hard cap. */
export interface GameSummary {
  seed: number;
  result: 'white' | 'black' | 'draw' | 'capped';
  /** game time played */
  seconds: number;
  deaths: Record<DeathCause, number>;
  trapsSet: number;
  disarmed: number;
  salvaged: number;
  /** armoury resupplies */
  armoury: number;
  /** maps opened */
  maps: number;
  /** a spy stood (moved < `STUCK_DISTANCE`, same room, 'normal') for `STUCK_SECONDS` */
  stuck: boolean;
  /** average ms per `think` call by the clock passed in (0 with the default clock) */
  thinkMs: number;
}

export interface TournamentOptions {
  games: number;
  iq: readonly [Iq, Iq];
  level: number;
  gameLength: GameLengthMultiplier;
  /** first seed; games use seed .. seed + games − 1 */
  seed: number;
  /** „Skrýt letiště" (spec §4); default off */
  hideAirport?: boolean;
}

const DT = 1 / 60;
/** The hard cap per game, in multiples of the (scaled) clock. */
const CAP_CLOCKS = 2;
/** A spy counts as stuck standing in one room, within this many units, for this many seconds of game time. */
const STUCK_DISTANCE = 1;
const STUCK_SECONDS = 60;
const CAUSES: readonly DeathCause[] = ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana', 'fight'];

/** Where a spy's current stand began: room, point and game time. */
interface Stand {
  room: number;
  x: number;
  z: number;
  since: number;
}

/** Whether `spy` has now stood for `STUCK_SECONDS`; moves `stand` on when he left it (or is not free to walk). */
function standing(stand: Stand, spy: Readonly<Spy>, time: number): boolean {
  if (spy.mode !== 'normal' || spy.room !== stand.room || Math.hypot(spy.x - stand.x, spy.z - stand.z) >= STUCK_DISTANCE) {
    stand.room = spy.room;
    stand.x = spy.x;
    stand.z = spy.z;
    stand.since = time;
    return false;
  }
  return time - stand.since >= STUCK_SECONDS;
}

/** One game bot vs bot: side 0 (White) plays `iq[0]`, side 1 (Black) `iq[1]`, each with his handicap health. */
export function playGame(
  seed: number, level: number, iq: readonly [Iq, Iq], gameLength: GameLengthMultiplier, now: () => number = () => 0,
  hideAirport = false,
): GameSummary {
  const state = createGame(seed, level, { gameLength, hideAirport, maxHealth: [botMaxHealth(iq[0]), botMaxHealth(iq[1])] });
  const bots = [createBot(0, iq[0], seed), createBot(1, iq[1], seed)] as const;
  const cap = Math.ceil((CAP_CLOCKS * scaledClock(levelRules(level).clockSeconds, gameLength)) / DT);
  const deaths = Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<DeathCause, number>;
  const counts = { trapSet: 0, disarmed: 0, salvaged: 0, resupplied: 0, mapOpened: 0 };
  const stands: Stand[] = state.spies.map((s) => ({ room: s.room, x: s.x, z: s.z, since: 0 }));
  let stuck = false;
  let thinkTime = 0;
  let thinks = 0;
  let events: GameEvent[] = [];
  let ticks = 0;
  while (state.result === null && ticks < cap) {
    const t0 = now();
    const inputs: [SpyInput, SpyInput] = [bots[0].think(state, events, DT), bots[1].think(state, events, DT)];
    thinkTime += now() - t0;
    thinks += 2;
    events = step(state, inputs, DT);
    ticks++;
    for (const e of events) {
      if (e.type === 'died') deaths[e.cause]++;
      else if (e.type in counts) counts[e.type as keyof typeof counts]++;
    }
    for (const id of [0, 1] as const satisfies readonly PlayerId[]) {
      if (standing(stands[id], state.spies[id], state.time)) stuck = true;
    }
  }
  const r = state.result;
  const result: GameSummary['result'] = r === null
    ? 'capped'
    : r.kind === 'draw' ? 'draw' : r.winner === 0 ? 'white' : 'black';
  return {
    seed, result, seconds: state.time, deaths,
    trapsSet: counts.trapSet, disarmed: counts.disarmed, salvaged: counts.salvaged,
    armoury: counts.resupplied, maps: counts.mapOpened, stuck,
    thinkMs: thinks === 0 ? 0 : thinkTime / thinks,
  };
}

/** `opts.games` games on seeds `opts.seed` onwards. */
export function runTournament(opts: TournamentOptions): GameSummary[] {
  return Array.from({ length: opts.games },
    (_, i) => playGame(opts.seed + i, opts.level, opts.iq, opts.gameLength, () => 0, opts.hideAirport ?? false));
}

const sum = (games: readonly GameSummary[], f: (g: GameSummary) => number) => games.reduce((a, g) => a + f(g), 0);
const row = (label: string, value: string) => `${label} `.padEnd(24) + value;

/** The tournament's printout (spec bot §8): plain ASCII, one line per figure. */
export function formatReport(opts: TournamentOptions, games: readonly GameSummary[]): string {
  const n = games.length;
  const count = (result: GameSummary['result']) => games.filter((g) => g.result === result).length;
  const pct = (k: number) => `${k} (${n === 0 ? 0 : Math.round((100 * k) / n)}%)`;
  const avg = (f: (g: GameSummary) => number) => (n === 0 ? 0 : sum(games, f) / n);
  const seconds = avg((g) => g.seconds);
  const stuck = games.filter((g) => g.stuck).map((g) => g.seed);
  const lines = [
    `Spy vs Spy bot tournament: ${n} games, IQ ${opts.iq[0]} (White) v IQ ${opts.iq[1]} (Black), level ${opts.level}, `
      + `length x${opts.gameLength}, seeds ${opts.seed}-${opts.seed + opts.games - 1}`,
    row('Wins White', pct(count('white'))),
    row('Wins Black', pct(count('black'))),
    row('Draws (both clocks out)', pct(count('draw'))),
    row('Capped', pct(count('capped'))),
    row('Average length', `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} (${seconds.toFixed(1)} s)`),
    row('Deaths by cause', CAUSES.map((c) => `${c} ${sum(games, (g) => g.deaths[c])}`).join(', ')),
    row('Traps', `set ${sum(games, (g) => g.trapsSet)}, disarmed ${sum(games, (g) => g.disarmed)}, `
      + `salvaged ${sum(games, (g) => g.salvaged)}`),
    row('Armoury uses', String(sum(games, (g) => g.armoury))),
    row('Map uses', String(sum(games, (g) => g.maps))),
    row('Stuck games', stuck.length === 0 ? '0' : `${stuck.length} (seeds ${stuck.join(', ')})`),
  ];
  return lines.join('\n');
}

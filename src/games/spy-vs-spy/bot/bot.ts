import { makeRng, rand } from '../../../shared/rng';
import type { GameEvent, GameState, PlayerId, SpyInput } from '../logic/state';
import { chooseGoal, exitOf, exploreFor, sameGoal, stillWorth, type ExploreTarget, type Goal } from './decide';
import { botRngSeed, type Iq, IQ_PARAMS } from './iq';
import { createMemory, forget, giveUp, remember, type Memory } from './memory';
import { createMotor, doorPoint, piecePoint, type Intent } from './motor';
import { route } from './route';
import { botView, noticedEvents, type BotView } from './view';

/**
 * The assembled computer opponent (spec bot §2): each tick eyes → notebook → goal → intent → legs. `think` is the only
 * place that takes the `GameState`, and it hands it straight to `botView`; nothing after that reads it.
 */
export interface Bot {
  readonly side: PlayerId;
  readonly iq: Iq;
  /** the goal he is pursuing (for tests and the tournament's reports) */
  readonly goal: Goal | null;
  think(state: Readonly<GameState>, events: readonly GameEvent[], dt: number): SpyInput;
}

const IDLE: Intent = { kind: 'idle' };
/** Searches of one piece in a row that start nothing before he gives up on it for a while (`giveUp`). */
const MAX_TRIES = 3;
/** His own events that answer a search: something was learned there. */
const SEARCH_ANSWERS: readonly GameEvent['type'][] = ['found', 'stored', 'swapped', 'hidden', 'alreadyHave', 'resupplied'];

const sameIntent = (a: Intent, b: Intent) => JSON.stringify(a) === JSON.stringify(b);

/** The first door on the way to `room`, or null when he is there already or knows no way. */
function towards(view: BotView, mem: Memory, room: number): Intent | null {
  const hops = route(view.known, view.cols, view.self.room, room, mem.dangers);
  if (hops === null || hops.length === 0) return null;
  return { kind: 'useDoor', dir: hops[0].dir };
}

/** What the legs do for `goal` from where he stands (`target`: where exploring heads); null when it can't be done
 *  from here — he then waits for the next think beat. */
function intentFor(goal: Goal, view: BotView, mem: Memory, target: ExploreTarget | null): Intent | null {
  switch (goal.kind) {
    case 'search':
    case 'fetch': {
      const here = view.pieces.find((p) => p.id === goal.piece);
      if (here !== undefined) return { kind: 'search', piece: here };
      const room = mem.pieces.get(goal.piece)?.room;
      return room === undefined ? null : towards(view, mem, room);
    }
    case 'escape': {
      const exit = exitOf(view);
      if (exit === null) return null;
      if (exit.room !== view.self.room) return towards(view, mem, exit.room);
      return view.doors.some((d) => d.exit) ? { kind: 'useDoor', dir: exit.dir } : null;
    }
    case 'explore':
      return target === null ? null : towards(view, mem, target.room);
    case 'map':
      return { kind: 'openMap' };
    default:
      return IDLE;
  }
}

export function createBot(side: PlayerId, iq: Iq, gameSeed: number): Bot {
  const params = IQ_PARAMS[iq];
  const rng = makeRng(botRngSeed(gameSeed, side));
  const motor = createMotor(iq, rng);
  const mem = createMemory();
  let time = 0;
  let goal: Goal | null = null;
  /** view time the current goal was taken up */
  let goalSince = 0;
  /** where the explore goal heads, worked out when a goal is chosen */
  let exploreTo: ExploreTarget | null = null;
  let sinceThink = Infinity;
  let intent: Intent = IDLE;
  let intentRoom = -1;
  /** what the legs were given last tick (the intent, or the bridge walk) */
  let driven: Intent = IDLE;
  let wasDone = true;
  /** walking towards where the repeated intent acts until then (see below) */
  let bridge: Intent = IDLE;
  let bridgeUntil = -1;
  /** search presses of one piece in a row that brought no answer */
  let tries = 0;
  let triedPiece: number | null = null;

  function think(state: Readonly<GameState>, events: readonly GameEvent[], dt: number): SpyInput {
    time += dt;
    sinceThink += dt;
    forget(mem, iq, dt, rng);
    const view = botView(state, side, rand(rng) < params.glancePerSecond * dt);
    const self = view.self;
    const noticed = noticedEvents(events, side, self.room);
    // What he was doing (last tick's intent) places a death: the piece he searched, the door he opened.
    const doorDir = intent.kind === 'useDoor' ? intent.dir : null;
    remember(mem, view, noticed, {
      pendingTrapTarget: null,
      searching: intent.kind === 'search' ? intent.piece.id : null,
      door: view.doors.find((d) => d.dir === doorDir)?.key ?? null,
    });
    if (noticed.some((e) => SEARCH_ANSWERS.includes(e.type))) tries = 0;

    // Choose again on the think beat, as soon as the goal is spent (the target vanished), or when the last intent
    // finished; the intent is worked out again then and on entering a room. An intent that can't be done from here
    // (null) waits for the beat — no re-choosing every frame.
    const done = motor.done();
    if (self.mode === 'normal') {
      const spent = goal === null || !stillWorth(view, mem, goal, goalSince, exploreTo);
      let replan = self.room !== intentRoom;
      if (spent || sinceThink >= params.thinkEvery || (done && !wasDone)) {
        const next = chooseGoal(view, mem, iq, goal, rng);
        if (goal === null || !sameGoal(next, goal)) goalSince = view.time;
        exploreTo = next.kind === 'explore' ? exploreFor(view, mem) : null;
        goal = next;
        sinceThink = 0;
        replan = true;
      }
      if (replan) {
        intent = intentFor(goal!, view, mem, exploreTo) ?? IDLE;
        intentRoom = self.room;
      }
    }
    wasDone = done;

    // The legs finished this very intent and the plan wants it again (the next door on the same side, the piece he
    // just hid something in, a press that did nothing): they only act on a new intent, so first walk towards where it
    // acts for a reaction, then give it again. A search that keeps starting nothing is left alone for a while.
    if (done && self.mode === 'normal' && time >= bridgeUntil && sameIntent(driven, intent)) {
      if (intent.kind === 'search') {
        const piece = intent.piece.id;
        if (piece !== triedPiece) tries = 0;
        triedPiece = piece;
        if (++tries > MAX_TRIES) {
          giveUp(mem, piece, view.time);
          tries = 0;
        }
      }
      if (intent.kind === 'search' || intent.kind === 'useDoor') {
        const p = intent.kind === 'search' ? piecePoint(intent.piece) : doorPoint(intent.dir);
        bridge = { kind: 'walkTo', x: p.x, z: p.z };
        bridgeUntil = time + params.reaction + dt;
      }
    }
    driven = time < bridgeUntil ? bridge : intent;
    return motor.drive(view, driven, dt);
  }

  return {
    side,
    iq,
    get goal() {
      return goal;
    },
    think,
  };
}

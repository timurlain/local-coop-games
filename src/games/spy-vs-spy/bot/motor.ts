import { rand, type RngState } from '../../../shared/rng';
import { inReach } from '../logic/places';
import { RULES } from '../logic/rules';
import { NO_INPUT, type Dir, type SpyInput, type TrapKind } from '../logic/state';
import { type Iq, IQ_PARAMS } from './iq';
import type { BotView, PieceView, SelfView } from './view';

/**
 * The bot's legs and hands (spec bot §6): turns what the brain wants into the same `SpyInput` a controller gives.
 * Everything it knows comes from the view; a reaction delay of its own game time sits between deciding and pressing.
 */
export type Intent =
  | { kind: 'idle' }
  | { kind: 'walkTo'; x: number; z: number }
  | { kind: 'useDoor'; dir: Dir }              // walk to the door, open it if closed (Akce), walk through
  | { kind: 'search'; piece: PieceView }       // walk into reach, face it, Akce (with empty hands or the thing to hide)
  | { kind: 'place'; trap: TrapKind; at: PieceView | Dir | 'here' } // cycle to `trap` by taps, walk into reach, Akce
  | { kind: 'openMap' }                        // hold the trap key past RULES.trapTapMax, release after reading
  | { kind: 'fight'; input: SpyInput };        // raw fight input from bot/fight.ts, still delayed

export interface Motor {
  /** The input for this tick. Decisions are delayed by `iq.reaction` of game time before they reach the keys. */
  drive(view: BotView, intent: Intent, dt: number): SpyInput;
  /**
   * true when the last intent has been carried out (searched, placed, went through, arrived) — or has failed for good
   * (no stock of the trap, a refused or ignored Akce). It latches while the same intent keeps being given: to repeat
   * an action (search the same piece again), the brain must give a different intent in between.
   */
  done(): boolean;
}

/** How close to a walkTo point counts as arrived (x and z); one tick moves at most 1 unit in x at 60 fps. */
const ARRIVE = 1.5;
/** How long he reads the open map before letting go of the trap key. */
const MAP_READ = 0.6;

const toward = (d: number): -1 | 0 | 1 => (Math.abs(d) <= ARRIVE ? 0 : d > 0 ? 1 : -1);

/** Movement keys toward (x, z); zero on an axis within `ARRIVE`. */
function steer(self: SelfView, x: number, z: number): SpyInput {
  return { moveX: toward(x - self.x), moveY: toward(z - self.z), action: false, trap: false };
}

/** A point inside the door's standing zone (`doorAt` geometry), halfway between the wall and the zone's edge. */
function doorPoint(dir: Dir): { x: number; z: number } {
  const r = RULES.doorReach / 2;
  switch (dir) {
    case 'N': return { x: RULES.roomW / 2, z: r };
    case 'S': return { x: RULES.roomW / 2, z: RULES.roomD - r };
    case 'W': return { x: r, z: RULES.roomD / 2 };
    case 'E': return { x: RULES.roomW - r, z: RULES.roomD / 2 };
  }
}

/** Whether (x, z) stands at the door on `dir` — the same zone as `logic/places.ts` `doorAt`. */
function atDoor(dir: Dir, x: number, z: number): boolean {
  const midX = Math.abs(x - RULES.roomW / 2) <= RULES.doorHalfX;
  const midZ = Math.abs(z - RULES.roomD / 2) <= RULES.doorHalfZ;
  switch (dir) {
    case 'N': return midX && z <= RULES.doorReach;
    case 'S': return midX && z >= RULES.roomD - RULES.doorReach;
    case 'W': return midZ && x <= RULES.doorReach;
    case 'E': return midZ && x >= RULES.roomW - RULES.doorReach;
  }
}

/** Where to stand to reach a piece: centred on it, halfway into its reach zone. */
const piecePoint = (p: PieceView) => ({ x: p.x, z: p.z + RULES.furnitureReachZ / 2 });

/** The keys that walk into the wall at `dir` (through an open door). */
function push(dir: Dir): Pick<SpyInput, 'moveX' | 'moveY'> {
  switch (dir) {
    case 'N': return { moveX: 0, moveY: -1 };
    case 'S': return { moveX: 0, moveY: 1 };
    case 'W': return { moveX: -1, moveY: 0 };
    case 'E': return { moveX: 1, moveY: 0 };
  }
}

interface Queued {
  intent: Intent;
  key: string;
  at: number;
}

export function createMotor(iq: Iq, rng: RngState): Motor {
  const { reaction, slipChance } = IQ_PARAMS[iq];
  /** his own game time: the sum of dt given to `drive` */
  let time = 0;
  /** decided but not yet released to the keys, oldest first */
  let queue: Queued[] = [];
  let active: Intent = { kind: 'idle' };
  let activeKey = JSON.stringify(active);
  let last: SpyInput = { ...NO_INPUT };

  // What the active intent has done so far (reset on release).
  let finished = true;
  let startRoom = 0;
  let startStock = 0;
  let pressedAkce = false;
  let mapSince: number | null = null;
  let slip = false;

  /** Latest decision in: the same one again keeps its timestamp; a new one replaces anything still pending (no
   *  backlog). Fight input is a delay line instead — it changes faster than a reaction, and replacing would starve
   *  it — but two given at the same motor time (dt = 0) still collapse into one. */
  function decide(intent: Intent): void {
    const key = JSON.stringify(intent);
    if (key === (queue.length > 0 ? queue[queue.length - 1].key : activeKey)) return;
    if (intent.kind !== 'fight') {
      queue = [];
      if (key === activeKey) return;
    } else {
      // A fight drops any walk still pending (it would only waste a slip draw), and dt = 0 collapses.
      queue = queue.filter((e) => e.intent.kind === 'fight');
      if (queue.length > 0 && queue[queue.length - 1].at === time) queue.pop();
    }
    queue.push({ intent, key, at: time });
  }

  function begin(e: Queued, view: BotView): void {
    active = e.intent;
    activeKey = e.key;
    finished = active.kind === 'idle' || active.kind === 'fight';
    startRoom = view.self.room;
    startStock = active.kind === 'place' ? view.self.stock[active.trap] : 0;
    pressedAkce = false;
    mapSince = null;
    // One draw per intent that walks (seeded; the tests mirror it): a wrong direction for one tick.
    slip = active.kind !== 'idle' && active.kind !== 'fight' && active.kind !== 'openMap' && rand(rng) < slipChance;
  }

  /** A key press needs a key-up in between (edges come from `spy.prev`). */
  const tapTrap = (): boolean => !last.trap;
  const pressAkce = (): boolean => !last.action;

  /** Taps the trap key until `want` is in hand; null when it is. (A `place` with no stock of `want` never gets here:
   *  `observe` finishes it first.) */
  function cycle(self: SelfView, want: TrapKind | null): SpyInput | null {
    if (self.selected === want) return last.trap ? { ...NO_INPUT } : null;
    return { ...NO_INPUT, trap: tapTrap() };
  }

  /** Stands in reach of the target with `want` in hand, then Akce — once per intent (`observe` then finishes it, so a
   *  refusal is not repeated as an endless head shake). */
  function reachAndAct(self: SelfView, want: TrapKind | null, there: boolean, point: { x: number; z: number }): SpyInput {
    const hand = cycle(self, want);
    const walk = there ? { ...NO_INPUT } : steer(self, point.x, point.z);
    if (hand !== null) return { ...walk, trap: hand.trap };
    if (!there || self.trapPress !== null || pressedAkce) return walk;
    const action = pressAkce();
    if (action) pressedAkce = true;
    return { ...walk, action };
  }

  function observe(view: BotView): void {
    const self = view.self;
    switch (active.kind) {
      case 'walkTo':
        if (Math.abs(active.x - self.x) <= ARRIVE && Math.abs(active.z - self.z) <= ARRIVE) finished = true;
        break;
      case 'useDoor':
        if (self.room !== startRoom || self.mode === 'escaped') finished = true;
        break;
      case 'search':
        // The view after the press: searching (or dead from a trap) — or the press was ignored; either way, over.
        if (pressedAkce) finished = true;
        break;
      case 'place':
        // Placed (stock −1); none of it to put in hand; or the one press was refused/ignored (not placing now).
        if (self.stock[active.trap] < startStock || self.stock[active.trap] <= 0 || (pressedAkce && !self.placing)) {
          finished = true;
        }
        break;
      case 'openMap':
        if (self.mapOpen && mapSince === null) mapSince = time;
        if (mapSince !== null && !self.mapOpen) finished = true;
        break;
    }
  }

  function keys(view: BotView): SpyInput {
    const self = view.self;
    if (active.kind === 'fight') return { ...active.input };
    if (finished || self.mode !== 'normal' || self.doorOpening || self.placing) return { ...NO_INPUT };
    switch (active.kind) {
      case 'idle':
        return { ...NO_INPUT };
      case 'walkTo':
        return steer(self, active.x, active.z);
      case 'useDoor': {
        const dir = active.dir;
        const door = view.doors.find((d) => d.dir === dir);
        if (door === undefined) return { ...NO_INPUT };
        if (!atDoor(dir, self.x, self.z)) {
          const p = doorPoint(dir);
          return steer(self, p.x, p.z);
        }
        if (!door.open) {
          // No once-only cap at a door: it may close again before he is through, and Akce there never refuses.
          pressedAkce = false;
          return reachAndAct(self, null, true, doorPoint(dir));
        }
        // Open: into the wall, kept centred on the door along it.
        const p = doorPoint(dir);
        const centre = steer(self, p.x, p.z);
        const out = push(dir);
        return {
          moveX: out.moveX !== 0 ? out.moveX : centre.moveX,
          moveY: out.moveY !== 0 ? out.moveY : centre.moveY,
          action: false,
          trap: false,
        };
      }
      case 'search': {
        const p = active.piece;
        return reachAndAct(self, null, inReach(p, self.x, self.z), piecePoint(p));
      }
      case 'place': {
        const at = active.at;
        if (at === 'here') return reachAndAct(self, active.trap, true, self);
        if (typeof at === 'string') return reachAndAct(self, active.trap, atDoor(at, self.x, self.z), doorPoint(at));
        return reachAndAct(self, active.trap, inReach(at, self.x, self.z), piecePoint(at));
      }
      case 'openMap':
        // Hold until the map has been open `MAP_READ`; a press cancelled under him (trapPress gone) is let go first.
        if (mapSince !== null) return { ...NO_INPUT, trap: time - mapSince < MAP_READ };
        return { ...NO_INPUT, trap: !(last.trap && self.trapPress === null) };
    }
  }

  function slipped(k: SpyInput): SpyInput {
    if (!slip || (k.moveX === 0 && k.moveY === 0)) return k;
    slip = false;
    return k.moveX !== 0 ? { ...k, moveX: k.moveX === 1 ? -1 : 1 } : { ...k, moveY: k.moveY === 1 ? -1 : 1 };
  }

  return {
    drive(view, intent, dt) {
      dt = Math.max(0, dt);
      time += dt;
      decide(intent);
      // Only his own time counts: a dt = 0 call advances nothing and repeats the last keys.
      if (dt <= 0) return { ...last };
      while (queue.length > 0 && time - queue[0].at >= reaction) {
        const e = queue.shift()!;
        if (e.key !== activeKey) begin(e, view);
      }
      observe(view);
      last = slipped(keys(view));
      return { ...last };
    },
    done() {
      return queue.length === 0 && finished;
    },
  };
}

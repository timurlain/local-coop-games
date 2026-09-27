import { armouryRoom } from '../logic/armoury';
import { doorKeyFor, exitVisibleTo, itemRooms } from '../logic/places';
import {
  ARMOURY_KIND, DIRS, EXIT_KEY, isActive, neighbor, opponentOf,
  type AttackKind, type Dir, type FurnitureKind, type GameEvent, type GameState, type PlaceTarget, type PlayerId, type RemedyKind,
  type SpyMode, type Thing, type TrapKind,
} from '../logic/state';

/**
 * The bot's eyes (spec bot §3): everything the brain may know, copied out of `GameState` as a human player would see
 * it on screen. This is the only bot file that reads `GameState`; no trap, no owner, no fuse, nothing hidden in
 * furniture, no other room's pieces and no opponent outside his room (except a glance) ever gets in.
 */

/** A piece of furniture in his room, as drawn. */
export interface PieceView {
  id: number;
  kind: FurnitureKind;
  x: number;
  z: number;
  /** a fixture's remedy (its look tells it) */
  source: RemedyKind | null;
  armoury: boolean;
}

/** A door of his room; the exit only while visible to him. */
export interface DoorView {
  dir: Dir;
  key: string;
  /** the neighbouring room, null for the exit */
  to: number | null;
  /** fully open (passable), not merely opening */
  open: boolean;
  exit: boolean;
}

/** The opponent, only while in the same room and active. */
export interface OpponentView {
  x: number;
  z: number;
  facing: -1 | 1;
  health: number;
  mode: SpyMode;
  attack: AttackKind | null;
  strikeIn: number;
  blocking: boolean;
  ducking: boolean;
  carrying: boolean;
}

export interface SelfView {
  id: PlayerId;
  room: number;
  x: number;
  z: number;
  facing: -1 | 1;
  mode: SpyMode;
  health: number;
  maxHealth: number;
  hand: Thing | null;
  stock: Readonly<Record<TrapKind, number>>;
  selected: TrapKind | null;
  trapPress: number | null;
  mapOpen: boolean;
  clock: number;
  armouryTimer: number;
  swingCooldown: number;
  attack: AttackKind | null;
  placing: boolean;
  /** where the trap he is putting down goes (his own hands: he knows), null when not placing */
  placingAt: PlaceTarget | null;
  doorOpening: boolean;
}

/** A visited room on his own map. */
export interface KnownRoom {
  id: number;
  doors: Readonly<Record<Dir, boolean>>;
  /** the exit side, only if the exit is visible to him */
  exit: Dir | null;
}

/** A glance at the other half of the screen: where the opponent is and what he carries. */
export interface Glance {
  room: number;
  hand: Thing | null;
}

export interface BotView {
  time: number;
  cols: number;
  rows: number;
  hideAirport: boolean;
  self: SelfView;
  pieces: PieceView[];
  doors: DoorView[];
  /** only while in the same room and active/visible */
  opponent: OpponentView | null;
  /** visited rooms only; exit only if exitVisibleTo(self) */
  known: KnownRoom[];
  /** marked for both spies */
  armouryRoom: number | null;
  /** only while self.mapOpen (the paid big map): itemRooms() */
  itemRooms: number[] | null;
  /** only when the caller passes glance = true */
  glance: Glance | null;
}

/** A copy of a thing, so the brain can never reach back into the state through it. */
function copyThing(t: Thing | null): Thing | null {
  if (t === null) return null;
  return t.kind === 'kufrik' ? { ...t, contents: [...t.contents] } : { ...t };
}

export function botView(state: Readonly<GameState>, side: PlayerId, glance: boolean): BotView {
  const spy = state.spies[side];
  const opp = opponentOf(state, spy);
  const room = state.rooms[spy.room];
  const seesExit = exitVisibleTo(state, spy);

  const pieces: PieceView[] = room.furniture.map((id) => {
    const f = state.furniture[id];
    return { id: f.id, kind: f.kind, x: f.x, z: f.z, source: f.source, armoury: f.kind === ARMOURY_KIND };
  });

  const doors: DoorView[] = [];
  for (const dir of DIRS) {
    if (room.exit === dir) {
      if (seesExit) doors.push({ dir, key: EXIT_KEY, to: null, open: state.doorOpen[EXIT_KEY]?.phase === 'open', exit: true });
      continue;
    }
    if (!room.doors[dir]) continue;
    const key = doorKeyFor(state, room.id, dir);
    doors.push({ dir, key, to: neighbor(state, room.id, dir), open: state.doorOpen[key]?.phase === 'open', exit: false });
  }

  const opponent: OpponentView | null = opp.room === spy.room && isActive(opp)
    ? {
        x: opp.x, z: opp.z, facing: opp.facing, health: opp.health, mode: opp.mode, attack: opp.attack,
        strikeIn: opp.strikeIn, blocking: opp.blocking, ducking: opp.ducking, carrying: opp.hand !== null,
      }
    : null;

  const known: KnownRoom[] = state.rooms
    .filter((r) => spy.visited[r.id])
    .map((r) => ({ id: r.id, doors: { ...r.doors }, exit: seesExit ? r.exit : null }));

  return {
    time: state.time,
    cols: state.cols,
    rows: state.rows,
    hideAirport: state.hideAirport,
    self: {
      id: spy.id, room: spy.room, x: spy.x, z: spy.z, facing: spy.facing, mode: spy.mode,
      health: spy.health, maxHealth: spy.maxHealth, hand: copyThing(spy.hand), stock: { ...spy.stock },
      selected: spy.selected, trapPress: spy.trapPress, mapOpen: spy.mapOpen, clock: spy.clock,
      armouryTimer: spy.armouryTimer, swingCooldown: spy.swingCooldown, attack: spy.attack,
      placing: spy.placing !== null, placingAt: spy.placing === null ? null : { ...spy.placing.target }, doorOpening: spy.doorOpening !== null,
    },
    pieces,
    doors,
    opponent,
    known,
    armouryRoom: armouryRoom(state),
    itemRooms: spy.mapOpen ? [...itemRooms(state, spy)] : null,
    glance: glance ? { room: opp.room, hand: copyThing(opp.hand) } : null,
  };
}

/** Events the bot's spy would notice: his own (spy === side) and ones in his current room (tick/explode). */
export function noticedEvents(events: readonly GameEvent[], side: PlayerId, room: number): GameEvent[] {
  return events.filter((e) => ('spy' in e ? e.spy === side : 'room' in e && e.room === room));
}

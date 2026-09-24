import { kill } from './death';
import { RULES } from './rules';
import {
  TRAPS, isActive,
  type DoorTrapKind, type Furniture, type FurnitureTrapKind, type GameEvent, type GameState,
  type RemedyKind, type Spy, type SpyInput, type TimeBomb,
} from './state';

export const REMEDY_FOR: Readonly<Record<FurnitureTrapKind | DoorTrapKind, RemedyKind>> = {
  bomba: 'voda',
  pruzina: 'kleste',
  elektrina: 'destnik',
  pistole: 'nuzky',
};

/** Returns true when the spy survives (matching remedy in hand, which is consumed). */
function spring(state: GameState, spy: Spy, trap: FurnitureTrapKind | DoorTrapKind, events: GameEvent[]): boolean {
  if (spy.hand?.kind === 'remedy' && spy.hand.remedy === REMEDY_FOR[trap]) {
    spy.hand = null;
    events.push({ type: 'disarmed', spy: spy.id, trap });
    return true;
  }
  kill(state, spy, trap, events);
  return false;
}

export function triggerFurnitureTrap(state: GameState, spy: Spy, f: Furniture, events: GameEvent[]): boolean {
  if (f.trap === null) return true;
  const kind = f.trap.kind;
  f.trap = null;
  return spring(state, spy, kind, events);
}

export function triggerDoorTrap(state: GameState, spy: Spy, key: string, events: GameEvent[]): boolean {
  const trap = state.doorTraps[key];
  if (!trap) return true;
  delete state.doorTraps[key];
  return spring(state, spy, trap.kind, events);
}

export function placeFurnitureTrap(spy: Spy, f: Furniture, kind: FurnitureTrapKind, events: GameEvent[]): void {
  if (f.trap !== null) {
    events.push({ type: 'trapFailed', spy: spy.id });
    return;
  }
  f.trap = { kind, owner: spy.id };
  spy.stock[kind]--;
  spy.armed = null;
  events.push({ type: 'trapSet', spy: spy.id, trap: kind });
}

export function placeDoorTrap(state: GameState, spy: Spy, key: string, kind: DoorTrapKind, events: GameEvent[]): void {
  if (state.doorTraps[key]) {
    events.push({ type: 'trapFailed', spy: spy.id });
    return;
  }
  state.doorTraps[key] = { kind, owner: spy.id };
  spy.stock[kind]--;
  spy.armed = null;
  events.push({ type: 'trapSet', spy: spy.id, trap: kind });
}

export function placeTimeBomb(state: GameState, spy: Spy, events: GameEvent[]): void {
  state.timeBombs.push({ room: spy.room, x: spy.x, z: spy.z, fuse: RULES.timeBombFuse, owner: spy.id });
  spy.stock.casovana--;
  spy.armed = null;
  events.push({ type: 'trapSet', spy: spy.id, trap: 'casovana' });
}

/** Called every tick while the Trapulator button is held. The spy does not move meanwhile. */
export function updateTrapMenu(state: GameState, spy: Spy, input: SpyInput, events: GameEvent[]): void {
  spy.menuOpen = true;
  const n = TRAPS.length;
  if (input.moveX === -1 && spy.prev.moveX !== -1) spy.menuCursor = (spy.menuCursor + n - 1) % n;
  if (input.moveX === 1 && spy.prev.moveX !== 1) spy.menuCursor = (spy.menuCursor + 1) % n;
  if (!input.action || spy.prev.action) return;
  const kind = TRAPS[spy.menuCursor];
  if (spy.stock[kind] <= 0) {
    events.push({ type: 'trapFailed', spy: spy.id });
    return;
  }
  if (kind === 'casovana') placeTimeBomb(state, spy, events);
  else if (spy.armed === kind) spy.armed = null;
  else spy.armed = kind;
}

export function updateTimeBombs(state: GameState, dt: number, events: GameEvent[]): void {
  const remaining: TimeBomb[] = [];
  for (const bomb of state.timeBombs) {
    const before = Math.ceil(bomb.fuse);
    bomb.fuse -= dt;
    if (bomb.fuse <= 0) {
      events.push({ type: 'explode', room: bomb.room });
      for (const spy of state.spies) {
        if (spy.room === bomb.room && isActive(spy)) kill(state, spy, 'casovana', events);
      }
    } else {
      if (Math.ceil(bomb.fuse) < before) events.push({ type: 'tick', room: bomb.room });
      remaining.push(bomb);
    }
  }
  state.timeBombs = remaining;
}

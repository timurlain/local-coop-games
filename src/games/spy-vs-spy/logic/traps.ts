import { kill } from './death';
import { sharesRoom } from './fight';
import { doorAt, doorKeyFor, furnitureAt } from './places';
import { RULES } from './rules';
import {
  TRAPS, isActive,
  type DoorTrapKind, type Furniture, type FurnitureTrapKind, type GameEvent, type GameState,
  type PlaceTarget, type RemedyKind, type Spy, type SpyInput, type TimeBomb, type TrapKind,
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
    events.push({ type: 'disarmed', spy: spy.id, trap, remedy: spy.hand.remedy });
    spy.hand = null;
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

/** Successful placement costs the placer clock (spec §4); never applied on a refusal. */
function chargeTrapSetCost(spy: Spy): void {
  spy.clock = Math.max(0, spy.clock - RULES.trapSetCost);
}

// ---------- the trap hand (round 4 §1) ----------

/** The hand's cycle order: empty, then every trap kind. */
const CYCLE: readonly (TrapKind | null)[] = [null, ...TRAPS];

/** The next entry after `current` in `null → bomba → pružina → elektřina → pistole → časovaná → null`,
 *  skipping kinds with no stock left; all stock 0 → null. */
export function nextSelection(current: TrapKind | null, stock: Readonly<Record<TrapKind, number>>): TrapKind | null {
  const at = CYCLE.indexOf(current);
  for (let i = 1; i <= CYCLE.length; i++) {
    const next = CYCLE[(at + i) % CYCLE.length];
    if (next === null || stock[next] > 0) return next;
  }
  return null;
}

/** The head shake (round 4 §1): an event for the sound/animation and a purely visual timer. */
export function refuse(spy: Spy, events: GameEvent[]): void {
  spy.refuseTimer = RULES.refuseTime;
  events.push({ type: 'refused', spy: spy.id });
}

/** Forgets the Trapulator press in progress and closes the map; the trap in hand stays. */
export function cancelTrapButton(spy: Spy): void {
  spy.trapPress = null;
  spy.mapOpen = false;
}

/**
 * The Trapulator button for a free spy (round 4 §1), every tick. A press released before `trapTapMax` is a tap: the
 * hand cycles (decided on release, so a hold never changes it). Reaching `trapTapMax` opens the map for as long as
 * the button stays held — charged once per opening — or, in a shared room, is refused. Neither the press nor a tap
 * stops the spy walking; only the open map does (see `step`).
 */
export function updateTrapButton(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (!input.trap) {
    if (spy.trapPress !== null && spy.trapPress < RULES.trapTapMax) spy.selected = nextSelection(spy.selected, spy.stock);
    cancelTrapButton(spy);
    return;
  }
  if (!spy.prev.trap) spy.trapPress = 0;
  if (spy.trapPress === null) return; // held since a cancelled press: ignored until released
  const before = spy.trapPress;
  spy.trapPress += dt;
  const shared = sharesRoom(state, spy);
  if (spy.mapOpen && shared) {
    // The opponent walked in while the map was open: close it; this press is spent.
    cancelTrapButton(spy);
    return;
  }
  if (before >= RULES.trapTapMax || spy.trapPress < RULES.trapTapMax) return;
  if (shared) refuse(spy, events);
  else openMap(spy, events);
}

/** Holding the Trapulator (round 4 §1): opens the map and costs the clock once per opening. */
function openMap(spy: Spy, events: GameEvent[]): void {
  spy.mapOpen = true;
  spy.clock = Math.max(0, spy.clock - RULES.mapCost);
  events.push({ type: 'mapOpened', spy: spy.id });
}

/**
 * Where `trap` would go if placed right now, or null when there is no valid, free target in reach (round 4 §1):
 * bomba/pružina on untrapped furniture (`furnitureAt`), elektřina/pistole on an untrapped door (`doorAt` — so never a
 * hidden exit), časovaná on the floor at the spy's feet. Ignores the shared-room rule (callers check that).
 */
export function placeTargetFor(state: GameState, spy: Spy, trap: TrapKind): PlaceTarget | null {
  switch (trap) {
    case 'bomba':
    case 'pruzina': {
      const f = furnitureAt(state, spy);
      return f !== null && f.trap === null ? { on: 'furniture', furniture: f.id } : null;
    }
    case 'elektrina':
    case 'pistole': {
      const d = doorAt(state, spy);
      if (d === null) return null;
      const key = doorKeyFor(state, spy.room, d);
      return state.doorTraps[key] ? null : { on: 'door', key };
    }
    case 'casovana':
      return { on: 'floor' };
  }
}

/** Akce with a trap in hand (not a swing): start putting it down, or shake the head. */
export function startPlacing(state: GameState, spy: Spy, events: GameEvent[]): void {
  const trap = spy.selected;
  if (trap === null) return;
  const target = sharesRoom(state, spy) || spy.stock[trap] <= 0 ? null : placeTargetFor(state, spy, trap);
  if (target === null) {
    refuse(spy, events);
    return;
  }
  spy.placing = { trap, target, timer: RULES.placeTime };
}

/** Every tick while placing (the spy is immobile): finishes after `placeTime`. An opponent walking in, or the target
 *  getting trapped meanwhile, turns it into a refusal; nothing is spent then. */
export function updatePlacing(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  const p = spy.placing!;
  if (sharesRoom(state, spy)) {
    spy.placing = null;
    refuse(spy, events);
    return;
  }
  p.timer -= dt;
  if (p.timer > 0) return;
  spy.placing = null;
  if (!putDown(state, spy, p.trap, p.target)) {
    refuse(spy, events);
    return;
  }
  if (p.target.on === 'door') slamShut(state, p.target.key);
  spy.stock[p.trap]--;
  spy.selected = null;
  chargeTrapSetCost(spy);
  events.push({ type: 'trapSet', spy: spy.id, trap: p.trap });
}

/** A door trap set on an open or opening door slams it shut (round 4): whoever wants through must open it again,
 *  and that opening is what fires the trap. A spy caught mid-opening is freed (the door is simply closed again). */
function slamShut(state: GameState, key: string): void {
  delete state.doorOpen[key];
  for (const s of state.spies) if (s.doorOpening === key) s.doorOpening = null;
}

/** Puts the trap on its target; false when the target has been trapped in the meantime. */
function putDown(state: GameState, spy: Spy, trap: TrapKind, target: PlaceTarget): boolean {
  switch (target.on) {
    case 'furniture': {
      const f = state.furniture[target.furniture];
      if (f.trap !== null || (trap !== 'bomba' && trap !== 'pruzina')) return false;
      f.trap = { kind: trap, owner: spy.id };
      return true;
    }
    case 'door':
      if (state.doorTraps[target.key] || (trap !== 'elektrina' && trap !== 'pistole')) return false;
      state.doorTraps[target.key] = { kind: trap, owner: spy.id };
      return true;
    case 'floor':
      state.timeBombs.push({ room: spy.room, x: spy.x, z: spy.z, fuse: RULES.timeBombFuse, owner: spy.id });
      return true;
  }
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

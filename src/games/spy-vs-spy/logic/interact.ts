import { sharesRoom, trySwing } from './fight';
import { resolveSearch } from './hand';
import { doorAt, doorKeyFor, furnitureAt } from './places';
import { RULES } from './rules';
import { startPlacing, triggerDoorTrap, triggerFurnitureTrap } from './traps';
import type { Dir, Furniture, GameEvent, GameState, Spy, SpyInput } from './state';

/**
 * Akce handling for a spy in 'normal' mode. While the opponent shares this room (spec §3, round 4
 * fix), Akce is only ever a door or an attack: a door in reach opens (priority over swinging,
 * regardless of range or a selected trap), otherwise the spy always starts a swing — even out of
 * range, where the strike simply misses at the end of the wind-up (`trySwing`/`strike`). A selected
 * trap is ignored there: no placing, no head-shake; the selection just sits until the room clears.
 * Search and hide stay disallowed in a shared room.
 */
export function updateAction(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (!input.action || spy.prev.action) return;
  const shared = sharesRoom(state, spy);
  // Spec §8: Akce while holding up is the head bash, otherwise a jab.
  const kind = input.moveY === -1 ? 'bash' : 'jab';

  if (shared) {
    const d = doorAt(state, spy);
    if (d !== null) {
      tryOpenDoor(state, spy, d, events);
      return;
    }
    trySwing(state, spy, kind, events);
    return;
  }

  // A trap in hand (round 4 §1): Akce puts it down on a valid target, or the spy shakes his head
  // (no target, target already trapped). It never opens a door, searches or hides.
  if (spy.selected !== null) {
    startPlacing(state, spy, events);
    return;
  }

  // A door in reach (spec §5): Akce opens it.
  const d = doorAt(state, spy);
  if (d !== null) {
    tryOpenDoor(state, spy, d, events);
    return;
  }

  const f = furnitureAt(state, spy);
  if (f !== null) startSearch(state, spy, f, events);
}

/** Starts opening the door at `dir`, unless it is already opening or open (a second Akce press
 *  there just waits it out). The 0.3 s countdown lives on `state.doorOpen[key]` so both spies can
 *  see it; `spy.doorOpening` only marks which spy is immobile meanwhile (spec §5). */
function tryOpenDoor(state: GameState, spy: Spy, dir: Dir, events: GameEvent[]): void {
  const key = doorKeyFor(state, spy.room, dir);
  if (state.doorOpen[key]) return;
  state.doorOpen[key] = { phase: 'opening', timer: RULES.doorOpenTime };
  spy.doorOpening = key;
}

/** Advances the 0.3 s opening countdown for the spy who pressed Akce at a door; called every tick
 *  while `spy.doorOpening` is set, in place of movement/fighting/menu (spec §5). */
export function updateDoorOpening(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  const key = spy.doorOpening!;
  const d = state.doorOpen[key];
  if (!d || d.phase !== 'opening') {
    // Defensive: the entry vanished from under us (should not happen outside tests poking state).
    spy.doorOpening = null;
    return;
  }
  d.timer -= dt;
  if (d.timer > 0) return;
  spy.doorOpening = null;
  d.phase = 'open';
  d.timer = RULES.doorOpenDuration;
  events.push({ type: 'doorOpened', spy: spy.id, key });
  // Door traps trigger on opening, never on passing (spec §5); remedy logic unchanged. The door
  // leaf has already swung, whatever happens to the opener next.
  triggerDoorTrap(state, spy, key, events);
}

export function startSearch(state: GameState, spy: Spy, f: Furniture, events: GameEvent[]): void {
  events.push({ type: 'searchStart', spy: spy.id });
  spy.blocking = false;
  spy.ducking = false;
  if (!triggerFurnitureTrap(state, spy, f, events)) return;
  spy.mode = 'searching';
  spy.modeTimer = RULES.searchTime;
  spy.searchTarget = f.id;
}

export function updateSearching(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  spy.modeTimer -= dt;
  if (spy.modeTimer > 0 || spy.searchTarget === null) return;
  const f = state.furniture[spy.searchTarget];
  const gave = spy.hand;
  spy.mode = 'normal';
  spy.modeTimer = 0;
  spy.searchTarget = null;
  const { outcome, found, stolenFrom } = resolveSearch(spy, f);
  switch (outcome) {
    case 'nothing':
    case 'putBack':
      events.push({ type: 'found', spy: spy.id, thing: null, furniture: f.id });
      break;
    case 'took':
      events.push({ type: 'found', spy: spy.id, thing: found, furniture: f.id, stolenFrom });
      break;
    case 'stored':
      // `found` is always the secret that went into the kufřík (spec §7).
      if (found?.kind === 'secret') {
        events.push({ type: 'stored', spy: spy.id, secret: found.secret, furniture: f.id, stolenFrom });
      }
      break;
    case 'swapped':
      events.push({ type: 'swapped', spy: spy.id, gave: gave!, took: found!, furniture: f.id, stolenFrom });
      break;
    case 'hidden':
      // Round 4 §2: empty furniture on a search with something in hand — it goes in.
      events.push({ type: 'hidden', spy: spy.id, thing: gave!, furniture: f.id });
      break;
  }
}

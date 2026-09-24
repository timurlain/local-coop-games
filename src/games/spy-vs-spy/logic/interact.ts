import { trySwing } from './fight';
import { canHide, hide, resolveSearch } from './hand';
import { doorAt, doorKeyFor, furnitureAt } from './places';
import { RULES } from './rules';
import { placeDoorTrap, placeFurnitureTrap, triggerFurnitureTrap } from './traps';
import type { Furniture, GameEvent, GameState, Spy, SpyInput } from './state';

/** Akce handling for a spy in 'normal' mode. */
export function updateAction(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (spy.holdTarget !== null) {
    const f = state.furniture[spy.holdTarget];
    if (!input.action) {
      spy.holdTarget = null;
      startSearch(state, spy, f, events);
      return;
    }
    spy.holdTime += dt;
    if (spy.holdTime >= RULES.hideHold) {
      spy.holdTarget = null;
      if (canHide(spy, f)) {
        hide(spy, f);
        events.push({ type: 'hidden', spy: spy.id });
      } else {
        startSearch(state, spy, f, events);
      }
    }
    return;
  }

  if (!input.action || spy.prev.action) return;
  if (trySwing(state, spy, events)) return;
  if (spy.armed !== null) {
    placeArmed(state, spy, events);
    return;
  }
  const f = furnitureAt(state, spy);
  if (f !== null) {
    spy.holdTarget = f.id;
    spy.holdTime = 0;
  }
}

function placeArmed(state: GameState, spy: Spy, events: GameEvent[]): void {
  const kind = spy.armed;
  if (kind === 'bomba' || kind === 'pruzina') {
    const f = furnitureAt(state, spy);
    if (f !== null) {
      placeFurnitureTrap(spy, f, kind, events);
      return;
    }
  } else if (kind === 'elektrina' || kind === 'pistole') {
    const d = doorAt(state, spy);
    if (d !== null) {
      placeDoorTrap(state, spy, doorKeyFor(state, spy.room, d), kind, events);
      return;
    }
  }
  events.push({ type: 'trapFailed', spy: spy.id });
}

export function startSearch(state: GameState, spy: Spy, f: Furniture, events: GameEvent[]): void {
  events.push({ type: 'searchStart', spy: spy.id });
  if (!triggerFurnitureTrap(state, spy, f, events)) return;
  spy.mode = 'searching';
  spy.modeTimer = RULES.searchTime;
  spy.searchTarget = f.id;
}

export function updateSearching(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  spy.modeTimer -= dt;
  if (spy.modeTimer > 0 || spy.searchTarget === null) return;
  const f = state.furniture[spy.searchTarget];
  spy.mode = 'normal';
  spy.modeTimer = 0;
  spy.searchTarget = null;
  const found = resolveSearch(spy, f);
  events.push({ type: 'found', spy: spy.id, thing: found });
}

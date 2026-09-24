import { cancelDoorOpening, dropHand, updateDead } from './death';
import { sharesRoom, updateBlocking, updateHealthRegen } from './fight';
import { updateAction, updateDoorOpening, updateSearching } from './interact';
import { dropOnEntering, updateMovement } from './movement';
import { updateTimeBombs, updateTrapMenu } from './traps';
import { isActive, type GameEvent, type GameState, type PlayerId, type Spy, type SpyInput } from './state';

/**
 * Advances the game by `dt` seconds. Mutates `state`; returns what happened
 * so the shell can play sounds. Pure otherwise: no DOM, no Math.random.
 */
export function step(state: GameState, inputs: readonly [SpyInput, SpyInput], dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.result !== null) return events;
  state.time += dt;
  state.tick += 1;

  for (const spy of state.spies) updateClock(state, spy, dt, events);

  // Alternate who is processed first each tick, so a simultaneous kill doesn't always favour spy 0.
  const order: readonly PlayerId[] = state.tick % 2 === 0 ? [0, 1] : [1, 0];
  // Spies that passed an internal door this tick (spec §3). Judged only after BOTH spies have
  // moved, below — evaluating a `dropOnEntering` immediately inside the per-spy loop would let
  // processing order decide it: if both spies pass doors into each other's current room in the
  // same tick, whoever is processed first would drop while the other (who by then has already
  // left) would not, even though neither ends up sharing a room with an active opponent.
  const entered = new Set<PlayerId>();
  for (const id of order) {
    const spy = state.spies[id];
    const input = inputs[spy.id];
    spy.swingCooldown = Math.max(0, spy.swingCooldown - dt);
    spy.swingAnim = Math.max(0, spy.swingAnim - dt);
    spy.lockedMsg = Math.max(0, spy.lockedMsg - dt);
    updateHealthRegen(spy, dt);
    switch (spy.mode) {
      case 'dead':
        updateDead(spy, dt, events);
        break;
      case 'searching':
        updateSearching(state, spy, dt, events);
        break;
      case 'normal':
        if (updateNormal(state, spy, input, dt, events)) entered.add(id);
        break;
      case 'out':
      case 'escaped':
        break;
    }
    spy.prev = { ...input };
  }

  // Judge entering-drops now that both spies have finished moving this tick, before the time
  // bombs tick (order chosen arbitrarily between the two end-of-tick passes; documented here
  // since nothing in the spec depends on it — bombs don't interact with entering).
  for (const id of entered) {
    const spy = state.spies[id];
    if (isActive(spy) && sharesRoom(state, spy)) dropOnEntering(state, spy, events);
  }

  updateTimeBombs(state, dt, events);
  updateDoors(state, dt);
  updateResult(state, events);
  return events;
}

/** Closes a door once its 1.5 s open window elapses (spec §5); the 0.3 s opening countdown is
 *  driven per-spy by `updateDoorOpening`, since only the opener is immobile meanwhile. */
function updateDoors(state: GameState, dt: number): void {
  for (const key of Object.keys(state.doorOpen)) {
    const d = state.doorOpen[key];
    if (d.phase !== 'open') continue;
    d.timer -= dt;
    if (d.timer <= 0) delete state.doorOpen[key];
  }
}

function updateClock(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  if (spy.mode === 'out' || spy.mode === 'escaped') return;
  spy.clock -= dt;
  if (spy.clock > 0) return;
  spy.clock = 0;
  dropHand(state, spy);
  spy.mode = 'out';
  spy.menuOpen = false;
  spy.mapOpen = false;
  spy.armed = null;
  spy.holdTarget = null;
  spy.searchTarget = null;
  spy.blocking = false;
  cancelDoorOpening(state, spy);
  events.push({ type: 'timeout', spy: spy.id });
}

/** Returns true when the spy passed through an internal door into a new room this tick. */
function updateNormal(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): boolean {
  // Opening a door (spec §5): the spy is fully immobile for the 0.3 s swing — no movement, no
  // Trapulator, no fighting — same idea as a search or a hide-hold taking over the tick.
  if (spy.doorOpening !== null) {
    updateDoorOpening(state, spy, dt, events);
    return false;
  }
  // Shared room (spec §3): the Trapulator cannot be opened, input for it is ignored. Tell the
  // player why (edge-triggered: once per fresh press, not every tick the button stays held).
  if (input.trap && sharesRoom(state, spy) && !spy.prev.trap) events.push({ type: 'trapBlocked', spy: spy.id });
  if (input.trap && !sharesRoom(state, spy)) {
    spy.holdTarget = null;
    spy.blocking = false;
    updateTrapMenu(state, spy, input, events);
    return false;
  }
  spy.menuOpen = false;
  spy.mapOpen = false;
  updateBlocking(state, spy, input);
  updateAction(state, spy, input, dt, events);
  if (spy.mode !== 'normal' || spy.holdTarget !== null) return false;
  // v1: holding the Trapulator button never moves the spy, even when the shared room
  // above ignores it for menu/map purposes (spec §3).
  if (input.trap) return false;
  return updateMovement(state, spy, input, dt, events);
}

function updateResult(state: GameState, events: GameEvent[]): void {
  const escaped = state.spies.find((s) => s.mode === 'escaped');
  if (escaped) {
    state.result = { kind: 'win', winner: escaped.id };
    return;
  }
  if (state.spies.every((s) => s.mode === 'out')) {
    state.result = { kind: 'draw' };
    events.push({ type: 'draw' });
  }
}

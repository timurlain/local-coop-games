import { cancelDoorOpening, cancelSwing, dropHand, updateDead } from './death';
import { sharesRoom, updateBlocking, updateDucking, updateHealthRegen, updateSwing } from './fight';
import { updateAction, updateDoorOpening, updateSearching } from './interact';
import { dropOnEntering, updateMovement } from './movement';
import { scoreDeltas } from './score';
import { cancelTrapButton, updatePlacing, updateTimeBombs, updateTrapButton } from './traps';
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

  // Judge both spies' blocking/ducking for this tick before either one's swing can land (spec §8).
  // Order-independent (only reads room/x as left by the previous tick, mutates neither), so it runs
  // once here rather than inside the per-spy loop below — otherwise whichever spy the alternating
  // order happens to process first would land a strike against the target's stance from last tick,
  // since the target's own stance update for this tick wouldn't have run yet.
  for (const spy of state.spies) {
    updateBlocking(state, spy, inputs[spy.id]);
    updateDucking(state, spy, inputs[spy.id]);
  }

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
    spy.refuseTimer = Math.max(0, spy.refuseTimer - dt);
    // A strike lands in this spy's turn of the alternating order (fairness above), judged against
    // the opponent's stance as last set; ducking is re-decided below only if the spy is free to.
    updateSwing(state, spy, dt, events);
    spy.ducking = false;
    updateHealthRegen(spy, dt);
    switch (spy.mode) {
      case 'dead':
        updateDead(state, spy, dt, events);
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
    // The Trapulator only listens to a free spy: dead, searching or out, any press in progress is forgotten.
    if (spy.mode !== 'normal') cancelTrapButton(spy);
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
  const [d0, d1] = scoreDeltas(state, events);
  state.spies[0].score += d0;
  state.spies[1].score += d1;
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
  // The trap in hand stays (nothing was spent), but a placement or the map in progress is dropped (round 4 §1).
  cancelTrapButton(spy);
  spy.placing = null;
  spy.refuseTimer = 0;
  spy.searchTarget = null;
  spy.blocking = false;
  spy.kickTimer = 0;
  cancelSwing(spy);
  cancelDoorOpening(state, spy);
  events.push({ type: 'timeout', spy: spy.id });
}

/** Returns true when the spy passed through an internal door into a new room this tick. */
function updateNormal(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): boolean {
  // Kicked back by the airport guard (spec §9): tumbling, fully immobile — no movement, Akce or Trapulator.
  // The trap in hand (spy.selected) intentionally stays through the kick: stock isn't spent until
  // the trap is placed, so there's nothing here to cancel.
  if (spy.kickTimer > 0) {
    spy.kickTimer = Math.max(0, spy.kickTimer - dt);
    cancelTrapButton(spy);
    return false;
  }
  // Opening a door (spec §5) or putting a trap down (round 4 §1): the spy is fully immobile — no
  // movement, no Trapulator, no fighting — same idea as a search taking over the tick.
  if (spy.doorOpening !== null) {
    cancelTrapButton(spy);
    updateDoorOpening(state, spy, dt, events);
    return false;
  }
  if (spy.placing !== null) {
    cancelTrapButton(spy);
    updatePlacing(state, spy, dt, events);
    return false;
  }
  // Round 4 §1: a tap on the Trapulator cycles the trap in hand while the spy keeps walking; a
  // hold opens the map, and only the open map holds him still (no Akce, no blocking either).
  updateTrapButton(state, spy, input, dt, events);
  if (spy.mapOpen) {
    spy.blocking = false;
    return false;
  }
  updateBlocking(state, spy, input);
  updateAction(state, spy, input, dt, events);
  // Duck (spec §8): shared room + holding down + not swinging; a ducking spy doesn't move.
  updateDucking(state, spy, input);
  if (spy.ducking) return false;
  if (spy.mode !== 'normal' || spy.placing !== null) return false;
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

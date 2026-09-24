import { dropHand, updateDead } from './death';
import { updateBlocking } from './fight';
import { updateAction, updateSearching } from './interact';
import { updateMovement } from './movement';
import { updateTimeBombs, updateTrapMenu } from './traps';
import type { GameEvent, GameState, Spy, SpyInput } from './state';

/**
 * Advances the game by `dt` seconds. Mutates `state`; returns what happened
 * so the shell can play sounds. Pure otherwise: no DOM, no Math.random.
 */
export function step(state: GameState, inputs: readonly [SpyInput, SpyInput], dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.result !== null) return events;
  state.time += dt;

  for (const spy of state.spies) updateClock(state, spy, dt, events);

  for (const spy of state.spies) {
    const input = inputs[spy.id];
    spy.swingCooldown = Math.max(0, spy.swingCooldown - dt);
    spy.swingAnim = Math.max(0, spy.swingAnim - dt);
    spy.lockedMsg = Math.max(0, spy.lockedMsg - dt);
    switch (spy.mode) {
      case 'dead':
        updateDead(spy, dt, events);
        break;
      case 'searching':
        updateSearching(state, spy, dt, events);
        break;
      case 'normal':
        updateNormal(state, spy, input, dt, events);
        break;
      case 'out':
      case 'escaped':
        break;
    }
    spy.prev = { ...input };
  }

  updateTimeBombs(state, dt, events);
  updateResult(state, events);
  return events;
}

function updateClock(state: GameState, spy: Spy, dt: number, events: GameEvent[]): void {
  if (spy.mode === 'out' || spy.mode === 'escaped') return;
  spy.clock -= dt;
  if (spy.clock > 0) return;
  spy.clock = 0;
  dropHand(state, spy);
  spy.mode = 'out';
  spy.menuOpen = false;
  spy.armed = null;
  spy.holdTarget = null;
  spy.searchTarget = null;
  spy.blocking = false;
  events.push({ type: 'timeout', spy: spy.id });
}

function updateNormal(state: GameState, spy: Spy, input: SpyInput, dt: number, events: GameEvent[]): void {
  if (input.trap) {
    spy.holdTarget = null;
    spy.blocking = false;
    updateTrapMenu(state, spy, input, events);
    return;
  }
  spy.menuOpen = false;
  updateBlocking(state, spy, input);
  updateAction(state, spy, input, dt, events);
  if (spy.mode !== 'normal' || spy.holdTarget !== null) return;
  updateMovement(state, spy, input, dt, events);
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

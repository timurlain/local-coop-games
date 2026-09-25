import { RULES } from './rules';
import { ARMOURY_KIND, TRAPS, type Furniture, type GameEvent, type GameState, type Spy, type TrapKind } from './state';

/**
 * Round 6 §4, the armoury cabinet (zbrojní skříň): the kind a spy gets from it — the one he has the fewest of, ties
 * broken in the Trapulator cycle order (bomba, pružina, elektřina, pistole, časovaná).
 */
export function resupplyKind(stock: Readonly<Record<TrapKind, number>>): TrapKind {
  let best: TrapKind = TRAPS[0];
  for (const kind of TRAPS) if (stock[kind] < stock[best]) best = kind;
  return best;
}

/** The room with the embassy's armoury (one per embassy), or null in a hand-made test state without one. */
export function armouryRoom(state: GameState): number | null {
  return state.furniture.find((f) => f.kind === ARMOURY_KIND)?.room ?? null;
}

/** +1 of `trap` in the spy's stock, blinking its digit on the Trapulator (salvage and armoury alike). */
export function addStock(spy: Spy, trap: TrapKind): void {
  spy.stock[trap]++;
  spy.stockFlash = { trap, timer: RULES.stockFlashTime };
}

/**
 * A finished search at the armoury (round 6 §4), in place of the hand/furniture exchange: nothing is ever hidden in it
 * or taken out, the hand stays as it is. Closed for this spy → the shrug (`found` with nothing, as an empty piece);
 * open → +1 of `resupplyKind` and it closes for him for `RULES.armouryCooldown`.
 */
export function searchArmoury(spy: Spy, f: Furniture, events: GameEvent[]): void {
  if (spy.armouryTimer > 0) {
    events.push({ type: 'found', spy: spy.id, thing: null, furniture: f.id });
    return;
  }
  const trap = resupplyKind(spy.stock);
  addStock(spy, trap);
  spy.armouryTimer = RULES.armouryCooldown;
  events.push({ type: 'resupplied', spy: spy.id, trap, furniture: f.id });
}

/** Every tick, in every mode: the spy's armoury timer and stock blink run down. */
export function updateArmouryTimers(spy: Spy, dt: number): void {
  spy.armouryTimer = Math.max(0, spy.armouryTimer - dt);
  if (spy.stockFlash === null) return;
  spy.stockFlash.timer -= dt;
  if (spy.stockFlash.timer <= 0) spy.stockFlash = null;
}

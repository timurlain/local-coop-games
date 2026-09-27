// Canvas smoke test for drawRoom (plan 2b, final review F3): draws every palace room across moods, strengths
// and hero placements against a recording fake context and asserts it never throws and never leaks state
// (save/restore always balanced). No real canvas — Path2D and CanvasRenderingContext2D are stubbed.

import { describe, expect, it } from 'vitest';
import { drawRoom } from '../../src/games/diktator/render/rooms/scene';
import { roomView, type RoomView } from '../../src/games/diktator/ui/palace-view';
import { albania } from '../../src/games/diktator/scenario/albania';
import { newGame } from '../../src/games/diktator/logic/turn';
import { roomOfGroup } from '../../src/games/diktator/logic/palace';
import { GROUPS, hasStrength } from '../../src/games/diktator/logic/groups';

/** Records every call and rejects a non-finite numeric argument, the way a real Path2D would misbehave silently. */
class FakePath2D {
  readonly calls: unknown[][] = [];
  constructor(...args: unknown[]) {
    this.record('new', args);
  }
  private record(name: string, args: unknown[]): void {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`Path2D.${name}: non-finite arg ${String(a)}`);
    this.calls.push([name, ...args]);
  }
  moveTo(...a: unknown[]): void { this.record('moveTo', a); }
  lineTo(...a: unknown[]): void { this.record('lineTo', a); }
  quadraticCurveTo(...a: unknown[]): void { this.record('quadraticCurveTo', a); }
  rect(...a: unknown[]): void { this.record('rect', a); }
  ellipse(...a: unknown[]): void { this.record('ellipse', a); }
  arc(...a: unknown[]): void { this.record('arc', a); }
  closePath(...a: unknown[]): void { this.record('closePath', a); }
}

/** A recording fake CanvasRenderingContext2D: any method call is recorded and checked for non-finite numeric
 * arguments; save/restore are tracked as a depth counter; any property may be set (fillStyle, font, …). */
function createFakeCtx(): CanvasRenderingContext2D & { depth: number; calls: string[] } {
  const store: Record<string, unknown> = {};
  const calls: string[] = [];
  let depth = 0;
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (prop === 'depth') return depth;
      if (prop === 'calls') return calls;
      return (...args: unknown[]) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) {
            throw new Error(`ctx.${String(prop)}(${args.map(String).join(', ')}): non-finite argument`);
          }
        }
        if (prop === 'save') depth++;
        if (prop === 'restore') {
          depth--;
          if (depth < 0) throw new Error('ctx.restore(): more restores than saves');
        }
        calls.push(String(prop));
        return undefined;
      };
    },
    set(t, prop, value) {
      t[String(prop)] = value;
      return true;
    },
  };
  return new Proxy(store, handler) as unknown as CanvasRenderingContext2D & { depth: number; calls: string[] };
}

const L = albania.palace!;
const ROOMS = L.grid.flat();
const MOODS: readonly (number | 'unknown')[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'unknown'];
const STRENGTHS = [0, 1, 5, 9];

/** A palace game state edited for one scenario: the room's groups at the given strength and mood (or unknown,
 * seenPop removed), heroes either standing in the room or elsewhere in the palace. */
function buildView(room: string, mood: number | 'unknown', strength: number, heroesPresent: boolean): RoomView {
  const s = newGame(albania, 1, undefined, { palace: true }).state;
  const p = s.palace!;
  const elsewhere = room === 'knihovna' ? 'herna' : 'knihovna';
  p.at.zogu = heroesPresent ? room : elsewhere;
  p.at.velitel = heroesPresent ? room : elsewhere;
  const groups = GROUPS.filter((g) => g !== 'povstalci' && roomOfGroup(L, g) === room);
  for (const g of groups) {
    if (hasStrength(g)) s.str[g] = strength;
    if (mood === 'unknown') delete p.seenPop[g];
    else { s.pop[g] = mood; p.seenPop[g] = mood; }
  }
  if (room === L.guardroom) s.str.povstalci = strength;
  s.hasPlane = true;
  return roomView(albania, s, room);
}

describe('drawRoom (canvas smoke test)', () => {
  it('draws every room, mood, strength and hero placement without throwing, and always balances save/restore', () => {
    const originalPath2D = globalThis.Path2D;
    (globalThis as { Path2D: unknown }).Path2D = FakePath2D;
    try {
      for (const room of ROOMS) {
        for (const mood of MOODS) {
          for (const strength of STRENGTHS) {
            for (const heroesPresent of [true, false]) {
              const view = buildView(room, mood, strength, heroesPresent);
              const ctx = createFakeCtx();
              try {
                drawRoom(ctx, view, 0.5);
              } catch (e) {
                throw new Error(
                  `drawRoom threw for room=${room} mood=${mood} strength=${strength} heroesPresent=${heroesPresent}: ${(e as Error).message}`,
                );
              }
              expect(ctx.depth, `${room} mood=${mood} strength=${strength} heroesPresent=${heroesPresent}`).toBe(0);
            }
          }
        }
      }
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = originalPath2D;
    }
  });
});

import { describe, expect, it } from 'vitest';
import { IQ_PARAMS, type Iq } from '../../src/games/spy-vs-spy/bot/iq';
import { createMotor, type Intent, type Motor } from '../../src/games/spy-vs-spy/bot/motor';
import { botView, type PieceView } from '../../src/games/spy-vs-spy/bot/view';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { step } from '../../src/games/spy-vs-spy/logic/step';
import { NO_INPUT, type GameEvent, type GameState, type SpyInput } from '../../src/games/spy-vs-spy/logic/state';
import { makeRng, rand } from '../../src/shared/rng';
import { firstFurniture, openGame } from './fixtures';

const DT = 1 / 60;

interface Run {
  events: GameEvent[];
  inputs: SpyInput[];
  ticks: number;
}

/** Drives the real `step()` with the motor's input for the bot (side 0); side 1 stands still. Stops once the motor
 *  reports done, or after `seconds` of game time. */
function run(s: GameState, motor: Motor, intent: Intent, seconds: number): Run {
  const out: Run = { events: [], inputs: [], ticks: 0 };
  for (let t = 0; t < seconds / DT; t++) {
    const input = motor.drive(botView(s, 0, false), intent, DT);
    out.inputs.push(input);
    out.events.push(...step(s, [input, NO_INPUT], DT));
    out.ticks++;
    if (motor.done()) break;
  }
  return out;
}

const pieceView = (s: GameState, room: number): PieceView => botView(s, 0, false).pieces.find((p) => p.id === firstFurniture(s, room).id)!;
const pressed = (i: SpyInput) => i.moveX !== 0 || i.moveY !== 0 || i.action || i.trap;
const mine = (e: GameEvent[], type: GameEvent['type']) => e.filter((x) => x.type === type && 'spy' in x && x.spy === 0);

describe('motor: legs and hands (spec bot §6)', () => {
  it('idle is always done and presses nothing', () => {
    const s = openGame();
    const motor = createMotor(5, makeRng(1));
    const r = run(s, motor, { kind: 'idle' }, 1);
    expect(motor.done()).toBe(true);
    expect(r.inputs.every((i) => !pressed(i))).toBe(true);
  });

  it('walkTo reaches within 3 units of the point in the same room', () => {
    const s = openGame();
    const motor = createMotor(5, makeRng(1));
    run(s, motor, { kind: 'walkTo', x: 150, z: 32 }, 10);
    expect(motor.done()).toBe(true);
    expect(s.spies[0].room).toBe(0);
    expect(Math.abs(s.spies[0].x - 150)).toBeLessThanOrEqual(3);
    expect(Math.abs(s.spies[0].z - 32)).toBeLessThanOrEqual(3);
  });

  it.each(['E', 'S'] as const)('useDoor %s on a closed door ends with the spy in the neighbouring room', (dir) => {
    const s = openGame();
    expect(Object.keys(s.doorOpen)).toEqual([]);
    const motor = createMotor(3, makeRng(2));
    const r = run(s, motor, { kind: 'useDoor', dir }, 10);
    expect(motor.done()).toBe(true);
    expect(s.spies[0].room).toBe(dir === 'E' ? 1 : 3);
    expect(mine(r.events, 'doorOpened')).toHaveLength(1);
  });

  it('useDoor with a trap in hand first taps it away (Akce would try to place it)', () => {
    const s = openGame();
    s.spies[0].selected = 'casovana';
    const motor = createMotor(5, makeRng(3));
    const r = run(s, motor, { kind: 'useDoor', dir: 'E' }, 10);
    expect(s.spies[0].room).toBe(1);
    expect(mine(r.events, 'refused')).toHaveLength(0);
    expect(mine(r.events, 'trapSet')).toHaveLength(0);
  });

  it('search on a piece in his room produces searchStart for side 0', () => {
    const s = openGame();
    const motor = createMotor(4, makeRng(4));
    const r = run(s, motor, { kind: 'search', piece: pieceView(s, 0) }, 10);
    expect(motor.done()).toBe(true);
    expect(mine(r.events, 'searchStart')).toHaveLength(1);
  });

  it('a search (or a placing) at a piece not in his room — a stale intent after a room change — presses nothing', () => {
    const s = openGame();
    const elsewhere = pieceView(s, 0);
    // He is in room 1 now; a piece of room 1 stands right where the room-0 piece's point would be.
    const here = firstFurniture(s, 1);
    here.x = elsewhere.x;
    here.z = elsewhere.z;
    s.spies[0].room = 1;
    s.spies[0].visited[1] = true;
    for (const intent of [
      { kind: 'search', piece: elsewhere },
      { kind: 'place', trap: 'bomba', at: elsewhere },
    ] as Intent[]) {
      const motor = createMotor(5, makeRng(15));
      const r = run(s, motor, intent, 3);
      expect(r.inputs.some((i) => i.action)).toBe(false);
      expect(mine(r.events, 'searchStart')).toHaveLength(0);
      expect(mine(r.events, 'trapSet')).toHaveLength(0);
      expect(motor.done()).toBe(false);
    }
  });

  it('place bomba on a piece: taps skip a kind with no stock, then trapSet (stock −1)', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.selected = 'elektrina';
    spy.stock.pistole = 0; // elektřina → (pistole skipped) → časovaná → nothing → bomba: 3 taps
    const before = spy.stock.bomba;
    const motor = createMotor(5, makeRng(5));
    const r = run(s, motor, { kind: 'place', trap: 'bomba', at: pieceView(s, 0) }, 10);
    expect(motor.done()).toBe(true);
    const set = mine(r.events, 'trapSet');
    expect(set).toHaveLength(1);
    expect(set[0]).toMatchObject({ trap: 'bomba' });
    expect(spy.stock.bomba).toBe(before - 1);
    expect(firstFurniture(s, 0).trap).toEqual({ kind: 'bomba', owner: 0 });
    const taps = r.inputs.filter((i, k) => i.trap && !(r.inputs[k - 1]?.trap ?? false)).length;
    expect(taps).toBe(3);
    expect(mine(r.events, 'mapOpened')).toHaveLength(0);
  });

  it('place elektřina on a door and časovaná here', () => {
    const s = openGame();
    const motor = createMotor(5, makeRng(6));
    const r = run(s, motor, { kind: 'place', trap: 'elektrina', at: 'S' }, 10);
    expect(mine(r.events, 'trapSet')).toMatchObject([{ trap: 'elektrina' }]);
    expect(Object.values(s.doorTraps)).toEqual([{ kind: 'elektrina', owner: 0 }]);
    const r2 = run(s, motor, { kind: 'place', trap: 'casovana', at: 'here' }, 10);
    expect(mine(r2.events, 'trapSet')).toMatchObject([{ trap: 'casovana' }]);
    expect(s.timeBombs).toHaveLength(1);
  });

  it('place with no stock of that kind presses nothing and is done (failed)', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.stock.pruzina = 0;
    spy.selected = 'bomba';
    const motor = createMotor(5, makeRng(13));
    const r = run(s, motor, { kind: 'place', trap: 'pruzina', at: pieceView(s, 0) }, 3);
    expect(motor.done()).toBe(true);
    expect(r.inputs.every((i) => !pressed(i))).toBe(true);
    for (const t of ['trapSet', 'searchStart', 'refused'] as const) expect(mine(r.events, t)).toHaveLength(0);
    expect(spy.selected).toBe('bomba');
  });

  it('a refused placement is pressed once, not as an endless head shake, and is done', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    f.trap = { kind: 'pruzina', owner: 0 };
    const motor = createMotor(5, makeRng(14));
    const intent: Intent = { kind: 'place', trap: 'bomba', at: pieceView(s, 0) };
    const events: GameEvent[] = [];
    for (let k = 0; k < 3 / DT; k++) events.push(...step(s, [motor.drive(botView(s, 0, false), intent, DT), NO_INPUT], DT));
    expect(mine(events, 'refused')).toHaveLength(1);
    expect(mine(events, 'trapSet')).toHaveLength(0);
    expect(motor.done()).toBe(true);
  });

  it('openMap opens the map once, holds it 0.6 s, and it closes afterwards', () => {
    const s = openGame();
    const motor = createMotor(5, makeRng(7));
    const r = run(s, motor, { kind: 'openMap' }, 10);
    expect(motor.done()).toBe(true);
    expect(mine(r.events, 'mapOpened')).toHaveLength(1);
    expect(s.spies[0].mapOpen).toBe(false);
    // Held: from the press through trapTapMax to open, then 0.6 s of open map.
    const held = r.inputs.filter((i) => i.trap).length * DT;
    expect(held).toBeGreaterThanOrEqual(RULES.trapTapMax + 0.6 - 1e-9);
    expect(held).toBeLessThan(RULES.trapTapMax + 0.6 + 0.1);
    // Asked again, the same (done) intent does not open it again.
    const again = run(s, motor, { kind: 'openMap' }, 2);
    expect(mine(again.events, 'mapOpened')).toHaveLength(0);
  });

  it.each([1, 3, 5] as const)('reaction at IQ %i: the first key of a new intent comes `reaction` of game time after it was given', (iq: Iq) => {
    const s = openGame();
    const motor = createMotor(iq, makeRng(8));
    const intent: Intent = { kind: 'walkTo', x: 150, z: 20 };
    let t = 0;
    let first: number | null = null;
    for (let k = 0; k < 120 && first === null; k++) {
      const input = motor.drive(botView(s, 0, false), intent, DT);
      if (pressed(input)) first = t;
      step(s, [input, NO_INPUT], DT);
      t += DT;
    }
    const reaction = IQ_PARAMS[iq].reaction;
    expect(first).not.toBeNull();
    expect(first!).toBeGreaterThanOrEqual(reaction - 1e-9);
    expect(first!).toBeLessThan(reaction + 2 * DT);
  });

  it('reaction pins the spec numbers: IQ 1 ≥ 0.8 s, IQ 5 ≥ 0.2 s', () => {
    expect(IQ_PARAMS[1].reaction).toBeGreaterThanOrEqual(0.8);
    expect(IQ_PARAMS[5].reaction).toBeGreaterThanOrEqual(0.2);
  });

  it('no backlog: 10 s of dt = 0 with changing intents, then resuming, acts on the last one only', () => {
    const s = openGame();
    s.spies[0].x = 100;
    const motor = createMotor(3, makeRng(9));
    for (let k = 0; k < 600; k++) {
      const x = k === 599 ? 10 : 180 + (k % 10);
      const input = motor.drive(botView(s, 0, false), { kind: 'walkTo', x, z: 20 }, 0);
      expect(pressed(input)).toBe(false);
    }
    const last: Intent = { kind: 'walkTo', x: 10, z: 20 };
    const r = run(s, motor, last, 6);
    expect(r.inputs.some((i) => i.moveX === 1)).toBe(false);
    expect(motor.done()).toBe(true);
    expect(Math.abs(s.spies[0].x - 10)).toBeLessThanOrEqual(3);
    // The pause did not count as reaction time: the first key came `reaction` after resuming.
    const firstKey = r.inputs.findIndex(pressed);
    expect(firstKey * DT).toBeGreaterThanOrEqual(IQ_PARAMS[3].reaction - DT - 1e-9);
  });

  it('a new intent replaces the pending one; the same intent again keeps its timestamp', () => {
    const s = openGame();
    s.spies[0].x = 100;
    const motor = createMotor(1, makeRng(10));
    const drive = (intent: Intent) => motor.drive(botView(s, 0, false), intent, DT);
    // Right, then (before it is released) left: the right one never reaches the keys.
    for (let k = 0; k < 30; k++) expect(pressed(drive({ kind: 'walkTo', x: 190, z: 20 }))).toBe(false);
    let firstLeft = -1;
    for (let k = 0; k < 100; k++) {
      const i = drive({ kind: 'walkTo', x: 10, z: 20 });
      expect(i.moveX).not.toBe(1);
      if (firstLeft < 0 && i.moveX === -1) firstLeft = k;
    }
    // Released 0.8 s after the left one was first given (not reset by each repeat).
    expect(firstLeft * DT).toBeGreaterThanOrEqual(IQ_PARAMS[1].reaction - DT - 1e-9);
    expect(firstLeft * DT).toBeLessThan(IQ_PARAMS[1].reaction + DT);
  });

  it('a negative dt does not run his clock backwards', () => {
    const s = openGame();
    const motor = createMotor(5, makeRng(15));
    const intent: Intent = { kind: 'walkTo', x: 150, z: 20 };
    motor.drive(botView(s, 0, false), intent, DT);
    motor.drive(botView(s, 0, false), intent, -10);
    let first = -1;
    for (let k = 1; k < 60 && first < 0; k++) if (pressed(motor.drive(botView(s, 0, false), intent, DT))) first = k;
    expect(first).toBeGreaterThan(0);
    expect(first * DT).toBeLessThan(IQ_PARAMS[5].reaction + 2 * DT);
  });

  it('a fight drops a walk still pending: it never reaches the keys and spends no rng draw', () => {
    const s = openGame();
    const rng = makeRng(16);
    const motor = createMotor(1, rng);
    const still: SpyInput = { ...NO_INPUT };
    for (let k = 0; k < 10; k++) motor.drive(botView(s, 0, false), { kind: 'walkTo', x: 190, z: 20 }, DT);
    for (let k = 0; k < 120; k++) expect(pressed(motor.drive(botView(s, 0, false), { kind: 'fight', input: still }, DT))).toBe(false);
    expect(rng.s).toBe(makeRng(16).s);
    expect(motor.done()).toBe(true);
  });

  it('fight input passes through the same delay', () => {
    const s = openGame();
    const motor = createMotor(3, makeRng(11));
    const jab: SpyInput = { moveX: 0, moveY: 0, action: true, trap: false };
    const outs: SpyInput[] = [];
    for (let k = 0; k < 40; k++) outs.push(motor.drive(botView(s, 0, false), { kind: 'fight', input: jab }, DT));
    const first = outs.findIndex((i) => i.action);
    expect(first * DT).toBeGreaterThanOrEqual(IQ_PARAMS[3].reaction - DT - 1e-9);
    expect(outs[outs.length - 1]).toEqual(jab);
  });

  it('slips: at IQ 1 a seeded number of intents gets one tick of the wrong direction; IQ 5 never slips', () => {
    const count = (iq: Iq, seed: number): number => {
      const s = openGame();
      const motor = createMotor(iq, makeRng(seed));
      let wrong = 0;
      for (let n = 0; n < 60; n++) {
        const x = n % 2 === 0 ? 170 : 30;
        const r = run(s, motor, { kind: 'walkTo', x, z: 20 }, 6);
        wrong += r.inputs.filter((i) => i.moveX !== 0 && i.moveX !== Math.sign(x - 100)).length;
      }
      return wrong;
    };
    // One rng draw per released intent decides a slip: mirror it.
    const expected = (iq: Iq, seed: number): number => {
      const r = makeRng(seed);
      let n = 0;
      for (let k = 0; k < 60; k++) if (rand(r) < IQ_PARAMS[iq].slipChance) n++;
      return n;
    };
    expect(expected(1, 12)).toBeGreaterThan(0);
    expect(count(1, 12)).toBe(expected(1, 12));
    expect(count(5, 12)).toBe(0);
  });
});

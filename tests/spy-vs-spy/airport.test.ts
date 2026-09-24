import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/games/spy-vs-spy/logic/generator';
import { updateMovement } from '../../src/games/spy-vs-spy/logic/movement';
import { doorAt, exitVisibleTo } from '../../src/games/spy-vs-spy/logic/places';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import { EXIT_KEY, type Dir, type GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { knownDoors } from '../../src/games/spy-vs-spy/render/map';
import { doorsToDraw } from '../../src/games/spy-vs-spy/render/room';
import { input, kufrik, openDoor, openGame, place, run, secret } from './fixtures';

const TICK = 1 / 60;
const key = (d: { room: number; dir: Dir }) => `${d.room}${d.dir}`;
const FULL = () => kufrik('klic', 'penize', 'pas', 'plany');

/** openGame with „Skrýt letiště" on; the exit is on room 2's east wall. */
function hiddenGame() {
  const s = openGame();
  s.hideAirport = true;
  return s;
}

describe('„Skrýt letiště" option', () => {
  it('is off by default and on when asked', () => {
    expect(createGame(1, 3).hideAirport).toBe(false);
    expect(createGame(1, 3, {}).hideAirport).toBe(false);
    expect(createGame(1, 3, { hideAirport: true }).hideAirport).toBe(true);
  });

  it('does not change the generated embassy', () => {
    const a = createGame(42, 5);
    const b = createGame(42, 5, { hideAirport: true });
    b.hideAirport = false;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('exitVisibleTo', () => {
  it('always shows the exit when the option is off', () => {
    const s = openGame();
    expect(exitVisibleTo(s, s.spies[0])).toBe(true);
    s.spies[0].hand = secret('pas');
    expect(exitVisibleTo(s, s.spies[0])).toBe(true);
  });

  it('hides the exit mid-game from a spy without the full kufrik', () => {
    const s = hiddenGame();
    const spy = s.spies[0];
    for (const hand of [null, secret('pas'), kufrik(), kufrik('klic', 'penize', 'pas')]) {
      spy.hand = hand;
      expect(exitVisibleTo(s, spy), JSON.stringify(hand)).toBe(false);
    }
  });

  it('shows the exit once the spy holds the kufrik with all 4 secrets — to that spy only', () => {
    const s = hiddenGame();
    s.spies[0].hand = FULL();
    expect(exitVisibleTo(s, s.spies[0])).toBe(true);
    expect(exitVisibleTo(s, s.spies[1])).toBe(false);
  });

  it('hides it again when the full kufrik leaves the hand', () => {
    const s = hiddenGame();
    s.spies[0].hand = FULL();
    expect(exitVisibleTo(s, s.spies[0])).toBe(true);
    s.spies[0].hand = null;
    expect(exitVisibleTo(s, s.spies[0])).toBe(false);
  });
});

describe('hidden exit in logic', () => {
  it('is not a door to stand at', () => {
    const s = hiddenGame();
    const spy = place(s, 0, 2, 200, 20);
    expect(doorAt(s, spy)).toBeNull();
    spy.hand = FULL();
    expect(doorAt(s, spy)).toBe('E');
  });

  it('blocks like a wall: no escape, no „Zamčeno", the spy stays in the room', () => {
    const s = hiddenGame();
    const spy = place(s, 0, 2, 190, 20);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 120; i++) updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(ev).toEqual([]);
    expect(spy.room).toBe(2);
    expect(spy.x).toBe(RULES.roomW);
    expect(spy.mode).toBe('normal');
    expect(spy.lockedMsg).toBe(0);
  });

  it('blocks like a wall even with a partial kufrik', () => {
    const s = hiddenGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = kufrik('klic', 'penize', 'pas');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(ev).toEqual([]);
  });

  it('lets the spy escape once it holds the full kufrik', () => {
    const s = hiddenGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.hand = FULL();
    openDoor(s, 0, 'E');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(spy.mode).toBe('escaped');
    expect(ev).toEqual([{ type: 'escaped', spy: 0 }]);
  });

  it('cannot take a door trap while hidden', () => {
    const s = hiddenGame();
    const spy = place(s, 0, 2, 200, 20);
    spy.armed = 'elektrina';
    const ev = run(s, [input({ action: true }), input()], TICK);
    expect(s.doorTraps[EXIT_KEY]).toBeUndefined();
    expect(ev).toContainEqual({ type: 'trapFailed', spy: 0 });
  });

  it('works as before when the option is off', () => {
    const s = openGame();
    const spy = place(s, 0, 2, 200, 20);
    openDoor(s, 0, 'E');
    const ev: GameEvent[] = [];
    updateMovement(s, spy, input({ moveX: 1 }), TICK, ev);
    expect(ev).toEqual([{ type: 'locked', spy: 0 }]);
  });
});

describe('hidden exit on the maps', () => {
  it('leaves the exit out of knownDoors even in a visited exit room', () => {
    const s = hiddenGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[2] = true;
    const doors = knownDoors(s, spy).map(key);
    expect(doors).not.toContain('2E');
    expect(doors).toContain('2S'); // ordinary doors still show
  });

  it('adds the exit for the spy holding the full kufrik, not for the opponent', () => {
    const s = hiddenGame();
    for (const spy of s.spies) spy.visited.fill(true);
    s.spies[0].hand = FULL();
    expect(knownDoors(s, s.spies[0]).map(key)).toContain('2E');
    expect(knownDoors(s, s.spies[1]).map(key)).not.toContain('2E');
  });
});

describe('hidden exit in the room view', () => {
  it('draws the exit only when it is visible to the viewer', () => {
    const s = openGame();
    const room = s.rooms[2]; // doors W and S, exit E
    const dirs = (show: boolean) => doorsToDraw(room, show).map((d) => `${d.dir}${d.isExit ? '!' : ''}`).sort();
    expect(dirs(true)).toEqual(['E!', 'S', 'W']);
    expect(dirs(false)).toEqual(['S', 'W']);
  });
});

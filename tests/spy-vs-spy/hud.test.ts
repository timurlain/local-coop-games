import { describe, expect, it } from 'vitest';
import type { Dir } from '../../src/games/spy-vs-spy/logic/state';
import { armedTrapHint, trapMenuLabel } from '../../src/games/spy-vs-spy/render/hud';
import { itemRooms, knownDoors } from '../../src/games/spy-vs-spy/render/map';
import { TOAST_TIME, currentToast, pushToast, toastFor, type ToastQueue } from '../../src/games/spy-vs-spy/render/toast';
import { defusedBy, formatLed } from '../../src/games/spy-vs-spy/render/trapulator';
import { firstFurniture, kufrik, openGame, remedy, secret } from './fixtures';

const key = (d: { room: number; dir: Dir }) => `${d.room}${d.dir}`;
const doors = (list: readonly { room: number; dir: Dir }[]) => list.map(key).sort();

describe('formatLed', () => {
  it('shows M:SS:hh with hundredths', () => {
    expect(formatLed(479.86)).toBe('7:59:86');
    expect(formatLed(5.004)).toBe('0:05:00');
    expect(formatLed(0)).toBe('0:00:00');
    expect(formatLed(480)).toBe('8:00:00');
    expect(formatLed(59.999)).toBe('1:00:00');
    expect(formatLed(-3)).toBe('0:00:00');
  });
});

describe('defusedBy', () => {
  it('maps each remedy to the trap it defuses', () => {
    expect(defusedBy('voda')).toBe('bomba');
    expect(defusedBy('kleste')).toBe('pruzina');
    expect(defusedBy('destnik')).toBe('elektrina');
    expect(defusedBy('nuzky')).toBe('pistole');
  });
});

describe('knownDoors', () => {
  it('lists only the doors of visited rooms', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[0] = true;
    expect(doors(knownDoors(s, spy))).toEqual(['0E', '0S']);
  });

  it('reports a door between two visited rooms once', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[0] = true;
    spy.visited[1] = true;
    expect(doors(knownDoors(s, spy))).toEqual(['0E', '0S', '1E', '1S']);
  });

  it('knows a door from its far side too, reported from the same side', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[4] = true;
    // room 4's north door is the south door of room 1, west door the east door of room 3
    expect(doors(knownDoors(s, spy))).toEqual(['1S', '3E', '4E', '4S']);
  });

  it('skips walls without a door', () => {
    const s = openGame();
    s.rooms[0].doors.E = false;
    s.rooms[1].doors.W = false;
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[0] = true;
    expect(doors(knownDoors(s, spy))).toEqual(['0S']);
  });

  it('includes the exit only once its room was visited', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[1] = true;
    expect(knownDoors(s, spy).map(key)).not.toContain('2E');
    spy.visited[2] = true;
    expect(knownDoors(s, spy).map(key)).toContain('2E');
  });

  it('never depends on the opponent', () => {
    const s = openGame();
    s.spies[0].visited.fill(false);
    s.spies[0].visited[0] = true;
    s.spies[1].visited.fill(true);
    expect(doors(knownDoors(s, s.spies[0]))).toEqual(['0E', '0S']);
  });
});

describe('itemRooms', () => {
  it('marks visited rooms whose furniture hides a secret or the kufrik', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(false);
    spy.visited[0] = true;
    spy.visited[1] = true;
    spy.visited[2] = true;
    firstFurniture(s, 0).hidden = secret('klic');
    firstFurniture(s, 1).hidden = kufrik();
    firstFurniture(s, 2).hidden = remedy('voda');
    firstFurniture(s, 5).hidden = secret('pas'); // not visited
    expect([...itemRooms(s, spy)].sort()).toEqual([0, 1]);
  });

  it('ignores what the opponent carries', () => {
    const s = openGame();
    const spy = s.spies[0];
    spy.visited.fill(true);
    s.spies[1].hand = kufrik('plany');
    expect(itemRooms(s, spy).size).toBe(0);
  });
});

describe('trapMenuLabel', () => {
  it('combines the selected trap name with how to arm it', () => {
    expect(trapMenuLabel(0)).toBe('Bomba · F nastražit');
    expect(trapMenuLabel(2)).toBe('Elektrický kbelík · F nastražit');
  });

  it('shows how to open the map when the cursor is on MAPA', () => {
    expect(trapMenuLabel(5)).toBe('Mapa · F otevřít mapu');
  });
});

describe('armedTrapHint', () => {
  it('points at furniture for bomba and pruzina', () => {
    expect(armedTrapHint('bomba')).toBe('Bomba připravena – F u nábytku');
    expect(armedTrapHint('pruzina')).toBe('Pružina připravena – F u nábytku');
  });

  it('points at a door for elektrina and pistole', () => {
    expect(armedTrapHint('elektrina')).toBe('Elektrický kbelík připravena – F u dveří');
    expect(armedTrapHint('pistole')).toBe('Pistole na provázku připravena – F u dveří');
  });
});

describe('toast queue', () => {
  it('names and colours the thing entering the hand', () => {
    expect(toastFor(remedy('voda'))).toEqual({ text: 'Kbelík vody', kind: 'remedy' });
    expect(toastFor(secret('plany'))).toEqual({ text: 'Plány', kind: 'secret' });
    expect(toastFor(kufrik('klic'))).toEqual({ text: 'Kufřík', kind: 'kufrik' });
  });

  it(`shows a toast for ${TOAST_TIME} s`, () => {
    const q: ToastQueue = [];
    pushToast(q, toastFor(secret('pas')), 10);
    expect(currentToast(q, 10)?.text).toBe('Pas');
    expect(currentToast(q, 10 + TOAST_TIME - 0.01)?.text).toBe('Pas');
    expect(currentToast(q, 10 + TOAST_TIME)).toBeNull();
    expect(q).toHaveLength(0);
  });

  it('queues toasts one after another', () => {
    const q: ToastQueue = [];
    pushToast(q, toastFor(secret('pas')), 10);
    pushToast(q, toastFor(kufrik()), 10.5);
    expect(currentToast(q, 11)?.text).toBe('Pas');
    expect(currentToast(q, 10 + TOAST_TIME + 0.1)?.text).toBe('Kufřík');
    expect(currentToast(q, 10 + 2 * TOAST_TIME + 0.1)).toBeNull();
  });

  it('starts at once when the previous toast is over', () => {
    const q: ToastQueue = [];
    pushToast(q, toastFor(secret('pas')), 10);
    pushToast(q, toastFor(remedy('nuzky')), 20);
    expect(currentToast(q, 20)?.text).toBe('Nůžky');
  });
});

import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import type { Command } from '../../src/games/diktator/logic/state';
import { CLOSED, clampFocus, heroOf, isSolo, join, keysFor, navigate, NO_SEATS, palaceAct, seatedDevices } from '../../src/games/diktator/ui/controls';

const P = cs.diktator.palace;

describe('navigate', () => {
  it('opens a closed menu with Action, and passes arrows and the seal key through', () => {
    expect(navigate(CLOSED, { kind: 'action' }, 3, false)).toEqual({ ui: { open: true, focus: 0 }, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'action' }, 0, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'dir', dir: 'left' }, 3, false).pass).toEqual({ kind: 'dir', dir: 'left' });
    expect(navigate(CLOSED, { kind: 'seal' }, 3, false).pass).toEqual({ kind: 'seal' });
    expect(navigate(CLOSED, { kind: 'close' }, 3, false).pass).toBeNull();
  });

  it('moves the focus up and down, but leaves the menu (closes and passes the intent through) at the ends', () => {
    const open = { open: true, focus: 0 };
    expect(navigate(open, { kind: 'dir', dir: 'down' }, 3, false).ui.focus).toBe(1);
    expect(navigate(open, { kind: 'dir', dir: 'up' }, 3, false)).toEqual({
      ui: CLOSED,
      chosen: null,
      pass: { kind: 'dir', dir: 'up' },
    });
    const bottom = { open: true, focus: 2 };
    expect(navigate(bottom, { kind: 'dir', dir: 'up' }, 3, false).ui.focus).toBe(1);
    expect(navigate(bottom, { kind: 'dir', dir: 'down' }, 3, false)).toEqual({
      ui: CLOSED,
      chosen: null,
      pass: { kind: 'dir', dir: 'down' },
    });
  });

  it('left and right always leave an open (non-modal) menu, closing it and passing the intent through', () => {
    const open = { open: true, focus: 1 };
    expect(navigate(open, { kind: 'dir', dir: 'left' }, 3, false)).toEqual({
      ui: CLOSED,
      chosen: null,
      pass: { kind: 'dir', dir: 'left' },
    });
    expect(navigate(open, { kind: 'dir', dir: 'right' }, 3, false)).toEqual({
      ui: CLOSED,
      chosen: null,
      pass: { kind: 'dir', dir: 'right' },
    });
  });

  it('an empty open menu passes every arrow through and closes', () => {
    const open = { open: true, focus: 0 };
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      expect(navigate(open, { kind: 'dir', dir }, 0, false)).toEqual({ ui: CLOSED, chosen: null, pass: { kind: 'dir', dir } });
    }
  });

  it('chooses the focused item and closes, or closes on Esc / seal key', () => {
    const open = { open: true, focus: 2 };
    expect(navigate(open, { kind: 'action' }, 3, false)).toEqual({ ui: CLOSED, chosen: 2, pass: null });
    expect(navigate(open, { kind: 'close' }, 3, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(open, { kind: 'seal' }, 3, false)).toEqual({ ui: CLOSED, chosen: null, pass: null });
  });

  it('keeps a modal menu open: arrows move the focus, Action chooses, Esc does nothing', () => {
    expect(navigate(CLOSED, { kind: 'dir', dir: 'down' }, 4, true).ui.focus).toBe(1);
    expect(navigate({ open: false, focus: 1 }, { kind: 'action' }, 4, true)).toEqual({ ui: { open: false, focus: 1 }, chosen: 1, pass: null });
    expect(navigate(CLOSED, { kind: 'close' }, 4, true)).toEqual({ ui: CLOSED, chosen: null, pass: null });
    expect(navigate(CLOSED, { kind: 'dir', dir: 'left' }, 4, true).pass).toBeNull();
  });

  it('clamps the focus when the menu shrinks', () => {
    expect(clampFocus({ open: true, focus: 5 }, 3)).toEqual({ open: true, focus: 2 });
    expect(clampFocus({ open: true, focus: 1 }, 3)).toEqual({ open: true, focus: 1 });
    expect(clampFocus({ open: true, focus: 1 }, 0)).toEqual({ open: true, focus: 0 });
  });
});

describe('palaceAct', () => {
  const cmds: Command[] = [
    { type: 'move', hero: 'zogu', dir: 'left' },
    { type: 'giveSeal', hero: 'zogu' },
    { type: 'endDay', hero: 'zogu' },
  ];
  it('turns an arrow into a move, or a bump at a wall', () => {
    expect(palaceAct(cmds, { kind: 'dir', dir: 'left' })).toEqual({ kind: 'command', command: cmds[0] });
    expect(palaceAct(cmds, { kind: 'dir', dir: 'up' })).toEqual({ kind: 'bump', dir: 'up' });
  });
  it('turns the seal key into take or give, preferring take', () => {
    expect(palaceAct(cmds, { kind: 'seal' })).toEqual({ kind: 'command', command: cmds[1] });
    const both: Command[] = [{ type: 'giveSeal', hero: 'zogu' }, { type: 'takeSeal', hero: 'zogu' }];
    expect(palaceAct(both, { kind: 'seal' })).toEqual({ kind: 'command', command: both[1] });
    expect(palaceAct([], { kind: 'seal' })).toBeNull();
    expect(palaceAct(cmds, { kind: 'action' })).toBeNull();
  });
  it('never bumps or moves a hero who ended his day (no commands)', () => {
    expect(palaceAct([], { kind: 'dir', dir: 'up' })).toBeNull();
  });
});

describe('keysFor', () => {
  it('names the keys for each device, and nothing for no device', () => {
    expect(keysFor('kb-left')).toBe(P.keys['kb-left']);
    expect(keysFor('kb-right')).toBe(P.keys['kb-right']);
    expect(keysFor('pad-0')).toBe(P.keys.pad);
    expect(keysFor(null)).toBe('');
  });
});

describe('seats', () => {
  it('always gives the left keyboard to Zogu and the right one to Vlček', () => {
    expect(join(NO_SEATS, 'kb-right')).toEqual({ zogu: null, velitel: 'kb-right' });
    expect(join(join(NO_SEATS, 'kb-right'), 'kb-left')).toEqual({ zogu: 'kb-left', velitel: 'kb-right' });
  });

  it('gives a gamepad the free hero, Zogu first', () => {
    expect(join(NO_SEATS, 'pad-0')).toEqual({ zogu: 'pad-0', velitel: null });
    expect(join({ zogu: 'kb-left', velitel: null }, 'pad-1')).toEqual({ zogu: 'kb-left', velitel: 'pad-1' });
    expect(join({ zogu: 'pad-0', velitel: null }, 'kb-left')).toEqual({ zogu: 'pad-0', velitel: null });
  });

  it('joins a device once and lists the seated devices', () => {
    const s = join(join(NO_SEATS, 'kb-left'), 'pad-0');
    expect(join(s, 'kb-left')).toBe(s);
    expect(seatedDevices(s)).toEqual(['kb-left', 'pad-0']);
  });

  it('one device alone steers both heroes; two players steer their own', () => {
    const solo = join(NO_SEATS, 'kb-right');
    expect(isSolo(solo)).toBe(true);
    expect(heroOf(solo, 'kb-right', 'zogu')).toBe('zogu');
    expect(heroOf(solo, 'kb-left', 'zogu')).toBeNull();
    const duo = join(solo, 'kb-left');
    expect(isSolo(duo)).toBe(false);
    expect(heroOf(duo, 'kb-left', 'velitel')).toBe('zogu');
    expect(heroOf(duo, 'kb-right', 'zogu')).toBe('velitel');
  });
});

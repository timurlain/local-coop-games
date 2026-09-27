// Controls of the palace game (spec §12), device-free and pure: menu navigation shared by the halves and the
// shared screens, what an arrow or the seal key means in the palace, and which device steers which hero.

import { cs } from '../../../shared/i18n/cs';
import type { DeviceId } from '../../../shared/input/manager';
import type { Direction, Hero } from '../logic/palace';
import type { Command } from '../logic/state';

const P = cs.diktator.palace;

export type Intent =
  | { readonly kind: 'dir'; readonly dir: Direction }
  | { readonly kind: 'action' }
  | { readonly kind: 'seal' }
  | { readonly kind: 'close' };

export interface MenuUi {
  readonly open: boolean;
  readonly focus: number;
}

export const CLOSED: MenuUi = { open: false, focus: 0 };

export interface NavResult {
  readonly ui: MenuUi;
  /** Index of the chosen item. */
  readonly chosen: number | null;
  /** An intent a closed menu does not handle (arrows, the seal key), for the palace to act on. */
  readonly pass: Intent | null;
}

/**
 * One intent applied to a menu of `count` items. A modal menu (the audience, a shared screen) is always open:
 * arrows move its focus, Action chooses, nothing closes it. A closed menu opens on Action and passes arrows and
 * the seal key through.
 */
export function navigate(ui: MenuUi, intent: Intent, count: number, modal: boolean): NavResult {
  if (!ui.open && !modal) {
    if (intent.kind === 'action') return { ui: count > 0 ? { open: true, focus: 0 } : ui, chosen: null, pass: null };
    return { ui, chosen: null, pass: intent.kind === 'close' ? null : intent };
  }
  const after = modal ? ui : CLOSED;
  switch (intent.kind) {
    case 'dir': {
      if (modal) {
        if ((intent.dir !== 'up' && intent.dir !== 'down') || count === 0) return { ui, chosen: null, pass: null };
        const step = intent.dir === 'up' ? -1 : 1;
        return { ui: { open: ui.open, focus: (ui.focus + step + count) % count }, chosen: null, pass: null };
      }
      // A non-modal open menu: left/right always leave, an empty menu leaves on any arrow, and up/down leave once
      // the focus is already at that end (no wrap-around any more — the ends now leave the menu).
      if (count === 0 || intent.dir === 'left' || intent.dir === 'right') return { ui: after, chosen: null, pass: intent };
      const leaves = (intent.dir === 'up' && ui.focus === 0) || (intent.dir === 'down' && ui.focus === count - 1);
      if (leaves) return { ui: after, chosen: null, pass: intent };
      const step = intent.dir === 'up' ? -1 : 1;
      return { ui: { open: ui.open, focus: ui.focus + step }, chosen: null, pass: null };
    }
    case 'action':
      return { ui: after, chosen: count > 0 ? Math.min(ui.focus, count - 1) : null, pass: null };
    case 'seal':
    case 'close':
      return { ui: after, chosen: null, pass: null };
  }
}

export function clampFocus(ui: MenuUi, count: number): MenuUi {
  return ui.focus < count || ui.focus === 0 ? ui : { ...ui, focus: Math.max(0, count - 1) };
}

export type PalaceAct =
  | { readonly kind: 'command'; readonly command: Command }
  | { readonly kind: 'bump'; readonly dir: Direction }
  | null;

/** A passed-through intent in the palace: a move to the next room, a bump against a wall, or the seal shortcut.
 * No commands (a hero who ended his day) never bumps or moves — null for any intent. */
export function palaceAct(commands: readonly Command[], intent: Intent): PalaceAct {
  if (commands.length === 0) return null;
  if (intent.kind === 'dir') {
    const move = commands.find((c) => c.type === 'move' && c.dir === intent.dir);
    return move ? { kind: 'command', command: move } : { kind: 'bump', dir: intent.dir };
  }
  if (intent.kind === 'seal') {
    const seal = commands.find((c) => c.type === 'takeSeal') ?? commands.find((c) => c.type === 'giveSeal');
    return seal ? { kind: 'command', command: seal } : null;
  }
  return null;
}

export interface Seats {
  readonly zogu: DeviceId | null;
  readonly velitel: DeviceId | null;
}

export const NO_SEATS: Seats = { zogu: null, velitel: null };

/** The left keyboard (F, WASD) always plays Zogu and the right one (Enter, arrows) always plays Vlček;
 * a gamepad takes the free hero, Zogu first. A device joins once. */
export function join(seats: Seats, d: DeviceId): Seats {
  if (seats.zogu === d || seats.velitel === d) return seats;
  if (d === 'kb-left') return seats.zogu === null ? { ...seats, zogu: d } : seats;
  if (d === 'kb-right') return seats.velitel === null ? { ...seats, velitel: d } : seats;
  if (seats.zogu === null) return { ...seats, zogu: d };
  if (seats.velitel === null) return { ...seats, velitel: d };
  return seats;
}

/** Exactly one device joined: it steers both heroes (Tab / Back switches). */
export function isSolo(seats: Seats): boolean {
  return (seats.zogu === null) !== (seats.velitel === null);
}

export function seatedDevices(seats: Seats): DeviceId[] {
  return [seats.zogu, seats.velitel].filter((d): d is DeviceId => d !== null);
}

/** The hero this device steers now: its own seat, or in solo play whichever hero the player switched to. */
export function heroOf(seats: Seats, d: DeviceId, active: Hero): Hero | null {
  if (isSolo(seats)) return seats.zogu === d || seats.velitel === d ? active : null;
  if (seats.zogu === d) return 'zogu';
  if (seats.velitel === d) return 'velitel';
  return null;
}

/** The control reminder for a device (play-test: "how am I supposed to control the two players?"); '' for none. */
/** The Action key's short name on a device, for the march's „Drž F — vyjednávat“ bubble. */
export function actionKeyOf(d: DeviceId | null): string {
  if (d === 'kb-right') return 'Enter';
  if (d?.startsWith('pad-')) return 'A';
  return 'F';
}

export function keysFor(d: DeviceId | null): string {
  if (d === 'kb-left') return P.keys['kb-left'];
  if (d === 'kb-right') return P.keys['kb-right'];
  if (d?.startsWith('pad-')) return P.keys.pad;
  return '';
}

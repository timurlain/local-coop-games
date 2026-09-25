/** Device-independent controls of one player for one frame (held states). */
export interface PlayerActions {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  action: boolean;
  trap: boolean;
  pause: boolean;
}

export const IDLE: Readonly<PlayerActions> = { moveX: 0, moveY: 0, action: false, trap: false, pause: false };

/** KeyboardEvent.code values — physical keys, so any keyboard layout works. */
export interface KeyBinding {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  action: readonly string[];
  trap: readonly string[];
  pause: readonly string[];
}

export const KEYBOARD_LEFT: KeyBinding = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  action: ['KeyF'], trap: ['KeyG'], pause: ['Escape'],
};

export const KEYBOARD_RIGHT: KeyBinding = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  action: ['Enter', 'NumpadEnter'], trap: ['ControlRight'], pause: ['Escape'],
};

export const DEADZONE = 0.4;

function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0;
  return negative ? -1 : 1;
}

export function keyboardActions(keys: ReadonlySet<string>, b: KeyBinding): PlayerActions {
  const any = (codes: readonly string[]) => codes.some((c) => keys.has(c));
  return {
    moveX: axis(any(b.left), any(b.right)),
    moveY: axis(any(b.up), any(b.down)),
    action: any(b.action),
    trap: any(b.trap),
    pause: any(b.pause),
  };
}

export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

/** Standard mapping: 0 = A, 2 = X, 9 = Start, 12-15 = D-pad up/down/left/right. */
export function gamepadActions(pad: PadSnapshot): PlayerActions {
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  return {
    moveX: axis(ax < -DEADZONE || btn(14), ax > DEADZONE || btn(15)),
    moveY: axis(ay < -DEADZONE || btn(12), ay > DEADZONE || btn(13)),
    action: btn(0),
    trap: btn(2),
    pause: btn(9),
  };
}

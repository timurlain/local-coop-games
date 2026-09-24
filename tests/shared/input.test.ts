import { describe, expect, it } from 'vitest';
import { KEYBOARD_LEFT, KEYBOARD_RIGHT, gamepadActions, keyboardActions } from '../../src/shared/input/actions';

const pad = (axes: number[], pressed: number[] = []) => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

describe('keyboardActions', () => {
  it('maps WASD + F + G for the left player', () => {
    const a = keyboardActions(new Set(['KeyA', 'KeyS', 'KeyF']), KEYBOARD_LEFT);
    expect(a).toEqual({ moveX: -1, moveY: 1, action: true, trap: false, pause: false });
  });

  it('maps arrows + Enter + right Shift for the right player', () => {
    const a = keyboardActions(new Set(['ArrowRight', 'ArrowUp', 'ShiftRight', 'Escape']), KEYBOARD_RIGHT);
    expect(a).toEqual({ moveX: 1, moveY: -1, action: false, trap: true, pause: true });
  });

  it('cancels opposite directions', () => {
    const a = keyboardActions(new Set(['KeyA', 'KeyD']), KEYBOARD_LEFT);
    expect(a.moveX).toBe(0);
  });

  it('ignores the other player keys', () => {
    const a = keyboardActions(new Set(['ArrowLeft', 'Enter']), KEYBOARD_LEFT);
    expect(a).toEqual({ moveX: 0, moveY: 0, action: false, trap: false, pause: false });
  });
});

describe('gamepadActions', () => {
  it('reads the left stick past the deadzone', () => {
    expect(gamepadActions(pad([-0.9, 0.2])).moveX).toBe(-1);
    expect(gamepadActions(pad([-0.9, 0.2])).moveY).toBe(0);
    expect(gamepadActions(pad([0.3, 0.8])).moveY).toBe(1);
  });

  it('reads the D-pad and face buttons', () => {
    const a = gamepadActions(pad([0, 0], [12, 15, 0, 2, 9]));
    expect(a).toEqual({ moveX: 1, moveY: -1, action: true, trap: true, pause: true });
  });

  it('survives pads with fewer buttons or axes', () => {
    expect(gamepadActions({ axes: [], buttons: [] })).toEqual({ moveX: 0, moveY: 0, action: false, trap: false, pause: false });
  });
});

import { describe, expect, it } from 'vitest';
import { Flick } from '../../src/games/diktator/ui/flick';

const at = (moveX: -1 | 0 | 1, moveY: -1 | 0 | 1) => ({ moveX, moveY });

describe('Flick', () => {
  it('fires once when a direction is pressed, not while it is held', () => {
    const f = new Flick();
    expect(f.next(at(1, 0))).toBe('right');
    expect(f.next(at(1, 0))).toBeNull();
    expect(f.next(at(1, 0))).toBeNull();
  });

  it('fires again after the stick returns to the centre', () => {
    const f = new Flick();
    f.next(at(0, -1));
    expect(f.next(at(0, 0))).toBeNull();
    expect(f.next(at(0, -1))).toBe('up');
  });

  it('fires when the stick flips straight to the other side', () => {
    const f = new Flick();
    f.next(at(-1, 0));
    expect(f.next(at(1, 0))).toBe('right');
  });

  it('prefers the horizontal direction when both axes fire together', () => {
    const f = new Flick();
    expect(f.next(at(-1, 1))).toBe('left');
    expect(f.next(at(-1, 1))).toBeNull();
  });

  it('maps every direction', () => {
    expect(new Flick().next(at(-1, 0))).toBe('left');
    expect(new Flick().next(at(1, 0))).toBe('right');
    expect(new Flick().next(at(0, -1))).toBe('up');
    expect(new Flick().next(at(0, 1))).toBe('down');
  });

  it('hold() swallows a direction already held when a screen opens', () => {
    const f = new Flick();
    f.hold(at(0, 1));
    expect(f.next(at(0, 1))).toBeNull();
  });
});

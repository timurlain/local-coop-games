import { describe, expect, it } from 'vitest';
import { canStart, humanSlots, type Settings } from '../../src/games/spy-vs-spy/settings';
import { cs } from '../../src/shared/i18n/cs';

const H = { bot: false, iq: 3 } as const;
const B = { bot: true, iq: 1 } as const;
const sides = (a: typeof H | typeof B, b: typeof H | typeof B): Settings['sides'] => [a, b];

describe('humanSlots (spec bot §1)', () => {
  it('lists the slots a human must join, in order', () => {
    expect(humanSlots(sides(H, H))).toEqual([0, 1]);
    expect(humanSlots(sides(H, B))).toEqual([0]);
    expect(humanSlots(sides(B, H))).toEqual([1]);
    expect(humanSlots(sides(B, B))).toEqual([]);
  });
});

describe('canStart (spec bot §1)', () => {
  it('two humans: both must have joined', () => {
    expect(canStart(sides(H, H), [false, false])).toBe(false);
    expect(canStart(sides(H, H), [true, false])).toBe(false);
    expect(canStart(sides(H, H), [false, true])).toBe(false);
    expect(canStart(sides(H, H), [true, true])).toBe(true);
  });

  it('a human against the computer: only the human slot waits', () => {
    expect(canStart(sides(H, B), [false, false])).toBe(false);
    expect(canStart(sides(H, B), [true, false])).toBe(true);
    expect(canStart(sides(B, H), [true, false])).toBe(false);
    expect(canStart(sides(B, H), [false, true])).toBe(true);
  });

  it('computer against computer: nobody waits (any key starts)', () => {
    expect(canStart(sides(B, B), [false, false])).toBe(true);
  });
});

describe('Czech labels for the computer (spec bot §1)', () => {
  it('names each IQ in the menu and the strip', () => {
    expect(cs.spy.sideHuman).toBe('Hráč');
    expect(cs.spy.sideBot).toBe('Počítač');
    expect([1, 2, 3, 4, 5].map((n) => cs.spy.iqOption(n))).toEqual([
      'IQ 1 (nemotorný)', 'IQ 2 (začátečník)', 'IQ 3 (šikovný)', 'IQ 4 (mazaný)', 'IQ 5 (mistr špión)',
    ]);
    expect(cs.spy.botLabel(3)).toBe('Počítač IQ 3');
  });
});

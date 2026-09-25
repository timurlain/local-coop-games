import { describe, expect, it } from 'vitest';
import { createSpy } from '../../src/games/spy-vs-spy/logic/generator';
import { RULES, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import type { Spy, Thing } from '../../src/games/spy-vs-spy/logic/state';
import { UMBRELLA_FRAMES, handItems, pickFrame, refuseFrame, walkFrame } from '../../src/games/spy-vs-spy/render/spy';

const spy = (over: Partial<Spy> = {}): Spy => ({ ...createSpy(0, 0, 40, 9, 480, levelRules(3).trapStockPerSpy), ...over });
const kufrik: Thing = { kind: 'kufrik', contents: ['klic'], lastHolder: 0 };
const pas: Thing = { kind: 'secret', secret: 'pas', lastHolder: 0 };
const voda: Thing = { kind: 'remedy', remedy: 'voda' };
const placing = { trap: 'bomba' as const, target: { on: 'floor' as const }, timer: 0.2 };

describe('handItems (round 4 §2): what goes in which hand', () => {
  it('empty hands: nothing drawn', () => {
    expect(handItems(spy(), 'stand')).toEqual({ front: null, back: null });
  });

  it('carrying only: the carried thing in the front hand (kufřík, satchel, remedy)', () => {
    expect(handItems(spy({ hand: kufrik }), 'stand')).toEqual({ front: 'kufrik', back: null });
    expect(handItems(spy({ hand: pas }), 'walk1')).toEqual({ front: 'satchel', back: null });
    expect(handItems(spy({ hand: voda }), 'stand')).toEqual({ front: 'voda', back: null });
  });

  it('a trap selected, nothing carried: the trap icon in the front hand', () => {
    expect(handItems(spy({ selected: 'pistole' }), 'stand')).toEqual({ front: 'pistole', back: null });
    expect(handItems(spy({ selected: 'casovana' }), 'refuse1')).toEqual({ front: 'casovana', back: null });
  });

  it('a trap selected and something carried: trap in front, the carried thing moves to the back hand', () => {
    expect(handItems(spy({ selected: 'bomba', hand: kufrik }), 'walk2')).toEqual({ front: 'bomba', back: 'kufrik' });
    expect(handItems(spy({ selected: 'elektrina', hand: voda }), 'stand')).toEqual({ front: 'elektrina', back: 'voda' });
  });

  it('fight frames: the umbrella is in front, so no trap is drawn; the carried thing hangs at the back hand', () => {
    for (const frame of UMBRELLA_FRAMES) {
      expect(handItems(spy({ selected: 'bomba', hand: kufrik }), frame)).toEqual({ front: null, back: 'kufrik' });
      expect(handItems(spy({ selected: 'bomba' }), frame)).toEqual({ front: null, back: null });
    }
    expect(UMBRELLA_FRAMES).toContain('fightStand');
    expect(UMBRELLA_FRAMES).toContain('swingStrike');
    expect(UMBRELLA_FRAMES).toContain('duck');
  });

  it('while placing, the trap is drawn flying into its target, not in the hand', () => {
    expect(handItems(spy({ selected: 'bomba', placing, hand: pas }), 'placeTrap')).toEqual({ front: null, back: 'satchel' });
  });
});

describe('pickFrame: placing and the head shake (round 4 §4)', () => {
  const refusing = { refuseTimer: RULES.refuseTime };

  it('placing shows placeTrap, over the refusal, poses, fight and walk', () => {
    expect(pickFrame(spy({ placing }), false, false, 0)).toBe('placeTrap');
    expect(pickFrame(spy({ placing, ...refusing }), false, false, 0)).toBe('placeTrap');
    expect(pickFrame(spy({ placing }), false, false, 0, 'liftFind')).toBe('placeTrap');
    expect(pickFrame(spy({ placing }), true, true, 0)).toBe('placeTrap');
  });

  it('the swing, block and duck still win over placing', () => {
    expect(pickFrame(spy({ placing, blocking: true }), true, false, 0)).toBe('block');
    expect(pickFrame(spy({ placing, ducking: true }), true, false, 0)).toBe('duck');
    expect(pickFrame(spy({ placing, attack: 'jab', swingAnim: 0.3, strikeIn: 0.1 }), true, false, 0)).toBe('swingWind');
  });

  it('the refusal alternates refuse1/refuse2 at about 8 fps, even while walking', () => {
    expect(refuseFrame(0)).toBe('refuse1');
    expect(refuseFrame(1 / 8 + 0.01)).toBe('refuse2');
    expect(refuseFrame(2 / 8 + 0.01)).toBe('refuse1');
    expect(pickFrame(spy(refusing), false, false, 0)).toBe('refuse1');
    expect(pickFrame(spy(refusing), false, true, 1 / 8 + 0.01)).toBe('refuse2');
    expect(pickFrame(spy(refusing), true, false, 0)).toBe('refuse1');
  });

  it('the refusal wins over an effect pose and a search, but not over block', () => {
    expect(pickFrame(spy(refusing), false, false, 0, 'shrug')).toBe('refuse1');
    expect(pickFrame(spy({ ...refusing, mode: 'searching' }), false, false, 0)).toBe('refuse1');
    expect(pickFrame(spy({ ...refusing, blocking: true }), true, false, 0)).toBe('block');
  });

  it('back to normal once the refusal is over', () => {
    expect(pickFrame(spy({ refuseTimer: 0 }), false, true, 0)).toBe(walkFrame(0));
  });
});

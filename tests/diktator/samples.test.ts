// Smoke test for Samples (play-test round 5): only the paths that never touch real audio decoding — no ctx,
// muted, or nothing decoded yet all fall back to the synth by returning false. Decoding real mp3 bytes needs a
// real AudioContext, which jsdom/node don't provide, so that path stays for the browser only.

import { describe, expect, it } from 'vitest';
import { Samples } from '../../src/games/diktator/audio/samples';

describe('Samples (smoke test)', () => {
  it('plays nothing and reports false when there is no AudioContext yet', () => {
    const s = new Samples(() => null);
    expect(s.play([{ sample: 'coins', delay: 0, rate: 1, gain: 0.8 }])).toBe(false);
  });

  it('load() with no context does not throw and does not start loading', () => {
    const s = new Samples(() => null);
    expect(() => s.load()).not.toThrow();
    expect(s.play([{ sample: 'page', delay: 0, rate: 1, gain: 1 }])).toBe(false);
  });

  it('plays nothing while muted, even if a context exists', () => {
    const s = new Samples(() => ({}) as AudioContext);
    s.muted = true;
    expect(s.play([{ sample: 'coins', delay: 0, rate: 1, gain: 0.8 }])).toBe(false);
  });

  it('plays nothing before any sample has decoded', () => {
    const s = new Samples(() => ({}) as AudioContext);
    expect(s.play([{ sample: 'zogu-door', delay: 0, rate: 1, gain: 0.7 }])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { bumpHits, bumpSound, moveHits, moveSounds, voiceOf } from '../../src/games/diktator/ui/sounds';

describe('hero sounds', () => {
  it('gives each hero his own footsteps, door and bump', () => {
    expect(moveSounds('zogu')).toEqual(['stepZogu', 'doorZogu']);
    expect(moveSounds('velitel')).toEqual(['stepVlcek', 'doorVlcek']);
    expect(bumpSound('zogu')).toBe('bumpZogu');
    expect(bumpSound('velitel')).toBe('bumpVlcek');
  });

  it('plays Zogu only zogu- samples, and Vlček only vlcek- samples', () => {
    expect(moveHits('zogu').every((h) => h.sample.startsWith('zogu-'))).toBe(true);
    expect(moveHits('velitel').every((h) => h.sample.startsWith('vlcek-'))).toBe(true);
    expect(bumpHits('zogu').every((h) => h.sample.startsWith('zogu-'))).toBe(true);
    expect(bumpHits('velitel').every((h) => h.sample.startsWith('vlcek-'))).toBe(true);
  });

  it("Zogu's heavy steps are slower than Vlček's quick ones", () => {
    const stepDelay = (h: 'zogu' | 'velitel') => moveHits(h).filter((hit) => hit.sample.includes('step')).map((hit) => hit.delay);
    const [z1, z2] = stepDelay('zogu');
    const [v1, v2] = stepDelay('velitel');
    expect(z2 - z1).toBeGreaterThan(v2 - v1);
  });

  it('every hit has a non-negative delay and a rate within 0.5..2', () => {
    for (const hits of [moveHits('zogu'), moveHits('velitel'), bumpHits('zogu'), bumpHits('velitel')]) {
      for (const h of hits) {
        expect(h.delay).toBeGreaterThanOrEqual(0);
        expect(h.rate).toBeGreaterThanOrEqual(0.5);
        expect(h.rate).toBeLessThanOrEqual(2);
      }
    }
  });

  it('gives every speaker a voice', () => {
    expect(voiceOf({ kind: 'hero', hero: 'zogu' })).toBe('voiceZogu');
    expect(voiceOf({ kind: 'hero', hero: 'velitel' })).toBe('voiceVlcek');
    expect(voiceOf({ kind: 'resident' })).toBe('voiceMother');
    expect(voiceOf({ kind: 'petitioner' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'armada' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'italie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'group', group: 'jugoslavie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'caption' })).toBe('paper');
  });
});

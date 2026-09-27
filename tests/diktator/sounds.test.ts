import { describe, expect, it } from 'vitest';
import { bumpSound, moveSounds, voiceOf } from '../../src/games/diktator/ui/sounds';

describe('hero sounds', () => {
  it('gives each hero his own footsteps, door and bump', () => {
    expect(moveSounds('zogu')).toEqual(['stepZogu', 'doorZogu']);
    expect(moveSounds('velitel')).toEqual(['stepKovar', 'doorKovar']);
    expect(bumpSound('zogu')).toBe('bumpZogu');
    expect(bumpSound('velitel')).toBe('bumpKovar');
  });

  it('gives every speaker a voice', () => {
    expect(voiceOf({ kind: 'hero', hero: 'zogu' })).toBe('voiceZogu');
    expect(voiceOf({ kind: 'hero', hero: 'velitel' })).toBe('voiceKovar');
    expect(voiceOf({ kind: 'resident' })).toBe('voiceMother');
    expect(voiceOf({ kind: 'petitioner' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'armada' })).toBe('voiceCrowd');
    expect(voiceOf({ kind: 'group', group: 'italie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'group', group: 'jugoslavie' })).toBe('voiceEnvoy');
    expect(voiceOf({ kind: 'caption' })).toBe('paper');
  });
});

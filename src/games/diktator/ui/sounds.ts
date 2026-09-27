// Which sound belongs to whom (spec §5.3, "Sounds tell the heroes apart"). Pure.

import type { SfxName } from '../../../shared/audio';
import type { SampleHit } from '../audio/samples';
import { FACTIONS } from '../logic/groups';
import type { Hero } from '../logic/palace';
import type { GameState } from '../logic/state';
import type { Speaker } from './speech';

const ENVOYS: ReadonlySet<string> = new Set(['italie', 'britanie', 'jugoslavie']);

export function moveSounds(h: Hero): SfxName[] {
  return h === 'zogu' ? ['stepZogu', 'doorZogu'] : ['stepVlcek', 'doorVlcek'];
}

export function bumpSound(h: Hero): SfxName {
  return h === 'zogu' ? 'bumpZogu' : 'bumpVlcek';
}

/**
 * Recorded footsteps and door for a hero's move (play-test round 5: real sounds, synth is the fallback).
 * Play-test round 6b §2: quieter — background noise, not a key noise.
 */
export function moveHits(h: Hero): SampleHit[] {
  if (h === 'zogu') {
    return [
      { sample: 'zogu-door', delay: 0, rate: 1, gain: 0.4 },
      { sample: 'zogu-step-1', delay: 0.22, rate: 0.85, gain: 0.35 },
      { sample: 'zogu-step-2', delay: 0.52, rate: 0.85, gain: 0.35 },
    ];
  }
  return [
    { sample: 'vlcek-door', delay: 0, rate: 1, gain: 0.4 },
    { sample: 'vlcek-step-1', delay: 0.16, rate: 1.12, gain: 0.3 },
    { sample: 'vlcek-step-2', delay: 0.3, rate: 1.12, gain: 0.3 },
    { sample: 'vlcek-step-3', delay: 0.44, rate: 1.12, gain: 0.3 },
  ];
}

/** Recorded knock for a hero's bump into a wall. Play-test round 6b §2: quieter, along with the footsteps. */
export function bumpHits(h: Hero): SampleHit[] {
  return [{ sample: h === 'zogu' ? 'zogu-bump' : 'vlcek-bump', delay: 0, rate: 1, gain: 0.5 }];
}

/** Delays (scene seconds) for the two "missed" gunshots of the Atentát mini-game (task 5, spec §5.3):
 * one at 0 s and one at 0.25 s. */
export function shotsHits(): readonly number[] {
  return [0, 0.25];
}

/**
 * How restless the crowd is (play-test round 6b §3, "a rebel noise when some of the factions are super unhappy"):
 * 0 while every faction is above rozzlobení (popularity > 2); 0.5 once the worst is exactly at 2 (rozzlobení);
 * 1 once any faction is rebellious or furious (popularity ≤ 1).
 */
export function unrestLevel(s: GameState): number {
  const worst = Math.min(...FACTIONS.map((f) => s.pop[f]));
  if (worst <= 1) return 1;
  if (worst === 2) return 0.5;
  return 0;
}

export function voiceOf(sp: Speaker): SfxName {
  switch (sp.kind) {
    case 'hero': return sp.hero === 'zogu' ? 'voiceZogu' : 'voiceVlcek';
    case 'resident': return 'voiceMother';
    case 'petitioner': return 'voiceCrowd';
    case 'group': return ENVOYS.has(sp.group) ? 'voiceEnvoy' : 'voiceCrowd';
    case 'caption': return 'paper';
  }
}

// Which sound belongs to whom (spec §5.3, "Sounds tell the heroes apart"). Pure.

import type { SfxName } from '../../../shared/audio';
import type { Hero } from '../logic/palace';
import type { Speaker } from './speech';

const ENVOYS: ReadonlySet<string> = new Set(['italie', 'britanie', 'jugoslavie']);

export function moveSounds(h: Hero): SfxName[] {
  return h === 'zogu' ? ['stepZogu', 'doorZogu'] : ['stepVlcek', 'doorVlcek'];
}

export function bumpSound(h: Hero): SfxName {
  return h === 'zogu' ? 'bumpZogu' : 'bumpVlcek';
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

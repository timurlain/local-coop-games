// Sketch colours of the characters (the final skin comes from generated part sheets, plan 5). Data only.

import type { GroupId } from '../../logic/groups';
import type { PropKind } from './skeleton';

export type HatKind = 'kepi' | 'cap' | 'plis' | 'fez' | 'borsalino' | 'tophat' | 'sajkaca' | 'bun' | 'none';

export interface Look {
  readonly coat: string;
  readonly trim: string;
  readonly legs: string;
  readonly boots: string;
  readonly hat: HatKind;
  readonly hatColor: string;
  readonly moustache?: boolean;
  readonly thinMoustache?: boolean;
  readonly monocle?: boolean;
  readonly belly?: boolean;
  /** A long dress: no legs drawn, a bell skirt to the floor. */
  readonly dress?: boolean;
  readonly shirt?: string;
  /** Diagonal sash stripes, top to bottom. */
  readonly sash?: readonly string[];
  /** Carried when the pose has no prop of its own. */
  readonly prop?: PropKind;
}

export const LOOKS = {
  zogu: { coat: '#5d6b4c', trim: '#c9a44a', legs: '#4a563c', boots: '#231a12', hat: 'kepi', hatColor: '#5d6b4c', moustache: true },
  velitel: { coat: '#7a6a45', trim: '#8c2f2a', legs: '#5f5335', boots: '#2a1d12', hat: 'cap', hatColor: '#6b5c3b', moustache: true },
  mother: { coat: '#2b2231', trim: '#e2d8c6', legs: '#2b2231', boots: '#141012', hat: 'bun', hatColor: '#b9b1a7', dress: true },
  officer: { coat: '#56613f', trim: '#b8963f', legs: '#454f33', boots: '#231a12', hat: 'cap', hatColor: '#56613f', moustache: true },
  peasant: { coat: '#7b5a3a', trim: '#d9cfb8', legs: '#e6dcc4', boots: '#5b4027', hat: 'plis', hatColor: '#f0ebdd', shirt: '#ece4d2' },
  bey: { coat: '#2e2a33', trim: '#8f1d24', legs: '#2a2630', boots: '#16110c', hat: 'fez', hatColor: '#a8202a', moustache: true, belly: true },
  gendarme: { coat: '#2c3a55', trim: '#c9a44a', legs: '#23304a', boots: '#14100b', hat: 'kepi', hatColor: '#2c3a55' },
  italy: {
    coat: '#3b3a44', trim: '#1f8a3b', legs: '#34333c', boots: '#231812', hat: 'borsalino', hatColor: '#6e5a45',
    thinMoustache: true, sash: ['#1f8a3b', '#f4f1e8', '#c8102e'], prop: 'flagIT',
  },
  britain: { coat: '#4a4d55', trim: '#8c2a2a', legs: '#3d4048', boots: '#15151a', hat: 'tophat', hatColor: '#1b1b20', monocle: true, moustache: true },
  yugo: {
    coat: '#1f2f5c', trim: '#c8102e', legs: '#1a2748', boots: '#1a140e', hat: 'sajkaca', hatColor: '#243565',
    moustache: true, sash: ['#1d3f8f', '#f4f1e8', '#c8102e'], prop: 'flagYU',
  },
  treasurer: { coat: '#3a3228', trim: '#c9a44a', legs: '#2f281f', boots: '#16110c', hat: 'none', hatColor: '#000000' },
} as const satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;

/** What the people of each group wear on stage. */
export const GROUP_LOOK: Readonly<Record<GroupId, LookId>> = {
  armada: 'officer',
  rolnici: 'peasant',
  statkari: 'bey',
  povstalci: 'peasant',
  jugoslavie: 'yugo',
  policie: 'gendarme',
  italie: 'italy',
  britanie: 'britain',
};

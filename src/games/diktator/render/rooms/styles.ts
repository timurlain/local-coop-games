// How each palace room looks: colours, furniture on the stage (x in stage units), and the one thing the room
// shows from the game state. Presentation data only; the rules never read it.

import type { RoomId } from '../../logic/palace';

export type FurnitureKind =
  | 'throne' | 'desk' | 'armchair' | 'teaTable' | 'mapTable' | 'bench' | 'stove' | 'sofa' | 'fireplace'
  | 'rifleRack' | 'roundTable' | 'safe' | 'bookshelf' | 'toyChest' | 'rockingHorse' | 'column' | 'fountain'
  /** A cluster of framed family photographs hung on the wall (play-test wish). */
  | 'familyPhotos'
  /** The playroom's war toys — a young king's toys of choice (play-test 2026-09-27). */
  | 'wallMap' | 'strategyTable' | 'toyCannon' | 'tinSoldiers'
  /** The bedroom (play-test round 6a, our addition): a hero out of hours sleeps here. */
  | 'bed' | 'nightstand';

export interface Furniture {
  readonly kind: FurnitureKind;
  /** Centre on the stage, 0..480. */
  readonly x: number;
}

export type RoomShows = 'map' | 'bigMap' | 'gold' | 'seal' | 'plane' | null;

export interface RoomStyle {
  readonly wall: string;
  readonly wainscot: string;
  readonly floor: string;
  readonly accent: string;
  readonly windows: number;
  /** Zog's portrait hangs here and reacts to the room's mood. */
  readonly portrait: boolean;
  readonly shows: RoomShows;
  readonly furniture: readonly Furniture[];
  /** The bedroom's window shows a night sky instead of daylight (play-test round 6a, our addition). */
  readonly night?: boolean;
}

export const ROOM_STYLES: Readonly<Record<RoomId, RoomStyle>> = {
  trunni: { wall: '#5a2a2a', wainscot: '#3d1c1c', floor: '#4a3522', accent: '#d9b45a', windows: 2, portrait: false, shows: null, furniture: [{ kind: 'throne', x: 240 }] },
  pracovna: { wall: '#3a2f22', wainscot: '#2a2118', floor: '#3b2c1c', accent: '#c9a44a', windows: 1, portrait: true, shows: 'seal', furniture: [{ kind: 'desk', x: 300 }, { kind: 'bookshelf', x: 420 }] },
  matka: { wall: '#3e3450', wainscot: '#2c2438', floor: '#3a2c2a', accent: '#d6c7e0', windows: 1, portrait: false, shows: null, furniture: [{ kind: 'familyPhotos', x: 285 }, { kind: 'armchair', x: 330 }, { kind: 'teaTable', x: 400 }] },
  herna: { wall: '#4d5a3a', wainscot: '#36402a', floor: '#5a4630', accent: '#e8c56a', windows: 1, portrait: false, shows: null, furniture: [{ kind: 'wallMap', x: 330 }, { kind: 'toyChest', x: 200 }, { kind: 'rockingHorse', x: 262 }, { kind: 'strategyTable', x: 352 }, { kind: 'tinSoldiers', x: 300 }, { kind: 'toyCannon', x: 446 }] },
  armada: { wall: '#34422a', wainscot: '#26311f', floor: '#3a2e20', accent: '#b8963f', windows: 1, portrait: true, shows: null, furniture: [{ kind: 'mapTable', x: 250 }] },
  nadvori: { wall: '#8aa0b5', wainscot: '#b9a98a', floor: '#9c8a6c', accent: '#f1e6c8', windows: 0, portrait: false, shows: 'plane', furniture: [{ kind: 'column', x: 40 }, { kind: 'fountain', x: 250 }, { kind: 'column', x: 450 }] },
  vyslanci: { wall: '#2a3440', wainscot: '#1f2730', floor: '#3a2e24', accent: '#c9b27a', windows: 2, portrait: false, shows: null, furniture: [{ kind: 'roundTable', x: 240 }] },
  knihovna: { wall: '#3b2a1e', wainscot: '#2b1f16', floor: '#3a2a1c', accent: '#c9a44a', windows: 1, portrait: false, shows: 'bigMap', furniture: [{ kind: 'armchair', x: 212 }, { kind: 'bookshelf', x: 450 }] },
  rolnici: { wall: '#6b5a3e', wainscot: '#4d4030', floor: '#5a4632', accent: '#e6d9b8', windows: 1, portrait: true, shows: null, furniture: [{ kind: 'bench', x: 300 }, { kind: 'stove', x: 440 }] },
  statkari: { wall: '#4a3a1e', wainscot: '#35291a', floor: '#3f2e1e', accent: '#d9b45a', windows: 1, portrait: true, shows: null, furniture: [{ kind: 'sofa', x: 300 }, { kind: 'fireplace', x: 430 }] },
  straznice: { wall: '#2a2a2a', wainscot: '#1d1d1d', floor: '#2f2a24', accent: '#c9a44a', windows: 0, portrait: true, shows: 'map', furniture: [{ kind: 'rifleRack', x: 200 }] },
  pokladna: { wall: '#4a3c14', wainscot: '#35290d', floor: '#3a2e1c', accent: '#f0d27a', windows: 0, portrait: false, shows: 'gold', furniture: [{ kind: 'safe', x: 420 }] },
  loznice: {
    wall: '#2b3350', wainscot: '#1f2640', floor: '#3a2c22', accent: '#d6c7a0', windows: 1, portrait: false, shows: null,
    furniture: [{ kind: 'bed', x: 330 }, { kind: 'nightstand', x: 420 }], night: true,
  },
};

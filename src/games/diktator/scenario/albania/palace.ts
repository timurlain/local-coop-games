import type { PalaceLayout } from '../../logic/palace';

/**
 * The royal palace in Tirana as a 4 × 3 room grid (spec §5.1):
 *   Pokoj královny matky | Pracovna krále | Trůnní sál        | Herna
 *   Důstojnický sál      | Nádvoří        | Salonek vyslanců  | Knihovna
 *   Selská světnice      | Salon statkářů | Strážnice         | Pokladna
 */
export const PALACE: PalaceLayout = {
  grid: [
    ['matka', 'pracovna', 'trunni', 'herna'],
    ['armada', 'nadvori', 'vyslanci', 'knihovna'],
    ['rolnici', 'statkari', 'straznice', 'pokladna'],
  ],
  names: {
    matka: 'Pokoj královny matky',
    pracovna: 'Pracovna krále',
    trunni: 'Trůnní sál',
    herna: 'Herna',
    armada: 'Důstojnický sál',
    nadvori: 'Nádvoří',
    vyslanci: 'Salonek vyslanců',
    knihovna: 'Knihovna',
    rolnici: 'Selská světnice',
    statkari: 'Salon statkářů',
    straznice: 'Strážnice',
    pokladna: 'Pokladna',
    loznice: 'Ložnice',
  },
  start: { zogu: 'pracovna', velitel: 'straznice' },
  throne: 'trunni',
  study: 'pracovna',
  mother: 'matka',
  envoys: 'vyslanci',
  guardroom: 'straznice',
  bedroom: 'loznice',
  groupRoom: { armada: 'armada', rolnici: 'rolnici', statkari: 'statkari', policie: 'straznice' },
  decisionRoom: {
    d25: 'armada',
    d26: 'rolnici',
    d27: 'statkari',
    d28: 'vyslanci',
    d29: 'vyslanci',
    d30: 'vyslanci',
    d33: 'straznice',
    d34: 'straznice',
    d35: 'straznice',
    d36: 'straznice',
    d37: 'pokladna',
    d38: 'vyslanci',
    d39: 'vyslanci',
    d40: 'vyslanci',
    d41: 'armada',
    d42: 'rolnici',
    d43: 'statkari',
  },
};

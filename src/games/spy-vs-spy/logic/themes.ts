import { shuffle, type RngState } from '../../../shared/rng';
import { DIRS, ROOM_THEMES, neighbor, type FurnitureKind, type RoomTheme } from './state';

/** Furniture a room of each theme is furnished from. */
export const THEME_FURNITURE: Readonly<Record<RoomTheme, readonly FurnitureKind[]>> = {
  kancelar: ['stul', 'kartoteka', 'trezor', 'lampa'],
  knihovna: ['knihovna', 'globus', 'lampa', 'pohovka'],
  salonek: ['pohovka', 'krb', 'obraz', 'kvetina'],
  archiv: ['kartoteka', 'skrin', 'trezor', 'knihovna'],
  konferencni: ['stul', 'televize', 'vesak', 'kvetina'],
  kuchynka: ['lednice', 'stul', 'kvetina', 'skrin'],
  radiostanice: ['radio', 'stul', 'trezor', 'kartoteka'],
  pracovna: ['stul', 'trezor', 'globus', 'obraz'],
};

const FIX_PASSES = 8;

/**
 * One theme per grid cell (index = room id). Deals from a shuffled deck of all themes and reshuffles
 * when it runs out, so every theme appears before any repeats; then swaps rooms around until no two
 * grid neighbours share a theme (swaps keep the dealt counts). Gives up quietly if the grid cannot be fixed.
 */
export function assignThemes(grid: { cols: number; rows: number }, rng: RngState): RoomTheme[] {
  const count = grid.cols * grid.rows;
  const themes: RoomTheme[] = [];
  let deck: RoomTheme[] = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = shuffle(rng, ROOM_THEMES);
    themes.push(deck.pop()!);
  }
  const clashes = (id: number): boolean =>
    DIRS.some((d) => {
      const n = neighbor(grid, id, d);
      return n !== null && themes[n] === themes[id];
    });
  const ids = themes.map((_, i) => i);
  for (let pass = 0; pass < FIX_PASSES; pass++) {
    let clean = true;
    for (const id of ids) {
      if (!clashes(id)) continue;
      clean = false;
      for (const other of shuffle(rng, ids)) {
        if (themes[other] === themes[id]) continue;
        [themes[id], themes[other]] = [themes[other], themes[id]];
        if (!clashes(id) && !clashes(other)) break;
        [themes[id], themes[other]] = [themes[other], themes[id]];
      }
    }
    if (clean) break;
  }
  return themes;
}

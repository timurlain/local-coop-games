import { pick, rand, shuffle, type RngState } from '../../../shared/rng';
import { RULES } from './rules';
import {
  DIRS, ROOM_THEMES, neighbor, type DecorKind, type FurnitureKind, type Room, type RoomDecor, type RoomTheme,
} from './state';

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

export const DECOR_KINDS: readonly DecorKind[] = [
  'plakat_psst', 'plakat_mapa', 'plakat_tajne', 'plakat_spion', 'portret', 'vlajka', 'hodiny', 'okno',
];
/** Width of a wall decoration, logic units (= screen px on the back wall). */
export const DECOR_W = 20;
/** Furniture drawn high enough to reach the decoration band; decorations keep clear of it. */
export const TALL_FURNITURE: readonly FurnitureKind[] = ['obraz', 'skrin', 'knihovna', 'vesak', 'lednice', 'radio', 'televize'];
const DECOR_STEP = 5;
const DECOR_GAP = 4;
const RUG_CHANCE = 1 / 3;

/** Hangs 1-2 decorations and maybe lays a rug. Needs furniture kinds/slots and the exit already in place. */
export function decorate(room: Room, furniture: readonly { x: number; kind: FurnitureKind }[], rng: RngState): void {
  const blocked = furniture.filter((f) => TALL_FURNITURE.includes(f.kind)).map((f) => f.x);
  if (room.exit === 'N') blocked.push(RULES.roomW / 2);
  const free: number[] = [];
  for (let x = DECOR_W / 2; x <= RULES.roomW - DECOR_W / 2; x += DECOR_STEP) {
    if (blocked.every((b) => Math.abs(x - b) >= DECOR_W)) free.push(x);
  }
  const wanted = rand(rng) < 0.5 ? 2 : 1;
  const kinds = shuffle(rng, DECOR_KINDS);
  const decor: RoomDecor[] = [];
  for (let i = 0; i < wanted; i++) {
    const options = free.filter((x) => decor.every((d) => Math.abs(x - d.x) >= DECOR_W + DECOR_GAP));
    if (options.length === 0) break;
    decor.push({ kind: kinds[i], x: pick(rng, options) });
  }
  room.decor = decor.sort((a, b) => a.x - b.x);
  room.rug = rand(rng) < RUG_CHANCE;
}

import { pick, rand, shuffle, type RngState } from '../../../shared/rng';
import { RULES } from './rules';
import {
  DIRS, HOSTS, ROOM_THEMES, YEAR_MAX, YEAR_MIN, neighbor,
  type DecorKind, type FlagKind, type FurnitureKind, type HostCountry, type Room, type RoomDecor, type RoomTheme,
} from './state';

/** Furniture a room of each theme is furnished from. */
export const THEME_FURNITURE: Readonly<Record<RoomTheme, readonly FurnitureKind[]>> = {
  kancelar: ['stul', 'kartoteka', 'trezor', 'lampa', 'telefon'],
  knihovna: ['knihovna', 'globus', 'lampa', 'pohovka'],
  salonek: ['pohovka', 'krb', 'obraz', 'kvetina'],
  archiv: ['kartoteka', 'skrin', 'trezor', 'knihovna'],
  konferencni: ['stul', 'gramofon', 'kvetina'],
  kuchynka: ['kredenc', 'stul', 'kvetina', 'skrin'],
  sifrovna: ['radio', 'stul', 'trezor', 'kartoteka', 'telefon'],
  pracovna: ['stul', 'trezor', 'globus', 'obraz', 'telefon'],
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

/** Ordinary wall decorations (the flags are dealt separately, see `decorate`). */
const PICTURE_KINDS: readonly DecorKind[] = [
  'plakat_psst', 'plakat_mapa', 'plakat_tajne', 'plakat_spion', 'portret', 'hodiny', 'okno', 'telegram',
];
export const flagOf = (host: HostCountry): FlagKind => `vlajka_${host}`;
/** Every wall decoration kind, flags included. */
export const DECOR_KINDS: readonly DecorKind[] = [...PICTURE_KINDS, ...HOSTS.map(flagOf)];
/** Chance a room shows the host country's flag (it also needs a free spot, which the first decoration always has). */
const HOST_FLAG_CHANCE = 0.55;
/** Chance a room without the host flag shows one of the other four. */
const OTHER_FLAG_CHANCE = 0.18;
/** The Weimar black-red-gold flag was replaced in March 1933: a German embassy stays in 1929-1932. */
const WEIMAR_LAST_YEAR = 1932;

/** Host country and year of the match, drawn from the looks stream. */
export function pickHost(rng: RngState): { host: HostCountry; year: number } {
  const host = pick(rng, HOSTS);
  const last = host === 'de' ? WEIMAR_LAST_YEAR : YEAR_MAX;
  return { host, year: YEAR_MIN + Math.floor(rand(rng) * (last - YEAR_MIN + 1)) };
}

/** Width of a wall decoration, logic units (= screen px on the back wall). */
export const DECOR_W = 20;
/** Furniture drawn high enough to reach the decoration band; decorations keep clear of it. */
export const TALL_FURNITURE: readonly FurnitureKind[] = ['obraz', 'skrin', 'knihovna', 'vesak', 'kredenc', 'radio', 'gramofon'];
const DECOR_STEP = 5;
const DECOR_GAP = 4;
const RUG_CHANCE = 1 / 3;

/**
 * Hangs 1-2 decorations and maybe lays a rug. Needs furniture kinds/slots and the exit already in place. About
 * half the rooms show the host's flag (always first, so it gets a spot); some others show a neighbour's flag.
 */
export function decorate(
  room: Room, furniture: readonly { x: number; kind: FurnitureKind }[], rng: RngState, host: HostCountry,
): void {
  const blocked = furniture.filter((f) => TALL_FURNITURE.includes(f.kind)).map((f) => f.x);
  if (room.exit === 'N') blocked.push(RULES.roomW / 2);
  const free: number[] = [];
  for (let x = DECOR_W / 2; x <= RULES.roomW - DECOR_W / 2; x += DECOR_STEP) {
    if (blocked.every((b) => Math.abs(x - b) >= DECOR_W)) free.push(x);
  }
  const wanted = rand(rng) < 0.5 ? 2 : 1;
  const kinds = shuffle(rng, PICTURE_KINDS);
  if (rand(rng) < HOST_FLAG_CHANCE) kinds.unshift(flagOf(host));
  else if (rand(rng) < OTHER_FLAG_CHANCE) kinds.unshift(flagOf(pick(rng, HOSTS.filter((h) => h !== host))));
  const decor: RoomDecor[] = [];
  for (let i = 0; i < wanted; i++) {
    const options = free.filter((x) => decor.every((d) => Math.abs(x - d.x) >= DECOR_W + DECOR_GAP));
    if (options.length === 0) break;
    decor.push({ kind: kinds[i], x: pick(rng, options) });
  }
  room.decor = decor.sort((a, b) => a.x - b.x);
  room.rug = rand(rng) < RUG_CHANCE;
}

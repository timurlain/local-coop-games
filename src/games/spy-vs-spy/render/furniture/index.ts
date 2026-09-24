import type { Furniture, FurnitureKind, RoomTheme } from '../../logic/state';
import { r, withScale } from '../draw';
import { VIEW, wallX } from '../geometry';
import { drawHasicak, drawLekarnicka, drawNaradi, drawVesak } from './fixtures';
import { drawKrb, drawKredenc, drawGramofon, drawKvetina, drawLampa, drawObraz, drawPohovka, drawSkrin } from './salon';
import type { Ctx, DrawFn } from './shared';
import { drawGlobus, drawKartoteka, drawKnihovna, drawRadio, drawStul, drawTelefon, drawTrezor } from './study';

/** One drawer per furniture kind; the type checker enforces that every kind has one. */
const DRAWERS: Readonly<Record<FurnitureKind, DrawFn>> = {
  // study
  stul: drawStul,
  knihovna: drawKnihovna,
  trezor: drawTrezor,
  kartoteka: drawKartoteka,
  globus: drawGlobus,
  telefon: drawTelefon,
  radio: drawRadio,
  // salon
  pohovka: drawPohovka,
  lampa: drawLampa,
  obraz: drawObraz,
  skrin: drawSkrin,
  gramofon: drawGramofon,
  kvetina: drawKvetina,
  krb: drawKrb,
  kredenc: drawKredenc,
  // fixtures
  vesak: drawVesak,
  hasicak: drawHasicak,
  naradi: drawNaradi,
  lekarnicka: drawLekarnicka,
};

/** A small chevron marker over a target, e.g. furniture in reach (white) or an armed trap's target (red). */
export function drawReachMarker(ctx: Ctx, x: number, top: number, color: string): void {
  r(ctx, x - 2, top - 5, 5, 1, color);
  r(ctx, x - 1, top - 4, 3, 1, color);
  r(ctx, x, top - 3, 1, 1, color);
}

/**
 * Draws one piece standing against the back wall, scaled with the wall (pieces are authored at 1 px per logic
 * unit). `highlight` shows the white reach marker; `armed` shows the red armed-trap target marker on top of it.
 */
export function drawFurniture(ctx: Ctx, f: Furniture, theme: RoomTheme, highlight: boolean, armed: boolean, now: number): void {
  const x = wallX(f.x);
  const y = VIEW.backY;
  withScale(x, y, VIEW.scale, () => drawPiece(ctx, f, theme, x, y, highlight, armed, now));
}

function drawPiece(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, highlight: boolean, armed: boolean, now: number): void {
  const top = DRAWERS[f.kind](ctx, f, theme, x, y, now);
  if (highlight) drawReachMarker(ctx, x, top, '#ffffff');
  if (armed) drawReachMarker(ctx, x, top - 3, '#ff3030');
}

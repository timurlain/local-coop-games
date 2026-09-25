import type { Furniture, FurnitureKind, RoomTheme } from '../../logic/state';
import { r, withScale } from '../draw';
import { furnitureBase } from '../geometry';
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

/** Markers over one piece: in reach of the viewer (white), where the trap in hand goes right now (red). */
export interface PieceMarks {
  near?: boolean;
  armed?: boolean;
}

/**
 * Draws one piece, scaled like the floor it stands on (pieces are authored at 1 px per logic unit): against the back
 * wall at the wall scale, or free-standing on the floor at its front edge, bigger the nearer it is (round 5 §5), with a
 * soft shadow under it.
 */
export function drawFurniture(ctx: Ctx, f: Furniture, theme: RoomTheme, marks: PieceMarks, now: number): void {
  const { x, y, k } = furnitureBase(f);
  if (f.z > 0) floorShadow(ctx, x, y, k);
  withScale(x, y, k, () => drawPiece(ctx, f, theme, x, y, marks, now));
}

function drawPiece(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, marks: PieceMarks, now: number): void {
  const top = DRAWERS[f.kind](ctx, f, theme, x, y, now);
  if (marks.near) drawReachMarker(ctx, x, top, '#ffffff');
  if (marks.armed) drawReachMarker(ctx, x, top - 3, '#ff3030');
}

/** A flat dark ellipse grounding a free-standing piece on the floor. */
function floorShadow(ctx: Ctx, x: number, y: number, k: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5, 14 * k, 2.5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

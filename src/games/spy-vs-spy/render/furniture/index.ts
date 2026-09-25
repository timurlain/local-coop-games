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

/** 0..1, pulsing about 1.5 times a second: the soft highlight of the other trap targets (round 5 §1). */
export function softPulse(now: number): number {
  return 0.5 + 0.5 * Math.sin(now * Math.PI * 3);
}

/** The soft marker of a valid trap target out of reach (round 5 §1): a pale gold chevron, pulsing. */
export function drawSoftMarker(ctx: Ctx, x: number, top: number, now: number): void {
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.5 * softPulse(now);
  drawReachMarker(ctx, x, top, '#ffe08a');
  ctx.restore();
}

/** Markers over one piece: in reach of the viewer (white), where the trap in hand goes right now (red), another valid
 *  target for it in the room (soft pulsing glow, round 5 §1). */
export interface PieceMarks {
  near?: boolean;
  armed?: boolean;
  soft?: boolean;
}

/**
 * Draws one piece, scaled like the floor it stands on (pieces are authored at 1 px per logic unit): against the back
 * wall at the wall scale, or free-standing on the floor at its front edge, bigger the nearer it is (round 5 §5), with a
 * soft shadow under it.
 */
export function drawFurniture(ctx: Ctx, f: Furniture, theme: RoomTheme, marks: PieceMarks, now: number): void {
  const { x, y, k } = furnitureBase(f);
  if (f.z > 0) floorShadow(ctx, x, y, k);
  if (marks.soft && !marks.armed) softGlow(ctx, x, y, k, now);
  withScale(x, y, k, () => drawPiece(ctx, f, theme, x, y, marks, now));
}

function drawPiece(ctx: Ctx, f: Furniture, theme: RoomTheme, x: number, y: number, marks: PieceMarks, now: number): void {
  const top = DRAWERS[f.kind](ctx, f, theme, x, y, now);
  if (marks.near) drawReachMarker(ctx, x, top, '#ffffff');
  if (marks.armed) drawReachMarker(ctx, x, top - 3, '#ff3030');
  else if (marks.soft) drawSoftMarker(ctx, x, top - 3, now);
}

/** A warm pulsing glow on the floor under a piece that could take the trap in hand (round 5 §1). */
function softGlow(ctx: Ctx, x: number, y: number, k: number, now: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,214,110,${(0.12 + 0.18 * softPulse(now)).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 17 * k, 3.5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

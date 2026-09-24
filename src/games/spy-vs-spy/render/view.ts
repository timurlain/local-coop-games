import { HALVES, withViewport } from '../../../shared/splitscreen';
import { doorAt, exitVisibleTo, furnitureAt } from '../logic/places';
import { cs } from '../../../shared/i18n/cs';
import { isActive, type GameState, type PlayerId } from '../logic/state';
import { drawDebug } from './debug';
import { r, text } from './draw';
import { drawEffects, effectPose, type EffectQueue } from './effects';
import { drawFrame, drawMessages, drawUnder } from './hud';
import { ROOM } from './layout';
import { drawBigMap } from './map';
import { drawRoom } from './room';
import { drawSpy, trackMotion } from './spy';
import { currentToast, type ToastQueue } from './toast';
import { drawCable, drawDevice } from './trapulator';

/**
 * Merged view (spec §2): while both spies are active in the same room, only one half shows it (with both
 * spies) and the half of the spy who entered later — higher `enteredAt`, a tie goes to Černý — goes dark.
 */
export function darkHalf(state: GameState, viewerId: PlayerId): boolean {
  const [white, black] = state.spies;
  if (white.room !== black.room || !isActive(white) || !isActive(black)) return false;
  const me = state.spies[viewerId];
  const other = state.spies[viewerId === 0 ? 1 : 0];
  return me.enteredAt > other.enteredAt || (me.enteredAt === other.enteredAt && viewerId === 1);
}

/** The dark room area of a merged view: near-black with a stepped vignette and a small „SOUBOJ" label. */
function drawDarkRoom(ctx: CanvasRenderingContext2D): void {
  r(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, '#0d0d10');
  // vignette: the centre is a touch lighter, darkening in steps towards the frame
  const steps = ['#121216', '#15151a', '#18181e'];
  steps.forEach((color, i) => {
    const inset = 8 + i * 8;
    r(ctx, ROOM.x + inset * 2, ROOM.y + inset, ROOM.w - inset * 4, ROOM.h - inset * 2, color);
  });
  text(ctx, cs.spy.duel, ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2 + 2, '#8a8a96', 6, 'center');
}

export interface DebugInfo {
  on: boolean;
  fps: number;
}

/** Draws both halves: room (or big map) in the TV frame, the strip under it and the Trapulator. `now` is in seconds. */
export function renderGame(
  ctx: CanvasRenderingContext2D, scale: number, state: GameState, now: number, debug: DebugInfo,
  toasts: readonly ToastQueue[], effects: EffectQueue = [],
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  trackMotion(state.spies, now);

  for (const viewer of state.spies) {
    withViewport(ctx, scale, HALVES[viewer.id], () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
      ctx.clip();
      if (darkHalf(state, viewer.id)) {
        drawDarkRoom(ctx);
      } else if (viewer.mapOpen) {
        drawBigMap(ctx, state, viewer, now);
      } else {
        const near = viewer.mode === 'normal' ? furnitureAt(state, viewer) : null;
        // Where an armed trap can be placed right now (spec §5), shown as a red marker in the viewer's own half.
        const armedFurnitureId =
          viewer.armed === 'bomba' || viewer.armed === 'pruzina' ? (near?.id ?? null) : null;
        const armedDoor =
          viewer.armed === 'elektrina' || viewer.armed === 'pistole' ? doorAt(state, viewer) : null;
        drawRoom(ctx, state, viewer.room, near?.id ?? null, now, armedFurnitureId, armedDoor, exitVisibleTo(state, viewer));
        const here = state.spies.filter((s) => s.room === viewer.room).sort((a, b) => a.z - b.z);
        for (const s of here) drawSpy(ctx, state, s, now, effectPose(effects, s.id, now));
        drawEffects(ctx, state, effects, viewer.room, now);
        if (debug.on) drawDebug(ctx, state, viewer.room, debug.fps);
      }
      drawMessages(ctx, viewer);
      ctx.restore();
      drawFrame(ctx);
      drawCable(ctx);
      drawDevice(ctx, state, viewer, now);
      const queue = toasts[viewer.id];
      drawUnder(ctx, state, viewer, queue ? currentToast(queue, now) : null);
    });
  }
}

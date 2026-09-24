import { HALVES, withViewport } from '../../../shared/splitscreen';
import { doorAt, exitVisibleTo, furnitureAt } from '../logic/places';
import type { GameState } from '../logic/state';
import { drawDebug } from './debug';
import { drawEffects, effectPose, type EffectQueue } from './effects';
import { drawFrame, drawMessages, drawUnder } from './hud';
import { ROOM } from './layout';
import { drawBigMap } from './map';
import { drawRoom } from './room';
import { drawSpy, trackMotion } from './spy';
import { currentToast, type ToastQueue } from './toast';
import { drawCable, drawDevice } from './trapulator';

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
      if (viewer.mapOpen) {
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

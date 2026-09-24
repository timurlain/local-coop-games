import { HALVES, withViewport } from '../../../shared/splitscreen';
import { furnitureAt } from '../logic/places';
import type { GameState } from '../logic/state';
import { drawDebug } from './debug';
import { drawFrame, drawMessages, drawUnder } from './hud';
import { ROOM } from './layout';
import { drawRoom } from './room';
import { drawSpy, trackMotion } from './spy';
import { currentToast, type ToastQueue } from './toast';
import { drawCable, drawDevice } from './trapulator';

export interface DebugInfo {
  on: boolean;
  fps: number;
}

/** Draws both halves: room in the TV frame, the strip under it and the Trapulator. `now` is in seconds. */
export function renderGame(
  ctx: CanvasRenderingContext2D, scale: number, state: GameState, now: number, debug: DebugInfo,
  toasts: readonly ToastQueue[],
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
      const near = viewer.mode === 'normal' ? furnitureAt(state, viewer) : null;
      drawRoom(ctx, state, viewer.room, near?.id ?? null, now);
      const here = state.spies.filter((s) => s.room === viewer.room).sort((a, b) => a.z - b.z);
      for (const s of here) drawSpy(ctx, state, s, now);
      if (debug.on) drawDebug(ctx, state, viewer.room, debug.fps);
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

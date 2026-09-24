import { HALVES, LOGICAL_W, withViewport } from '../../../shared/splitscreen';
import { furnitureAt } from '../logic/places';
import type { GameState } from '../logic/state';
import { drawDebug } from './debug';
import { VIEW } from './geometry';
import { drawHud, drawMessages, drawTrapulator } from './hud';
import { drawRoom } from './room';
import { drawSpy, trackMotion } from './spy';

export interface DebugInfo {
  on: boolean;
  fps: number;
}

/** Draws both halves. `now` is in seconds. */
export function renderGame(ctx: CanvasRenderingContext2D, scale: number, state: GameState, now: number, debug: DebugInfo): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  trackMotion(state.spies, now);

  for (const viewer of state.spies) {
    withViewport(ctx, scale, HALVES[viewer.id], () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, LOGICAL_W, VIEW.viewH);
      ctx.clip();
      const near = viewer.mode === 'normal' ? furnitureAt(state, viewer) : null;
      drawRoom(ctx, state, viewer.room, near?.id ?? null, now);
      const here = state.spies.filter((s) => s.room === viewer.room).sort((a, b) => a.z - b.z);
      for (const s of here) drawSpy(ctx, state, s, now);
      if (viewer.menuOpen) drawTrapulator(ctx, viewer);
      drawMessages(ctx, viewer);
      if (debug.on) drawDebug(ctx, state, viewer.room, debug.fps);
      ctx.restore();
      drawHud(ctx, state, viewer, now);
    });
  }
}

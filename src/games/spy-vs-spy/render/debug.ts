import { doorKeyFor } from '../logic/places';
import { DIRS, type GameState, type Thing } from '../logic/state';
import { text } from './draw';
import { VIEW, furnitureBase } from './geometry';

function label(t: Thing): string {
  if (t.kind === 'secret') return t.secret;
  if (t.kind === 'remedy') return t.remedy;
  return `kufrik[${t.contents.join(',')}]`;
}

/** F1 overlay: reveals everything in the room, inside the room view. For testing only. */
export function drawDebug(ctx: CanvasRenderingContext2D, state: GameState, roomId: number, fps: number): void {
  const room = state.rooms[roomId];
  for (const id of room.furniture) {
    const f = state.furniture[id];
    const lines = [
      f.source ? `S:${f.source}` : '',
      f.hidden ? `H:${label(f.hidden)}` : '',
      f.trap ? `T:${f.trap.kind}` : '',
    ].filter(Boolean);
    // wall pieces label the wall above them, free-standing ones the floor under them
    const x = furnitureBase(f).x;
    const y0 = f.z === 0 ? VIEW.wallTop + 2 : furnitureBase(f).y + 5;
    lines.forEach((l, i) => text(ctx, l, x, y0 + i * 6, '#ffeb3b', 5, 'center'));
  }
  DIRS.forEach((d, i) => {
    if (!room.doors[d] && room.exit !== d) return;
    const trap = state.doorTraps[doorKeyFor(state, roomId, d)];
    if (trap) text(ctx, `${d}:${trap.kind}`, VIEW.cx, VIEW.backY + 6 + i * 6, '#ff5252', 5, 'center');
  });
  text(ctx, `seed ${state.seed} · ${fps} fps`, VIEW.left + 2, VIEW.bottom - 2, '#ffeb3b', 5);
}

import { doorKeyFor } from '../logic/places';
import { DIRS, type GameState, type Thing } from '../logic/state';
import { text } from './draw';
import { VIEW } from './geometry';

function label(t: Thing): string {
  if (t.kind === 'secret') return t.secret;
  if (t.kind === 'remedy') return t.remedy;
  return `kufrik[${t.contents.join(',')}]`;
}

/** F1 overlay: reveals everything in the room. For testing only. */
export function drawDebug(ctx: CanvasRenderingContext2D, state: GameState, roomId: number, fps: number): void {
  const room = state.rooms[roomId];
  for (const id of room.furniture) {
    const f = state.furniture[id];
    const lines = [
      f.source ? `S:${f.source}` : '',
      f.hidden ? `H:${label(f.hidden)}` : '',
      f.trap ? `T:${f.trap.kind}` : '',
    ].filter(Boolean);
    lines.forEach((l, i) => text(ctx, l, VIEW.backLeft + f.x, 12 + i * 6, '#ffeb3b', 5, 'center'));
  }
  DIRS.forEach((d, i) => {
    if (!room.doors[d] && room.exit !== d) return;
    const trap = state.doorTraps[doorKeyFor(state, roomId, d)];
    if (trap) text(ctx, `${d}:${trap.kind}`, 160, 52 + i * 6, '#ff5252', 5, 'center');
  });
  text(ctx, `seed ${state.seed} · ${fps} fps`, 2, 6, '#ffeb3b', 5);
}

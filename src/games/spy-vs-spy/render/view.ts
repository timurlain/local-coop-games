import { HALVES, withViewport } from '../../../shared/splitscreen';
import { doorAt, exitVisibleTo, furnitureAt } from '../logic/places';
import { placeTargetFor, placeTargetsInRoom } from '../logic/traps';
import { cs } from '../../../shared/i18n/cs';
import { isActive, type Dir, type GameState, type PlayerId, type Spy } from '../logic/state';
import { drawDebug } from './debug';
import { r, text } from './draw';
import { drawEffectAt, effectPose, effectsIn, type EffectQueue } from './effects';
import { drawFrame, drawMessages, drawUnder } from './hud';
import { softPulse } from './furniture';
import { project } from './geometry';
import { ROOM } from './layout';
import { drawBigMap } from './map';
import { drawPiece, drawRoom, drawTrapMarks, type RoomMarks } from './room';
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

/**
 * Whether the exit is shown to a viewer (hidden airport, spec §4). In a shared room only the
 * visible half is ever drawn, and it draws both spies together, so the exit is shown there if
 * EITHER active spy in the room can see it (L3 review) — not just the viewer whose half it is.
 * Outside a shared room nothing changes: per-viewer, as before.
 */
export function exitShownIn(state: GameState, viewerId: PlayerId): boolean {
  const [white, black] = state.spies;
  if (white.room === black.room && isActive(white) && isActive(black)) {
    return exitVisibleTo(state, white) || exitVisibleTo(state, black);
  }
  return exitVisibleTo(state, state.spies[viewerId]);
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

/** The trap-target markers of one viewer's own half (round 5 §1). */
export interface TrapMarks {
  /** where the trap in hand goes right now (red); none when nothing valid is in reach */
  armedFurniture: number | null;
  armedDoor: Dir | null;
  /** časovaná: the floor under the spy, always in reach */
  floor: boolean;
  /** every other valid target in the room (soft pulsing glow) */
  softFurniture: number[];
  softDoors: Dir[];
}

/**
 * Markers for the trap in `viewer`'s hand, shown in his own view only: the target in reach in red (round 4 §1), every
 * other valid target in the room softly (round 5 §1). None without a trap in hand, while not free to place (dead,
 * searching, ...) or in a shared room, where Akce would be refused.
 */
export function trapMarks(state: GameState, viewer: Spy): TrapMarks {
  const none: TrapMarks = { armedFurniture: null, armedDoor: null, floor: false, softFurniture: [], softDoors: [] };
  if (viewer.mode !== 'normal' || viewer.selected === null) return none;
  const all = placeTargetsInRoom(state, viewer);
  if (all.length === 0) return none;
  const target = placeTargetFor(state, viewer, viewer.selected);
  const armedFurniture = target?.on === 'furniture' ? target.furniture : null;
  const armedDoor = target?.on === 'door' ? doorAt(state, viewer) : null;
  return {
    armedFurniture,
    armedDoor,
    floor: target?.on === 'floor',
    softFurniture: all.flatMap((t) => (t.on === 'furniture' && t.furniture !== armedFurniture ? [t.furniture] : [])),
    softDoors: all.flatMap((t) => (t.on === 'door' && t.dir !== armedDoor ? [t.dir] : [])),
  };
}

/** Časovaná in hand: a small red ring pulsing on the floor at the spy's feet, where it would be put down. */
function drawFloorTarget(ctx: CanvasRenderingContext2D, spy: Spy, now: number): void {
  const { sx, sy } = project(spy.x, spy.z);
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.4 * softPulse(now);
  ctx.strokeStyle = '#ff3030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(sx, sy - 0.5, 9, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** One thing standing on the floor, drawn back to front (round 5 §5). */
export interface Layer {
  /** depth: a spy's or an effect's z, a free-standing piece's front edge */
  z: number;
  /** order at the same depth: 0 furniture, 1 spy, 2 effect — a spy at a piece's front edge stands in front of it */
  rank: 0 | 1 | 2;
  draw: () => void;
}

/** Back to front: by depth, then by rank. */
export function depthSorted(layers: readonly Layer[]): Layer[] {
  return [...layers].sort((a, b) => a.z - b.z || a.rank - b.rank);
}

/** Free-standing pieces, spies and effects of a room, depth-sorted (round 5 §5): a piece in front of a spy covers
 *  him, one behind him is covered. */
function roomLayers(
  ctx: CanvasRenderingContext2D, state: GameState, roomId: number, now: number, marks: RoomMarks, effects: EffectQueue,
  tops?: Map<number, number>,
): Layer[] {
  const layers: Layer[] = [];
  for (const id of state.rooms[roomId].furniture) {
    const f = state.furniture[id];
    if (f.z > 0) layers.push({ z: f.z, rank: 0, draw: () => drawPiece(ctx, state, id, now, marks, tops) });
  }
  for (const s of state.spies) {
    if (s.room === roomId) layers.push({ z: s.z, rank: 1, draw: () => drawSpy(ctx, state, s, now, effectPose(effects, s.id, now)) });
  }
  for (const e of effectsIn(effects, roomId, now)) layers.push({ z: e.z, rank: 2, draw: () => drawEffectAt(ctx, state, e, now) });
  return depthSorted(layers);
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
        const trap = trapMarks(state, viewer);
        const marks: RoomMarks = {
          ...trap,
          near: near?.id ?? null,
          showExit: exitShownIn(state, viewer.id),
          freePieces: false,
        };
        const tops = new Map<number, number>();
        drawRoom(ctx, state, viewer.room, now, marks, tops);
        if (trap.floor) drawFloorTarget(ctx, viewer, now);
        for (const layer of roomLayers(ctx, state, viewer.room, now, marks, effects, tops)) layer.draw();
        // Trap markers last (round 5 §1/§3): drawn after the spies, so one standing at the target
        // never hides the marker under his hat.
        drawTrapMarks(ctx, state, viewer.room, marks, tops, now);
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

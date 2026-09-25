import { describe, expect, it } from 'vitest';
import { drawRoom, drawTrapMarks, type RoomMarks } from '../../src/games/spy-vs-spy/render/room';
import { openGame } from './fixtures';

/**
 * A minimal recording `CanvasRenderingContext2D`: every method not explicitly given is a no-op (so the real
 * drawing code — backgrounds, wallpaper, furniture, doors — runs without a real canvas), while `fillRect` is
 * recorded together with the `fillStyle` in effect at the time, so a test can tell which color painted where.
 */
function makeCtx(): { ctx: CanvasRenderingContext2D; calls: { style: unknown; x: number; y: number; w: number; h: number }[] } {
  const calls: { style: unknown; x: number; y: number; w: number; h: number }[] = [];
  const target: Record<string, unknown> = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ style: target.fillStyle, x, y, w, h });
    },
  };
  const ctx = new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) return Reflect.get(t, prop, receiver);
      return () => undefined;
    },
    set(t, prop, value) {
      t[prop as string] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const ARMED_RED = '#ff3030';
const SOFT_GOLD = '#ffe08a';

describe('trap markers stay clear of the spies (round 5 §1/§3)', () => {
  it('drawRoom no longer paints the armed/soft marker colors — only drawTrapMarks does, afterwards', () => {
    const s = openGame();
    const room = s.rooms[0];
    expect(room.furniture.length).toBeGreaterThanOrEqual(2);
    const [armedId, softId] = room.furniture;
    const marks: RoomMarks = {
      armedFurniture: armedId,
      armedDoor: 'E',
      softFurniture: [softId],
      softDoors: [],
      showExit: true,
    };

    const tops = new Map<number, number>();
    const first = makeCtx();
    drawRoom(first.ctx, s, 0, 0, marks, tops);
    expect(first.calls.some((c) => c.style === ARMED_RED)).toBe(false);
    expect(first.calls.some((c) => c.style === SOFT_GOLD)).toBe(false);
    // the piece pass still records each drawn piece's top, for the later marker pass
    expect(tops.has(armedId)).toBe(true);
    expect(tops.has(softId)).toBe(true);

    const second = makeCtx();
    drawTrapMarks(second.ctx, s, 0, marks, tops, 0);
    expect(second.calls.some((c) => c.style === ARMED_RED)).toBe(true); // armed furniture + armed door
    expect(second.calls.some((c) => c.style === SOFT_GOLD)).toBe(true); // the other valid target, softly
  });

  it('draws no marker at all when nothing is armed or soft', () => {
    const s = openGame();
    const tops = new Map<number, number>([[s.rooms[0].furniture[0], 10]]);
    const marks: RoomMarks = { armedFurniture: null, armedDoor: null, softFurniture: [], softDoors: [], showExit: true };
    const { ctx, calls } = makeCtx();
    drawTrapMarks(ctx, s, 0, marks, tops, 0);
    expect(calls.some((c) => c.style === ARMED_RED || c.style === SOFT_GOLD)).toBe(false);
  });
});

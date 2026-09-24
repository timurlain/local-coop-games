import { describe, expect, it } from 'vitest';
import { LEVELS, levelRules } from '../../src/games/spy-vs-spy/logic/rules';
import {
  DEV, DEVICE, FRAME, HALF_H, HALF_W, ROOM, UNDER, UNDER_PARTS,
  bigMapLayout, contains, minimapLayout, overlaps, type GridLayout, type Rect,
} from '../../src/games/spy-vs-spy/render/layout';

const HALF: Rect = { x: 0, y: 0, w: HALF_W, h: HALF_H };

function noOverlaps(name: string, rects: readonly Rect[]): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j]), `${name} ${i}/${j}`).toBe(false);
  }
}

const deviceParts: Rect[] = [DEV.led, DEV.warn, ...DEV.traps, DEV.map, DEV.remedy, DEV.remedyHint, ...DEV.secrets, DEV.kufrik, DEV.minimap];

describe('half layout', () => {
  it('keeps every rectangle inside the 320×100 half', () => {
    for (const r of [FRAME, ROOM, UNDER, DEVICE, ...Object.values(UNDER_PARTS), ...deviceParts]) {
      expect(contains(HALF, r), JSON.stringify(r)).toBe(true);
    }
  });

  it('has a room view of about 208×76 inside a ~216×84 frame', () => {
    expect(contains(FRAME, ROOM)).toBe(true);
    expect(FRAME.w).toBeGreaterThanOrEqual(212);
    expect(FRAME.w).toBeLessThanOrEqual(220);
    expect(FRAME.h).toBeGreaterThanOrEqual(80);
    expect(ROOM.x - FRAME.x).toBeGreaterThanOrEqual(3);
  });

  it('frame, strip and device do not overlap', () => {
    noOverlaps('top level', [FRAME, UNDER, DEVICE]);
  });

  it('the strip parts sit in the strip without overlapping', () => {
    const parts = Object.values(UNDER_PARTS);
    for (const p of parts) expect(contains(UNDER, p)).toBe(true);
    noOverlaps('strip', parts);
  });

  it('buttons and slots sit inside the Trapulator without overlapping', () => {
    expect(DEVICE.w).toBeGreaterThanOrEqual(95);
    expect(DEVICE.h).toBeGreaterThanOrEqual(95);
    expect(DEV.traps).toHaveLength(5);
    expect(DEV.secrets).toHaveLength(4);
    for (const p of deviceParts) expect(contains(DEVICE, p), JSON.stringify(p)).toBe(true);
    noOverlaps('device', deviceParts);
  });
});

function gridFits(g: GridLayout, cols: number, rows: number, area: Rect, margin: number): void {
  expect(g.cellW).toBeGreaterThan(0);
  expect(g.cellH).toBeGreaterThan(0);
  const w = cols * g.cellW + (cols - 1) * g.gap;
  const h = rows * g.cellH + (rows - 1) * g.gap;
  expect(contains(area, { x: g.x0 - margin, y: g.y0 - margin, w: w + 2 * margin, h: h + 2 * margin })).toBe(true);
}

describe('map layouts', () => {
  for (const level of LEVELS) {
    const { cols, rows } = levelRules(level);
    it(`mini-map fits the Trapulator slot for level ${level} (${cols}×${rows})`, () => {
      const g = minimapLayout(cols, rows);
      gridFits(g, cols, rows, DEV.minimap, 3);
      if (rows <= 4) {
        // the round-2 look: 7×5 cells, 2 px apart
        expect(g.cellW).toBe(7);
        expect(g.cellH).toBe(5);
        expect(g.gap).toBe(2);
      } else {
        expect(g.cellW).toBeGreaterThanOrEqual(4);
        expect(g.cellH).toBeGreaterThanOrEqual(3);
        expect(g.gap).toBeGreaterThanOrEqual(1);
      }
      expect(g.cellW).toBeGreaterThan(g.cellH);
    });

    it(`big map fits the room view for level ${level} (${cols}×${rows}), with cells larger than the mini-map`, () => {
      const g = bigMapLayout(cols, rows);
      gridFits(g, cols, rows, ROOM, 6);
      expect(g.cellW).toBeGreaterThan(14);
      expect(g.cellH).toBeGreaterThan(8);
      expect(g.cellW).toBeGreaterThan(g.cellH);
      expect(g.gap).toBeGreaterThanOrEqual(2);
    });
  }

  it('keeps the round-2 big-map spacing where it fits', () => {
    expect(bigMapLayout(5, 4).gap).toBe(5);
    expect(bigMapLayout(6, 6).gap).toBeLessThan(5);
  });
});

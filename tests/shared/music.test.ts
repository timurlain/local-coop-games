import { describe, expect, it } from 'vitest';
import {
  BAR_BEATS,
  BPM,
  LOOP_BEATS,
  SONG,
  advance,
  loopSeconds,
  noteFreq,
  notesBetween,
  type Cursor,
} from '../../src/shared/music';

describe('noteFreq', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(noteFreq('A4')).toBeCloseTo(440, 6);
  });

  it('handles octaves, sharps and flats', () => {
    expect(noteFreq('A3')).toBeCloseTo(220, 6);
    expect(noteFreq('C4')).toBeCloseTo(261.626, 2);
    expect(noteFreq('C#5')).toBeCloseTo(noteFreq('Db5'), 9);
    expect(noteFreq('Bb2')).toBeCloseTo(116.541, 2);
    expect(noteFreq('D3')).toBeCloseTo(146.832, 2);
  });

  it('rejects nonsense', () => {
    expect(() => noteFreq('H2')).toThrow();
    expect(() => noteFreq('C')).toThrow();
  });
});

describe('song data', () => {
  it('every voice fills the whole loop exactly', () => {
    for (const voice of Object.values(SONG)) {
      const total = voice.notes.reduce((sum, [, beats]) => sum + beats, 0);
      expect(total).toBeCloseTo(LOOP_BEATS, 9);
    }
  });

  it('loops in whole bars and lasts about 40 s', () => {
    expect(LOOP_BEATS % BAR_BEATS).toBe(0);
    expect(loopSeconds(1)).toBeCloseTo((LOOP_BEATS * 60) / BPM, 9);
    expect(loopSeconds(1)).toBeGreaterThanOrEqual(35);
    expect(loopSeconds(1)).toBeLessThanOrEqual(45);
  });

  it('plays 1.25x faster when hurried', () => {
    expect(loopSeconds(1.25)).toBeCloseTo(loopSeconds(1) / 1.25, 9);
  });

  it('uses only parseable pitches', () => {
    for (const [name, voice] of Object.entries(SONG)) {
      if (name === 'drums') continue;
      for (const [note] of voice.notes) if (note !== 'r') expect(noteFreq(note)).toBeGreaterThan(20);
    }
  });
});

describe('notesBetween', () => {
  it('returns the notes starting in [from, to), without rests', () => {
    const first = notesBetween(0, 1);
    expect(first.length).toBeGreaterThan(0);
    for (const n of first) {
      expect(n.beat).toBeGreaterThanOrEqual(0);
      expect(n.beat).toBeLessThan(1);
      expect(n.note).not.toBe('r');
    }
    // the bass starts the loop on the downbeat
    expect(first.some((n) => n.voice === 'bass' && n.beat === 0)).toBe(true);
  });

  it('is empty for an empty window and never double-counts', () => {
    expect(notesBetween(3, 3)).toEqual([]);
    const whole = notesBetween(0, LOOP_BEATS);
    const split = [...notesBetween(0, 17.3), ...notesBetween(17.3, LOOP_BEATS)];
    expect(split).toEqual(whole);
  });

  it('wraps around the loop with absolute beats', () => {
    const again = notesBetween(LOOP_BEATS, LOOP_BEATS + 1);
    const first = notesBetween(0, 1);
    expect(again.map((n) => n.beat - LOOP_BEATS)).toEqual(first.map((n) => n.beat));
    const across = notesBetween(LOOP_BEATS - 1, LOOP_BEATS + 1);
    expect(across.some((n) => n.beat < LOOP_BEATS)).toBe(true);
    expect(across.some((n) => n.beat >= LOOP_BEATS)).toBe(true);
  });

  it('is sorted by beat', () => {
    const all = notesBetween(0, LOOP_BEATS * 2);
    for (let i = 1; i < all.length; i++) expect(all[i].beat).toBeGreaterThanOrEqual(all[i - 1].beat);
  });
});

describe('advance', () => {
  const spb = 60 / BPM;

  it('maps beats to context time at the current tempo', () => {
    const start: Cursor = { beat: 0, time: 10, mult: 1 };
    const { cursor, notes } = advance(start, 10 + spb * 2, 1);
    expect(cursor.beat).toBeCloseTo(2, 9);
    expect(cursor.time).toBeCloseTo(10 + spb * 2, 9);
    expect(notes.length).toBe(notesBetween(0, 2).length);
    for (const n of notes) expect(n.time).toBeCloseTo(10 + n.beat * spb, 9);
  });

  it('does nothing when the horizon is already scheduled', () => {
    const start: Cursor = { beat: 5, time: 10, mult: 1 };
    expect(advance(start, 9, 1)).toEqual({ cursor: start, notes: [] });
  });

  it('switches tempo at the next bar line, not mid-bar', () => {
    const start: Cursor = { beat: 1, time: 0, mult: 1 };
    const horizon = 3 * spb + 2 * (spb / 1.25); // to beat 4 at x1, then 2 beats at x1.25
    const { cursor, notes } = advance(start, horizon, 1.25);
    expect(cursor.mult).toBe(1.25);
    expect(cursor.beat).toBeCloseTo(6, 9);
    expect(cursor.time).toBeCloseTo(horizon, 9);
    const at5 = notes.find((n) => n.beat === 5);
    expect(at5).toBeDefined();
    expect(at5!.time).toBeCloseTo(3 * spb + spb / 1.25, 9);
    const at2 = notes.find((n) => n.beat === 2);
    expect(at2).toBeDefined();
    expect(at2!.time).toBeCloseTo(spb, 9);
  });

  it('switches immediately when sitting on a bar line', () => {
    const { cursor } = advance({ beat: 8, time: 0, mult: 1 }, 1, 1.25);
    expect(cursor.mult).toBe(1.25);
    expect(cursor.beat).toBeCloseTo(8 + 1 / (spb / 1.25), 9);
  });

  it('keeps the old tempo while the bar line is beyond the horizon', () => {
    const { cursor } = advance({ beat: 4.5, time: 0, mult: 1 }, spb, 1.25);
    expect(cursor.mult).toBe(1);
    expect(cursor.beat).toBeCloseTo(5.5, 9);
  });
});

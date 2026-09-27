import { describe, expect, it } from 'vitest';
import { crowdSlots, CROWD_MAX_X, CROWD_MIN_X } from '../../src/games/diktator/render/rooms/crowd';
import { portraitFor } from '../../src/games/diktator/render/rooms/portrait';
import { ROOM_STYLES } from '../../src/games/diktator/render/rooms/styles';
import { albania } from '../../src/games/diktator/scenario/albania';

describe('room styles', () => {
  it('styles every room of the palace grid', () => {
    for (const room of albania.palace!.grid.flat()) expect(ROOM_STYLES[room], room).toBeDefined();
  });
  it('marks the special rooms', () => {
    expect(ROOM_STYLES.straznice.shows).toBe('map');
    expect(ROOM_STYLES.pokladna.shows).toBe('gold');
    expect(ROOM_STYLES.pracovna.shows).toBe('seal');
    expect(ROOM_STYLES.nadvori.shows).toBe('plane');
  });
});

describe('crowdSlots', () => {
  it('places one person per point of strength, clamped to 0..9', () => {
    expect(crowdSlots(0)).toEqual([]);
    expect(crowdSlots(4)).toHaveLength(4);
    expect(crowdSlots(9)).toHaveLength(9);
    expect(crowdSlots(12)).toHaveLength(9);
  });
  it('fills the front row first, keeps everybody on the right side, and orders back row first for drawing', () => {
    const slots = crowdSlots(9);
    expect(slots.filter((s) => s.row === 0)).toHaveLength(5);
    expect(slots.filter((s) => s.row === 1)).toHaveLength(4);
    for (const s of slots) expect(s.x >= CROWD_MIN_X && s.x <= CROWD_MAX_X).toBe(true);
    const firstFront = slots.findIndex((s) => s.row === 0);
    expect(slots.slice(0, firstFront).every((s) => s.row === 1)).toBe(true);
    expect(slots.find((s) => s.row === 1)!.scale).toBeLessThan(1);
  });
});

describe('portraitFor (Zog on the wall, spec §5.2)', () => {
  it('follows the ten mood levels', () => {
    expect(portraitFor(9)).toMatchObject({ laurel: true, bunting: true, tilt: 0 });
    expect(portraitFor(8)).toMatchObject({ laurel: true, bunting: false });
    expect(portraitFor(6)).toMatchObject({ laurel: false, tilt: 0, turned: false });
    expect(portraitFor(4).tilt).toBe(6);
    expect(portraitFor(3).tilt).toBe(12);
    expect(portraitFor(2)).toMatchObject({ turned: true });
    expect(portraitFor(1)).toMatchObject({ fallen: true, brokenChair: true });
    expect(portraitFor(0)).toMatchObject({ defaced: true, brokenChair: true, barricade: true });
  });
  it('shows a plain portrait while the mood is unknown', () => {
    expect(portraitFor(null)).toMatchObject({ tilt: 0, laurel: false, turned: false, defaced: false });
  });
});

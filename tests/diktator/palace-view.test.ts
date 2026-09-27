import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { roomView, stripView } from '../../src/games/diktator/ui/palace-view';
import { petitionById } from '../../src/games/diktator/logic/audience';
import { GROUP_LOOK } from '../../src/games/diktator/render/puppet/looks';

function day(): GameState {
  return advance(albania, newGame(albania, 4, undefined, { palace: true }).state, { type: 'answer', answer: 'no' }).state;
}

describe('roomView', () => {
  it('shows the throne room with Zogu in it and no crowd', () => {
    const v = roomView(albania, day(), 'trunni');
    expect(v.name).toBe('Trůnní sál');
    expect(v.heroes).toEqual(['zogu']);
    expect(v.crowds).toEqual([]);
  });

  it('shows the guardroom: the commander, the gendarmes (count = strength, mood live) and the rebels’ fires', () => {
    const s = day();
    const v = roomView(albania, s, 'straznice');
    expect(v.heroes).toEqual(['velitel']);
    expect(v.crowds).toEqual([{ group: 'policie', count: s.str.policie, mood: s.pop.policie, look: 'gendarme' }]);
    expect(v.rebelFires).toBe(s.str.povstalci);
  });

  it('hides the mood of a room nobody has visited, but shows its strength', () => {
    const s = day();
    const v = roomView(albania, s, 'armada');
    expect(v.crowds[0]).toEqual({ group: 'armada', count: s.str.armada, mood: null, look: 'officer' });
    expect(v.portraitMood).toBeNull();
  });

  it('remembers the last seen mood after the hero leaves', () => {
    let s = day();
    for (const dir of ['left', 'left', 'down', 'up'] as const) s = advance(albania, s, { type: 'move', hero: 'zogu', dir }).state;
    expect(s.palace!.at.zogu).toBe('matka');
    const v = roomView(albania, s, 'armada');
    expect(v.crowds[0].mood).toBe(s.pop.armada);
    expect(v.portraitMood).toBe(s.pop.armada);
  });

  it('shows one envoy per power in the salon', () => {
    const v = roomView(albania, day(), 'vyslanci');
    expect(v.crowds.map((c) => [c.group, c.count, c.look])).toEqual([
      ['jugoslavie', 1, 'yugo'],
      ['italie', 1, 'italy'],
      ['britanie', 1, 'britain'],
    ]);
  });

  it('shows the gold in the treasury and the seal lying in the study', () => {
    const s = day();
    expect(roomView(albania, s, 'pokladna').treasury).toBe(s.treasury);
    expect(roomView(albania, s, 'pracovna').sealLying).toBe(true);
    expect(roomView(albania, s, 'trunni').sealLying).toBe(false);
  });

  it('keeps treasury and rebelFires null outside their own rooms', () => {
    const s = day();
    expect(roomView(albania, s, 'trunni').treasury).toBeNull();
    expect(roomView(albania, s, 'armada').rebelFires).toBeNull();
  });

  it('shows the plane only in the courtyard, and only when it exists', () => {
    const seen = { ...day(), hasPlane: true };
    expect(roomView(albania, seen, 'nadvori').plane).toBe(true);
    expect(roomView(albania, seen, 'trunni').plane).toBe(false);
    const none = day();
    expect(none.hasPlane).toBe(false);
    expect(roomView(albania, none, 'nadvori').plane).toBe(false);
  });

  it('computes layout and resident from the layout, never by comparing room ids', () => {
    const s = day();
    expect(roomView(albania, s, 'vyslanci').layout).toBe('envoys');
    expect(roomView(albania, s, 'trunni').layout).toBe('crowd');
    expect(roomView(albania, s, 'matka').resident).toBe('mother');
    expect(roomView(albania, s, 'pokladna').resident).toBe('treasurer');
    expect(roomView(albania, s, 'trunni').resident).toBeNull();
  });

  it('shows the envoys with unknown mood before anyone has visited the salon', () => {
    const v = roomView(albania, day(), 'vyslanci');
    expect(v.crowds.every((c) => c.mood === null)).toBe(true);
  });
});

describe('stripView', () => {
  it('mirrors the grid with heroes, crowd sizes and seen moods', () => {
    const s = day();
    const strip = stripView(albania, s);
    expect(strip.map((row) => row.map((c) => c.room))).toEqual(albania.palace!.grid);
    const guard = strip[2][2];
    expect(guard.heroes).toEqual(['velitel']);
    expect(guard.count).toBe(s.str.policie);
    expect(guard.mood).toBe(s.pop.policie);
    expect(strip[1][0].mood).toBeNull();
  });

  it('never claims a single mood for the envoys’ salon (three separate powers, three moods)', () => {
    const strip = stripView(albania, day());
    const envoysCell = strip.flat().find((c) => c.room === 'vyslanci')!;
    expect(envoysCell.mood).toBeNull();
  });
});

describe('roomView — petitioner and revealed plots', () => {
  it('puts the petitioner in the throne room during the audience only', () => {
    const s = newGame(albania, 4, undefined, { palace: true }).state;
    const pet = petitionById(albania, (s.phase as { petition: string }).petition);
    expect(roomView(albania, s, 'trunni').petitioner).toBe(GROUP_LOOK[pet.from]);
    expect(roomView(albania, s, 'pracovna').petitioner).toBeNull();
    expect(roomView(albania, day(), 'trunni').petitioner).toBeNull();
  });

  it('marks a plot the commander revealed, in the faction’s own room', () => {
    const s = day();
    expect(roomView(albania, s, 'armada').plotMarker).toBeNull();
    s.palace!.investigated.armada = { kind: 'assassination' };
    expect(roomView(albania, s, 'armada').plotMarker).toBe('spiknutí: atentát');
    s.palace!.investigated.armada = { kind: 'none' };
    expect(roomView(albania, s, 'armada').plotMarker).toBeNull();
  });

  it('takes plots from the police report too', () => {
    const s = day();
    s.palace!.report = {
      pop: s.pop, str: s.str, guard: s.guard, low: s.low, threshold: s.threshold,
      plots: { armada: { kind: 'none' }, rolnici: { kind: 'revolution', ally: 'policie' }, statkari: { kind: 'none' } },
    };
    expect(roomView(albania, s, 'rolnici').plotMarker).toBe('spiknutí: revoluce, spojenec Tajná policie');
  });
});

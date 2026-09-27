import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { Direction, Hero } from '../../src/games/diktator/logic/palace';
import type { GameState } from '../../src/games/diktator/logic/state';
import { petitionById } from '../../src/games/diktator/logic/audience';
import { albania } from '../../src/games/diktator/scenario/albania';
import { heroMenu } from '../../src/games/diktator/ui/menus';
import { palaceAudience, palaceDay } from './helpers';

const T = cs.diktator;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return palaceDay();
}
function walk(s: GameState, hero: Hero, dirs: readonly Direction[]): GameState {
  for (const dir of dirs) s = advance(albania, s, { type: 'move', hero, dir }).state;
  return s;
}

describe('heroMenu — audience', () => {
  it('offers Zogu the audience, no longer modal, with the answers first, money on "Ano", once he stands in the throne room', () => {
    const s = palaceAudience();
    const m = heroMenu(albania, s, 'zogu');
    const pet = petitionById(albania, (s.phase as { petition: string }).petition);
    expect(m.modal).toBe(false);
    expect(m.title).toBe(P.audienceTitle(albania.groupNames[pet.from]));
    expect(m.body[0]).toContain(pet.title);
    expect(m.items.slice(0, 3).map((i) => i.label)).toEqual([T.yes, T.no, T.goAway]);
    expect(m.items[0].detail.startsWith('Peníze: ')).toBe(true);
    expect(m.items.some((i) => i.command.type === 'advice')).toBe(false);
  });

  it("offers advice about the petition once Zogu stands in Mother's room", () => {
    const atMother = advance(albania, audience(), { type: 'move', hero: 'zogu', dir: 'left' }).state;
    const m = heroMenu(albania, atMother, 'zogu');
    const pet = petitionById(albania, (atMother.phase as { petition: string }).petition);
    expect(m.items.some((i) => i.label === P.adviceAudience(pet.title))).toBe(true);
  });

  it('tells Zogu the petitioner waits in the throne room, with no way to end the day, while he stands in the study', () => {
    const m = heroMenu(albania, audience(), 'zogu');
    const pet = petitionById(albania, (audience().phase as { petition: string }).petition);
    expect(m.body).toEqual([P.petitionerWaits(albania.groupNames[pet.from])]);
    expect(m.items.some((i) => i.label === T.endDay)).toBe(false);
  });

  it('lets the commander act freely during the audience', () => {
    const m = heroMenu(albania, audience(), 'velitel');
    expect(m.modal).toBe(false);
    expect(m.title).toBe('Strážnice');
    const labels = m.items.map((i) => i.label);
    expect(labels).toContain(P.policeReport);
    expect(labels).toContain(T.endDay);
    expect(m.items.some((i) => i.command.type === 'move')).toBe(false);
  });

  it('tells a hero who has ended his day that he waits for the other', () => {
    const s = advance(albania, audience(), { type: 'endDay', hero: 'velitel' }).state;
    const m = heroMenu(albania, s, 'velitel');
    expect(m.items).toEqual([]);
    expect(m.body).toEqual([P.waiting('Zogu')]);
  });
});

describe('heroMenu — day', () => {
  it('offers only the end of the quarter in the empty throne room', () => {
    expect(heroMenu(albania, day(), 'zogu').items.map((i) => i.label)).toEqual([T.endDay]);
  });

  it('offers talk in a faction room', () => {
    const s = walk(day(), 'zogu', ['down', 'left', 'left']);
    expect(s.palace!.at.zogu).toBe('armada');
    expect(heroMenu(albania, s, 'zogu').items[0].label).toBe(P.talk(albania.groupNames.armada));
  });

  it('offers the seal in the study, then the study decisions with their money', () => {
    let s = walk(day(), 'zogu', ['left']);
    expect(heroMenu(albania, s, 'zogu').items.map((i) => i.label)).toContain(P.takeSeal);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    const seals = heroMenu(albania, s, 'zogu').items.filter((i) => i.command.type === 'decide');
    expect(seals.length).toBeGreaterThan(0);
    for (const item of seals) {
      expect(item.label.startsWith('Zapečetit: ')).toBe(true);
      expect(item.detail.startsWith('Peníze: ')).toBe(true);
    }
  });

  it('splits the Swiss account into its four shares in the treasury', () => {
    let s = walk(day(), 'zogu', ['left']);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    s = walk(s, 'zogu', ['down', 'right', 'right', 'down']);
    expect(s.palace!.at.zogu).toBe('pokladna');
    const swiss = heroMenu(albania, s, 'zogu').items.filter((i) => i.command.type === 'decide' && i.command.decision === 'd37');
    expect(swiss.map((i) => (i.command.type === 'decide' ? i.command.share : 0))).toEqual([1, 2, 3, 4]);
  });

  it('names the other hero when the seal can be handed over', () => {
    let s = walk(day(), 'zogu', ['left']);
    s = advance(albania, s, { type: 'takeSeal', hero: 'zogu' }).state;
    s = walk(s, 'zogu', ['down', 'right']); // vyslanci
    s = walk(s, 'velitel', ['up']); // straznice → vyslanci
    expect(s.palace!.at.velitel).toBe('vyslanci');
    expect(heroMenu(albania, s, 'zogu').items.map((i) => i.label)).toContain(P.giveSeal('Vlček'));
  });
});

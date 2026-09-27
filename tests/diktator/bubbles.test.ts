import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';
import { roomView } from '../../src/games/diktator/ui/palace-view';
import { heroMenu } from '../../src/games/diktator/ui/menus';
import { anchorFor, bubblesFor } from '../../src/games/diktator/ui/bubbles';
import { QUIET, say } from '../../src/games/diktator/ui/dialogue';

const audience = () => newGame(albania, 4, undefined, { palace: true }).state;

describe('anchorFor', () => {
  it('puts a hero’s bubble above his head, own hero in front', () => {
    const s = audience();
    s.palace!.at.velitel = 'trunni';
    const v = roomView(albania, s, 'trunni');
    expect(anchorFor({ kind: 'hero', hero: 'zogu' }, v, 'zogu')).toEqual({ x: 90, y: 69 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, v, 'zogu')).toEqual({ x: 145, y: 77 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, roomView(albania, audience(), 'trunni'), 'zogu')).toBeNull();
    expect(anchorFor({ kind: 'petitioner' }, v, 'zogu')).toEqual({ x: 330, y: 69 });
  });

  it('finds each envoy and the crowd; a group not in the room becomes a caption', () => {
    const s = audience();
    const salon = roomView(albania, s, 'vyslanci');
    const i = salon.crowds.findIndex((c) => c.group === 'britanie');
    expect(anchorFor({ kind: 'group', group: 'britanie' }, salon, 'zogu')).toEqual({ x: 300 + 60 * i, y: 69 });
    expect(anchorFor({ kind: 'group', group: 'policie' }, roomView(albania, s, 'straznice'), 'velitel')).toEqual({ x: 358, y: 69 });
    expect(anchorFor({ kind: 'group', group: 'armada' }, salon, 'zogu')).toBeNull();
    expect(anchorFor({ kind: 'caption' }, salon, 'zogu')).toBeNull();
  });
});

describe('bubblesFor', () => {
  it('shows Zogu’s audience as a choice bubble over him', () => {
    const s = audience();
    const b = bubblesFor(QUIET, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b).toHaveLength(1);
    expect(b[0].kind).toBe('choice');
    if (b[0].kind === 'choice') {
      expect(b[0].anchor).toEqual({ x: 90, y: 69 });
      expect(b[0].items.length).toBeGreaterThan(2);
    }
  });

  it('shows the first waiting line instead of the choice, with a "more" mark, plus the captions', () => {
    const s = audience();
    const d = say(QUIET, [
      { speaker: { kind: 'hero', hero: 'zogu' }, text: 'Ano, svoluji.' },
      { speaker: { kind: 'caption' }, text: 'Peníze: stojí 10 tis.' },
    ]);
    const b = bubblesFor(d, ['Pečeť nese Kovář.'], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b.map((x) => x.kind)).toEqual(['speech', 'caption']);
    if (b[0].kind === 'speech') expect(b[0].more).toBe(true);
    if (b[1].kind === 'caption') expect(b[1].text).toBe('Pečeť nese Kovář.');
  });

  it('shows no choice bubble for a closed, non-modal menu', () => {
    const s = advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
    expect(bubblesFor(QUIET, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu')).toEqual([]);
  });
});

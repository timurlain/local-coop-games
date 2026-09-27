import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';
import { roomView } from '../../src/games/diktator/ui/palace-view';
import { heroMenu } from '../../src/games/diktator/ui/menus';
import { anchorFor, bubblesFor, stageView } from '../../src/games/diktator/ui/bubbles';
import { QUIET, say } from '../../src/games/diktator/ui/dialogue';
import { palaceAudience, palaceDay } from './helpers';

const P = cs.diktator.palace;

const audience = () => newGame(albania, 4, undefined, { palace: true }).state;

describe('anchorFor', () => {
  it('puts a hero’s bubble above his head, own hero in front', () => {
    const s = palaceAudience();
    s.palace!.at.velitel = 'trunni';
    const v = roomView(albania, s, 'trunni');
    expect(anchorFor({ kind: 'hero', hero: 'zogu' }, v, 'zogu')).toEqual({ x: 90, y: 69 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, v, 'zogu')).toEqual({ x: 145, y: 77 });
    expect(anchorFor({ kind: 'hero', hero: 'velitel' }, roomView(albania, audience(), 'trunni'), 'zogu')).toBeNull();
    expect(anchorFor({ kind: 'petitioner' }, v, 'zogu')).toEqual({ x: 395, y: 69 });
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

describe('stageView', () => {
  it('keeps the petitioner while one of his lines still waits, in the same room', () => {
    const before = palaceAudience();
    const after = advance(albania, before, { type: 'answer', answer: 'yes' }).state;
    const prev = roomView(albania, before, 'trunni');
    const view = roomView(albania, after, 'trunni');
    const waiting = say(QUIET, [{ speaker: { kind: 'petitioner' }, text: 'Děkujeme!' }]);
    expect(stageView(view, prev, waiting).petitioner).toBe(prev.petitioner);
  });

  it('drops the petitioner once no line of his waits any more', () => {
    const before = palaceAudience();
    const after = advance(albania, before, { type: 'answer', answer: 'yes' }).state;
    const prev = roomView(albania, before, 'trunni');
    const view = roomView(albania, after, 'trunni');
    expect(stageView(view, prev, QUIET).petitioner).toBeNull();
  });

  it('does not carry the petitioner into another room', () => {
    const before = palaceAudience();
    const after = advance(albania, before, { type: 'answer', answer: 'yes' }).state;
    const prev = roomView(albania, before, 'trunni');
    const view = roomView(albania, after, 'armada');
    const waiting = say(QUIET, [{ speaker: { kind: 'petitioner' }, text: 'Děkujeme!' }]);
    expect(stageView(view, prev, waiting).petitioner).toBeNull();
  });
});

describe('bubblesFor', () => {
  it('shows Zogu’s audience as a choice bubble over him, once opened — the audience is no longer modal', () => {
    const s = palaceAudience();
    const open = { ui: { open: true, focus: 0 }, queue: [] };
    const b = bubblesFor(open, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b).toHaveLength(1);
    expect(b[0].kind).toBe('choice');
    if (b[0].kind === 'choice') {
      expect(b[0].anchor).toEqual({ x: 90, y: 69 });
      expect(b[0].items.length).toBeGreaterThan(2);
      expect(b[0].right).toBe(372);
    }
  });

  it('gives the choice bubble the full width when there is no petitioner to clear', () => {
    const s = palaceDay();
    let s2 = s;
    for (const dir of ['down', 'left', 'left'] as const) s2 = advance(albania, s2, { type: 'move', hero: 'zogu', dir }).state;
    const room = s2.palace!.at.zogu;
    const open = { ui: { open: true, focus: 0 }, queue: [] };
    const b = bubblesFor(open, [], heroMenu(albania, s2, 'zogu'), roomView(albania, s2, room), 'zogu');
    expect(b).toHaveLength(1);
    if (b[0].kind === 'choice') expect(b[0].right).toBe(470);
  });

  it('tells a hero who has ended his day that the other still plays', () => {
    const s = advance(albania, audience(), { type: 'endDay', hero: 'velitel' }).state;
    const b = bubblesFor(QUIET, [], heroMenu(albania, s, 'velitel'), roomView(albania, s, s.palace!.at.velitel), 'velitel');
    expect(b.some((x) => x.kind === 'caption' && x.text === P.waiting('Zogu'))).toBe(true);
  });

  it('shows the first waiting line instead of the choice, with a "more" mark, plus the captions', () => {
    const s = palaceAudience();
    const d = say(QUIET, [
      { speaker: { kind: 'hero', hero: 'zogu' }, text: 'Ano, svoluji.' },
      { speaker: { kind: 'caption' }, text: 'Peníze: stojí 10 tis.' },
    ]);
    const b = bubblesFor(d, ['Pečeť nese Vlček.'], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu');
    expect(b.map((x) => x.kind)).toEqual(['speech', 'caption']);
    if (b[0].kind === 'speech') expect(b[0].more).toBe(true);
    if (b[1].kind === 'caption') expect(b[1].text).toBe('Pečeť nese Vlček.');
  });

  it('shows no choice bubble for a closed, non-modal menu', () => {
    const s = palaceDay();
    expect(bubblesFor(QUIET, [], heroMenu(albania, s, 'zogu'), roomView(albania, s, 'trunni'), 'zogu')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameState, PoliceSnapshot } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { notesFor } from '../../src/games/diktator/ui/notes';
import { heroHud, topHud } from '../../src/games/diktator/ui/hud';

const T = cs.diktator;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
}

describe('notesFor', () => {
  it('tells both halves who carries the seal', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'seal', holder: 'velitel' })).toEqual([{ to: 'both', text: P.sealHolder('Vlček') }]);
    expect(notesFor(albania, s, { type: 'seal', holder: null })).toEqual([{ to: 'both', text: P.sealLies }]);
  });

  it('gives Zogu the envoys’ offers, one line per lender', () => {
    const notes = notesFor(albania, day(), { type: 'envoys', offers: { italie: 180, britanie: 0 } });
    expect(notes.every((n) => n.to === 'zogu')).toBe(true);
    expect(notes.map((n) => n.text)).toEqual([P.offer('Itálie', 180), P.offerHostile('Británie')]);
    const used = notesFor(albania, day(), { type: 'envoys', offers: { italie: null, britanie: 90 } });
    expect(used[0].text).toBe(P.offerUsed('Itálie'));
  });

  it('gives Zogu a group’s wish by the decision’s title', () => {
    const d = albania.decisions[0];
    expect(notesFor(albania, day(), { type: 'wish', group: 'armada', decision: d.id })).toEqual([
      { to: 'zogu', text: P.wish('Armáda', d.title) },
    ]);
    expect(notesFor(albania, day(), { type: 'wish', group: 'rolnici', decision: null })[0].text).toBe(P.wishNone('Rolníci'));
  });

  it('gives Zogu Mother’s advice on both answers of the petition', () => {
    const s = audience();
    const id = (s.phase as { petition: string }).petition;
    const notes = notesFor(albania, s, { type: 'advised', subject: 'petition', id });
    expect(notes.map((n) => n.to)).toEqual(['zogu', 'zogu']);
    expect(notes[0].text.startsWith('Matka o „ano“: ')).toBe(true);
    expect(notes[1].text.startsWith('Matka o „ne“: ')).toBe(true);
  });

  it('gives Vlček the investigation and the whole police report', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'investigated', faction: 'armada', plot: { kind: 'none' } })).toEqual([
      { to: 'velitel', text: P.noPlot('Armáda') },
    ]);
    const report: PoliceSnapshot = {
      pop: s.pop, str: s.str, guard: s.guard, low: 3, threshold: 11,
      plots: { armada: { kind: 'assassination' }, rolnici: { kind: 'none' }, statkari: { kind: 'revolution', ally: 'policie' } },
    };
    const notes = notesFor(albania, s, { type: 'policeReport', report });
    expect(notes.every((n) => n.to === 'velitel')).toBe(true);
    expect(notes.map((n) => n.text)).toEqual([
      P.reportRead,
      P.plot('Armáda', T.plots.assassination),
      P.noPlot('Rolníci'),
      P.plot('Statkáři', T.plots.revolution('Tajná policie')),
      P.reportLimits(3, 11),
    ]);
  });

  it('tells both halves about the guard and who finished; routes other lines to both', () => {
    const s = day();
    expect(notesFor(albania, s, { type: 'guarding' })).toEqual([{ to: 'both', text: P.guarding }]);
    expect(notesFor(albania, s, { type: 'heroDone', hero: 'zogu' })).toEqual([{ to: 'both', text: P.heroDone('Zogu') }]);
    expect(notesFor(albania, s, { type: 'budget', income: 60, costs: 60 })).toEqual([{ to: 'both', text: T.events.budget(60, 60) }]);
    expect(notesFor(albania, s, { type: 'moved', hero: 'zogu', from: 'trunni', to: 'pracovna' })).toEqual([]);
  });
});

describe('HUD', () => {
  it('shows the hero, his room, his hours as dots and the seal', () => {
    const s = day();
    expect(heroHud(albania, s, 'velitel')).toEqual({ name: 'Vlček', room: 'Strážnice', hours: '●●●', seal: false, done: false });
    const spent = advance(albania, s, { type: 'policeReport', hero: 'velitel' }).state;
    expect(heroHud(albania, spent, 'velitel').hours).toBe('●●○');
  });

  it('shows the date and the money on top', () => {
    const s = day();
    expect(topHud(s)).toEqual([T.quarter(1925, 1), T.treasury(s.treasury), T.balance(s.income - s.costs), T.guard(s.guard)]);
  });
});

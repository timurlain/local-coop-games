import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { albania } from '../../src/games/diktator/scenario/albania';
import { endingText, eventText, plotText } from '../../src/games/diktator/ui/event-text';

const T = cs.diktator;

describe('eventText', () => {
  it('describes money and aid events in Czech', () => {
    expect(eventText(albania, { type: 'budget', income: 60, costs: 70 })).toBe(T.events.budget(60, 70));
    expect(eventText(albania, { type: 'aidGranted', lender: 'italie', amount: 180 })).toBe(T.events.aidGranted('Itálie', 180));
    expect(eventText(albania, { type: 'aidRefused', lender: 'britanie', reason: 'unpopular' })).toBe(T.events.aidUnpopular('Británie'));
  });

  it('names a decision and a news item by their titles', () => {
    const d = albania.decisions[0];
    expect(eventText(albania, { type: 'decided', id: d.id })).toBe(`✓ ${d.title}`);
    const n = albania.news[0];
    expect(eventText(albania, { type: 'news', id: n.id })).toBe(`📰 ${n.title}`);
  });

  it('has no line for palace bookkeeping events', () => {
    expect(eventText(albania, { type: 'moved', hero: 'zogu', from: 'trunni', to: 'pracovna' })).toBeNull();
    expect(eventText(albania, { type: 'heroDone', hero: 'velitel' })).toBeNull();
    expect(eventText(albania, { type: 'quarterStarted', quarter: 2 })).toBeNull();
  });
});

describe('endingText', () => {
  it('covers every ending', () => {
    expect(endingText({ kind: 'survived' })).toBe(T.endings.survived);
    expect(endingText({ kind: 'escaped', via: 'plane' })).toBe(T.endings.plane);
    expect(endingText({ kind: 'escaped', via: 'mountains' })).toBe(T.endings.escapedMountains);
    expect(endingText({ kind: 'killed', cause: 'war' })).toBe(T.endings.war);
  });
});

describe('plotText', () => {
  it('names the plot and the ally', () => {
    expect(plotText(albania, { kind: 'none' })).toBe('');
    expect(plotText(albania, { kind: 'assassination' })).toBe(T.plots.assassination);
    expect(plotText(albania, { kind: 'revolution', ally: 'policie' })).toBe(T.plots.revolution('Tajná policie'));
  });
});

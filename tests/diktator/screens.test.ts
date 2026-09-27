import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { GameEvent, GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { cardsFor, phaseScreen } from '../../src/games/diktator/ui/screens';

const T = cs.diktator;
const P = T.palace;

function day(): GameState {
  return advance(albania, newGame(albania, 4, undefined, { palace: true }).state, { type: 'answer', answer: 'no' }).state;
}

describe('cardsFor', () => {
  it('opens a new game with the first quarter’s card', () => {
    const { state, events } = newGame(albania, 4, undefined, { palace: true });
    const cards = cardsFor(albania, null, events, state);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe(T.quarter(1925, 1));
    expect(cards[0].lines).toContain(T.events.budget(60, 60));
    expect(cards[0].button).toBe(P.toPalace);
  });

  it('shows no card for a command inside the day', () => {
    const s = day();
    const r = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' });
    expect(cardsFor(albania, s, r.events, r.state)).toEqual([]);
  });

  it('shows the evening, then the next quarter, once both heroes end the day', () => {
    let s = day();
    s = advance(albania, s, { type: 'endDay', hero: 'velitel' }).state;
    const r = advance(albania, s, { type: 'endDay', hero: 'zogu' });
    const cards = cardsFor(albania, s, r.events, r.state);
    expect(cards[0].title).toBe(P.evening(T.quarter(1925, 1)));
    expect(cards[0].lines.length).toBeGreaterThan(0);
    if (r.state.phase.kind === 'audience') {
      expect(cards).toHaveLength(2);
      expect(cards[1].title).toBe(T.quarter(1925, 2));
    }
  });

  it('shows no evening card when the evening ends in a revolution', () => {
    const before = day();
    const after: GameState = structuredClone(before);
    after.phase = { kind: 'revolution', faction: 'armada' };
    const events: GameEvent[] = [
      { type: 'heroDone', hero: 'zogu' },
      { type: 'revolution', faction: 'armada', ally: 'policie', strength: 12 },
    ];
    expect(cardsFor(albania, before, events, after)).toEqual([]);
  });

  it('shows no evening card when the evening ends in death', () => {
    const before = day();
    const after: GameState = structuredClone(before);
    after.phase = { kind: 'ended', ending: { kind: 'killed', cause: 'assassination' } };
    const events: GameEvent[] = [
      { type: 'heroDone', hero: 'zogu' },
      { type: 'assassination', faction: 'armada', survived: false },
      { type: 'ended', ending: { kind: 'killed', cause: 'assassination' } },
    ];
    expect(cardsFor(albania, before, events, after)).toEqual([]);
  });

  it('keeps a news line from the evening before a revolution, dropping the revolution line', () => {
    const before = day();
    const after: GameState = structuredClone(before);
    after.phase = { kind: 'revolution', faction: 'armada' };
    const events: GameEvent[] = [
      { type: 'heroDone', hero: 'zogu' },
      { type: 'warThreat' },
      { type: 'revolution', faction: 'armada', ally: 'policie', strength: 12 },
    ];
    const cards = cardsFor(albania, before, events, after);
    expect(cards).toHaveLength(1);
    expect(cards[0].lines).toEqual([T.events.warThreat]);
  });

  it('titles the crisis outcome card "victory" after a punish decision, then shows the next quarter', () => {
    const before = day();
    before.phase = { kind: 'punish', faction: 'armada', chosen: 'policie' };
    const after: GameState = structuredClone(before);
    after.phase = { kind: 'audience', petition: '', suggested: false };
    after.quarter = before.quarter + 1;
    const events: GameEvent[] = [
      { type: 'punished', faction: 'armada', ally: 'policie' },
      { type: 'quarterStarted', quarter: before.quarter + 1 },
    ];
    const cards = cardsFor(albania, before, events, after);
    expect(cards[0].title).toBe(P.victory);
    expect(cards[0].lines).toEqual([T.events.punished]);
    expect(cards[1].title).toBe(T.quarter(1925, 2));
  });
});

describe('phaseScreen', () => {
  it('shows nothing during the palace day', () => {
    expect(phaseScreen(albania, day(), null)).toBeNull();
  });

  it('offers flight and fight in a revolution, and mentions the plane', () => {
    const s = day();
    s.phase = { kind: 'revolution', faction: 'armada' };
    s.hasPlane = true;
    s.plots.armada = { kind: 'revolution', ally: 'policie' };
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.title).toBe(P.revolutionTitle);
    expect(scr.lines).toEqual([T.events.revolution('Armáda', 'Tajná policie', s.str.armada + s.str.policie), P.planeReady]);
    expect(scr.options.map((o) => o.label)).toEqual([T.flee, T.fight]);
    expect(scr.options[0].choice).toEqual({ kind: 'command', command: { type: 'flee' } });
  });

  it('falls back to a plain rebellion line without a revolution plot', () => {
    const s = day();
    s.phase = { kind: 'revolution', faction: 'armada' };
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.lines).toEqual([P.rebels('Armáda')]);
  });

  it('lists all six strength groups as allies with their known mood or "?"', () => {
    const s = day();
    s.phase = { kind: 'chooseAlly', faction: 'armada' };
    s.palace!.seenPop.rolnici = 9;
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.options).toHaveLength(6);
    expect(scr.options.find((o) => o.label.startsWith('Rolníci'))!.label).toBe(P.allyMood('Rolníci', 'nadšení'));
    const unseen = scr.options.find((o) => o.label.startsWith('Statkáři'))!;
    expect(unseen.label).toBe(P.allyMood('Statkáři', P.unknownMood));
    expect(unseen.choice).toEqual({ kind: 'command', command: { type: 'ally', group: 'statkari' } });
  });

  it('asks whether to punish after a won fight', () => {
    const s = day();
    s.phase = { kind: 'punish', faction: 'armada', chosen: 'policie' };
    const scr = phaseScreen(albania, s, null)!;
    expect(scr.title).toBe(P.victory);
    expect(scr.options.map((o) => o.label)).toEqual([T.punishYes, T.punishNo]);
  });

  it('ends with the text, the score and retry / new game / menu', () => {
    const s = day();
    s.phase = { kind: 'ended', ending: { kind: 'killed', cause: 'assassination' } };
    const scr = phaseScreen(albania, s, 1925)!;
    expect(scr.title).toBe(P.ending);
    expect(scr.lines[0]).toBe(T.endings.assassination);
    expect(scr.lines[1].startsWith('Skóre: ')).toBe(true);
    expect(scr.options.map((o) => o.choice.kind)).toEqual(['retry', 'newGame', 'menu']);
    expect(scr.options[0].label).toBe(T.retry(1925));
    expect(phaseScreen(albania, s, null)!.options.map((o) => o.choice.kind)).toEqual(['newGame', 'menu']);
  });
});

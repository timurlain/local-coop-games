import { describe, expect, it } from 'vitest';
import { rankFor, scoreDeltas } from '../../src/games/spy-vs-spy/logic/score';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { openGame } from './fixtures';

describe('scoreDeltas (spec §7 table)', () => {
  it('fight kill: +80 to the killer, -20 to the victim', () => {
    const s = openGame();
    const events: GameEvent[] = [{ type: 'died', spy: 1, cause: 'fight', killer: 0 }];
    expect(scoreDeltas(s, events)).toEqual([80, -20]);
  });

  it('trap placed: +30 to the placer', () => {
    const s = openGame();
    const events: GameEvent[] = [{ type: 'trapSet', spy: 1, trap: 'pruzina' }];
    expect(scoreDeltas(s, events)).toEqual([0, 30]);
  });

  it('trap death: -80, for every trap kind including a time bomb', () => {
    const s = openGame();
    for (const trap of ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana'] as const) {
      expect(scoreDeltas(s, [{ type: 'died', spy: 0, cause: trap }])).toEqual([-80, 0]);
    }
  });

  it('trap death penalises even your own trap (no killer involved)', () => {
    const s = openGame();
    expect(scoreDeltas(s, [{ type: 'died', spy: 0, cause: 'bomba' }])).toEqual([-80, 0]);
  });

  it('opening the map: -70 to the opener', () => {
    const s = openGame();
    expect(scoreDeltas(s, [{ type: 'mapOpened', spy: 1 }])).toEqual([0, -70]);
  });

  it('disarming with a remedy: +40 to the disarmer', () => {
    const s = openGame();
    expect(scoreDeltas(s, [{ type: 'disarmed', spy: 0, trap: 'elektrina', remedy: 'destnik' }])).toEqual([40, 0]);
  });

  it('escaping: +1000 + 5 x whole seconds left on the escaper\'s clock', () => {
    const s = openGame();
    s.spies[0].clock = 62.9; // floor 62
    expect(scoreDeltas(s, [{ type: 'escaped', spy: 0 }])).toEqual([1000 + 5 * 62, 0]);
  });

  it('escaping with zero seconds left still pays the base bonus', () => {
    const s = openGame();
    s.spies[1].clock = 0;
    expect(scoreDeltas(s, [{ type: 'escaped', spy: 1 }])).toEqual([0, 1000]);
  });

  describe('stealing (+60)', () => {
    it('found with stolenFrom set scores the taker', () => {
      const s = openGame();
      expect(
        scoreDeltas(s, [{ type: 'found', spy: 0, thing: null, furniture: 0, stolenFrom: 1 }]),
      ).toEqual([60, 0]);
    });

    it('found without stolenFrom (own item, or never held) scores nothing', () => {
      const s = openGame();
      expect(scoreDeltas(s, [{ type: 'found', spy: 0, thing: null, furniture: 0 }])).toEqual([0, 0]);
    });

    it('a stored secret with stolenFrom scores the taker once', () => {
      const s = openGame();
      expect(
        scoreDeltas(s, [{ type: 'stored', spy: 1, secret: 'klic', furniture: 0, stolenFrom: 0 }]),
      ).toEqual([0, 60]);
    });

    it('a swap with stolenFrom scores the taker', () => {
      const s = openGame();
      const thing = { kind: 'secret', secret: 'klic', lastHolder: 0 } as const;
      expect(
        scoreDeltas(s, [
          { type: 'swapped', spy: 0, gave: { kind: 'secret', secret: 'pas', lastHolder: 0 }, took: thing, furniture: 0, stolenFrom: 1 },
        ]),
      ).toEqual([60, 0]);
    });
  });

  it('sums several events in the same tick, independently per spy', () => {
    const s = openGame();
    const events: GameEvent[] = [
      { type: 'trapSet', spy: 0, trap: 'bomba' },
      { type: 'died', spy: 1, cause: 'fight', killer: 0 },
      { type: 'mapOpened', spy: 1 },
    ];
    expect(scoreDeltas(s, events)).toEqual([30 + 80, -20 - 70]);
  });

  it('events with no scoring rule contribute nothing', () => {
    const s = openGame();
    const events: GameEvent[] = [
      { type: 'bump', spy: 0 },
      { type: 'door', spy: 1 },
      { type: 'respawn', spy: 0 },
    ];
    expect(scoreDeltas(s, events)).toEqual([0, 0]);
  });
});

describe('rankFor (spec §7 thresholds)', () => {
  it('below zero: Nováček', () => {
    expect(rankFor(-1)).toBe('Nováček');
    expect(rankFor(-1000)).toBe('Nováček');
  });

  it('0 to 299: Agent', () => {
    expect(rankFor(0)).toBe('Agent');
    expect(rankFor(299)).toBe('Agent');
  });

  it('300 to 799: Tajný agent', () => {
    expect(rankFor(300)).toBe('Tajný agent');
    expect(rankFor(799)).toBe('Tajný agent');
  });

  it('800 to 1499: Mistr špionáže', () => {
    expect(rankFor(800)).toBe('Mistr špionáže');
    expect(rankFor(1499)).toBe('Mistr špionáže');
  });

  it('1500 and above: Velmistr špionáže', () => {
    expect(rankFor(1500)).toBe('Velmistr špionáže');
    expect(rankFor(50000)).toBe('Velmistr špionáže');
  });
});

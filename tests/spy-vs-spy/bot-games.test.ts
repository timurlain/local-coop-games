import { describe, expect, it } from 'vitest';
import { formatReport, playGame, runTournament, type TournamentOptions } from '../../src/games/spy-vs-spy/bot/tournament';

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

describe('whole games bot vs bot (spec bot §8, §9)', () => {
  for (const level of [1, 2]) {
    it(`level ${level}, IQ 3v3, seeds 1-10: every game ends, no spy stuck`, () => {
      for (const seed of SEEDS) {
        const g = playGame(seed, level, [3, 3], 1);
        expect(g.result, `seed ${seed}`).not.toBe('capped');
        expect(g.stuck, `seed ${seed}`).toBe(false);
      }
    });
  }

  it('the same seed plays the same game twice (identical summary)', () => {
    expect(playGame(4, 2, [3, 3], 1)).toEqual(playGame(4, 2, [3, 3], 1));
    expect(playGame(9, 1, [5, 1], 1)).toEqual(playGame(9, 1, [5, 1], 1));
  });

  it('IQ 5 beats IQ 1 in at least 14 of 20 level-1 games', () => {
    const games = runTournament({ games: 20, iq: [5, 1], level: 1, gameLength: 1, seed: 1 });
    expect(games.filter((g) => g.result === 'white').length).toBeGreaterThanOrEqual(14);
  });

  it('review focus 4: level 8, IQ 5v5, average think under 0.5 ms (real clock)', () => {
    const g = playGame(1, 8, [5, 5], 1, () => performance.now());
    expect(g.thinkMs).toBeGreaterThan(0);
    expect(g.thinkMs).toBeLessThan(0.5);
  });

  it('review finding 5: hideAirport threads through to the created game and changes play', () => {
    const iq: [5, 5] = [5, 5];
    const withHidden = runTournament({ games: 15, iq, level: 1, gameLength: 1, seed: 1, hideAirport: true });
    const shown = runTournament({ games: 15, iq, level: 1, gameLength: 1, seed: 1 });
    expect(withHidden.map((g) => g.result)).not.toEqual(shown.map((g) => g.result));
    // playGame itself takes the same flag (default off, same as omitting it from TournamentOptions).
    expect(playGame(1, 1, iq, 1, undefined, false)).toEqual(playGame(1, 1, iq, 1));
  }, 15000);
});

describe('formatReport', () => {
  it('names wins, draws, average length and deaths by cause, in plain ASCII', () => {
    const opts: TournamentOptions = { games: 3, iq: [3, 3], level: 1, gameLength: 1, seed: 1 };
    const report = formatReport(opts, runTournament(opts));
    expect(report).toMatch(/^Wins White/m);
    expect(report).toMatch(/^Wins Black/m);
    expect(report).toMatch(/^Draws \(both clocks out\)/m);
    expect(report).toMatch(/^Average length/m);
    expect(report).toMatch(/^Deaths by cause/m);
    for (const cause of ['bomba', 'pruzina', 'elektrina', 'pistole', 'casovana', 'fight']) expect(report).toContain(cause);
    expect(/^[\x20-\x7e\n]*$/.test(report)).toBe(true);
  });

  it('review finding 3: no unreachable timeout result — step.ts always settles both-out as a draw', () => {
    const opts: TournamentOptions = { games: 20, iq: [3, 3], level: 1, gameLength: 1, seed: 1 };
    const games = runTournament(opts);
    for (const g of games) expect(g.result).not.toBe('timeout');
    expect(formatReport(opts, games)).not.toContain('Time-outs');
  });
});

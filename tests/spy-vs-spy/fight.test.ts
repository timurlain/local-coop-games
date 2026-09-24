import { describe, expect, it } from 'vitest';
import { trySwing, updateBlocking } from '../../src/games/spy-vs-spy/logic/fight';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { GameEvent } from '../../src/games/spy-vs-spy/logic/state';
import { input, openGame, place } from './fixtures';

function duel() {
  const s = openGame();
  const a = place(s, 0, 4, 100, 20);
  const b = place(s, 1, 4, 110, 20);
  return { s, a, b };
}

describe('trySwing', () => {
  it('hits an opponent in range: damage, knockback, cooldown', () => {
    const { s, a, b } = duel();
    const ev: GameEvent[] = [];
    expect(trySwing(s, a, ev)).toBe(true);
    expect(b.health).toBe(RULES.health - 1);
    expect(b.x).toBe(110 + RULES.knockback);
    expect(a.swingCooldown).toBe(RULES.swingCooldown);
    expect(ev).toEqual([{ type: 'swing', spy: 0 }, { type: 'hit', spy: 1 }]);
  });

  it('consumes the press but does nothing during cooldown', () => {
    const { s, a, b } = duel();
    trySwing(s, a, []);
    const ev: GameEvent[] = [];
    expect(trySwing(s, a, ev)).toBe(true);
    expect(b.health).toBe(RULES.health - 1);
    expect(ev).toEqual([]);
  });

  it('is blocked when the opponent holds away', () => {
    const { s, a, b } = duel();
    updateBlocking(s, b, input({ moveX: 1 })); // a is to the left, away = right
    expect(b.blocking).toBe(true);
    const ev: GameEvent[] = [];
    trySwing(s, a, ev);
    expect(b.health).toBe(RULES.health);
    expect(ev).toEqual([{ type: 'swing', spy: 0 }, { type: 'blocked', spy: 1 }]);
  });

  it('holding towards the opponent is not a block', () => {
    const { s, b } = duel();
    updateBlocking(s, b, input({ moveX: -1 }));
    expect(b.blocking).toBe(false);
  });

  it('returns false when nobody is in range', () => {
    const { s, a, b } = duel();
    b.x = 100 + RULES.fightRangeX + 1;
    expect(trySwing(s, a, [])).toBe(false);
    b.x = 110;
    b.room = 5;
    expect(trySwing(s, a, [])).toBe(false);
  });

  it('kills after health runs out', () => {
    const { s, a, b } = duel();
    const ev: GameEvent[] = [];
    for (let i = 0; i < RULES.health; i++) {
      a.swingCooldown = 0;
      b.x = 110;
      trySwing(s, a, ev);
    }
    expect(b.mode).toBe('dead');
    expect(ev).toContainEqual({ type: 'died', spy: 1, cause: 'fight' });
  });

  it('ignores a dead opponent', () => {
    const { s, a, b } = duel();
    b.mode = 'dead';
    expect(trySwing(s, a, [])).toBe(false);
  });
});

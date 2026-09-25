import { describe, expect, it } from 'vitest';
import { kill } from '../../src/games/spy-vs-spy/logic/death';
import { trySwing, updateBlocking, updateDucking, updateHealthRegen, updateSwing } from '../../src/games/spy-vs-spy/logic/fight';
import { RULES } from '../../src/games/spy-vs-spy/logic/rules';
import type { AttackKind, GameEvent, GameState, Spy } from '../../src/games/spy-vs-spy/logic/state';
import { input, openGame, place } from './fixtures';

function duel() {
  const s = openGame();
  const a = place(s, 0, 4, 100, 20);
  const b = place(s, 1, 4, 110, 20);
  return { s, a, b };
}

/** Presses Akce (`kind`) and runs the attacker's swing clock through the whole wind-up. */
function swingAndStrike(s: GameState, a: Spy, kind: AttackKind, ev: GameEvent[] = []): GameEvent[] {
  trySwing(s, a, kind, ev);
  updateSwing(s, a, windupOf(kind), ev);
  return ev;
}

const windupOf = (kind: AttackKind): number => (kind === 'jab' ? RULES.swingWindup : RULES.bashWindup);

describe('trySwing (spec §8: the press only starts the wind-up)', () => {
  it('starts a jab: no damage yet, facing the opponent, swing event', () => {
    const { s, a, b } = duel();
    a.facing = -1;
    const ev: GameEvent[] = [];
    expect(trySwing(s, a, 'jab', ev)).toBe(true);
    expect(a.attack).toBe('jab');
    expect(a.strikeIn).toBe(RULES.swingWindup);
    expect(a.swingAnim).toBe(RULES.swingWindup + RULES.strikeAnim);
    expect(a.facing).toBe(1);
    expect(b.health).toBe(RULES.health);
    expect(a.swingCooldown).toBe(0);
    expect(ev).toEqual([{ type: 'swing', spy: 0 }]);
  });

  it('starts a head bash with the longer wind-up', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'bash', []);
    expect(a.attack).toBe('bash');
    expect(a.strikeIn).toBe(RULES.bashWindup);
    expect(a.swingAnim).toBe(RULES.bashWindup + RULES.strikeAnim);
    expect(b.health).toBe(RULES.health);
  });

  it('consumes the press but starts nothing during the wind-up or the cooldown', () => {
    const { s, a } = duel();
    trySwing(s, a, 'jab', []);
    const ev: GameEvent[] = [];
    expect(trySwing(s, a, 'bash', ev)).toBe(true);
    expect(a.attack).toBe('jab');
    expect(ev).toEqual([]);
    updateSwing(s, a, RULES.swingWindup, []);
    expect(a.swingCooldown).toBe(RULES.swingCooldown);
    expect(trySwing(s, a, 'jab', ev)).toBe(true);
    expect(ev).toEqual([]);
  });

  it('starts anyway when the opponent shares the room but is out of range (round 4 fix): the strike judges range', () => {
    const { s, a, b } = duel();
    b.x = 100 + RULES.fightRangeX + 1;
    const ev: GameEvent[] = [];
    expect(trySwing(s, a, 'jab', ev)).toBe(true);
    expect(a.attack).toBe('jab');
    expect(ev).toEqual([{ type: 'swing', spy: 0 }]);
  });

  it('returns false when nobody shares the room', () => {
    const { s, a, b } = duel();
    b.room = 5;
    expect(trySwing(s, a, 'jab', [])).toBe(false);
  });

  it('ignores a dead opponent', () => {
    const { s, a, b } = duel();
    b.mode = 'dead';
    expect(trySwing(s, a, 'jab', [])).toBe(false);
  });
});

describe('updateSwing: the strike (spec §8)', () => {
  it('a jab lands at the end of its wind-up: 1 damage, knockback, cooldown from the strike', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'jab', []);
    const ev: GameEvent[] = [];
    updateSwing(s, a, RULES.swingWindup - 0.01, ev);
    expect(b.health).toBe(RULES.health);
    b.sinceHit = 5;
    updateSwing(s, a, 0.01, ev);
    expect(b.health).toBe(RULES.health - RULES.jabDamage);
    expect(RULES.jabDamage).toBe(1);
    expect(b.x).toBe(110 + RULES.knockback);
    expect(b.sinceHit).toBe(0);
    expect(a.swingCooldown).toBe(RULES.swingCooldown);
    expect(a.strikeIn).toBe(0);
    expect(a.attack).toBe('jab'); // still showing the strike frame
    expect(ev).toEqual([{ type: 'hit', spy: 1 }]);
  });

  it('a head bash lands only after 0.3 s and does 2 damage', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'bash', []);
    updateSwing(s, a, RULES.swingWindup, []);
    expect(b.health).toBe(RULES.health);
    updateSwing(s, a, RULES.bashWindup - RULES.swingWindup, []);
    expect(RULES.bashWindup).toBe(0.3);
    expect(RULES.bashDamage).toBe(2);
    expect(b.health).toBe(RULES.health - 2);
    expect(b.x).toBe(110 + RULES.knockback);
  });

  it('the swing ends (attack cleared) once the strike frame has shown', () => {
    const { s, a } = duel();
    swingAndStrike(s, a, 'jab');
    updateSwing(s, a, RULES.strikeAnim, []);
    expect(a.swingAnim).toBe(0);
    expect(a.attack).toBeNull();
  });

  it('a jab is blocked by holding away at the strike, even if the block started after the press', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'jab', []);
    updateBlocking(s, b, input({ moveX: 1 })); // a is to the left, away = right
    expect(b.blocking).toBe(true);
    const ev: GameEvent[] = [];
    updateSwing(s, a, RULES.swingWindup, ev);
    expect(b.health).toBe(RULES.health);
    expect(ev).toEqual([{ type: 'blocked', spy: 1 }]);
    expect(a.swingCooldown).toBe(RULES.swingCooldown);
  });

  it('a block dropped before the strike does not help', () => {
    const { s, a, b } = duel();
    updateBlocking(s, b, input({ moveX: 1 }));
    trySwing(s, a, 'jab', []);
    updateBlocking(s, b, input());
    const ev: GameEvent[] = [];
    updateSwing(s, a, RULES.swingWindup, ev);
    expect(b.health).toBe(RULES.health - 1);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
  });

  it('holding towards the opponent is not a block', () => {
    const { s, b } = duel();
    updateBlocking(s, b, input({ moveX: -1 }));
    expect(b.blocking).toBe(false);
  });

  it('a head bash is not stopped by holding away', () => {
    const { s, a, b } = duel();
    updateBlocking(s, b, input({ moveX: 1 }));
    const ev = swingAndStrike(s, a, 'bash');
    expect(b.health).toBe(RULES.health - 2);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
  });

  it('a head bash is stopped by ducking at the strike', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'bash', []);
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(true);
    const ev: GameEvent[] = [];
    updateSwing(s, a, RULES.bashWindup, ev);
    expect(b.health).toBe(RULES.health);
    expect(ev).toEqual([{ type: 'blocked', spy: 1 }]);
  });

  it('ducking does not stop a jab', () => {
    const { s, a, b } = duel();
    updateDucking(s, b, input({ moveY: 1 }));
    swingAndStrike(s, a, 'jab');
    expect(b.health).toBe(RULES.health - 1);
  });

  it('lands at 40 units apart, well within the doubled range (round 4 §1: the club reaches twice as far)', () => {
    const s = openGame();
    const a = place(s, 0, 4, 100, 20);
    const b = place(s, 1, 4, 140, 20); // 40 units apart in x, same z
    expect(RULES.fightRangeX).toBe(48);
    expect(RULES.fightRangeZ).toBe(16);
    const ev = swingAndStrike(s, a, 'jab');
    expect(b.health).toBe(RULES.health - 1);
    expect(ev).toContainEqual({ type: 'hit', spy: 1 });
  });

  it('misses when the opponent left range during the wind-up', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'bash', []);
    b.x = 100 + RULES.fightRangeX + 1;
    const ev: GameEvent[] = [];
    updateSwing(s, a, RULES.bashWindup, ev);
    expect(b.health).toBe(RULES.health);
    expect(ev).toEqual([]);
    expect(a.swingCooldown).toBe(RULES.swingCooldown);
  });

  it('never strikes once the attacker is dead', () => {
    const { s, a, b } = duel();
    trySwing(s, a, 'jab', []);
    kill(s, a, 'fight', []);
    expect(a.attack).toBeNull();
    updateSwing(s, a, RULES.swingWindup, []);
    expect(b.health).toBe(RULES.health);
  });

  it('kills after health runs out', () => {
    const { s, a, b } = duel();
    const ev: GameEvent[] = [];
    for (let i = 0; i < RULES.health && b.mode !== 'dead'; i++) {
      a.swingCooldown = 0;
      b.x = 110;
      swingAndStrike(s, a, 'bash', ev);
      updateSwing(s, a, RULES.strikeAnim, ev);
    }
    expect(b.mode).toBe('dead');
    expect(ev).toContainEqual({ type: 'died', spy: 1, cause: 'fight', killer: 0 });
    expect(ev.filter((e) => e.type === 'hit')).toHaveLength(Math.ceil(RULES.health / 2));
  });
});

describe('updateDucking (spec §8)', () => {
  it('ducks only in a shared room, holding down, not swinging', () => {
    const { s, a, b } = duel();
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(true);
    updateDucking(s, b, input({ moveY: 1, moveX: 1 }));
    expect(b.ducking).toBe(true);
    updateDucking(s, b, input({ moveY: -1 }));
    expect(b.ducking).toBe(false);
    trySwing(s, b, 'jab', []);
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(false);
    b.attack = null;
    a.room = 5;
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(false);
  });

  it('does not duck when the opponent shares the room but is out of fight range (L3 review)', () => {
    const { s, b } = duel();
    b.x = 100 + RULES.fightRangeX + 1;
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(false);
    b.x = 110;
    b.z = 20 + RULES.fightRangeZ + 1;
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(false);
  });

  it('ducks once the opponent is back within fight range', () => {
    const { s, a, b } = duel();
    b.x = 100 + RULES.fightRangeX + 1;
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(false);
    b.x = a.x + RULES.fightRangeX;
    updateDucking(s, b, input({ moveY: 1 }));
    expect(b.ducking).toBe(true);
  });
});

describe('updateHealthRegen', () => {
  it('does not recover before the delay has passed', () => {
    const { b } = duel();
    b.health = RULES.health - 3;
    b.sinceHit = 0;
    updateHealthRegen(b, RULES.regenDelay - 0.01);
    expect(b.health).toBe(RULES.health - 3);
  });

  it('recovers +1 exactly at the delay after the last hit, then +1 every interval', () => {
    const { b } = duel();
    b.health = RULES.health - 3;
    b.sinceHit = 0;
    updateHealthRegen(b, RULES.regenDelay);
    expect(b.health).toBe(RULES.health - 2);
    updateHealthRegen(b, RULES.regenInterval - 0.01);
    expect(b.health).toBe(RULES.health - 2);
    updateHealthRegen(b, 0.01);
    expect(b.health).toBe(RULES.health - 1);
  });

  it('caps recovery at max health', () => {
    const { b } = duel();
    b.health = RULES.health;
    b.sinceHit = 0;
    updateHealthRegen(b, RULES.regenDelay + RULES.regenInterval * 5);
    expect(b.health).toBe(RULES.health);
  });

  it('does not run while dead or out', () => {
    const { b } = duel();
    b.health = RULES.health - 3;
    b.sinceHit = 0;
    b.mode = 'dead';
    updateHealthRegen(b, RULES.regenDelay + 1);
    expect(b.health).toBe(RULES.health - 3);
    b.mode = 'out';
    updateHealthRegen(b, RULES.regenDelay + 1);
    expect(b.health).toBe(RULES.health - 3);
  });

  it('a new hit restarts the delay (covered by the strike resetting sinceHit)', () => {
    const { s, a, b } = duel();
    b.health = RULES.health - 3;
    b.sinceHit = RULES.regenDelay - 0.1; // about to recover
    swingAndStrike(s, a, 'jab'); // hits b, resetting sinceHit
    expect(b.sinceHit).toBe(0);
    updateHealthRegen(b, RULES.regenDelay - 0.01);
    expect(b.health).toBe(RULES.health - 3 - 1); // the hit itself, no recovery yet
  });
});

import { describe, expect, it } from 'vitest';
import { canHide, hasAllSecrets, hide, resolveSearch } from '../../src/games/spy-vs-spy/logic/hand';
import { atFurniture, firstFurniture, kufrik, openGame, remedy, secret, taken } from './fixtures';

function setup() {
  const s = openGame();
  const f = firstFurniture(s, 0);
  const spy = atFurniture(s, 0, f);
  return { s, f, spy };
}

describe('resolveSearch — normal furniture', () => {
  it('any hand + empty furniture → nothing found', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'nothing', found: null });
    expect(spy.hand).toEqual(secret('pas'));
    expect(f.hidden).toBeNull();
  });

  it('empty hand takes the thing', () => {
    const { f, spy } = setup();
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'took', found: taken(secret('klic'), 0) });
    expect(spy.hand).toEqual(taken(secret('klic'), 0));
    expect(f.hidden).toBeNull();
  });

  it('kufrik + secret → secret goes into the kufrik (stored)', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('pas');
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'stored', found: secret('klic') });
    expect(spy.hand).toEqual(kufrik('pas', 'klic'));
    expect(f.hidden).toBeNull();
  });

  it('secret + kufrik → take kufrik, held secret goes in (stored)', () => {
    const { f, spy } = setup();
    spy.hand = secret('penize');
    f.hidden = kufrik('plany');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'stored', found: secret('penize') });
    expect(spy.hand).toEqual(taken(kufrik('plany', 'penize'), 0));
    expect(f.hidden).toBeNull();
  });

  it('secret + secret → swap', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'swapped', found: taken(secret('klic'), 0) });
    expect(spy.hand).toEqual(taken(secret('klic'), 0));
    expect(f.hidden).toEqual(secret('pas'));
  });

  it('kufrik + hidden remedy → swap, kufrik stays hidden', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('pas', 'klic');
    f.hidden = remedy('destnik');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'swapped', found: remedy('destnik') });
    expect(spy.hand).toEqual(remedy('destnik'));
    expect(f.hidden).toEqual(kufrik('pas', 'klic'));
  });
});

describe('resolveSearch — steals (spec §7)', () => {
  it('taking back your own secret is not a steal', () => {
    const { f, spy } = setup();
    f.hidden = taken(secret('klic'), 0);
    expect(resolveSearch(spy, f).stolenFrom).toBeUndefined();
  });

  it('taking a secret the opponent held last is a steal', () => {
    const { f, spy } = setup();
    f.hidden = taken(secret('klic'), 1);
    expect(resolveSearch(spy, f).stolenFrom).toBe(1);
    expect((spy.hand as { lastHolder: number }).lastHolder).toBe(0);
  });

  it('taking a kufrik the opponent held last is a steal, whatever it contains', () => {
    const { f, spy } = setup();
    f.hidden = taken(kufrik('pas', 'klic'), 1);
    expect(resolveSearch(spy, f).stolenFrom).toBe(1);
  });

  it('a fresh (never-held) secret or kufrik is not a steal', () => {
    const { f, spy } = setup();
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f).stolenFrom).toBeUndefined();
  });

  it('storing a found secret into your own held kufrik steals only if the opponent held that secret', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = kufrik('pas');
    f.hidden = taken(secret('klic'), 1);
    const result = resolveSearch(spy, f);
    expect(result.outcome).toBe('stored');
    expect(result.stolenFrom).toBe(1);
  });

  it('taking a kufrik the opponent held last while holding a secret counts once for the kufrik', () => {
    const s = openGame();
    const f = firstFurniture(s, 0);
    const spy = atFurniture(s, 0, f);
    spy.hand = secret('penize');
    f.hidden = taken(kufrik('plany'), 1);
    const result = resolveSearch(spy, f);
    expect(result.outcome).toBe('stored');
    expect(result.stolenFrom).toBe(1);
    expect(spy.hand).toEqual(taken(kufrik('plany', 'penize'), 0));
  });
});

describe('resolveSearch — remedy sources', () => {
  it('empty hand takes the remedy, source stays', () => {
    const { f, spy } = setup();
    f.source = 'nuzky';
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'took', found: remedy('nuzky') });
    expect(spy.hand).toEqual(remedy('nuzky'));
    expect(f.source).toBe('nuzky');
    expect(f.hidden).toBeNull();
  });

  it('full hand takes the remedy and leaves the held thing in the hidden slot (swap)', () => {
    const { f, spy } = setup();
    f.source = 'nuzky';
    spy.hand = kufrik('pas');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'swapped', found: remedy('nuzky') });
    expect(spy.hand).toEqual(remedy('nuzky'));
    expect(f.hidden).toEqual(kufrik('pas'));
  });

  it('a hidden thing in a source is found before the remedy', () => {
    const { f, spy } = setup();
    f.source = 'voda';
    f.hidden = secret('plany');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'took', found: taken(secret('plany'), 0) });
    expect(spy.hand).toEqual(taken(secret('plany'), 0));
    expect(f.hidden).toBeNull();
  });

  it('holding its own remedy puts it back (putBack)', () => {
    const { f, spy } = setup();
    f.source = 'voda';
    spy.hand = remedy('voda');
    expect(resolveSearch(spy, f)).toEqual({ outcome: 'putBack', found: null });
    expect(spy.hand).toBeNull();
    expect(f.hidden).toBeNull();
  });
});

describe('hide', () => {
  it('is allowed only with a full hand and a free hidden slot', () => {
    const { f, spy } = setup();
    expect(canHide(spy, f)).toBe(false);
    spy.hand = secret('pas');
    expect(canHide(spy, f)).toBe(true);
    f.hidden = secret('klic');
    expect(canHide(spy, f)).toBe(false);
  });

  it('moves the hand item into the furniture', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    hide(spy, f);
    expect(spy.hand).toBeNull();
    expect(f.hidden).toEqual(secret('pas'));
  });
});

describe('hasAllSecrets', () => {
  it('needs the kufrik with all four secrets', () => {
    expect(hasAllSecrets(null)).toBe(false);
    expect(hasAllSecrets(secret('pas'))).toBe(false);
    expect(hasAllSecrets(kufrik('pas', 'klic', 'penize'))).toBe(false);
    expect(hasAllSecrets(kufrik('plany', 'pas', 'klic', 'penize'))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { canHide, hasAllSecrets, hide, resolveSearch } from '../../src/games/spy-vs-spy/logic/hand';
import { atFurniture, firstFurniture, kufrik, openGame, remedy, secret } from './fixtures';

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
    expect(resolveSearch(spy, f)).toBeNull();
    expect(spy.hand).toEqual(secret('pas'));
    expect(f.hidden).toBeNull();
  });

  it('empty hand takes the thing', () => {
    const { f, spy } = setup();
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f)).toEqual(secret('klic'));
    expect(spy.hand).toEqual(secret('klic'));
    expect(f.hidden).toBeNull();
  });

  it('kufrik + secret → secret goes into the kufrik', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('pas');
    f.hidden = secret('klic');
    expect(resolveSearch(spy, f)).toEqual(secret('klic'));
    expect(spy.hand).toEqual(kufrik('pas', 'klic'));
    expect(f.hidden).toBeNull();
  });

  it('secret + kufrik → take kufrik, held secret goes in', () => {
    const { f, spy } = setup();
    spy.hand = secret('penize');
    f.hidden = kufrik('plany');
    expect(resolveSearch(spy, f)).toEqual(kufrik('plany', 'penize'));
    expect(spy.hand).toEqual(kufrik('plany', 'penize'));
    expect(f.hidden).toBeNull();
  });

  it('secret + secret → swap', () => {
    const { f, spy } = setup();
    spy.hand = secret('pas');
    f.hidden = secret('klic');
    resolveSearch(spy, f);
    expect(spy.hand).toEqual(secret('klic'));
    expect(f.hidden).toEqual(secret('pas'));
  });

  it('kufrik + hidden remedy → swap, kufrik stays hidden', () => {
    const { f, spy } = setup();
    spy.hand = kufrik('pas', 'klic');
    f.hidden = remedy('destnik');
    resolveSearch(spy, f);
    expect(spy.hand).toEqual(remedy('destnik'));
    expect(f.hidden).toEqual(kufrik('pas', 'klic'));
  });
});

describe('resolveSearch — remedy sources', () => {
  it('empty hand takes the remedy, source stays', () => {
    const { f, spy } = setup();
    f.source = 'nuzky';
    expect(resolveSearch(spy, f)).toEqual(remedy('nuzky'));
    expect(spy.hand).toEqual(remedy('nuzky'));
    expect(f.source).toBe('nuzky');
    expect(f.hidden).toBeNull();
  });

  it('full hand takes the remedy and leaves the held thing in the hidden slot', () => {
    const { f, spy } = setup();
    f.source = 'nuzky';
    spy.hand = kufrik('pas');
    resolveSearch(spy, f);
    expect(spy.hand).toEqual(remedy('nuzky'));
    expect(f.hidden).toEqual(kufrik('pas'));
  });

  it('a hidden thing in a source is found before the remedy', () => {
    const { f, spy } = setup();
    f.source = 'voda';
    f.hidden = secret('plany');
    expect(resolveSearch(spy, f)).toEqual(secret('plany'));
    expect(spy.hand).toEqual(secret('plany'));
    expect(f.hidden).toBeNull();
  });

  it('holding its own remedy puts it back', () => {
    const { f, spy } = setup();
    f.source = 'voda';
    spy.hand = remedy('voda');
    expect(resolveSearch(spy, f)).toBeNull();
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

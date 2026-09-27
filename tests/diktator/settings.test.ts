import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, nextEffects, saveSettings } from '../../src/games/diktator/settings';

// The test environment (node) has no localStorage; loadJson/saveJson only degrade gracefully when it is missing
// or throws, so a minimal in-memory stub lets these tests exercise the real round-trip.
class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('nextEffects (play-test round 6b §1)', () => {
  it('cycles 1 → 0.7 → 0.4 → 0 → 1', () => {
    expect(nextEffects(1)).toBe(0.7);
    expect(nextEffects(0.7)).toBe(0.4);
    expect(nextEffects(0.4)).toBe(0);
    expect(nextEffects(0)).toBe(1);
  });
});

describe('loadSettings/saveSettings', () => {
  it('defaults to full effects volume with nothing saved', () => {
    expect(loadSettings()).toEqual({ effects: 1 });
  });

  it('round-trips a saved effects volume', () => {
    saveSettings({ effects: 0.4 });
    expect(loadSettings()).toEqual({ effects: 0.4 });
  });

  it('falls back to the default for junk saved under the key', () => {
    localStorage.setItem('diktator/settings', JSON.stringify({ effects: 'loud' }));
    expect(loadSettings()).toEqual({ effects: 1 });
    localStorage.setItem('diktator/settings', 'not json');
    expect(loadSettings()).toEqual({ effects: 1 });
  });
});

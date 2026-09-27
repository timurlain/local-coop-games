// Menu settings, persisted in localStorage (play-test round 6b §1: one effects-volume knob).

import { loadJson, saveJson } from '../../shared/storage';

export type EffectsVolume = 1 | 0.7 | 0.4 | 0;

export interface Settings {
  effects: EffectsVolume;
}

const KEY = 'diktator/settings';
/** The cycle `nextEffects` steps through, in order. */
const CYCLE = [1, 0.7, 0.4, 0] as const;

function isEffectsVolume(v: unknown): v is EffectsVolume {
  return (CYCLE as readonly unknown[]).includes(v);
}

/** 1 → 0.7 → 0.4 → 0 → 1 … */
export function nextEffects(v: EffectsVolume): EffectsVolume {
  const i = CYCLE.indexOf(v);
  return CYCLE[(i + 1) % CYCLE.length];
}

export function loadSettings(): Settings {
  const raw = loadJson<Partial<Settings>>(KEY, {});
  return { effects: isEffectsVolume(raw.effects) ? raw.effects : 1 };
}

export function saveSettings(s: Settings): void {
  saveJson(KEY, s);
}

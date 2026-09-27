import { makeRng } from '../../../shared/rng';
import type { GameState } from './state';

export const SAVE_VERSION = 4;

export interface SaveFile {
  readonly version: typeof SAVE_VERSION;
  readonly scenario: string;
  readonly current: GameState;
  /** The state at the start of each year (Q1, audience phase), oldest first. */
  readonly checkpoints: readonly GameState[];
  readonly retries: number;
}

function isYearStart(s: GameState): boolean {
  return s.phase.kind === 'audience' && !s.phase.suggested && s.quarter % 4 === 1;
}

export function newSave(scenario: string, state: GameState): SaveFile {
  return { version: SAVE_VERSION, scenario, current: state, checkpoints: isYearStart(state) ? [state] : [], retries: 0 };
}

/** Stores the latest state; at the start of a year also stores that year's checkpoint, once — a palace-mode
 * audience phase spans many commands, so later calls for the same quarter never overwrite the first. */
export function recordTurn(f: SaveFile, state: GameState): SaveFile {
  const checkpoints = isYearStart(state) && !f.checkpoints.some((c) => c.quarter === state.quarter) ? [...f.checkpoints, state] : f.checkpoints;
  return { ...f, current: state, checkpoints };
}

/** Back to the latest yearly checkpoint not after the current turn; null when there is none. */
export function retryFromYear(f: SaveFile): { file: SaveFile; state: GameState } | null {
  const cp = [...f.checkpoints].reverse().find((c) => c.quarter <= f.current.quarter);
  if (!cp) return null;
  const state = structuredClone(cp);
  state.rng = makeRng((cp.seed ^ Math.imul(f.retries + 1, 0x9e3779b9)) >>> 0);
  return { state, file: { ...f, current: state, retries: f.retries + 1 } };
}

export function serialize(f: SaveFile): string {
  return JSON.stringify(f);
}

/** Null for missing, broken or foreign-version data (the menu then hides "Pokračovat"). */
export function deserialize(raw: string | null): SaveFile | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<SaveFile>;
    if (f.version !== SAVE_VERSION || !f.current || !Array.isArray(f.checkpoints)) return null;
    return f as SaveFile;
  } catch {
    return null;
  }
}

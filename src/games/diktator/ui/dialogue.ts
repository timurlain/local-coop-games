// One half's conversation (spec §5.3, "Comic dialogue"): the choice bubble (plan 2c's menu navigation) and the
// queue of lines that play after a choice, each waiting for Action. Pure.

import { CLOSED, navigate, type Intent, type MenuUi } from './controls';
import type { Line, Speaker } from './speech';

export interface Dialogue {
  readonly ui: MenuUi;
  /** Lines still to show; the first one is on screen. */
  readonly queue: readonly Line[];
}

export const QUIET: Dialogue = { ui: CLOSED, queue: [] };

export interface SteerResult {
  readonly d: Dialogue;
  /** A menu item was chosen (only when no line is waiting). */
  readonly chosen: number | null;
  /** An intent for the palace (arrows, the seal key) when no line waits and the menu is closed. */
  readonly pass: Intent | null;
  /** A line was dismissed (Action) or the conversation skipped (Esc). */
  readonly advanced: boolean;
}

/** Queues `lines` and closes an open (non-modal) choice bubble; a modal audience keeps its focus. */
export function say(d: Dialogue, lines: readonly Line[]): Dialogue {
  return { ui: d.ui.open ? CLOSED : d.ui, queue: [...d.queue, ...lines] };
}

/** Who is speaking now, or null when no line is up. */
export function speaking(d: Dialogue): Speaker | null {
  return d.queue[0]?.speaker ?? null;
}

/** While lines wait, Action shows the next, Esc skips the rest and nothing else gets through; otherwise the menu. */
export function steer(d: Dialogue, intent: Intent, count: number, modal: boolean): SteerResult {
  if (d.queue.length > 0) {
    if (intent.kind === 'action') return { d: { ...d, queue: d.queue.slice(1) }, chosen: null, pass: null, advanced: true };
    if (intent.kind === 'close') return { d: { ...d, queue: [] }, chosen: null, pass: null, advanced: true };
    return { d, chosen: null, pass: null, advanced: false };
  }
  const r = navigate(d.ui, intent, count, modal);
  return { d: { ...d, ui: r.ui }, chosen: r.chosen, pass: r.pass, advanced: false };
}

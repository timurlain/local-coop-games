import { describe, expect, it } from 'vitest';
import { QUIET, say, speaking, steer } from '../../src/games/diktator/ui/dialogue';
import type { Line } from '../../src/games/diktator/ui/speech';

const a: Line = { speaker: { kind: 'hero', hero: 'zogu' }, text: 'Co si přejete?' };
const b: Line = { speaker: { kind: 'group', group: 'armada' }, text: 'Armáda: „Nic si nepřejeme.“' };

describe('dialogue', () => {
  it('without lines, steers the menu like plan 2c', () => {
    const r = steer(QUIET, { kind: 'action' }, 3, false);
    expect(r.d.ui).toEqual({ open: true, focus: 0 });
    expect(r.chosen).toBeNull();
    expect(r.advanced).toBe(false);
    expect(steer(QUIET, { kind: 'dir', dir: 'left' }, 3, false).pass).toEqual({ kind: 'dir', dir: 'left' });
  });

  it('say() closes the choice bubble and queues the lines', () => {
    const d = say({ ui: { open: true, focus: 2 }, queue: [] }, [a, b]);
    expect(d.ui.open).toBe(false);
    expect(d.queue).toEqual([a, b]);
    expect(speaking(d)).toEqual(a.speaker);
  });

  it('while lines wait, Action shows the next one and nothing else gets through', () => {
    const d = say(QUIET, [a, b]);
    const r1 = steer(d, { kind: 'action' }, 3, false);
    expect(r1.advanced).toBe(true);
    expect(r1.d.queue).toEqual([b]);
    expect(r1.chosen).toBeNull();
    const moved = steer(d, { kind: 'dir', dir: 'left' }, 3, false);
    expect(moved.pass).toBeNull();
    expect(moved.d).toBe(d);
    expect(steer(d, { kind: 'seal' }, 3, false).d).toBe(d);
  });

  it('Esc skips the rest of the conversation', () => {
    const r = steer(say(QUIET, [a, b]), { kind: 'close' }, 3, false);
    expect(r.d.queue).toEqual([]);
    expect(r.advanced).toBe(true);
  });

  it('keeps a modal menu’s focus while lines play', () => {
    const d = say({ ui: { open: false, focus: 1 }, queue: [] }, [a]);
    expect(d.ui).toEqual({ open: false, focus: 1 });
    expect(speaking(QUIET)).toBeNull();
  });
});

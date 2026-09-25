import { IDLE, KEYBOARD_LEFT, KEYBOARD_RIGHT, gamepadActions, keyboardActions, type PlayerActions } from './actions';

/** 'kb-left' | 'kb-right' | 'pad-<gamepad index>' */
export type DeviceId = string;
type Edge = 'action' | 'trap' | 'pause';

/**
 * Collects keyboard and gamepad state. Call `update()` exactly once per logic tick,
 * then read `get()` / `pressed()` / `keyPressed()` for that tick.
 */
export class InputManager {
  private readonly keys = new Set<string>();
  private pendingPresses = new Set<string>();
  private tickPresses = new Set<string>();
  private current = new Map<DeviceId, PlayerActions>();
  private previous = new Map<DeviceId, PlayerActions>();
  private readonly captured: Set<string>;

  constructor(private readonly win: Window) {
    this.captured = new Set([
      ...Object.values(KEYBOARD_LEFT).flat(),
      ...Object.values(KEYBOARD_RIGHT).flat(),
      'F1',
    ]);
    win.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      const inForm = !!t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
      if (!inForm && this.captured.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pendingPresses.add(e.code);
      this.keys.add(e.code);
    });
    win.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    win.addEventListener('blur', () => {
      this.keys.clear();
      this.pendingPresses.clear();
    });
  }

  update(): void {
    this.tickPresses = this.pendingPresses;
    this.pendingPresses = new Set();

    // A key that was pressed and released between two update() calls never appears in
    // `this.keys` at this instant, but it did happen this tick — hold it for one tick so
    // pressed()/get().action can see it instead of silently dropping the tap.
    const effectiveKeys = new Set([...this.keys, ...this.tickPresses]);

    this.previous = this.current;
    this.current = new Map();
    this.current.set('kb-left', keyboardActions(effectiveKeys, KEYBOARD_LEFT));
    this.current.set('kb-right', keyboardActions(effectiveKeys, KEYBOARD_RIGHT));
    for (const pad of this.win.navigator.getGamepads?.() ?? []) {
      if (pad && pad.connected) this.current.set(`pad-${pad.index}`, gamepadActions(pad));
    }
  }

  devices(): DeviceId[] {
    return [...this.current.keys()];
  }

  isConnected(id: DeviceId): boolean {
    return this.current.has(id);
  }

  get(id: DeviceId): PlayerActions {
    return this.current.get(id) ?? IDLE;
  }

  /** True on the tick the button went down. */
  pressed(id: DeviceId, key: Edge): boolean {
    return this.get(id)[key] && !(this.previous.get(id)?.[key] ?? false);
  }

  /** Any keyboard key went down this tick. */
  anyKeyPressed(): boolean {
    return this.tickPresses.size > 0;
  }

  /** Raw key press this tick (for F1, KeyM and other non-player keys). */
  keyPressed(code: string): boolean {
    return this.tickPresses.has(code);
  }
}

import { cs } from '../../../shared/i18n/cs';
import type { Thing } from '../logic/state';
import type { HandColor } from './colors';

/** How long one toast shows, seconds. */
export const TOAST_TIME = 1.5;

export interface Toast {
  text: string;
  kind: HandColor;
  start: number;
  end: number;
}

/** Render-side queue of toasts for one player; toasts show one after another. */
export type ToastQueue = Toast[];

/** Czech name and colour of a thing entering the hand. */
export function toastFor(t: Thing): { text: string; kind: HandColor } {
  const names = cs.spy.things;
  switch (t.kind) {
    case 'secret':
      return { text: names[t.secret], kind: 'secret' };
    case 'remedy':
      return { text: names[t.remedy], kind: 'remedy' };
    case 'kufrik':
      return { text: names.kufrik, kind: 'kufrik' };
  }
}

/** Queues a toast; it starts now or when the previous one ends. */
export function pushToast(q: ToastQueue, toast: { text: string; kind: HandColor }, now: number): void {
  const last = q[q.length - 1];
  const start = last && last.end > now ? last.end : now;
  q.push({ ...toast, start, end: start + TOAST_TIME });
}

/** The toast showing at `now` (dropping finished ones), or null. */
export function currentToast(q: ToastQueue, now: number): Toast | null {
  while (q.length > 0 && q[0].end <= now) q.shift();
  const head = q[0];
  return head && head.start <= now ? head : null;
}

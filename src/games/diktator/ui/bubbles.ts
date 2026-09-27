// Where the comic bubbles sit on a half's stage (480 × 200 stage units) and what each shows. Pure; ui/dom.ts
// turns these into positioned elements over the canvas.

import type { Hero } from '../logic/palace';
import { CROWD_MAX_X, CROWD_MIN_X, FLOOR_Y } from '../render/rooms/crowd';
import type { Dialogue } from './dialogue';
import type { HeroMenu } from './menus';
import type { RoomView } from './palace-view';
import type { Speaker } from './speech';

/** The view to draw and anchor bubbles on: the petitioner stays while a line of his still waits in this half. */
export function stageView(view: RoomView, previous: RoomView | null, d: Dialogue): RoomView {
  if (view.petitioner || !previous?.petitioner || previous.id !== view.id) return view;
  return d.queue.some((l) => l.speaker.kind === 'petitioner') ? { ...view, petitioner: previous.petitioner } : view;
}

/** Puppet height on stage (render/rooms/scene.ts scales every figure to 95 units). */
const FIGURE = 95;
const GAP = 4;

export interface Anchor {
  readonly x: number;
  /** Just above the speaker's head. */
  readonly y: number;
}

export type Bubble =
  | {
      readonly kind: 'choice';
      readonly anchor: Anchor;
      /** Stage x the bubble must not cross — clears the petitioner when he is on stage. */
      readonly right: number;
      readonly title: string;
      readonly body: readonly string[];
      readonly items: readonly { readonly label: string; readonly detail: string }[];
      readonly focus: number;
    }
  | { readonly kind: 'speech'; readonly anchor: Anchor; readonly text: string; readonly speaker: Speaker; readonly more: boolean }
  | { readonly kind: 'caption'; readonly text: string; readonly more: boolean };

const head = (scale = 1): number => Math.round(FLOOR_Y - FIGURE * scale - GAP);

/** The point above the speaker's head in this room, or null when he is not on this stage (shown as a caption). */
export function anchorFor(sp: Speaker, view: RoomView, own: Hero): Anchor | null {
  switch (sp.kind) {
    case 'hero':
      if (!view.heroes.includes(sp.hero)) return null;
      return sp.hero === own ? { x: 90, y: head() } : { x: 145, y: head(0.92) };
    case 'petitioner':
      return view.petitioner ? { x: 395, y: head() } : null;
    case 'resident':
      return view.resident ? { x: 380, y: head() } : null;
    case 'group': {
      const i = view.crowds.findIndex((c) => c.group === sp.group);
      if (i < 0) return null;
      if (view.layout === 'envoys') return { x: 300 + 60 * i, y: head() };
      return { x: Math.round((CROWD_MIN_X + CROWD_MAX_X) / 2), y: head() };
    }
    case 'caption':
      return null;
  }
}

/**
 * The bubbles of one half, back to front: the waiting line (or else the open choice bubble), then the other half's
 * fading captions. `captions` are texts only.
 */
export function bubblesFor(d: Dialogue, captions: readonly string[], menu: HeroMenu, view: RoomView, own: Hero): Bubble[] {
  const out: Bubble[] = [];
  const line = d.queue[0];
  if (line) {
    const anchor = anchorFor(line.speaker, view, own);
    const more = d.queue.length > 1;
    out.push(anchor ? { kind: 'speech', anchor, text: line.text, speaker: line.speaker, more } : { kind: 'caption', text: line.text, more });
  } else if ((d.ui.open || menu.modal) && (menu.items.length > 0 || menu.body.length > 0)) {
    out.push({
      kind: 'choice',
      anchor: anchorFor({ kind: 'hero', hero: own }, view, own) ?? { x: 90, y: head() },
      right: view.petitioner ? 372 : 470,
      title: menu.title,
      body: menu.body,
      items: menu.items.map((i) => ({ label: i.label, detail: i.detail })),
      focus: d.ui.focus,
    });
  } else if (menu.items.length === 0 && menu.body.length > 0) {
    out.push({ kind: 'caption', text: menu.body[0], more: false });
  }
  for (const text of captions) out.push({ kind: 'caption', text, more: false });
  return out;
}

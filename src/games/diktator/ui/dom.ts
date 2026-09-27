// DOM rendering of the palace page (plan 2c): the top HUD, the palace strip, each half's panel and the shared
// overlay. Thin: it draws the pure models from menus/hud/notes/screens and reports clicks; no game logic here.

import { cs } from '../../../shared/i18n/cs';
import type { Hero, RoomId } from '../logic/palace';
import { STAGE_H, STAGE_W } from '../render/rooms/crowd';
import type { MenuUi } from './controls';
import type { HeroHud } from './hud';
import type { HeroMenu } from './menus';
import type { StripCell } from './palace-view';

const T = cs.diktator;
const P = T.palace;
const $ = <E extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as E;

function para(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

function menuList(ol: HTMLOListElement, labels: readonly { label: string; detail: string }[], focus: number | null, onChoose: (i: number) => void): void {
  ol.replaceChildren(
    ...labels.map((it, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.detail) {
        const small = document.createElement('small');
        small.textContent = it.detail;
        b.append(small);
      }
      if (i === focus) b.classList.add('focus');
      b.addEventListener('click', () => onChoose(i));
      li.append(b);
      return li;
    }),
  );
  const focused = focus === null ? null : ol.children[focus];
  focused?.scrollIntoView({ block: 'nearest' });
}

export function renderTop(lines: readonly string[]): void {
  $('#top-hud').replaceChildren(
    ...lines.map((l) => {
      const s = document.createElement('span');
      s.textContent = l;
      return s;
    }),
  );
}

export function renderStrip(cells: readonly (readonly StripCell[])[], flash: ReadonlySet<RoomId>): void {
  $('#strip').replaceChildren(
    ...cells.flat().map((c) => {
      const div = document.createElement('div');
      div.className = 'cell';
      if (flash.has(c.room)) div.classList.add('flash');
      div.append(para(c.name));
      const mood = document.createElement('span');
      mood.className = 'mood';
      mood.textContent = c.count > 0 ? `${c.count} · ${c.mood === null ? P.unknownMood : T.moods[c.mood]}` : '';
      div.append(mood);
      const heroes = document.createElement('span');
      heroes.className = 'heroes';
      for (const h of c.heroes) {
        const b = document.createElement('b');
        b.textContent = T.heroes[h][0];
        b.title = T.heroes[h];
        heroes.append(b);
      }
      div.append(heroes);
      return div;
    }),
  );
}

export interface HalfModel {
  readonly hud: HeroHud;
  readonly menu: HeroMenu;
  readonly ui: MenuUi;
  readonly notes: readonly string[];
  /** Solo play: this half is not the one being steered. */
  readonly inactive: boolean;
  readonly solo: boolean;
}

export function renderHalf(hero: Hero, m: HalfModel, onChoose: (i: number) => void): void {
  const root = $(`#half-${hero}`);
  root.classList.toggle('inactive', m.inactive);
  const hud = [m.hud.name, m.hud.room, `${P.hours} ${m.hud.hours}`];
  if (m.hud.seal) hud.push(`✉ ${P.sealMark}`);
  $('.hud', root).replaceChildren(...hud.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
  $('.menu-title', root).textContent = m.menu.title;
  $('.menu-body', root).replaceChildren(...m.menu.body.map(para));
  const open = m.ui.open || m.menu.modal;
  const ol = $<HTMLOListElement>('.menu', root);
  ol.classList.toggle('closed', !open);
  menuList(ol, m.menu.items, open ? m.ui.focus : null, onChoose);
  const hint = open ? P.hintOpen : P.hintClosed;
  $('.hint', root).textContent = m.solo ? `${hint} · ${P.soloHint}` : hint;
  $('.notes', root).replaceChildren(...m.notes.map(para));
}

export interface OverlayModel {
  readonly title: string;
  readonly lines: readonly string[];
  readonly options: readonly string[];
  readonly focus: number;
  readonly hint: string;
}

export function renderOverlay(m: OverlayModel | null, onChoose: (i: number) => void): void {
  $('#overlay').classList.toggle('hidden', m === null);
  if (!m) return;
  $('#overlay-title').textContent = m.title;
  $('#overlay-lines').replaceChildren(...m.lines.map(para));
  menuList($<HTMLOListElement>('#overlay-options'), m.options.map((label) => ({ label, detail: '' })), m.focus, onChoose);
  $('#overlay-hint').textContent = m.hint;
}

/** Sizes the half's canvas to the largest 480 × 200 box that fits its container; returns the stage scale. */
export function fitStage(canvas: HTMLCanvasElement): number {
  const box = canvas.parentElement!;
  const w = Math.max(1, Math.min(box.clientWidth, (box.clientHeight * STAGE_W) / STAGE_H));
  const h = (w * STAGE_H) / STAGE_W;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
  const bw = Math.round(w * dpr);
  if (canvas.width !== bw) {
    canvas.width = bw;
    canvas.height = Math.round(h * dpr);
  }
  return canvas.width / STAGE_W;
}

export function stageCanvas(hero: Hero): HTMLCanvasElement {
  return $<HTMLCanvasElement>(`#half-${hero} .stage`);
}

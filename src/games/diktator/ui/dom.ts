// DOM rendering of the palace page (plan 2c): the top HUD, the palace strip, each half's panel and the shared
// overlay. Thin: it draws the pure models from menus/hud/notes/screens and reports clicks; no game logic here.

import { cs } from '../../../shared/i18n/cs';
import type { Hero, RoomId } from '../logic/palace';
import { STAGE_H, STAGE_W } from '../render/rooms/crowd';
import type { Bubble } from './bubbles';
import type { HeroHud } from './hud';
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
  /** A line is waiting in this half. */
  readonly talking: boolean;
  /** The choice bubble is open (menu open or modal). */
  readonly open: boolean;
  /** Solo play: this half is not the one being steered. */
  readonly inactive: boolean;
  readonly solo: boolean;
}

export function renderHalf(hero: Hero, m: HalfModel): void {
  const root = $(`#half-${hero}`);
  root.classList.toggle('inactive', m.inactive);
  const hud = [m.hud.name, m.hud.room, `${P.hours} ${m.hud.hours}`];
  if (m.hud.seal) hud.push(`✉ ${P.sealMark}`);
  $('.hud', root).replaceChildren(...hud.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
  const hint = m.talking ? P.hintTalk : m.open ? P.hintOpen : P.hintClosed;
  $('.hint', root).textContent = m.solo ? `${hint} · ${P.soloHint}` : hint;
}

/** Draws a half's comic bubbles over its canvas. Stage units are mapped onto the canvas' on-screen box. */
export function renderBubbles(hero: Hero, bubbles: readonly Bubble[], onChoose: (i: number) => void): void {
  const box = $(`#half-${hero} .stage-box`);
  const canvas = $<HTMLCanvasElement>('.stage', box);
  const layer = $('.bubbles', box);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const ox = canvas.offsetLeft;
  const oy = canvas.offsetTop;
  const px = (x: number) => ox + (x / STAGE_W) * cw;
  const py = (y: number) => oy + (y / STAGE_H) * ch;
  layer.style.fontSize = `${Math.max(13, Math.min(26, ch * 0.075))}px`;
  layer.replaceChildren();
  let capTop = oy + ch * 0.02;
  for (const b of bubbles) {
    const el = document.createElement('div');
    el.className = `bubble ${b.kind}`;
    if (b.kind === 'choice') {
      el.style.left = `${px(b.anchor.x + 26)}px`;
      el.style.top = `${oy + ch * 0.03}px`;
      el.style.maxHeight = `${ch * 0.94}px`;
      el.style.maxWidth = `${px(b.right) - px(b.anchor.x + 26)}px`;
      const h = document.createElement('h3');
      h.textContent = b.title;
      el.append(h, ...b.body.map(para));
      const ol = document.createElement('ol');
      menuList(ol, b.items, b.focus, onChoose);
      el.append(ol);
      layer.append(el);
      continue;
    }
    el.textContent = b.text;
    if (b.more) {
      const m = document.createElement('span');
      m.className = 'more';
      m.textContent = T.speech.more;
      el.prepend(m);
    }
    if (b.kind === 'caption') {
      el.style.left = `${ox + cw * 0.01}px`;
      el.style.top = `${capTop}px`;
      layer.append(el);
      capTop += el.offsetHeight + 4;
    } else {
      el.style.left = '0';
      el.style.top = '0';
      el.style.maxWidth = `${cw * 0.6}px`;
      const headY = py(b.anchor.y);
      el.style.maxHeight = `${Math.max(40, headY - 14 - (oy + 4))}px`;
      el.style.overflowY = 'auto';
      layer.append(el);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const ax = px(b.anchor.x);
      const left = Math.min(Math.max(ax - w / 2, ox + 4), ox + cw - w - 4);
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(oy + 4, headY - 14 - h)}px`;
      el.style.setProperty('--tail', `${Math.min(Math.max(ax - left, 16), w - 16)}px`);
    }
  }
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

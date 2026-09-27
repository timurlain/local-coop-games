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
      el.style.maxWidth = `${px(b.right) - px(b.anchor.x + 26)}px`;
      // The scrolling lives on an inner box: overflow on the bubble itself would clip its tail.
      const inner = document.createElement('div');
      inner.className = 'scroll';
      inner.style.maxHeight = `${ch * 0.9}px`;
      const h = document.createElement('h3');
      h.textContent = b.title;
      inner.append(h, ...b.body.map(para));
      const ol = document.createElement('ol');
      menuList(ol, b.items, b.focus, onChoose);
      inner.append(ol);
      el.append(inner);
      layer.append(el);
      continue;
    }
    const says = document.createElement('div');
    says.className = 'scroll';
    says.textContent = b.text;
    el.append(says);
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
      says.style.maxHeight = `${Math.max(40, headY - 22 - (oy + 4))}px`;
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
  /** The evening's news as a gazette (plan 5): a masthead and one article per headline. */
  readonly gazette?: { readonly date: string; readonly headlines: readonly string[] };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el as SVGElementTagNameMap[K];
}

/** A 120 × 90 sepia engraving-like placeholder: sky, sun, rooftops and a minaret silhouette of Tirana, hatch
 * lines. The art plan (plan 5) replaces it with real illustrations. */
function gazetteArt(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 120 90', width: 120, height: 90 });
  svg.append(
    svgEl('rect', { x: 0, y: 0, width: 120, height: 90, fill: '#e3d3a4' }),
    svgEl('circle', { cx: 92, cy: 22, r: 12, fill: '#c9a44a' }),
    svgEl('path', {
      d: 'M0,90 L0,58 L14,44 L28,58 L40,50 L52,58 L52,34 L58,22 L64,34 L64,58 L78,46 L92,58 L104,50 L120,60 L120,90 Z',
      fill: '#6a4a2a',
    }),
    svgEl('path', { d: 'M58,22 A6,6 0 0 1 64,34 L52,34 A6,6 0 0 1 58,22 Z', fill: '#5a3e22' }),
  );
  for (let i = -90; i < 120; i += 6) svg.append(svgEl('line', { x1: i, y1: 0, x2: i + 90, y2: 90, stroke: '#7a6a45', 'stroke-width': 0.4, opacity: 0.35 }));
  return svg;
}

function renderGazette(gazette: { readonly date: string; readonly headlines: readonly string[] } | undefined): void {
  const root = $('#overlay-gazette');
  $('.card').classList.toggle('with-gazette', !!gazette && gazette.headlines.length > 0);
  if (!gazette || gazette.headlines.length === 0) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  root.hidden = false;
  const masthead = document.createElement('div');
  masthead.className = 'gazette-masthead';
  const name = document.createElement('h3');
  name.textContent = P.gazette;
  const rule = document.createElement('div');
  rule.className = 'gazette-rule';
  const dateline = document.createElement('p');
  dateline.className = 'gazette-dateline';
  dateline.textContent = `${P.gazetteDate(gazette.date)} · ${P.gazettePrice}`;
  masthead.append(name, rule, dateline);
  const articles = gazette.headlines.map((headline) => {
    const article = document.createElement('div');
    article.className = 'gazette-article';
    const pic = document.createElement('div');
    pic.className = 'gazette-pic';
    pic.append(gazetteArt());
    const h = document.createElement('h4');
    h.textContent = headline;
    article.append(pic, h);
    return article;
  });
  root.replaceChildren(masthead, ...articles);
}

export function renderOverlay(m: OverlayModel | null, onChoose: (i: number) => void): void {
  $('#overlay').classList.toggle('hidden', m === null);
  if (!m) return;
  $('#overlay-title').textContent = m.title;
  $('#overlay-lines').replaceChildren(...m.lines.map(para));
  renderGazette(m.gazette);
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

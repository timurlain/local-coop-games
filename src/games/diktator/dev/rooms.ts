// Preview of the palace rooms (plan 2b): pick a room on the strip, set the room group's strength and mood,
// place the heroes. Builds a palace game state and edits it directly — a dev tool, not the game.

import { newGame } from '../logic/turn';
import type { GameState } from '../logic/state';
import { roomOfGroup, type Hero } from '../logic/palace';
import { GROUPS, hasStrength } from '../logic/groups';
import { albania } from '../scenario/albania';
import { MOOD_NAMES } from '../render/puppet/poses';
import { drawRoom } from '../render/rooms/scene';
import { STAGE_H, STAGE_W } from '../render/rooms/crowd';
import { roomView, stripView } from '../ui/palace-view';

const sc = albania;
const L = sc.palace!;
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const strength = $<HTMLInputElement>('strength');
const mood = $<HTMLInputElement>('mood');

let room = 'armada';
let base: GameState = newGame(sc, 1, undefined, { palace: true }).state;

function groupsHere() {
  return GROUPS.filter((g) => g !== 'povstalci' && roomOfGroup(L, g) === room);
}

function state(): GameState {
  const s: GameState = structuredClone(base);
  const p = s.palace!;
  const heroes: Hero[] = [];
  if ($<HTMLInputElement>('zogu').checked) heroes.push('zogu');
  if ($<HTMLInputElement>('velitel').checked) heroes.push('velitel');
  p.at.zogu = heroes.includes('zogu') ? room : 'knihovna';
  p.at.velitel = heroes.includes('velitel') ? room : 'knihovna';
  const m = Number(mood.value);
  for (const g of groupsHere()) {
    if (hasStrength(g)) s.str[g] = Number(strength.value);
    if (m >= 0) { s.pop[g] = m; p.seenPop[g] = m; } else delete p.seenPop[g];
  }
  if (room === L.guardroom) s.str.povstalci = Number(strength.value);
  if (m < 0 && heroes.length > 0) { p.at.zogu = 'knihovna'; p.at.velitel = 'knihovna'; }
  s.hasPlane = $<HTMLInputElement>('plane').checked;
  return s;
}

function renderStrip(s: GameState): void {
  const strip = $('strip');
  strip.replaceChildren();
  for (const row of stripView(sc, s)) {
    for (const cell of row) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${cell.name} · ${cell.count} · ${cell.mood === null ? '?' : MOOD_NAMES[cell.mood]}`;
      if (cell.room === room) b.classList.add('here');
      b.addEventListener('click', () => { room = cell.room; update(); });
      strip.append(b);
    }
  }
}

function update(): void {
  const m = Number(mood.value);
  $('strength-out').textContent = strength.value;
  $('mood-out').textContent = m < 0 ? 'neviděno' : `${m} · ${MOOD_NAMES[m]}`;
  renderStrip(state());
}

function frame(now: number): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * STAGE_H * dpr) / STAGE_W);
  }
  const k = canvas.width / STAGE_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  drawRoom(ctx, roomView(sc, state(), room), now / 1000);
  requestAnimationFrame(frame);
}

strength.value = '6';
mood.value = '7';
for (const id of ['strength', 'mood', 'zogu', 'velitel', 'plane']) $(id).addEventListener('input', update);
base = { ...base };
update();
requestAnimationFrame(frame);

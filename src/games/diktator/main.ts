// Diktátor — the palace game (plan 2c). Wires the pure UI models (menus, notes, HUD, screens, controls) to input,
// canvas, DOM and storage. Screens: title (join + menu) → palace (split screen, cards and phase screens as a
// shared overlay) ⇄ pause.

import { cs } from '../../shared/i18n/cs';
import { Sfx } from '../../shared/audio';
import { InputManager, type DeviceId } from '../../shared/input/manager';
import { startLoop } from '../../shared/loop';
import { randomSeed } from '../../shared/rng';
import { saveJson } from '../../shared/storage';
import { exits, HEROES, neighbour, other, type Hero, type RoomId } from './logic/palace';
import { palaceCommands } from './logic/palace-actions';
import { deserialize, newSave, recordTurn, retryFromYear, type SaveFile } from './logic/save';
import type { Command, GameEvent, GameState } from './logic/state';
import { advance, newGame, quarterLabel } from './logic/turn';
import { STAGE_H, STAGE_W } from './render/rooms/crowd';
import { drawHalf, type StageAnim } from './render/rooms/stage';
import { albania } from './scenario/albania';
import { CLOSED, clampFocus, heroOf, isSolo, join, navigate, NO_SEATS, palaceAct, seatedDevices, type Intent, type MenuUi, type Seats } from './ui/controls';
import { fitStage, renderHalf, renderOverlay, renderStrip, renderTop, stageCanvas, type OverlayModel } from './ui/dom';
import { Flick } from './ui/flick';
import { heroHud, topHud } from './ui/hud';
import { heroMenu, type HeroMenu } from './ui/menus';
import { notesFor } from './ui/notes';
import { roomView, stripView, type RoomView } from './ui/palace-view';
import { cardsFor, phaseScreen, type Card, type PhaseScreen } from './ui/screens';

const T = cs.diktator;
const P = T.palace;
const sc = albania;
const SAVE_KEY = 'diktator/palace';
const NOTES_KEPT = 6;
const FLASH_SEC = 0.5;

type Screen = 'title' | 'palace' | 'pause';

interface Half {
  ui: MenuUi;
  anim: StageAnim | null;
  view: RoomView;
  menu: HeroMenu;
  notes: string[];
}

const input = new InputManager(window);
const sfx = new Sfx();
const flicks = new Map<DeviceId, Flick>();

let screen: Screen = 'title';
let pauseReason = '';
let seats: Seats = NO_SEATS;
let active: Hero = 'zogu';
let file: SaveFile | null = null;
let cards: Card[] = [];
let overlayUi: MenuUi = CLOSED;
let halves: Record<Hero, Half> | null = null;
let flash: { rooms: Set<RoomId>; until: number } = { rooms: new Set(), until: 0 };
let t = 0;
let dirty = true;

// ---------- state helpers ----------

function state(): GameState {
  return file!.current;
}

function savedGame(): SaveFile | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // storage unavailable: no Continue
  }
  const f = deserialize(raw);
  return f && f.current.palace ? f : null;
}

function buildHalves(s: GameState, keep: Record<Hero, Half> | null): Record<Hero, Half> {
  const out = {} as Record<Hero, Half>;
  for (const h of HEROES) {
    const menu = heroMenu(sc, s, h);
    const prev = keep?.[h];
    out[h] = {
      ui: prev ? clampFocus(prev.ui, menu.items.length) : CLOSED,
      anim: prev?.anim ?? null,
      view: roomView(sc, s, s.palace!.at[h]),
      menu,
      notes: prev?.notes ?? [],
    };
  }
  return out;
}

function retryYear(): number | null {
  const r = file ? retryFromYear(file) : null;
  return r ? quarterLabel(r.state.quarter).year : null;
}

function currentScreen(): PhaseScreen | null {
  return file ? phaseScreen(sc, state(), retryYear()) : null;
}

function holdAll(): void {
  for (const d of input.devices()) {
    let f = flicks.get(d);
    if (!f) flicks.set(d, (f = new Flick()));
    f.hold(input.get(d));
  }
}

// ---------- starting and leaving ----------

function begin(f: SaveFile, first: readonly GameEvent[]): void {
  file = f;
  saveJson(SAVE_KEY, file);
  cards = cardsFor(sc, null, first, state());
  overlayUi = CLOSED;
  halves = buildHalves(state(), null);
  active = 'zogu';
  screen = 'palace';
  holdAll();
  dirty = true;
}

function startNew(): void {
  const { state: s, events } = newGame(sc, randomSeed(), undefined, { palace: true });
  begin(newSave(sc.id, s), events);
}

function continueSaved(): void {
  const f = savedGame();
  if (f) begin(f, []);
}

function retry(): void {
  const r = file ? retryFromYear(file) : null;
  if (!r) return;
  begin(r.file, [{ type: 'quarterStarted', quarter: r.state.quarter }]);
}

function toTitle(): void {
  if (file) saveJson(SAVE_KEY, file);
  file = null;
  halves = null;
  cards = [];
  seats = NO_SEATS;
  overlayUi = CLOSED;
  screen = 'title';
  dirty = true;
}

// ---------- playing a command ----------

function play(cmd: Command): void {
  if (!file || !halves) return;
  const before = state();
  let result: { state: GameState; events: readonly GameEvent[] };
  try {
    result = advance(sc, before, cmd);
  } catch (e) {
    console.error(e);
    return;
  }
  const { state: after, events } = result;
  file = recordTurn(file, after);
  saveJson(SAVE_KEY, file);

  const oldViews = { zogu: halves.zogu.view, velitel: halves.velitel.view };
  const next = buildHalves(after, after.quarter === before.quarter ? halves : null);
  for (const e of events) {
    if (e.type === 'moved') {
      next[e.hero].anim = { kind: 'slide', from: oldViews[e.hero], dir: dirOf(e.from, e.to), start: t };
      sfx.play('step');
      sfx.play('door');
    }
    if (e.type === 'decided') sfx.play('stamp');
    if (e.type === 'aidGranted' || e.type === 'swissTransfer') sfx.play('coins');
    for (const n of notesFor(sc, after, e)) {
      for (const h of n.to === 'both' ? HEROES : [n.to]) next[h].notes = [...next[h].notes, n.text].slice(-NOTES_KEPT);
    }
  }
  halves = next;
  const newCards = cardsFor(sc, before, events, after);
  if (newCards.length > 0) {
    cards.push(...newCards);
    overlayUi = CLOSED;
    sfx.play('paper');
    holdAll();
  }
  dirty = true;
}

function dirOf(from: RoomId, to: RoomId): 'up' | 'down' | 'left' | 'right' {
  const L = sc.palace!;
  for (const d of ['up', 'down', 'left', 'right'] as const) if (neighbour(L, from, d) === to) return d;
  return 'right';
}

function bump(hero: Hero, dir: 'up' | 'down' | 'left' | 'right'): void {
  if (!halves || !file) return;
  halves[hero].anim = { kind: 'bump', dir, start: t };
  const L = sc.palace!;
  const room = state().palace!.at[hero];
  flash = { rooms: new Set(exits(L, room).map((d) => neighbour(L, room, d)!)), until: t + FLASH_SEC };
  sfx.play('bump');
  dirty = true;
}

// ---------- input ----------

function intentsOf(d: DeviceId): Intent[] {
  let f = flicks.get(d);
  if (!f) flicks.set(d, (f = new Flick()));
  const out: Intent[] = [];
  const dir = f.next(input.get(d));
  if (dir) out.push({ kind: 'dir', dir });
  if (input.pressed(d, 'action')) out.push({ kind: 'action' });
  if (input.pressed(d, 'trap')) out.push({ kind: 'seal' });
  if (input.pressed(d, 'pause')) out.push({ kind: 'close' });
  return out;
}

/** Title: an unseated device joins with Action; seated devices steer the title menu. */
function titleOptions(): { label: string; run: () => void }[] {
  const opts = [{ label: P.join.newGame, run: startNew }];
  if (savedGame()) opts.push({ label: P.join.continueGame, run: continueSaved });
  opts.push({ label: P.join.textMode, run: () => { window.location.href = './text.html'; } });
  return opts;
}

function updateTitle(): void {
  for (const d of input.devices()) {
    const seated = seatedDevices(seats).includes(d);
    const intents = intentsOf(d);
    if (!seated) {
      if (intents.some((i) => i.kind === 'action')) {
        sfx.unlock();
        seats = join(seats, d);
        sfx.play('join');
        dirty = true;
      }
      continue;
    }
    for (const intent of intents) {
      const opts = titleOptions();
      const r = navigate(overlayUi, intent, opts.length, true);
      if (r.ui.focus !== overlayUi.focus) sfx.play('click');
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        opts[r.chosen].run();
        return;
      }
    }
  }
}

/** A shared screen (card or phase screen) is up: any seated device steers it. */
function updateShared(): boolean {
  const card = cards[0];
  const scr = card ? null : currentScreen();
  if (!card && !scr) return false;
  const count = card ? 1 : scr!.options.length;
  for (const d of seatedDevices(seats)) {
    for (const intent of intentsOf(d)) {
      const r = navigate(overlayUi, intent, count, true);
      if (r.ui.focus !== overlayUi.focus) sfx.play('click');
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        chooseShared(r.chosen);
        return true;
      }
    }
  }
  return true;
}

function chooseShared(i: number): void {
  if (cards.length > 0) {
    cards.shift();
    overlayUi = CLOSED;
    holdAll();
    dirty = true;
    return;
  }
  const scr = currentScreen();
  const opt = scr?.options[i];
  if (!opt) return;
  overlayUi = CLOSED;
  switch (opt.choice.kind) {
    case 'command': play(opt.choice.command); break;
    case 'retry': retry(); break;
    case 'newGame': startNew(); break;
    case 'menu': toTitle(); break;
  }
  dirty = true;
}

function choosePalace(hero: Hero, i: number): void {
  if (!halves) return;
  const item = halves[hero].menu.items[i];
  halves[hero].ui = halves[hero].menu.modal ? halves[hero].ui : CLOSED;
  if (item) play(item.command);
}

function updatePalace(): void {
  if (seatedDevices(seats).some((d) => !input.isConnected(d))) return pause(P.pause.padLost);
  const switchPressed = input.keyPressed('Tab') || seatedDevices(seats).some((d) => input.pressed(d, 'back'));
  if (switchPressed && isSolo(seats)) {
    active = other(active);
    dirty = true;
  }
  if (updateShared()) return;
  if (!halves) return;
  for (const d of seatedDevices(seats)) {
    const hero = heroOf(seats, d, active);
    if (!hero) continue;
    for (const intent of intentsOf(d)) {
      const half = halves[hero];
      if (intent.kind === 'close' && !(half.ui.open && !half.menu.modal)) return pause(P.pause.title);
      const r = navigate(half.ui, intent, half.menu.items.length, half.menu.modal);
      if (r.ui.focus !== half.ui.focus && r.chosen === null) sfx.play('click');
      half.ui = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        choosePalace(hero, r.chosen);
        return;
      }
      if (r.pass) {
        const act = palaceAct(palaceCommands(sc, state(), hero), r.pass);
        if (act?.kind === 'command') {
          play(act.command);
          return;
        }
        if (act?.kind === 'bump') bump(hero, act.dir);
      }
    }
  }
}

function pause(reason: string): void {
  pauseReason = reason;
  screen = 'pause';
  overlayUi = CLOSED;
  dirty = true;
}

function pauseOptions(): { label: string; run: () => void }[] {
  return [
    { label: P.pause.resume, run: () => { if (seatedDevices(seats).every((d) => input.isConnected(d))) { screen = 'palace'; holdAll(); } } },
    { label: P.pause.menu, run: toTitle },
  ];
}

function updatePause(): void {
  for (const d of seatedDevices(seats)) {
    if (!input.isConnected(d)) continue;
    for (const intent of intentsOf(d)) {
      const opts = pauseOptions();
      if (intent.kind === 'close') {
        opts[0].run();
        dirty = true;
        return;
      }
      const r = navigate(overlayUi, intent, opts.length, true);
      overlayUi = r.ui;
      dirty = true;
      if (r.chosen !== null) {
        opts[r.chosen].run();
        return;
      }
    }
  }
}

function update(dt: number): void {
  input.update();
  t += dt;
  if (input.anyKeyPressed()) sfx.unlock();
  if (flash.rooms.size > 0 && t > flash.until) {
    flash = { rooms: new Set(), until: 0 };
    dirty = true;
  }
  if (screen === 'title') updateTitle();
  else if (screen === 'palace') updatePalace();
  else updatePause();
}

// ---------- rendering ----------

function overlayModel(): OverlayModel | null {
  if (screen === 'title') {
    const deviceName = (d: DeviceId | null) =>
      d === null ? P.join.waiting : d === 'kb-left' ? cs.spy.devices.kbLeft : d === 'kb-right' ? cs.spy.devices.kbRight : cs.spy.devices.pad(Number(d.slice(4)) + 1);
    const opts = seatedDevices(seats).length > 0 ? titleOptions().map((o) => o.label) : [];
    return {
      title: P.join.title,
      lines: [T.subtitle, P.join.slot(T.heroes.zogu, deviceName(seats.zogu)), P.join.slot(T.heroes.velitel, deviceName(seats.velitel))],
      options: opts,
      focus: overlayUi.focus,
      hint: P.join.hint,
    };
  }
  if (screen === 'pause') {
    return { title: pauseReason, lines: [], options: pauseOptions().map((o) => o.label), focus: overlayUi.focus, hint: '' };
  }
  const card = cards[0];
  if (card) return { title: card.title, lines: card.lines, options: [card.button], focus: 0, hint: '' };
  const scr = currentScreen();
  if (scr) return { title: scr.title, lines: scr.lines, options: scr.options.map((o) => o.label), focus: overlayUi.focus, hint: '' };
  return null;
}

function onOverlayClick(i: number): void {
  if (screen === 'title') {
    if (seatedDevices(seats).length === 0) seats = join(seats, 'kb-left');
    titleOptions()[i]?.run();
  } else if (screen === 'pause') {
    pauseOptions()[i]?.run();
  } else {
    chooseShared(i);
  }
  dirty = true;
}

function renderDom(): void {
  renderOverlay(overlayModel(), onOverlayClick);
  if (!file || !halves) return;
  const s = state();
  renderTop(topHud(s));
  renderStrip(stripView(sc, s), flash.rooms);
  for (const h of HEROES) {
    const half = halves[h];
    renderHalf(
      h,
      { hud: heroHud(sc, s, h), menu: half.menu, ui: half.ui, notes: half.notes, inactive: isSolo(seats) && active !== h, solo: isSolo(seats) },
      (i) => { choosePalace(h, i); dirty = true; },
    );
  }
}

function render(): void {
  if (dirty) {
    dirty = false;
    renderDom();
  }
  if (!halves) return;
  for (const h of HEROES) {
    const canvas = stageCanvas(h);
    const k = fitStage(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    drawHalf(ctx, halves[h].view, h, halves[h].anim, t);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

startLoop(update, render);

// Diktátor — the palace game (plan 2c). Wires the pure UI models (menus, notes, HUD, screens, controls) to input,
// canvas, DOM and storage. Screens: title (join + menu) → palace (split screen, cards and phase screens as a
// shared overlay) ⇄ pause.

import { cs } from '../../shared/i18n/cs';
import { getAudioContext, Sfx } from '../../shared/audio';
import { InputManager, type DeviceId } from '../../shared/input/manager';
import { startLoop } from '../../shared/loop';
import { randomSeed } from '../../shared/rng';
import { saveJson } from '../../shared/storage';
import { Samples } from './audio/samples';
import { exits, HEROES, neighbour, other, type Hero, type RoomId } from './logic/palace';
import { palaceCommands } from './logic/palace-actions';
import { deserialize, newSave, recordTurn, retryFromYear, type SaveFile } from './logic/save';
import type { Command, GameEvent, GameState } from './logic/state';
import { advance, newGame, quarterLabel } from './logic/turn';
import { STAGE_H, STAGE_W } from './render/rooms/crowd';
import { drawHalf, type StageAnim } from './render/rooms/stage';
import { albania } from './scenario/albania';
import { bubblesFor, stageView } from './ui/bubbles';
import { CLOSED, clampFocus, heroOf, isSolo, join, keysFor, navigate, NO_SEATS, palaceAct, seatedDevices, type Intent, type MenuUi, type Seats } from './ui/controls';
import { QUIET, say, speaking, steer, type Dialogue } from './ui/dialogue';
import {
  fitStage, renderBubbles, renderDossier, renderHalf, renderHourglasses, renderOverlay, renderStrip, renderTop, stageCanvas,
  type OverlayModel,
} from './ui/dom';
import { dossierModel, type DossierModel } from './ui/dossier';
import { Flick } from './ui/flick';
import { heroHud, topHud } from './ui/hud';
import { heroMenu, type HeroMenu } from './ui/menus';
import { roomView, stripView, type RoomView } from './ui/palace-view';
import { cardsFor, phaseScreen, type Card, type PhaseScreen } from './ui/screens';
import { bumpHits, bumpSound, moveHits, moveSounds, voiceOf } from './ui/sounds';
import { heroLine, replyLines, type Line } from './ui/speech';

const T = cs.diktator;
const P = T.palace;
const sc = albania;
const SAVE_KEY = 'diktator/palace';
const FLASH_SEC = 0.5;
const CAPTION_SEC = 4;

type Screen = 'title' | 'palace' | 'pause';

interface Half {
  dialogue: Dialogue;
  /** The other half's news, fading on their own. */
  captions: { text: string; until: number }[];
  anim: StageAnim | null;
  view: RoomView;
  /** The view actually drawn and anchored on: keeps the petitioner while a line of his still waits. */
  stage: RoomView;
  menu: HeroMenu;
  /** The police report as a full dossier over this half's room (play-test round 6a, our addition). */
  dossier: DossierModel | null;
  /** The "close it? (free next time)" prompt is up; the first press while the dossier is open only raises it. */
  confirmClose: boolean;
  /** Which of the confirm prompt's two choices is highlighted (0 = Zavřít, 1 = Číst dál). */
  dossierFocus: number;
}

const input = new InputManager(window);
const sfx = new Sfx();
const samples = new Samples(getAudioContext);
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
let pausedAt = 0;

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
    const view = roomView(sc, s, s.palace!.at[h]);
    out[h] = {
      dialogue: prev ? { ...prev.dialogue, ui: clampFocus(prev.dialogue.ui, menu.items.length) } : QUIET,
      captions: prev?.captions ?? [],
      anim: prev?.anim ?? null,
      view,
      stage: prev?.stage ?? view,
      menu,
      dossier: prev?.dossier ?? null,
      confirmClose: prev?.confirmClose ?? false,
      dossierFocus: prev?.dossierFocus ?? 0,
    };
  }
  return out;
}

function retryYear(): number | null {
  const r = file ? retryFromYear(file) : null;
  return r ? quarterLabel(r.state.quarter).year : null;
}

function currentScreen(): PhaseScreen | null {
  return file ? phaseScreen(sc, state(), state().phase.kind === 'ended' ? retryYear() : null) : null;
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

function play(cmd: Command, actor: Hero | null = null): void {
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
  const oldStages = { zogu: halves.zogu.stage, velitel: halves.velitel.stage };
  const next = buildHalves(after, after.quarter === before.quarter ? halves : null);
  for (const e of events) {
    if (e.type === 'moved') {
      next[e.hero].anim = { kind: 'slide', from: oldViews[e.hero], dir: dirOf(e.from, e.to), start: t };
      if (!samples.play(moveHits(e.hero))) moveSounds(e.hero).forEach((n) => sfx.play(n));
      // Entering the throne room while the petitioner waits: his question pops up (not modal — Esc or an arrow leaves).
      if (e.hero === 'zogu' && e.to === sc.palace!.throne && after.phase.kind === 'audience') {
        next.zogu.dialogue = { ...next.zogu.dialogue, ui: { open: true, focus: 0 } };
      }
    }
    if (e.type === 'policeReport') {
      // The report replaces the room as a full dossier (play-test round 6a): only the commander reads it.
      next.velitel.dossier = dossierModel(sc, e.report, after.quarter);
      next.velitel.confirmClose = false;
      next.velitel.dossierFocus = 0;
    }
    if (e.type === 'decided') sfx.play('stamp');
    if (e.type === 'aidGranted' || e.type === 'swissTransfer') {
      if (!samples.play([{ sample: 'coins', delay: 0, rate: 1, gain: 0.8 }])) sfx.play('coins');
    }
  }
  if (actor && after.quarter === before.quarter) {
    const said = heroLine(sc, before, cmd);
    const replies =
      after.phase.kind === 'audience' || after.phase.kind === 'day' ? replyLines(sc, before, after, events, actor) : { actor: [], other: [] };
    const lines: Line[] = [...(said ? [{ speaker: { kind: 'hero' as const, hero: actor }, text: said }] : []), ...replies.actor];
    if (lines.length > 0) {
      const wasQuiet = next[actor].dialogue.queue.length === 0;
      next[actor].dialogue = say(next[actor].dialogue, lines);
      if (wasQuiet) sfx.play(voiceOf(lines[0].speaker));
    }
    const o = other(actor);
    for (const text of replies.other) next[o].captions = [...next[o].captions, { text, until: t + CAPTION_SEC }].slice(-3);
  }
  for (const h of HEROES) next[h].stage = stageView(next[h].view, oldStages[h], next[h].dialogue);
  halves = next;
  const newCards = cardsFor(sc, before, events, after);
  if (newCards.length > 0) {
    cards.push(...newCards);
    overlayUi = CLOSED;
    if (!samples.play([{ sample: 'page', delay: 0, rate: 1, gain: 0.8 }])) sfx.play('paper');
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
  if (!samples.play(bumpHits(hero))) sfx.play(bumpSound(hero));
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
        samples.load();
        const joined = join(seats, d);
        if (joined !== seats) {
          seats = joined;
          sfx.play('join');
          dirty = true;
        }
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

/** A line is still waiting in some half: shared cards and phase screens wait until it is read. */
function someoneTalking(): boolean {
  return !!halves && HEROES.some((h) => halves![h].dialogue.queue.length > 0);
}

/** A shared screen (card or phase screen) is up: any seated device steers it. */
function updateShared(): boolean {
  if (someoneTalking()) return false;
  const card = cards[0];
  const scr = card ? null : currentScreen();
  if (!card && !scr) return false;
  const count = card ? 1 : scr!.options.length;
  for (const d of seatedDevices(seats)) {
    for (const intent of intentsOf(d)) {
      if (scr && intent.kind === 'close') {
        pause(P.pause.title);
        return true;
      }
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

/** The dossier's confirm prompt: 0 closes it (free to re-read this quarter), 1 keeps reading. */
function pickDossier(hero: Hero, i: number): void {
  if (!halves) return;
  const half = halves[hero];
  if (i === 0) half.dossier = null;
  half.confirmClose = false;
  half.dossierFocus = 0;
  dirty = true;
}

function choosePalace(hero: Hero, i: number): void {
  if (!halves) return;
  const item = halves[hero].menu.items[i];
  if (item) play(item.command, hero);
}

function updatePalace(): void {
  if (seatedDevices(seats).some((d) => !input.isConnected(d))) return pause(P.pause.padLost);
  const switchPressed = input.keyPressed('Tab') || seatedDevices(seats).some((d) => input.pressed(d, 'back'));
  if (switchPressed && isSolo(seats)) {
    active = other(active);
    dirty = true;
  }
  if (halves && isSolo(seats) && (cards.length > 0 || currentScreen() !== null)) {
    const o = other(active);
    if (halves[active].dialogue.queue.length === 0 && halves[o].dialogue.queue.length > 0) {
      active = o;
      dirty = true;
    }
  }
  if (updateShared()) return;
  if (!halves) return;
  /** A command played by one device stops only that device's intents this tick; the other device still plays
   * its own tick, unless the command raised a shared screen or left the palace (then the whole tick is over). */
  const afterCommand = (): boolean => cards.length > 0 || currentScreen() !== null || screen !== 'palace';
  devices: for (const d of seatedDevices(seats)) {
    const hero = heroOf(seats, d, active);
    if (!hero) continue;
    for (const intent of intentsOf(d)) {
      const half = halves![hero];
      // The dossier takes every intent once its hero's own "Hlášení!" line has been dismissed (talking).
      if (half.dossier && half.dialogue.queue.length === 0) {
        if (!half.confirmClose) {
          // The first press while the dossier is up only raises the "close it?" prompt; it never closes.
          half.confirmClose = true;
          dirty = true;
          continue;
        }
        if (intent.kind === 'dir') {
          half.dossierFocus = half.dossierFocus === 0 ? 1 : 0;
          sfx.play('click');
          dirty = true;
        } else if (intent.kind === 'action') {
          pickDossier(hero, half.dossierFocus);
        } else if (intent.kind === 'close') {
          pickDossier(hero, 1); // Esc = Číst dál
        }
        continue;
      }
      const talking = half.dialogue.queue.length > 0;
      if (intent.kind === 'close' && !talking && !(half.dialogue.ui.open && !half.menu.modal)) return pause(P.pause.title);
      const oldStage = half.stage;
      const r = steer(half.dialogue, intent, half.menu.items.length, half.menu.modal);
      if (r.d.ui.focus !== half.dialogue.ui.focus && r.chosen === null) sfx.play('click');
      half.dialogue = r.d;
      dirty = true;
      if (r.advanced) {
        half.stage = stageView(half.view, oldStage, half.dialogue);
        const next = speaking(half.dialogue);
        if (next) sfx.play(voiceOf(next));
        continue;
      }
      if (r.chosen !== null) {
        choosePalace(hero, r.chosen);
        if (afterCommand()) return;
        continue devices;
      }
      if (r.pass) {
        const act = palaceAct(palaceCommands(sc, state(), hero), r.pass);
        if (act?.kind === 'command') {
          play(act.command, hero);
          if (afterCommand()) return;
          continue devices;
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
  pausedAt = t;
  dirty = true;
}

function pauseOptions(): { label: string; run: () => void }[] {
  return [
    {
      label: P.pause.resume,
      run: () => {
        if (seatedDevices(seats).every((d) => input.isConnected(d))) {
          const paused = t - pausedAt;
          if (halves) for (const h of HEROES) halves[h].captions = halves[h].captions.map((c) => ({ ...c, until: c.until + paused }));
          screen = 'palace';
          holdAll();
        }
      },
    },
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
  if (input.anyKeyPressed()) {
    sfx.unlock();
    samples.load();
  }
  if (flash.rooms.size > 0 && t > flash.until) {
    flash = { rooms: new Set(), until: 0 };
    dirty = true;
  }
  if (halves && screen !== 'pause') {
    for (const h of HEROES) {
      const half = halves[h];
      const kept = half.captions.filter((c) => c.until > t);
      if (kept.length !== half.captions.length) {
        half.captions = kept;
        dirty = true;
      }
    }
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
    const slotLine = (hero: Hero, d: DeviceId | null) => {
      const base = P.join.slot(T.heroes[hero], deviceName(d));
      return d === null ? base : `${base} — ${keysFor(d)}`;
    };
    const opts = seatedDevices(seats).length > 0 ? titleOptions().map((o) => o.label) : [];
    return {
      title: P.join.title,
      lines: [T.subtitle, slotLine('zogu', seats.zogu), slotLine('velitel', seats.velitel)],
      options: opts,
      focus: overlayUi.focus,
      hint: `${P.join.clickFirst} ${P.join.hint}`,
    };
  }
  if (screen === 'pause') {
    const pauseLines = isSolo(seats)
      ? HEROES.map((h) => `${T.heroes[h]}: ${keysFor(seats.zogu ?? seats.velitel)}`)
      : HEROES.filter((h) => seats[h] !== null).map((h) => `${T.heroes[h]}: ${keysFor(seats[h])}`);
    return { title: pauseReason, lines: pauseLines, options: pauseOptions().map((o) => o.label), focus: overlayUi.focus, hint: '' };
  }
  if (someoneTalking()) return null;
  const card = cards[0];
  if (card) {
    return {
      title: card.title,
      lines: card.lines,
      options: [card.button],
      focus: 0,
      hint: '',
      ...(card.news.length > 0 ? { gazette: { date: card.date, headlines: card.news } } : {}),
    };
  }
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
    const hud = heroHud(sc, s, h);
    renderHalf(h, {
      hud,
      talking: half.dialogue.queue.length > 0,
      open: half.dialogue.ui.open || half.menu.modal,
      inactive: isSolo(seats) && active !== h,
      solo: isSolo(seats),
      keys: keysFor(isSolo(seats) ? (seats.zogu ?? seats.velitel) : seats[h]),
    });
    renderHourglasses(h, hud);
    renderDossier(h, half.dossier, half.confirmClose, half.dossierFocus, (i) => pickDossier(h, i));
    renderBubbles(h, bubblesFor(half.dialogue, half.captions.map((c) => c.text), half.menu, half.stage, h), (i) => {
      choosePalace(h, i);
      dirty = true;
    });
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
    const before = canvas.width;
    const k = fitStage(canvas);
    if (canvas.width !== before) dirty = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    const sp = speaking(halves[h].dialogue);
    drawHalf(ctx, halves[h].stage, h, halves[h].anim, t, sp?.kind === 'hero' ? sp.hero : null);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

startLoop(update, render);

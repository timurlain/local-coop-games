import { Sfx, getAudioContext, type SfxName } from '../../shared/audio';
import { cs } from '../../shared/i18n/cs';
import type { PlayerActions } from '../../shared/input/actions';
import { InputManager, type DeviceId } from '../../shared/input/manager';
import { startLoop } from '../../shared/loop';
import { Music } from '../../shared/music';
import { randomSeed } from '../../shared/rng';
import { fitCanvas } from '../../shared/splitscreen';
import { loadJson, saveJson } from '../../shared/storage';
import { createGame } from './logic/generator';
import { LEVELS, levelRules } from './logic/rules';
import { rankFor } from './logic/score';
import type { GameEvent, GameState, PlayerId, Spy, SpyInput } from './logic/state';
import { step } from './logic/step';
import { laugher, spawnEffects, type EffectQueue } from './render/effects';
import { formatClock } from './render/hud';
import { pushToast, toastFor, type ToastQueue } from './render/toast';
import { LOW_TIME } from './render/trapulator';
import { LAUGH_AT, MOB_AT, VICTORY_DURATION, VICTORY_SKIPPABLE_AFTER, renderVictory } from './render/victory';
import { TITLE_CARD_TIME, renderTitleCard } from './render/title';
import { renderGame } from './render/view';
import { levelReadout, migrateSettings } from './settings';

type Screen = 'menu' | 'title' | 'play' | 'pause' | 'victory' | 'result';

const T = cs.spy;
const SETTINGS_KEY = 'spy-vs-spy/settings';
const STEP_INTERVAL = 0.3;
/** The music speeds up while either clock is under a minute. */
const HURRY_TEMPO = 1.25;

const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const input = new InputManager(window);
const sfx = new Sfx();
const music = new Music(getAudioContext);
const settings = migrateSettings(loadJson<Record<string, unknown>>(SETTINGS_KEY, {}));
sfx.muted = settings.muted;
music.muted = !settings.music;
const urlSeed = parseSeed(new URLSearchParams(location.search).get('seed'));

let screen: Screen = 'menu';
let slots: [DeviceId | null, DeviceId | null] = [null, null];
let state: GameState | null = null;
let scale = 1;
let debug = false;
let fps = 0;
let frames = 0;
let fpsTime = performance.now();
/** Countdown per spy to the next footstep sound while walking. */
const stepTimers: [number, number] = [0, 0];
let victoryT = 0;
/** Seconds the match title card has been showing; the gameplay clock does not run meanwhile. */
let titleT = 0;
/** Render-side toasts under each frame, fed from logic events. */
let toasts: [ToastQueue, ToastQueue] = [[], []];
/** Render-side search / hide / swap / drop feedback, fed from logic events. */
let effects: EffectQueue = [];
/** Whole second of each clock at which the low-time beep last sounded. */
const lastBeep: [number, number] = [-1, -1];

function parseSeed(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n >>> 0 : null;
}

// ---------- DOM overlays ----------

function setupMenu(): void {
  $('menu-title').textContent = T.title;
  $('menu-subtitle').textContent = T.subtitle;
  // canvas text (title card) needs the art-deco faces loaded; the DOM menu loads them via CSS
  document.fonts?.load('14px "Limelight"').catch(() => undefined);
  document.fonts?.load('8px "Poiret One"').catch(() => undefined);
  $('level-label').textContent = T.levelLabel;
  $('hide-airport-label').textContent = T.hideAirport;
  $('mute-label').textContent = T.mute;
  $('music-label').textContent = T.music;
  $('controls').textContent = T.controls;
  $('back').textContent = T.back;
  $('toosmall-title').textContent = T.tooSmall;

  const level = $<HTMLSelectElement>('level');
  const readout = $('level-readout');
  for (const n of LEVELS) {
    const { cols, rows } = levelRules(n);
    level.add(new Option(T.levelOption(n, cols, rows), String(n), false, n === settings.level));
  }
  readout.textContent = levelReadout(settings.level);
  level.onchange = () => {
    settings.level = Number(level.value);
    readout.textContent = levelReadout(settings.level);
    saveJson(SETTINGS_KEY, settings);
  };

  const hideAirport = $<HTMLInputElement>('hide-airport');
  hideAirport.checked = settings.hideAirport;
  hideAirport.onchange = () => {
    settings.hideAirport = hideAirport.checked;
    saveJson(SETTINGS_KEY, settings);
  };

  const mute = $<HTMLInputElement>('mute');
  mute.checked = settings.muted;
  mute.onchange = () => {
    settings.muted = mute.checked;
    sfx.muted = mute.checked;
    saveJson(SETTINGS_KEY, settings);
  };

  const musicBox = $<HTMLInputElement>('music');
  musicBox.checked = settings.music;
  musicBox.onchange = () => {
    settings.music = musicBox.checked;
    music.muted = !musicBox.checked;
    saveJson(SETTINGS_KEY, settings);
  };
  renderSlots();
}

function deviceLabel(d: DeviceId): string {
  if (d === 'kb-left') return T.devices.kbLeft;
  if (d === 'kb-right') return T.devices.kbRight;
  return T.devices.pad(Number(d.slice(4)) + 1);
}

function renderSlots(): void {
  slots.forEach((d, i) => {
    const el = $(`slot-${i}`);
    el.textContent = `${i === 0 ? T.white : T.black}: ${d ? deviceLabel(d) : T.waiting}`;
    el.classList.toggle('joined', d !== null);
  });
  $('menu-hint').textContent = slots[0] && slots[1] ? T.startHint : T.joinHint;
}

function show(id: 'menu' | 'pause' | 'result' | null): void {
  for (const o of ['menu', 'pause', 'result']) $(o).classList.toggle('hidden', o !== id);
}

// ---------- screens ----------

function startGame(): void {
  (document.activeElement as HTMLElement | null)?.blur();
  state = createGame(urlSeed ?? randomSeed(), settings.level, { hideAirport: settings.hideAirport });
  state.spies.forEach((spy, i) => {
    spy.prev = toSpyInput(input.get(slots[i]!));
  });
  stepTimers[0] = 0;
  stepTimers[1] = 0;
  toasts = [[], []];
  effects = [];
  lastBeep[0] = -1;
  lastBeep[1] = -1;
  titleT = 0;
  screen = 'title';
  show(null);
}

/** Title card done (or skipped with Akce): the match starts; held buttons don't count as fresh presses. */
function beginPlay(): void {
  state!.spies.forEach((spy, i) => {
    spy.prev = toSpyInput(input.get(slots[i]!));
  });
  screen = 'play';
  music.start();
}

function toMenu(): void {
  music.stop();
  screen = 'menu';
  state = null;
  slots = [null, null];
  renderSlots();
  show('menu');
}

function pause(reason: string): void {
  music.pause();
  screen = 'pause';
  $('pause-title').textContent = reason;
  $('pause-hint').textContent = T.resumeHint;
  show('pause');
}

/** Result screen (spec §7): both spies' score and rank, winner first — Bílý then Černý on a draw. */
function finish(s: GameState): void {
  const r = s.result!;
  music.stop();
  $('result-title').textContent = r.kind === 'win' ? T.winner(r.winner === 0 ? T.white : T.black) : T.draw;
  $('result-time').textContent = r.kind === 'win' ? T.timeLeft(formatClock(s.spies[r.winner].clock)) : '';
  $('result-host').textContent = T.titleCard(s.host, s.year);
  $('result-seed').textContent = `${T.seed}: ${s.seed}`;
  const order: [PlayerId, PlayerId] = r.kind === 'win' && r.winner === 1 ? [1, 0] : [0, 1];
  order.forEach((id, i) => {
    const spy = s.spies[id];
    const name = id === 0 ? T.white : T.black;
    $(`result-score-${i}`).textContent = T.scoreLine(name, spy.score, rankFor(spy.score));
  });
  $('result-hint').textContent = T.rematchHint;
  screen = 'result';
  show('result');
  sfx.play(r.kind === 'win' ? 'win' : 'draw');
}

const slotDevices = (): DeviceId[] => slots.filter((d): d is DeviceId => d !== null);
const slotPressed = (key: 'action' | 'pause'): boolean => slotDevices().some((d) => input.pressed(d, key));

// ---------- per-tick update ----------

function update(dt: number): void {
  input.update();
  if (input.keyPressed('F1')) debug = !debug;
  switch (screen) {
    case 'menu':
      updateMenu();
      break;
    case 'title':
      if (slotDevices().some((d) => !input.isConnected(d))) {
        beginPlay();
        pause(T.padLost);
        break;
      }
      if (slotPressed('pause')) {
        beginPlay();
        pause(T.paused);
        break;
      }
      titleT += dt;
      if (titleT >= TITLE_CARD_TIME || slotPressed('action')) beginPlay();
      break;
    case 'play':
      updatePlay(dt);
      break;
    case 'victory':
      updateVictory(dt);
      break;
    case 'pause':
      if (slotPressed('pause') && slotDevices().every((d) => input.isConnected(d))) {
        screen = 'play';
        show(null);
        music.resume();
      } else if (input.keyPressed('KeyM')) {
        toMenu();
      }
      break;
    case 'result':
      if (slotPressed('action')) startGame();
      else if (slotPressed('pause')) toMenu();
      break;
  }
}

function updateMenu(): void {
  slots.forEach((d, i) => {
    if (d && !input.isConnected(d)) {
      slots[i as 0 | 1] = null;
      renderSlots();
    }
  });
  for (const d of input.devices()) {
    if (!input.pressed(d, 'action')) continue;
    sfx.unlock();
    if (slots.includes(d)) {
      if (slots[0] && slots[1]) {
        startGame();
        return;
      }
      continue;
    }
    const free = slots.indexOf(null);
    if (free === -1) continue;
    slots[free as 0 | 1] = d;
    sfx.play('join');
    renderSlots();
  }
}

function toSpyInput(a: PlayerActions): SpyInput {
  return { moveX: a.moveX, moveY: a.moveY, action: a.action, trap: a.trap };
}

function posKey(spy: Spy): string {
  return `${spy.room}:${spy.x}:${spy.z}`;
}

function updatePlay(dt: number): void {
  const s = state!;
  if (slotDevices().some((d) => !input.isConnected(d))) {
    pause(T.padLost);
    return;
  }
  if (slotPressed('pause')) {
    pause(T.paused);
    return;
  }
  const before: [string, string] = [posKey(s.spies[0]), posKey(s.spies[1])];
  const inputs: [SpyInput, SpyInput] = [toSpyInput(input.get(slots[0]!)), toSpyInput(input.get(slots[1]!))];
  const now = performance.now() / 1000;
  const events = step(s, inputs, dt);
  for (const e of events) {
    const name = soundFor(e);
    if (name) sfx.play(name);
    if (laugher(s, e) !== null) sfx.play('laugh');
    toastOn(e, now);
  }
  spawnEffects(effects, s, events, now);
  for (const spy of s.spies) lowTimeBeep(spy);
  music.setTempo(s.spies.some((spy) => spy.clock < LOW_TIME) ? HURRY_TEMPO : 1);
  for (const spy of s.spies) {
    if (spy.mode !== 'normal') continue;
    if (posKey(spy) !== before[spy.id]) {
      stepTimers[spy.id] -= dt;
      if (stepTimers[spy.id] <= 0) {
        sfx.play('step');
        stepTimers[spy.id] = STEP_INTERVAL;
      }
    } else {
      stepTimers[spy.id] = 0;
    }
  }
  if (s.result) {
    if (s.result.kind === 'win') {
      screen = 'victory';
      victoryT = 0;
      music.stop();
    } else {
      finish(s);
    }
  }
}

function updateVictory(dt: number): void {
  const before = victoryT;
  victoryT += dt;
  if (before < LAUGH_AT && victoryT >= LAUGH_AT) sfx.play('laugh');
  if (before < MOB_AT && victoryT >= MOB_AT) sfx.play('mob');
  const skipped = victoryT >= VICTORY_SKIPPABLE_AFTER && slotPressed('action');
  if (victoryT >= VICTORY_DURATION || skipped) finish(state!);
}

/** A remedy, secret or kufřík entering the hand shows its name under that player's frame. */
function toastOn(e: GameEvent, now: number): void {
  switch (e.type) {
    case 'found':
      if (e.thing) pushToast(toasts[e.spy], toastFor(e.thing), now);
      break;
    case 'swapped':
      pushToast(toasts[e.spy], toastFor(e.took), now);
      break;
    case 'stored':
      pushToast(toasts[e.spy], toastFor({ kind: 'secret', secret: e.secret, lastHolder: null }), now);
      break;
    case 'trapBlocked':
      pushToast(toasts[e.spy], { text: T.trapBlocked, kind: 'trap' }, now);
      break;
    case 'trapFailed':
      pushToast(toasts[e.spy], { text: T.trapPlaceFailed, kind: 'trap' }, now, 1.2);
      break;
  }
}

/** Once per second per player while the clock is under LOW_TIME. */
function lowTimeBeep(spy: Spy): void {
  if (spy.mode === 'out' || spy.mode === 'escaped' || spy.clock <= 0 || spy.clock >= LOW_TIME) return;
  const sec = Math.ceil(spy.clock);
  if (sec === lastBeep[spy.id]) return;
  lastBeep[spy.id] = sec;
  sfx.play('lowtime');
}

function soundFor(e: GameEvent): SfxName | null {
  switch (e.type) {
    case 'searchStart': return 'search';
    case 'found': return e.thing ? 'found' : 'nothing';
    case 'stored': return 'found';
    case 'swapped': return 'swap';
    case 'hidden': return 'thud';
    case 'dropped': return e.thing ? 'clatter' : null;
    case 'trapSet': return 'trapSet';
    case 'trapFailed': return 'fail';
    case 'trapBlocked': return 'fail';
    case 'disarmed': return 'found';
    case 'died':
      switch (e.cause) {
        case 'bomba': return 'bomb';
        case 'pruzina': return 'boing';
        case 'elektrina': return 'zap';
        case 'pistole': return 'shot';
        default: return null; // casovana → 'explode', fight → 'hit'
      }
    case 'swing': return 'swing';
    case 'hit': return 'hit';
    case 'blocked': return 'block';
    case 'door': return 'door';
    case 'doorOpened': return 'door';
    case 'bump': return 'bump';
    case 'bounced': return 'boot';
    case 'tick': return 'tick';
    case 'explode': return 'bomb';
    case 'timeout': return 'fail';
    case 'mapOpened': return 'door';
    case 'respawn':
    case 'escaped':
    case 'draw':
      return null;
  }
}

// ---------- render & window ----------

function render(): void {
  frames++;
  const now = performance.now();
  if (now - fpsTime >= 1000) {
    fps = frames;
    frames = 0;
    fpsTime = now;
  }
  if (screen === 'victory' && state?.result?.kind === 'win') {
    renderVictory(ctx, scale, state, state.result.winner, victoryT, now / 1000);
  } else if (state && screen !== 'menu') {
    renderGame(ctx, scale, state, now / 1000, { on: debug, fps }, toasts, effects);
    if (screen === 'title') renderTitleCard(ctx, scale, state, titleT);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function resize(): void {
  scale = fitCanvas(canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  $('toosmall').classList.toggle('hidden', scale >= 2);
}

window.addEventListener('resize', resize);
window.addEventListener('blur', () => {
  if (screen === 'play') pause(T.paused);
  else if (screen === 'title') {
    beginPlay();
    pause(T.paused);
  }
});
window.addEventListener('pointerdown', () => sfx.unlock());

setupMenu();
resize();
show('menu');
startLoop(update, render);

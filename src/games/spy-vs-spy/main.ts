import { Sfx, audioLocked, getAudioContext, type SfxName } from '../../shared/audio';
import { cs } from '../../shared/i18n/cs';
import type { PlayerActions } from '../../shared/input/actions';
import { InputManager, type DeviceId } from '../../shared/input/manager';
import { startLoop } from '../../shared/loop';
import { Music } from '../../shared/music';
import { randomSeed } from '../../shared/rng';
import { fitCanvas } from '../../shared/splitscreen';
import { loadJson, saveJson } from '../../shared/storage';
import { createBot, type Bot } from './bot/bot';
import { IQS, botMaxHealth, type Iq } from './bot/iq';
import { createGame } from './logic/generator';
import { GAME_LENGTH_MULTIPLIERS, LEVELS, RULES, levelRules } from './logic/rules';
import { rankFor } from './logic/score';
import { NO_INPUT, type GameEvent, type GameState, type PlayerId, type RemedyKind, type Spy, type SpyInput } from './logic/state';
import { step } from './logic/step';
import { deathFrames } from './render/death-frames';
import { laugher, spawnEffects, type EffectQueue } from './render/effects';
import { formatClock } from './render/hud';
import { pushToast, toastFor, type ToastQueue } from './render/toast';
import { LOW_TIME } from './render/trapulator';
import { escapeCues, escapeOver, renderEscape } from './render/escape';
import { LAUGH_AT, MOB_AT, VICTORY_DURATION, VICTORY_SKIPPABLE_AFTER, renderVictory } from './render/victory';
import { TITLE_CARD_TIME, renderTitleCard } from './render/title';
import { renderGame } from './render/view';
import { canStart, humanSlots, levelReadout, migrateSettings, startsDemo, type SideSetting } from './settings';

type Screen = 'menu' | 'title' | 'play' | 'pause' | 'escape' | 'victory' | 'result';

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
/** The computer's sides of the running match (spec bot §1), fixed at its start; null for a human's side. */
let bots: [Bot | null, Bot | null] = [null, null];
/** Strip labels of the computer's halves („Počítač IQ 3"), null for a human's. */
let botLabels: [string | null, string | null] = [null, null];
/** The previous `step`'s events: what the bots saw happen last tick. */
let lastEvents: readonly GameEvent[] = [];
/** A menu select changed this tick (a key on a focused select): that key must not also start a bot-vs-bot demo. */
let menuChanged = false;
/** Elements whose keys work the menu itself (Enter, Space, arrows), so they never start the demo. */
const FORM_CONTROLS: readonly string[] = ['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA', 'A'];
let scale = 1;
let debug = false;
let fps = 0;
let frames = 0;
let fpsTime = performance.now();
/** Countdown per spy to the next footstep sound while walking. */
const stepTimers: [number, number] = [0, 0];
let victoryT = 0;
/** Seconds into the escape scene that plays before the victory (round 6 §5). */
let escapeT = 0;
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
  $('game-length-label').textContent = T.gameLengthLabel;
  $('hide-airport-label').textContent = T.hideAirport;
  $('mute-label').textContent = T.mute;
  $('music-label').textContent = T.music;
  $('controls').textContent = T.controls;
  $('sound-hint').textContent = T.soundLocked;
  $('back').textContent = T.back;
  $('toosmall-title').textContent = T.tooSmall;

  const level = $<HTMLSelectElement>('level');
  const readout = $('level-readout');
  for (const n of LEVELS) {
    const { cols, rows } = levelRules(n);
    level.add(new Option(T.levelOption(n, cols, rows), String(n), false, n === settings.level));
  }
  const updateReadout = () => {
    readout.textContent = levelReadout(settings.level, settings.gameLength);
  };
  updateReadout();
  level.onchange = () => {
    settings.level = Number(level.value);
    updateReadout();
    saveJson(SETTINGS_KEY, settings);
  };

  const gameLength = $<HTMLSelectElement>('game-length');
  for (const m of GAME_LENGTH_MULTIPLIERS) {
    gameLength.add(new Option(T.gameLengthOption(m), String(m), false, m === settings.gameLength));
  }
  gameLength.onchange = () => {
    settings.gameLength = Number(gameLength.value) as typeof GAME_LENGTH_MULTIPLIERS[number];
    updateReadout();
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

  // Hráč / Počítač per side (spec bot §1); the IQ select only for Počítač
  ([0, 1] as const).forEach((i) => {
    $(`side-${i}-label`).textContent = i === 0 ? T.white : T.black;
    const side = $<HTMLSelectElement>(`side-${i}`);
    const iq = $<HTMLSelectElement>(`iq-${i}`);
    const saved = settings.sides[i];
    side.add(new Option(T.sideHuman, 'human', false, !saved.bot));
    side.add(new Option(T.sideBot, 'bot', false, saved.bot));
    for (const n of IQS) iq.add(new Option(T.iqOption(n), String(n), false, n === saved.iq));
    iq.hidden = !saved.bot;
    const apply = () => {
      const next: SideSetting = { bot: side.value === 'bot', iq: Number(iq.value) as Iq };
      settings.sides = i === 0 ? [next, settings.sides[1]] : [settings.sides[0], next];
      iq.hidden = !next.bot;
      if (next.bot) slots[i] = null; // a Počítač slot never holds a controller
      menuChanged = true;
      renderSlots();
      saveJson(SETTINGS_KEY, settings);
    };
    // let go of the focus after a choice, so the next key starts a bot-vs-bot demo as the hint says (spec bot §8)
    side.onchange = (e) => {
      apply();
      (e.target as HTMLSelectElement).blur();
    };
    iq.onchange = side.onchange;
  });
  renderSlots();
}

function deviceLabel(d: DeviceId): string {
  if (d === 'kb-left') return T.devices.kbLeft;
  if (d === 'kb-right') return T.devices.kbRight;
  return T.devices.pad(Number(d.slice(4)) + 1);
}

const joined = (): [boolean, boolean] => [slots[0] !== null, slots[1] !== null];

function renderSlots(): void {
  slots.forEach((d, i) => {
    const el = $(`slot-${i}`);
    const side = settings.sides[i];
    el.textContent = `${i === 0 ? T.white : T.black}: ${side.bot ? T.botLabel(side.iq) : d ? deviceLabel(d) : T.waiting}`;
    el.classList.toggle('joined', side.bot || d !== null);
  });
  const humans = humanSlots(settings.sides).length;
  const ready = canStart(settings.sides, joined());
  $('menu-hint').textContent = humans === 0 ? T.demoHint : !ready ? T.joinHint : humans === 2 ? T.startHint : T.readyHint;
}

function show(id: 'menu' | 'pause' | 'result' | null): void {
  for (const o of ['menu', 'pause', 'result']) $(o).classList.toggle('hidden', o !== id);
}

// ---------- screens ----------

function startGame(): void {
  (document.activeElement as HTMLElement | null)?.blur();
  const seed = urlSeed ?? randomSeed();
  const sides = settings.sides;
  // the computer's health handicap at low IQ (spec bot §1); humans always have the full health
  const health = (side: SideSetting) => (side.bot ? botMaxHealth(side.iq) : RULES.health);
  state = createGame(seed, settings.level, {
    hideAirport: settings.hideAirport, gameLength: settings.gameLength, maxHealth: [health(sides[0]), health(sides[1])],
  });
  const botFor = (i: PlayerId) => (sides[i].bot ? createBot(i, sides[i].iq, seed) : null);
  bots = [botFor(0), botFor(1)];
  botLabels = [bots[0] && T.botLabel(bots[0].iq), bots[1] && T.botLabel(bots[1].iq)];
  lastEvents = [];
  state.spies.forEach((spy) => {
    spy.prev = heldInput(spy.id);
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
  state!.spies.forEach((spy) => {
    spy.prev = heldInput(spy.id);
  });
  screen = 'play';
  music.start();
}

function toMenu(): void {
  music.stop();
  screen = 'menu';
  state = null;
  bots = [null, null];
  lastEvents = [];
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

/** The humans' controllers (a computer's slot holds none), so a lost gamepad pauses only for a human (spec bot §1). */
const slotDevices = (): DeviceId[] => slots.filter((d): d is DeviceId => d !== null);
/** Computer against computer: nobody holds a controller, so every one counts (spec bot §8). */
const noHumans = (): boolean => bots[0] !== null && bots[1] !== null;
/** A human pressed `key`; with no human in the match, anyone did. */
const slotPressed = (key: 'action' | 'pause'): boolean =>
  (noHumans() ? input.devices() : slotDevices()).some((d) => input.pressed(d, key));
/** Any key (but the F1 debug toggle) or any controller button went down this tick (in play: the menu is closed). */
const anyPress = (): boolean =>
  (input.anyKeyPressed() && !input.keyPressed('F1')) ||
  input.devices().some((d) => input.pressed(d, 'action') || input.pressed(d, 'trap') || input.pressed(d, 'pause'));

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
    case 'escape':
      updateEscape(dt);
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
  $('sound-hint').hidden = !audioLocked();
  slots.forEach((d, i) => {
    if (d && !input.isConnected(d)) {
      slots[i as 0 | 1] = null;
      renderSlots();
    }
  });
  const changed = menuChanged;
  menuChanged = false;
  const humans = humanSlots(settings.sides);
  if (humans.length === 0) {
    // computer against computer (spec bot §8): nobody joins, any key or button starts the demo
    if (!changed && demoStartPressed()) {
      sfx.unlock();
      startGame();
    }
    return;
  }
  for (const d of input.devices()) {
    if (!input.pressed(d, 'action')) continue;
    sfx.unlock();
    if (slots.includes(d)) {
      if (canStart(settings.sides, joined())) {
        startGame();
        return;
      }
      continue;
    }
    // a joining controller takes the first free Hráč slot; a Počítač slot never waits
    const free = humans.find((i) => slots[i] === null);
    if (free === undefined) continue;
    slots[free] = d;
    sfx.play('join');
    renderSlots();
  }
}

/**
 * Bot vs bot in the menu (spec bot §8): a key starts the demo only when no menu control has focus (`startsDemo`), a
 * gamepad button always does. Keyboard „devices" are left out, their keys already went through `startsDemo`; a mouse
 * click is no key at all.
 */
function demoStartPressed(): boolean {
  const focused = document.activeElement;
  const inForm = focused !== null && FORM_CONTROLS.includes(focused.tagName);
  if (input.keysPressed().some((code) => startsDemo(code, inForm))) return true;
  return input.devices().some((d) =>
    d.startsWith('pad-') && (input.pressed(d, 'action') || input.pressed(d, 'trap') || input.pressed(d, 'pause')));
}

function toSpyInput(a: PlayerActions): SpyInput {
  return { moveX: a.moveX, moveY: a.moveY, action: a.action, trap: a.trap };
}

/** What a side holds at the start of play: a human's controller, nothing for the computer. */
function heldInput(id: PlayerId): SpyInput {
  return bots[id] ? { ...NO_INPUT } : toSpyInput(input.get(slots[id]!));
}

/** This tick's input of a side: a human's controller, or the bot's answer to what he saw last tick. */
function playInput(id: PlayerId, s: GameState, dt: number): SpyInput {
  const bot = bots[id];
  return bot ? bot.think(s, lastEvents, dt) : toSpyInput(input.get(slots[id]!));
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
  // with no human any key or button pauses (spec bot §8); the bots think only while playing, so a pause leaves no backlog
  if (noHumans() ? anyPress() : slotPressed('pause')) {
    pause(T.paused);
    return;
  }
  const before: [string, string] = [posKey(s.spies[0]), posKey(s.spies[1])];
  const inputs: [SpyInput, SpyInput] = [playInput(0, s, dt), playInput(1, s, dt)];
  const now = performance.now() / 1000;
  const events = step(s, inputs, dt);
  lastEvents = events;
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
      screen = 'escape';
      escapeT = 0;
      music.stop();
    } else {
      finish(s);
    }
  }
}

/** The escape scene: no controls; each item's sound on cue; any key or button skips straight to the victory. */
function updateEscape(dt: number): void {
  const before = escapeT;
  escapeT += dt;
  for (const name of escapeCues(before, escapeT)) sfx.play(name);
  const pressed = input.anyKeyPressed() || slotPressed('action') || slotPressed('pause') || slotDevices().some((d) => input.pressed(d, 'trap'));
  if (escapeOver(escapeT, pressed)) {
    screen = 'victory';
    victoryT = 0;
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

/** The sound of each remedy defusing its trap (round 4 §3). */
const DISARM_SOUND: Readonly<Record<RemedyKind, SfxName>> = { destnik: 'umbrella', voda: 'hiss', kleste: 'snip', nuzky: 'snip' };

function soundFor(e: GameEvent): SfxName | null {
  switch (e.type) {
    case 'searchStart': return 'search';
    case 'found': return e.thing ? 'found' : 'nothing';
    case 'alreadyHave': return 'nothing';
    case 'stored': return 'found';
    case 'swapped': return 'swap';
    case 'hidden': return 'thud';
    case 'dropped': return e.thing ? 'clatter' : null;
    case 'trapSet': return 'trapSet';
    case 'refused': return 'grumble';
    case 'disarmed': return DISARM_SOUND[e.remedy];
    case 'salvaged': return 'salvage';
    case 'resupplied': return 'resupply';
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
  if (screen === 'escape' && state?.result?.kind === 'win') {
    // the loser's half stays on the frozen match; the winner's half shows the escape
    renderGame(ctx, scale, state, now / 1000, { on: false, fps }, toasts, effects, botLabels);
    renderEscape(ctx, scale, state.result.winner, escapeT, now / 1000);
  } else if (screen === 'victory' && state?.result?.kind === 'win') {
    renderVictory(ctx, scale, state, state.result.winner, victoryT, now / 1000);
  } else if (state && screen !== 'menu') {
    renderGame(ctx, scale, state, now / 1000, { on: debug, fps }, toasts, effects, botLabels);
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
// Unlock sound inside a real user gesture (autoplay policy): a click, touch or any key. Gamepad buttons are not
// gestures, so the menu shows a hint until the sound runs.
for (const type of ['pointerdown', 'keydown', 'touchstart'] as const) {
  window.addEventListener(type, () => sfx.unlock(), { capture: true });
}

setupMenu();
resize();
show('menu');
startLoop(update, render);
// The death animations are built on first use; build them now, while the menu idles, so no death waits for them.
// (No requestIdleCallback in Safari, which we don't target; a timeout does the same job there.)
if ('requestIdleCallback' in window) requestIdleCallback(() => deathFrames());
else setTimeout(() => deathFrames(), 500);

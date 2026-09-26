export type SfxName =
  | 'join' | 'search' | 'found' | 'hide' | 'trapSet' | 'fail'
  | 'nothing' | 'thud' | 'swap' | 'clatter'
  | 'bomb' | 'zap' | 'boing' | 'shot'
  | 'swing' | 'hit' | 'block' | 'door' | 'bump' | 'boot' | 'tick' | 'win' | 'draw'
  | 'step'
  | 'laugh' | 'mob'
  | 'lowtime'
  | 'grumble'
  | 'umbrella' | 'hiss' | 'snip'
  | 'salvage' | 'resupply'
  | 'jingle' | 'click' | 'coins' | 'paper' | 'stamp' | 'engine';

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function tone(c: AudioContext, { freq, to, dur, type = 'square', vol = 0.15, delay = 0 }: ToneOpts): void {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  delay?: number;
  lowpass?: number;
}

function noise(c: AudioContext, { dur, vol = 0.3, delay = 0, lowpass = 2000 }: NoiseOpts): void {
  const t0 = c.currentTime + delay;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

/** Two short metallic clicks, like a rifle bolt worked back and forth. */
function clickClack(c: AudioContext, delay: number): void {
  tone(c, { freq: 1900, dur: 0.025, delay, type: 'square', vol: 0.12 });
  noise(c, { dur: 0.03, vol: 0.18, delay, lowpass: 7000 });
  tone(c, { freq: 1300, dur: 0.03, delay: delay + 0.09, type: 'square', vol: 0.12 });
  noise(c, { dur: 0.035, vol: 0.2, delay: delay + 0.09, lowpass: 6000 });
}

const RECIPES: Record<SfxName, (c: AudioContext) => void> = {
  join: (c) => { tone(c, { freq: 440, dur: 0.08 }); tone(c, { freq: 660, dur: 0.1, delay: 0.08 }); },
  search: (c) => noise(c, { dur: 0.25, vol: 0.12, lowpass: 1200 }),
  found: (c) => { tone(c, { freq: 660, dur: 0.08 }); tone(c, { freq: 990, dur: 0.12, delay: 0.08 }); },
  hide: (c) => tone(c, { freq: 500, to: 300, dur: 0.12 }),
  nothing: (c) => { tone(c, { freq: 330, to: 260, dur: 0.14, type: 'triangle', vol: 0.18 }); tone(c, { freq: 247, to: 150, dur: 0.28, delay: 0.14, type: 'triangle', vol: 0.18 }); },
  thud: (c) => { tone(c, { freq: 140, to: 60, dur: 0.12, type: 'sine', vol: 0.35 }); noise(c, { dur: 0.06, vol: 0.12, lowpass: 500 }); },
  swap: (c) => { noise(c, { dur: 0.22, vol: 0.12, lowpass: 3500 }); tone(c, { freq: 300, to: 900, dur: 0.2, type: 'sine', vol: 0.08 }); },
  clatter: (c) => [0, 0.05, 0.11, 0.18].forEach((delay, i) => {
    tone(c, { freq: 1100 - i * 170, dur: 0.04, delay, type: 'square', vol: 0.08 });
    noise(c, { dur: 0.04, vol: 0.12, delay, lowpass: 5000 });
  }),
  trapSet: (c) => { tone(c, { freq: 300, dur: 0.05 }); tone(c, { freq: 300, dur: 0.05, delay: 0.1 }); },
  fail: (c) => tone(c, { freq: 150, dur: 0.15, type: 'sawtooth' }),
  /** the head shake (round 4 §1): a short low „hm-hm", two falling grunts */
  grumble: (c) => {
    tone(c, { freq: 180, to: 140, dur: 0.12, type: 'triangle', vol: 0.2 });
    tone(c, { freq: 160, to: 110, dur: 0.16, delay: 0.16, type: 'triangle', vol: 0.2 });
  },
  /** the umbrella snapping open (a whoosh), then the patter of water drops on it (round 4 §3) */
  umbrella: (c) => {
    noise(c, { dur: 0.18, vol: 0.2, lowpass: 2500 });
    tone(c, { freq: 250, to: 700, dur: 0.15, type: 'sine', vol: 0.08 });
    [0.2, 0.27, 0.31, 0.38, 0.44, 0.49, 0.56, 0.63].forEach((delay, i) =>
      tone(c, { freq: 1800 + (i % 3) * 400, to: 900, dur: 0.03, delay, type: 'sine', vol: 0.07 }));
  },
  /** water on a lit fuse: a splash, then a long falling steam hiss */
  hiss: (c) => {
    noise(c, { dur: 0.12, vol: 0.18, lowpass: 1500 });
    noise(c, { dur: 0.7, vol: 0.14, delay: 0.1, lowpass: 9000 });
  },
  /** a metallic snip: two quick bright clicks with a ring */
  snip: (c) => {
    tone(c, { freq: 2400, dur: 0.03, type: 'square', vol: 0.1 });
    noise(c, { dur: 0.03, vol: 0.15, lowpass: 8000 });
    tone(c, { freq: 3100, to: 2600, dur: 0.12, delay: 0.06, type: 'triangle', vol: 0.1 });
    noise(c, { dur: 0.03, vol: 0.15, delay: 0.06, lowpass: 8000 });
  },
  /** round 6 §4, a disarmed trap kept: after the disarm sound, a bolt's click-clack and a small bright „ding-ding" */
  salvage: (c) => {
    clickClack(c, 0.5);
    tone(c, { freq: 880, dur: 0.07, delay: 0.66, type: 'triangle', vol: 0.12 });
    tone(c, { freq: 1320, dur: 0.1, delay: 0.73, type: 'triangle', vol: 0.12 });
  },
  /** round 6 §4, a trap from the armoury: the cabinet door's wooden clunk, a bolt's click-clack, a rising chirp */
  resupply: (c) => {
    tone(c, { freq: 170, to: 110, dur: 0.08, type: 'sine', vol: 0.3 });
    noise(c, { dur: 0.05, vol: 0.12, lowpass: 900 });
    clickClack(c, 0.12);
    tone(c, { freq: 660, to: 1100, dur: 0.12, delay: 0.3, type: 'triangle', vol: 0.1 });
  },
  /** the escape scene (round 6 §5): a bunch of keys jingling as the klíč flies out */
  jingle: (c) => [0, 0.04, 0.09, 0.15].forEach((delay, i) =>
    tone(c, { freq: 2600 + (i % 2) * 700, to: 2200, dur: 0.06, delay, type: 'triangle', vol: 0.07 })),
  /** the lock turning: two dry clicks */
  click: (c) => {
    tone(c, { freq: 1800, dur: 0.02, type: 'square', vol: 0.1 });
    noise(c, { dur: 0.02, vol: 0.12, lowpass: 7000 });
    tone(c, { freq: 1200, dur: 0.03, delay: 0.07, type: 'square', vol: 0.12 });
    noise(c, { dur: 0.03, vol: 0.15, delay: 0.07, lowpass: 5000 });
  },
  /** coins chinking on the counter */
  coins: (c) => [0, 0.07, 0.12, 0.2, 0.26].forEach((delay, i) =>
    tone(c, { freq: 3200 - (i % 3) * 450, to: 2500, dur: 0.08, delay, type: 'sine', vol: 0.09 })),
  /** paper: a short rustle */
  paper: (c) => { noise(c, { dur: 0.12, vol: 0.12, lowpass: 7000 }); noise(c, { dur: 0.08, vol: 0.08, delay: 0.1, lowpass: 5000 }); },
  /** the rubber stamp's thud on the desk */
  stamp: (c) => { tone(c, { freq: 160, to: 70, dur: 0.12, type: 'sine', vol: 0.4 }); noise(c, { dur: 0.05, vol: 0.2, lowpass: 900 }); },
  /** the airliner's engines opening up as it rolls */
  engine: (c) => {
    tone(c, { freq: 55, to: 110, dur: 1, type: 'sawtooth', vol: 0.08 });
    tone(c, { freq: 82, to: 165, dur: 1, type: 'sawtooth', vol: 0.06 });
    noise(c, { dur: 1, vol: 0.1, lowpass: 400 });
  },
  bomb: (c) => { noise(c, { dur: 0.8, vol: 0.5, lowpass: 600 }); tone(c, { freq: 120, to: 40, dur: 0.6, type: 'sine', vol: 0.4 }); },
  /**
   * the electric bucket (round 6 §6): a tinny clang as it lands on the head, the old crackle, then a mains buzz
   * pulsing for the second the X-ray flickers
   */
  zap: (c) => {
    tone(c, { freq: 1500, to: 1100, dur: 0.18, type: 'triangle', vol: 0.12, delay: 0.2 });
    noise(c, { dur: 0.05, vol: 0.15, delay: 0.2, lowpass: 6000 });
    for (let i = 0; i < 6; i++) tone(c, { freq: 800 + (i % 2) * 400, dur: 0.04, delay: 0.22 + i * 0.04, type: 'sawtooth', vol: 0.1 });
    noise(c, { dur: 0.3, vol: 0.1, delay: 0.22, lowpass: 4000 });
    for (let i = 0; i < 11; i++) tone(c, { freq: i % 2 === 0 ? 110 : 165, dur: 0.09, delay: 0.26 + i * 0.09, type: 'sawtooth', vol: 0.07 });
  },
  boing: (c) => tone(c, { freq: 200, to: 900, dur: 0.35, type: 'triangle', vol: 0.25 }),
  shot: (c) => noise(c, { dur: 0.2, vol: 0.5, lowpass: 3000 }),
  swing: (c) => noise(c, { dur: 0.08, vol: 0.1, lowpass: 2500 }),
  hit: (c) => tone(c, { freq: 180, to: 90, dur: 0.1, vol: 0.3 }),
  // clubs meeting (round 4 §2): a sharp high crack plus a burst of noise for the wood-on-wood clack, louder than before
  block: (c) => {
    tone(c, { freq: 2200, to: 1400, dur: 0.06, type: 'square', vol: 0.3 });
    noise(c, { dur: 0.04, vol: 0.3, lowpass: 6000 });
  },
  door: (c) => { noise(c, { dur: 0.1, vol: 0.1, delay: 0.02, lowpass: 800 }); tone(c, { freq: 220, to: 180, dur: 0.08, type: 'triangle', vol: 0.12 }); },
  bump: (c) => tone(c, { freq: 110, to: 70, dur: 0.06, type: 'sine', vol: 0.08 }),
  // a boot's thump, then a short indignant whistle (up, then down)
  boot: (c) => {
    tone(c, { freq: 150, to: 50, dur: 0.14, type: 'sine', vol: 0.45 });
    noise(c, { dur: 0.07, vol: 0.25, lowpass: 700 });
    tone(c, { freq: 1300, to: 2300, dur: 0.12, delay: 0.18, type: 'sine', vol: 0.1 });
    tone(c, { freq: 2300, to: 1200, dur: 0.18, delay: 0.31, type: 'sine', vol: 0.1 });
  },
  tick: (c) => tone(c, { freq: 1500, dur: 0.03, vol: 0.08 }),
  win: (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, dur: 0.18, delay: i * 0.15, vol: 0.2 })),
  draw: (c) => [392, 330, 262].forEach((f, i) => tone(c, { freq: f, dur: 0.25, delay: i * 0.2, vol: 0.2 })),
  step: (c) => noise(c, { dur: 0.04, vol: 0.06, lowpass: 900 }),
  laugh: (c) => [0, 0.2, 0.4].forEach((delay, i) =>
    tone(c, { freq: 620 - i * 60, to: 480 - i * 60, dur: 0.14, delay, type: 'square', vol: 0.18 })),
  lowtime: (c) => tone(c, { freq: 1760, dur: 0.06, type: 'square', vol: 0.07 }),
  mob: (c) => {
    noise(c, { dur: 3, vol: 0.25, lowpass: 450 });
    for (let i = 0; i < 6; i++) tone(c, { freq: 140 + (i % 3) * 30, dur: 0.25, delay: 0.3 + i * 0.4, type: 'sawtooth', vol: 0.08 });
  },
};

let shared: AudioContext | null = null;

/** The one AudioContext shared by effects and music; null until `unlockAudio()` ran (or without audio support). */
export function getAudioContext(): AudioContext | null {
  return shared;
}

/** Create/resume the shared AudioContext. Call from a user gesture (browser autoplay policy). */
export function unlockAudio(): AudioContext | null {
  if (shared === null) {
    try {
      shared = new AudioContext();
    } catch {
      return null; // no audio support: everything stays silent
    }
  }
  void shared.resume();
  return shared;
}

/**
 * True while the browser still blocks sound: no context yet, or it is suspended. Browsers start audio only after a
 * click or key press on the page; a gamepad button does not count, so gamepad-only players need a hint.
 */
export function audioLocked(): boolean {
  return shared === null || shared.state !== 'running';
}

/** Synthesized sound effects. Call `unlock()` from a user gesture (browser autoplay policy). */
export class Sfx {
  muted = false;

  unlock(): void {
    unlockAudio();
  }

  play(name: SfxName): void {
    const ctx = getAudioContext();
    if (this.muted || ctx === null) return;
    RECIPES[name](ctx);
  }
}

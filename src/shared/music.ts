/**
 * „Tiptoe in D minor" — an original ~40 s loop in a 1930s spy-comedy style, synthesized with WebAudio.
 *
 * 120 BPM, 4/4, 20 bars (40 s). Intro (bars 1–2: walking bass alone) → A (3–10: tiptoe pizzicato
 * theme, one chromatic "wah-wah-wahh" from a muted trumpet) → B (11–16: repeated-note tiptoes over
 * Gm / Dm / E° / A7, each answered by the muted trumpet) → A' (17–20: theme returns, A7 turnaround
 * back to the top). Noise ticks and a soft low thump keep the pulse.
 */

export type VoiceName = 'bass' | 'melody' | 'trumpet' | 'drums';
/** A note name like 'D3', 'C#5', 'Bb2', or 'r' for a rest (drums: 'k' thump, 'h' tick), and its length in beats. */
export type NoteSpec = readonly [note: string, beats: number];
export interface Voice {
  readonly notes: readonly NoteSpec[];
}

export const BPM = 120;
export const BAR_BEATS = 4;

// ---------- the score ----------

const q = (...notes: string[]): NoteSpec[] => notes.map((n) => [n, 1] as const);
const REST_BAR: NoteSpec[] = [['r', 4]];

/** Walking bass: staccato quarters with chromatic approach notes into each next chord. */
const BASS: NoteSpec[] = [
  ...q('D3', 'F3', 'A3', 'G#3'), // 1  Dm
  ...q('A3', 'G3', 'E3', 'C#3'), // 2  A7
  ...q('D3', 'C3', 'A2', 'C#3'), // 3  Dm
  ...q('D3', 'F3', 'A3', 'F#3'), // 4  Dm
  ...q('G3', 'F3', 'D3', 'Bb2'), // 5  Gm
  ...q('A2', 'C#3', 'E3', 'C#3'), // 6  A7
  ...q('D3', 'E3', 'F3', 'A3'), // 7  Dm
  ...q('Bb2', 'D3', 'F3', 'F#3'), // 8  Bb
  ...q('G3', 'F3', 'E3', 'Bb2'), // 9  Gm → E°
  ...q('A2', 'C#3', 'E3', 'F#3'), // 10 A7
  ...q('G3', 'D3', 'G2', 'A2'), // 11 Gm
  ...q('Bb2', 'D3', 'G3', 'C#3'), // 12 Gm
  ...q('D3', 'A2', 'D3', 'E3'), // 13 Dm
  ...q('F3', 'A3', 'D3', 'D#3'), // 14 Dm
  ...q('E3', 'D3', 'C3', 'Bb2'), // 15 E°
  ...q('A2', 'C#3', 'E3', 'C#3'), // 16 A7
  ...q('D3', 'F3', 'A3', 'F#3'), // 17 Dm
  ...q('G3', 'F3', 'D3', 'C3'), // 18 Gm
  ...q('Bb2', 'C3', 'D3', 'Bb2'), // 19 Bb
  ...q('A2', 'E3', 'G3', 'C#3'), // 20 A7
];

const THEME_1: NoteSpec[] = [['r', 0.5], ['A4', 0.5], ['D5', 0.5], ['r', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['r', 0.5]];
const THEME_3: NoteSpec[] = [['r', 0.5], ['Bb4', 0.5], ['D5', 0.5], ['r', 0.5], ['G5', 0.5], ['F5', 0.5], ['D5', 0.5], ['r', 0.5]];

/** Pizzicato tiptoe melody in staccato eighths. */
const MELODY: NoteSpec[] = [
  ['r', 8], // 1–2 intro
  ...THEME_1, // 3
  ['C#5', 0.5], ['D5', 0.5], ['r', 0.5], ['A4', 0.5], ['r', 2], // 4 (trumpet answers)
  ...THEME_3, // 5
  ['E5', 0.5], ['C#5', 0.5], ['r', 0.5], ['A4', 0.5], ['G5', 1], ['r', 1], // 6
  ['r', 0.5], ['A4', 0.5], ['D5', 0.5], ['r', 0.5], ['F5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], // 7
  ['D5', 0.5], ['r', 0.5], ['F5', 0.5], ['D5', 0.5], ['Bb4', 1], ['r', 1], // 8
  ['G4', 0.5], ['Bb4', 0.5], ['D5', 0.5], ['E5', 0.5], ['G5', 0.5], ['F5', 0.5], ['E5', 0.5], ['Bb4', 0.5], // 9
  ['A4', 0.5], ['r', 0.5], ['C#5', 0.5], ['E5', 0.5], ['G5', 0.5], ['r', 0.5], ['r', 1], // 10
  ['D5', 0.5], ['r', 0.5], ['D5', 0.5], ['r', 0.5], ['D5', 0.5], ['Eb5', 0.5], ['D5', 0.5], ['r', 0.5], // 11
  ...REST_BAR, // 12 (trumpet)
  ['A4', 0.5], ['r', 0.5], ['A4', 0.5], ['r', 0.5], ['A4', 0.5], ['Bb4', 0.5], ['A4', 0.5], ['r', 0.5], // 13
  ...REST_BAR, // 14 (trumpet)
  ['E5', 0.5], ['G5', 0.5], ['Bb5', 0.5], ['r', 0.5], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['r', 0.5], // 15
  ['C#5', 0.5], ['r', 0.5], ['A4', 0.5], ['r', 0.5], ['r', 2], // 16 (trumpet)
  ...THEME_1, // 17
  ...THEME_3, // 18
  ['F5', 0.5], ['D5', 0.5], ['Bb4', 0.5], ['r', 0.5], ['D5', 0.5], ['C5', 0.5], ['Bb4', 0.5], ['r', 0.5], // 19
  ['A4', 0.5], ['r', 0.5], ['C#5', 0.5], ['r', 0.5], ['E5', 0.5], ['r', 0.5], ['r', 1], // 20
];

/** Muted trumpet: short answers in the melody's gaps. */
const TRUMPET: NoteSpec[] = [
  ['r', 12], // 1–3
  ['r', 2], ['A4', 0.5], ['Ab4', 0.5], ['G4', 1], // 4
  ['r', 28], // 5–11
  ['D5', 0.75], ['r', 0.25], ['C5', 0.5], ['Bb4', 0.5], ['A4', 1.5], ['r', 0.5], // 12
  ...REST_BAR, // 13
  ['F4', 0.75], ['r', 0.25], ['E4', 0.5], ['D4', 0.5], ['C#4', 1.5], ['r', 0.5], // 14
  ...REST_BAR, // 15
  ['r', 2], ['E4', 0.5], ['G4', 0.5], ['A4', 1], // 16
  ['r', 16], // 17–20
];

const DRUM_BAR: NoteSpec[] = [
  ['k', 0.5], ['h', 0.5], ['r', 0.5], ['h', 0.5], ['k', 0.5], ['h', 0.5], ['r', 0.25], ['h', 0.25], ['h', 0.5],
];
const DRUMS: NoteSpec[] = Array.from({ length: 20 }, () => DRUM_BAR).flat();

export const SONG: Readonly<Record<VoiceName, Voice>> = {
  bass: { notes: BASS },
  melody: { notes: MELODY },
  trumpet: { notes: TRUMPET },
  drums: { notes: DRUMS },
};

export const LOOP_BEATS = BASS.reduce((sum, [, beats]) => sum + beats, 0);

// ---------- pure helpers ----------

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Equal-tempered frequency of a note name ('A4' = 440 Hz, 'C#5', 'Bb2'). */
export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = (Number(m[3]) + 1) * 12 + SEMITONE[m[1]] + acc;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Seconds per beat at a tempo multiplier. */
export const secondsPerBeat = (mult: number): number => 60 / (BPM * mult);

/** Length of one pass through the loop, in seconds. */
export const loopSeconds = (mult: number): number => LOOP_BEATS * secondsPerBeat(mult);

export interface SongNote {
  voice: VoiceName;
  note: string;
  /** Absolute beat position (loop passes keep counting up). */
  beat: number;
  /** Length in beats. */
  beats: number;
}

/** Every sounding note of one loop pass, sorted by beat (ties in voice order). */
const EVENTS: readonly SongNote[] = (Object.keys(SONG) as VoiceName[])
  .flatMap((voice) => {
    let beat = 0;
    const out: SongNote[] = [];
    for (const [note, beats] of SONG[voice].notes) {
      if (note !== 'r') out.push({ voice, note, beat, beats });
      beat += beats;
    }
    return out;
  })
  .sort((a, b) => a.beat - b.beat);

/** Notes starting in the beat window [from, to), looping forever; beats are absolute. */
export function notesBetween(from: number, to: number): SongNote[] {
  const out: SongNote[] = [];
  if (to <= from) return out;
  for (let k = Math.floor(from / LOOP_BEATS); k * LOOP_BEATS < to; k++) {
    const base = k * LOOP_BEATS;
    for (const e of EVENTS) {
      const beat = base + e.beat;
      if (beat >= from && beat < to) out.push({ ...e, beat });
    }
  }
  return out;
}

/** How far the music has been scheduled: this beat plays at this context time, at this tempo. */
export interface Cursor {
  beat: number;
  time: number;
  mult: number;
}

export interface ScheduledNote extends SongNote {
  /** Context time the note starts. */
  time: number;
  /** Length in seconds at the tempo it was scheduled with. */
  dur: number;
}

/**
 * Schedule everything from the cursor up to `horizon` (context seconds). A tempo change to
 * `targetMult` takes effect at the next bar line, so a bar never changes speed halfway.
 */
export function advance(cursor: Cursor, horizon: number, targetMult: number): { cursor: Cursor; notes: ScheduledNote[] } {
  const notes: ScheduledNote[] = [];
  let c = cursor;
  const emit = (from: number, to: number, at: Cursor): void => {
    const spb = secondsPerBeat(at.mult);
    for (const n of notesBetween(from, to)) notes.push({ ...n, time: at.time + (n.beat - at.beat) * spb, dur: n.beats * spb });
  };
  while (c.time < horizon) {
    const spb = secondsPerBeat(c.mult);
    const endBeat = c.beat + (horizon - c.time) / spb;
    if (c.mult !== targetMult) {
      const bar = Math.ceil(c.beat / BAR_BEATS - 1e-9) * BAR_BEATS;
      if (bar <= endBeat) {
        emit(c.beat, bar, c);
        c = { beat: bar, time: c.time + (bar - c.beat) * spb, mult: targetMult };
        continue;
      }
    }
    emit(c.beat, endBeat, c);
    c = { beat: endBeat, time: horizon, mult: c.mult };
  }
  return { cursor: c, notes };
}

// ---------- runtime ----------

/** Overall music level; effects peak around 0.15–0.5, so this stays well underneath. */
const MUSIC_VOLUME = 0.28;
const LOOKAHEAD = 0.1;
const TICK_MS = 25;
const LEAD_IN = 0.05;

/** Background music on the shared AudioContext, with its own gain node. */
export class Music {
  private readonly ctxProvider: () => AudioContext | null;
  private master: GainNode | null = null;
  /** Per-run bus: faded out and dropped on pause/stop, which silences anything already scheduled. */
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursor: Cursor = { beat: 0, time: 0, mult: 1 };
  private target = 1;
  private state: 'stopped' | 'playing' | 'paused' = 'stopped';
  private isMuted = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctxProvider: () => AudioContext | null) {
    this.ctxProvider = ctxProvider;
  }

  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    const ctx = this.ctxProvider();
    if (ctx && this.master) this.master.gain.setTargetAtTime(value ? 0 : MUSIC_VOLUME, ctx.currentTime, 0.05);
  }

  get playing(): boolean {
    return this.state === 'playing';
  }

  /** Start from the top at normal tempo. */
  start(): void {
    this.stop();
    const ctx = this.ctxProvider();
    if (!ctx) return;
    this.target = 1;
    this.cursor = { beat: 0, time: ctx.currentTime + LEAD_IN, mult: 1 };
    this.run(ctx);
  }

  stop(): void {
    this.halt();
    this.state = 'stopped';
    this.target = 1;
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.halt();
    this.state = 'paused';
  }

  /** Continue from the beat where the music paused. */
  resume(): void {
    if (this.state !== 'paused') return;
    const ctx = this.ctxProvider();
    if (!ctx) return;
    this.cursor = { ...this.cursor, time: ctx.currentTime + LEAD_IN };
    this.run(ctx);
  }

  /** Tempo multiplier (1 = 120 BPM); switches at the next bar line. */
  setTempo(mult: number): void {
    this.target = mult;
  }

  private run(ctx: AudioContext): void {
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.isMuted ? 0 : MUSIC_VOLUME;
      this.master.connect(ctx.destination);
    }
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.state = 'playing';
    this.timer = setInterval(() => this.tick(ctx), TICK_MS);
    this.tick(ctx);
  }

  private halt(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    const ctx = this.ctxProvider();
    if (bus && ctx) {
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => bus.disconnect(), 300);
    }
    this.bus = null;
  }

  private tick(ctx: AudioContext): void {
    const bus = this.bus;
    if (!bus) return;
    // a throttled background timer fell behind: skip ahead instead of firing a burst of stale notes
    if (this.cursor.time < ctx.currentTime) this.cursor = { ...this.cursor, time: ctx.currentTime + 0.01 };
    const { cursor, notes } = advance(this.cursor, ctx.currentTime + LOOKAHEAD, this.target);
    this.cursor = cursor;
    for (const n of notes) this.play(ctx, bus, n);
  }

  private play(ctx: AudioContext, bus: GainNode, n: ScheduledNote): void {
    switch (n.voice) {
      case 'bass':
        this.voice(ctx, bus, { type: 'triangle', freq: noteFreq(n.note), t: n.time, vol: 0.55, attack: 0.005, len: n.dur * 0.6 });
        break;
      case 'melody':
        // pizzicato: a plucked blip whatever the written length
        this.voice(ctx, bus, { type: 'square', freq: noteFreq(n.note), t: n.time, vol: 0.14, attack: 0.003, len: Math.min(0.16, n.dur * 0.8), lowpass: 2600 });
        break;
      case 'trumpet':
        this.voice(ctx, bus, { type: 'sawtooth', freq: noteFreq(n.note), t: n.time, vol: 0.13, attack: 0.035, len: n.dur * 0.9, lowpass: 1100, sustain: true, vibrato: true });
        break;
      case 'drums':
        if (n.note === 'k') this.voice(ctx, bus, { type: 'sine', freq: 110, to: 50, t: n.time, vol: 0.35, attack: 0.002, len: 0.09 });
        else this.tickNoise(ctx, bus, n.time);
        break;
    }
  }

  private voice(
    ctx: AudioContext,
    bus: GainNode,
    o: { type: OscillatorType; freq: number; to?: number; t: number; vol: number; attack: number; len: number; lowpass?: number; sustain?: boolean; vibrato?: boolean },
  ): void {
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, o.t + o.len);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, o.t);
    gain.gain.linearRampToValueAtTime(o.vol, o.t + o.attack);
    if (o.sustain) {
      gain.gain.setValueAtTime(o.vol * 0.8, o.t + Math.max(o.attack, o.len - 0.06));
      gain.gain.linearRampToValueAtTime(0.0001, o.t + o.len);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.0001, o.t + o.len);
    }
    let out: AudioNode = osc;
    if (o.lowpass !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      filter.Q.value = o.sustain ? 4 : 0.7; // resonant = "muted" brass
      out = out.connect(filter);
    }
    out.connect(gain).connect(bus);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, o.t);
      depth.gain.linearRampToValueAtTime(o.freq * 0.008, o.t + Math.min(0.2, o.len));
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(o.t);
      lfo.stop(o.t + o.len);
    }
    osc.start(o.t);
    osc.stop(o.t + o.len + 0.01);
  }

  private tickNoise(ctx: AudioContext, bus: GainNode, t: number): void {
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t);
    src.stop(t + 0.05);
  }
}

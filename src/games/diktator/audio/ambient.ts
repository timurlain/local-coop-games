// A restless crowd murmuring under the palace, louder the angrier the factions get (play-test round 6b §3:
// "a rebel noise when some of the factions are super unhappy... background, not attention-grabbing"). Browser-only
// (needs a real AudioContext, which jsdom/node don't provide — see src/shared/music.ts's Music class for the same
// reason); its pure trigger, `unrestLevel` in ui/sounds.ts, is what carries the test coverage.

import { effectsOut } from '../../../shared/audio';

const LOOP_SEC = 3;
const LOWPASS_HZ = 380;
const TREMOLO_HZ = 0.25;
const TREMOLO_DEPTH = 0.3;
const RAMP_SEC = 1.5;
/** `setLevel`'s 0..1 scaled down to a gain that sits well under the effects (round 6b §3: background, not a key noise). */
const LEVEL_SCALE = 0.05;
const SHOUT_MIN_SEC = 5;
const SHOUT_MAX_SEC = 9;
const SHOUT_LOWPASS_HZ = 900;
const SHOUT_VOL = 0.025;

/** Background crowd ambience, its own small graph on the shared AudioContext (see `Music` for the sibling pattern). */
export class Ambient {
  private ctx: AudioContext | null = null;
  private levelGain: GainNode | null = null;
  private level = 0;
  private shoutTimer: ReturnType<typeof setTimeout> | null = null;

  /** Builds the loop once (a repeat call is a no-op); starts silent — call `setLevel` to bring it up. */
  start(ctx: AudioContext): void {
    if (this.levelGain) return;
    this.ctx = ctx;

    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * LOOP_SEC), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = LOWPASS_HZ;

    // A slow tremolo: an LFO drives the tremolo gain's own gain up and down by ±30 %, so the murmur breathes.
    const tremolo = ctx.createGain();
    tremolo.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = TREMOLO_HZ;
    const depth = ctx.createGain();
    depth.gain.value = TREMOLO_DEPTH;
    lfo.connect(depth).connect(tremolo.gain);

    const level = ctx.createGain();
    level.gain.value = 0;

    src.connect(lowpass).connect(tremolo).connect(level).connect(effectsOut(ctx));
    src.start();
    lfo.start();

    this.levelGain = level;
  }

  /** Ramps toward `level` (0..1) over 1.5 s; at level ≥ 1 an occasional distant shout starts (stops otherwise). */
  setLevel(level: number): void {
    this.level = level;
    const ctx = this.ctx;
    const gain = this.levelGain?.gain;
    if (ctx && gain) {
      gain.cancelScheduledValues(ctx.currentTime);
      gain.setValueAtTime(gain.value, ctx.currentTime);
      gain.linearRampToValueAtTime(level * LEVEL_SCALE, ctx.currentTime + RAMP_SEC);
    }
    if (level >= 1) this.scheduleShout();
    else this.clearShout();
  }

  /** Ramps to silence and clears the shout timer; the loop itself is left running (silent). */
  stop(): void {
    this.setLevel(0);
    this.clearShout();
  }

  private scheduleShout(): void {
    if (this.shoutTimer !== null) return; // already waiting on one
    const delay = (SHOUT_MIN_SEC + Math.random() * (SHOUT_MAX_SEC - SHOUT_MIN_SEC)) * 1000;
    this.shoutTimer = setTimeout(() => {
      this.shoutTimer = null;
      this.playShout();
      if (this.level >= 1) this.scheduleShout();
    }, delay);
  }

  private clearShout(): void {
    if (this.shoutTimer !== null) {
      clearTimeout(this.shoutTimer);
      this.shoutTimer = null;
    }
  }

  /** Two low, distant-sounding blips — not a synth recipe (samples.ts's SfxName set), just this ambience's own voice. */
  private playShout(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const delay of [0, 0.18]) {
      const freq = 160 + Math.random() * 60;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = SHOUT_LOWPASS_HZ;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(SHOUT_VOL, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.3);
      osc.connect(lowpass).connect(gain).connect(effectsOut(ctx));
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.35);
    }
  }
}

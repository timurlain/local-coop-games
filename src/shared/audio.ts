export type SfxName =
  | 'join' | 'search' | 'found' | 'hide' | 'trapSet' | 'fail'
  | 'bomb' | 'zap' | 'boing' | 'shot'
  | 'swing' | 'hit' | 'block' | 'door' | 'locked' | 'tick' | 'win' | 'draw';

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

const RECIPES: Record<SfxName, (c: AudioContext) => void> = {
  join: (c) => { tone(c, { freq: 440, dur: 0.08 }); tone(c, { freq: 660, dur: 0.1, delay: 0.08 }); },
  search: (c) => noise(c, { dur: 0.25, vol: 0.12, lowpass: 1200 }),
  found: (c) => { tone(c, { freq: 660, dur: 0.08 }); tone(c, { freq: 990, dur: 0.12, delay: 0.08 }); },
  hide: (c) => tone(c, { freq: 500, to: 300, dur: 0.12 }),
  trapSet: (c) => { tone(c, { freq: 300, dur: 0.05 }); tone(c, { freq: 300, dur: 0.05, delay: 0.1 }); },
  fail: (c) => tone(c, { freq: 150, dur: 0.15, type: 'sawtooth' }),
  bomb: (c) => { noise(c, { dur: 0.8, vol: 0.5, lowpass: 600 }); tone(c, { freq: 120, to: 40, dur: 0.6, type: 'sine', vol: 0.4 }); },
  zap: (c) => {
    for (let i = 0; i < 6; i++) tone(c, { freq: 800 + (i % 2) * 400, dur: 0.04, delay: i * 0.04, type: 'sawtooth', vol: 0.1 });
    noise(c, { dur: 0.3, vol: 0.1, lowpass: 4000 });
  },
  boing: (c) => tone(c, { freq: 200, to: 900, dur: 0.35, type: 'triangle', vol: 0.25 }),
  shot: (c) => noise(c, { dur: 0.2, vol: 0.5, lowpass: 3000 }),
  swing: (c) => noise(c, { dur: 0.08, vol: 0.1, lowpass: 2500 }),
  hit: (c) => tone(c, { freq: 180, to: 90, dur: 0.1, vol: 0.3 }),
  block: (c) => tone(c, { freq: 1200, dur: 0.05, type: 'triangle', vol: 0.15 }),
  door: (c) => tone(c, { freq: 220, to: 180, dur: 0.08, type: 'triangle', vol: 0.12 }),
  locked: (c) => { tone(c, { freq: 200, dur: 0.08 }); tone(c, { freq: 160, dur: 0.12, delay: 0.1 }); },
  tick: (c) => tone(c, { freq: 1500, dur: 0.03, vol: 0.08 }),
  win: (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, dur: 0.18, delay: i * 0.15, vol: 0.2 })),
  draw: (c) => [392, 330, 262].forEach((f, i) => tone(c, { freq: f, dur: 0.25, delay: i * 0.2, vol: 0.2 })),
};

/** Synthesized sound effects. Call `unlock()` from a user gesture (browser autoplay policy). */
export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    if (this.ctx === null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return; // no audio support: play() stays silent
      }
    }
    void this.ctx.resume();
  }

  play(name: SfxName): void {
    if (this.muted || this.ctx === null) return;
    RECIPES[name](this.ctx);
  }
}

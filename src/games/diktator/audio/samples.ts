// Recorded sounds (Kenney CC0) played through the shared AudioContext. Lazy: decoded after the first user gesture.

import zoguStep1 from '../assets/sounds/zogu-step-1.mp3';
import zoguStep2 from '../assets/sounds/zogu-step-2.mp3';
import zoguStep3 from '../assets/sounds/zogu-step-3.mp3';
import vlcekStep1 from '../assets/sounds/vlcek-step-1.mp3';
import vlcekStep2 from '../assets/sounds/vlcek-step-2.mp3';
import vlcekStep3 from '../assets/sounds/vlcek-step-3.mp3';
import zoguDoor from '../assets/sounds/zogu-door.mp3';
import vlcekDoor from '../assets/sounds/vlcek-door.mp3';
import zoguBump from '../assets/sounds/zogu-bump.mp3';
import vlcekBump from '../assets/sounds/vlcek-bump.mp3';
import coinsSound from '../assets/sounds/coins.mp3';
import pageSound from '../assets/sounds/page.mp3';

export type SampleName =
  | 'zogu-step-1' | 'zogu-step-2' | 'zogu-step-3' | 'vlcek-step-1' | 'vlcek-step-2' | 'vlcek-step-3'
  | 'zogu-door' | 'vlcek-door' | 'zogu-bump' | 'vlcek-bump' | 'coins' | 'page';

const URLS: Readonly<Record<SampleName, string>> = {
  'zogu-step-1': zoguStep1,
  'zogu-step-2': zoguStep2,
  'zogu-step-3': zoguStep3,
  'vlcek-step-1': vlcekStep1,
  'vlcek-step-2': vlcekStep2,
  'vlcek-step-3': vlcekStep3,
  'zogu-door': zoguDoor,
  'vlcek-door': vlcekDoor,
  'zogu-bump': zoguBump,
  'vlcek-bump': vlcekBump,
  coins: coinsSound,
  page: pageSound,
};

export interface SampleHit {
  readonly sample: SampleName;
  readonly delay: number;
  readonly rate: number;
  readonly gain: number;
}

/** Decodes a sound file URL; data: URLs (the artifact build inlines them) are decoded without fetch. */
async function bytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(url)).arrayBuffer();
}

export class Samples {
  private buffers = new Map<SampleName, AudioBuffer>();
  private loading = false;
  muted = false;

  constructor(private readonly ctx: () => AudioContext | null) {}

  /** Start decoding (call after a user gesture unlocked audio); failures leave the synth fallback in place. */
  load(): void {
    if (this.loading) return;
    const c = this.ctx();
    if (!c) return;
    this.loading = true;
    for (const name of Object.keys(URLS) as SampleName[]) {
      bytes(URLS[name])
        .then((buf) => c.decodeAudioData(buf))
        .then((decoded) => { this.buffers.set(name, decoded); })
        .catch(() => {
          // keep the synth fallback for this sample
        });
    }
  }

  /** Plays all hits; false (nothing played) if any sample is not decoded yet — the caller then uses the synth. */
  play(hits: readonly SampleHit[]): boolean {
    const c = this.ctx();
    if (this.muted || !c) return false;
    if (hits.some((h) => !this.buffers.has(h.sample))) return false;
    for (const h of hits) {
      const source = c.createBufferSource();
      source.buffer = this.buffers.get(h.sample)!;
      source.playbackRate.value = h.rate;
      const gain = c.createGain();
      gain.gain.value = h.gain;
      source.connect(gain).connect(c.destination);
      source.start(c.currentTime + h.delay);
    }
    return true;
  }
}
